import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normaliseStatus, isGeneral, normaliseNic, validateRiNumber, memberEligibility, eventGenderOk, categoryOk, windowStatus, capacityCheck } from '../src/server/registration/eligibility.mjs'

const CUT = '2026-12-01T00:00:00.000Z'
const m = (o = {}) => ({ status: 1, gender: 'F', created_at: '2026-06-23T10:00:00.000Z', ...o })

test('status normalisation: active+transferred are general, prospective stays, others rejected', () => {
  assert.equal(normaliseStatus(1), 1)
  assert.equal(normaliseStatus(3), 1)
  assert.equal(normaliseStatus(5), 5)
  for (const s of [2, 4, 0, 6, null, undefined]) assert.equal(normaliseStatus(s), null)
  assert.equal(isGeneral(1), true)
  assert.equal(isGeneral(5), false)
})

test('NIC normalisation: trim, upper-case, no inner spaces, empty -> null', () => {
  assert.equal(normaliseNic(' 912345678v '), '912345678V')
  assert.equal(normaliseNic('2000 1234 5678'), '200012345678')
  assert.equal(normaliseNic(''), null)
  assert.equal(normaliseNic(null), null)
})

test('RI number: required for general, trimmed, sane length', () => {
  assert.equal(validateRiNumber('').ok, false)
  assert.equal(validateRiNumber('   ').code, 'ri_number_required')
  assert.equal(validateRiNumber(undefined).ok, false)
  assert.deepEqual(validateRiNumber(' 12345 '), { ok: true, value: '12345' })
  assert.equal(validateRiNumber('x'.repeat(31)).code, 'ri_number_invalid')
})

test('member eligibility: all of active (1), transferred (3) and prospective (5) may register', () => {
  for (const s of [1, 3, 5]) assert.equal(memberEligibility(m({ status: s }), { cutoff: CUT }).ok, true, `status ${s}`)
  for (const s of [2, 4]) assert.equal(memberEligibility(m({ status: s }), { cutoff: CUT }).code, 'member_not_active')
})

test('member eligibility: gender must be M or F', () => {
  assert.equal(memberEligibility(m({ gender: 'O' }), { cutoff: CUT }).code, 'gender_not_registrable')
  assert.equal(memberEligibility(m({ gender: null }), { cutoff: CUT }).code, 'gender_not_registrable')
})

test('member eligibility: cutoff is inclusive, joined-after is rejected, unset/garbage fails closed', () => {
  assert.equal(memberEligibility(m({ created_at: CUT }), { cutoff: CUT }).ok, true)
  assert.equal(memberEligibility(m({ created_at: '2026-12-01T00:00:00.001Z' }), { cutoff: CUT }).code, 'joined_after_cutoff')
  assert.equal(memberEligibility(m(), { cutoff: undefined }).code, 'cutoff_not_set')
  assert.equal(memberEligibility(m(), { cutoff: 'soon' }).code, 'cutoff_not_set')
})

test('event gender: male/female restrict, mixed allows both, unknown vocabulary is refused', () => {
  assert.equal(eventGenderOk('male', 'M'), true)
  assert.equal(eventGenderOk('male', 'F'), false)
  assert.equal(eventGenderOk('female', 'F'), true)
  assert.equal(eventGenderOk('female', 'M'), false)
  assert.equal(eventGenderOk('mixed', 'M'), true)
  assert.equal(eventGenderOk('mixed', 'F'), true)
  assert.equal(eventGenderOk('boys', 'M'), false)
})

test('category: community clubs enter community events only, institute likewise', () => {
  assert.equal(categoryOk('community', 'community'), true)
  assert.equal(categoryOk('community', 'institute'), false)
})

test('window: unset or future open = closed; per-event close; no close = no deadline', () => {
  const now = new Date('2026-12-05T12:00:00Z')
  assert.equal(windowStatus({ openAt: undefined, now }).code, 'registration_not_open')
  assert.equal(windowStatus({ openAt: 'garbage', now }).code, 'registration_not_open')
  assert.equal(windowStatus({ openAt: '2026-12-06T00:00:00Z', now }).code, 'registration_not_open')
  assert.equal(windowStatus({ openAt: '2026-12-01T00:00:00Z', now }).open, true)
  assert.equal(windowStatus({ openAt: '2026-12-01T00:00:00Z', eventClose: '2026-12-05T12:00:00Z', now }).code, 'registration_closed') // closes AT the instant
  assert.equal(windowStatus({ openAt: '2026-12-01T00:00:00Z', eventClose: '2026-12-05T12:00:01Z', now }).open, true)
  assert.equal(windowStatus({ openAt: '2026-12-01T00:00:00Z', eventClose: null, now }).open, true)
})

test('capacity: main and reserve counted separately, boundaries exact', () => {
  const ev = { max_count: 10, reserve_count: 2 }
  assert.equal(capacityCheck({ event: ev, counts: { main: 9, reserve: 0 }, mainPlayer: true }).ok, true)
  assert.equal(capacityCheck({ event: ev, counts: { main: 10, reserve: 0 }, mainPlayer: true }).code, 'main_full')
  assert.equal(capacityCheck({ event: ev, counts: { main: 10, reserve: 1 }, mainPlayer: false }).ok, true)
  assert.equal(capacityCheck({ event: ev, counts: { main: 0, reserve: 2 }, mainPlayer: false }).code, 'reserve_full')
})

test('capacity: no reserve_count means no reserves; no max_count means not configured', () => {
  assert.equal(capacityCheck({ event: { max_count: 5, reserve_count: null }, counts: { main: 0, reserve: 0 }, mainPlayer: false }).code, 'reserve_full')
  assert.equal(capacityCheck({ event: { max_count: null, reserve_count: 2 }, counts: { main: 0, reserve: 0 }, mainPlayer: true }).code, 'event_not_configured')
})

test('transfers: must be finalised on or before the cutoff; unknown transfer info fails closed for status 3', () => {
  const t = (o) => memberEligibility(m({ status: 3, transfer_info: true, ...o }), { cutoff: CUT })
  assert.equal(t({ transfer_completed_at: '2026-11-30T23:59:59.000Z' }).ok, true)
  assert.equal(t({ transfer_completed_at: CUT }).ok, true)                                   // exactly at the cutoff is fine
  assert.equal(t({ transfer_completed_at: '2026-12-01T00:00:01.000Z' }).code, 'transfer_after_cutoff')
  assert.equal(t({ transfer_completed_at: null }).ok, true)                                  // legacy transferred member, field present
  assert.equal(t({ transfer_completed_at: null, transfer_info: false }).code, 'transfer_info_unavailable')
  // an active member who once transferred late is also refused
  assert.equal(memberEligibility(m({ status: 1, transfer_completed_at: '2027-01-01T00:00:00.000Z' }), { cutoff: CUT }).code, 'transfer_after_cutoff')
  // active member without transfer info is unaffected
  assert.equal(memberEligibility(m({ status: 1, transfer_info: false }), { cutoff: CUT }).ok, true)
})
