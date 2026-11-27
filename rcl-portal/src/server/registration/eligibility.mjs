// Registration rules as pure functions (no database, no clock of their own), so every rule can be
// unit-tested. The service layer feeds them data read inside a transaction.

/** RMIS status -> RCL status. 1 active and 3 transferred are "general" (1); 5 prospective stays 5. */
export function normaliseStatus(raw) {
  if (raw === 1 || raw === 3) return 1
  if (raw === 5) return 5
  return null // 2 inactive, 4 terminated, anything else: not registrable
}

export const isGeneral = (normalisedStatus) => normalisedStatus === 1

/** NICs are stored trimmed and upper-case so exact-match lookups are reliable. */
export function normaliseNic(nic) {
  const v = String(nic ?? '').trim().toUpperCase().replace(/\s+/g, '')
  return v === '' ? null : v
}

/** Typed by the club for general members. Format is not enforced beyond sanity (unknown RI formats). */
export function validateRiNumber(value) {
  const v = String(value ?? '').trim()
  if (!v) return { ok: false, code: 'ri_number_required', message: 'An RI number is required for general members.' }
  if (v.length > 30) return { ok: false, code: 'ri_number_invalid', message: 'The RI number is too long.' }
  return { ok: true, value: v }
}

/** Map an rmis_members row to what memberEligibility needs. */
export const eligibilityInput = (m) => ({
  status: m.status, gender: m.gender,
  created_at: m.created_at instanceof Date ? m.created_at.toISOString() : m.created_at,
  transfer_completed_at: m.transfer_completed_at instanceof Date ? m.transfer_completed_at.toISOString() : (m.transfer_completed_at ?? null),
  transfer_info: m.transfer_info,
})

/**
 * Can this RMIS member be registered at all?
 * `member`: { status, gender, created_at, transfer_completed_at?, transfer_info? } from the RMIS mirror.
 * `cutoff`: ISO string or undefined. An unset cutoff fails closed.
 *
 * Transfers: a member whose transfer was completed AFTER the cutoff is not registrable (whatever
 * their status is now). `transfer_completed_at` null = no transfer record (including RMIS-1 legacy
 * transferred members): the creation-date rule alone applies. If RMIS did not send transfer
 * information at all (`transfer_info === false`) a transferred member (status 3) is refused,
 * because we cannot prove the transfer was finalised in time.
 */
export function memberEligibility(member, { cutoff }) {
  if (normaliseStatus(member.status) === null) {
    return { ok: false, code: 'member_not_active', message: 'Only active, transferred or prospective members can be registered.' }
  }
  if (member.gender !== 'M' && member.gender !== 'F') {
    return { ok: false, code: 'gender_not_registrable', message: 'Only members recorded as male or female can be registered.' }
  }
  if (!cutoff || !Number.isFinite(Date.parse(cutoff))) {
    return { ok: false, code: 'cutoff_not_set', message: 'The membership cutoff date has not been set yet.' }
  }
  if (Date.parse(member.created_at) > Date.parse(cutoff)) {
    return { ok: false, code: 'joined_after_cutoff', message: 'This member joined after the membership cutoff.' }
  }
  if (member.transfer_completed_at) {
    if (Date.parse(member.transfer_completed_at) > Date.parse(cutoff)) {
      return { ok: false, code: 'transfer_after_cutoff', message: 'This member\'s transfer was completed after the membership cutoff.' }
    }
  } else if (member.status === 3 && member.transfer_info === false) {
    return { ok: false, code: 'transfer_info_unavailable', message: 'RMIS has not provided the transfer details for this member yet, so the transfer date cannot be checked.' }
  }
  return { ok: true }
}

export function eventGenderOk(genderType, memberGender) {
  if (genderType === 'mixed') return true
  if (genderType === 'male') return memberGender === 'M'
  if (genderType === 'female') return memberGender === 'F'
  return false
}

export const categoryOk = (clubCategory, eventCategory) => clubCategory === eventCategory

/**
 * Registration window. The global open time must be set and passed (unset = closed). The deadline is
 * the sport's own close time if it has one, else the generic `registration.close_at`; with neither set
 * there is no deadline.
 */
export function windowStatus({ openAt, eventClose, closeAt, now = new Date() }) {
  const effectiveClose = eventClose ?? closeAt // a sport's own deadline wins; otherwise the generic one
  const t = now.getTime()
  if (!openAt || !Number.isFinite(Date.parse(openAt))) {
    return { open: false, code: 'registration_not_open', message: 'Registration has not been opened yet.' }
  }
  if (Date.parse(openAt) > t) return { open: false, code: 'registration_not_open', message: 'Registration has not opened yet.' }
  if (effectiveClose && Date.parse(effectiveClose) <= t) {
    return { open: false, code: 'registration_closed', message: 'Registration for this sport has closed.' }
  }
  return { open: true }
}

/**
 * Capacity per club per sport. `counts`: { main, reserve } already registered by this club.
 * max_count caps main players, reserve_count caps reserves (NULL reserves = none allowed).
 * A missing max_count means the event is not configured: nobody can register (fail closed).
 */
export function capacityCheck({ event, counts, mainPlayer }) {
  if (event.max_count == null) {
    return { ok: false, code: 'event_not_configured', message: 'This sport has no player limit configured yet.' }
  }
  if (mainPlayer) {
    return counts.main >= event.max_count
      ? { ok: false, code: 'main_full', message: `This club already has the maximum of ${event.max_count} main players for this sport.` }
      : { ok: true }
  }
  const reserves = event.reserve_count ?? 0
  return counts.reserve >= reserves
    ? { ok: false, code: 'reserve_full', message: reserves === 0 ? 'This sport allows no reserve players.' : `This club already has the maximum of ${reserves} reserve players for this sport.` }
    : { ok: true }
}
