import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkRegistrationLimits, checkMove, validateLimitRules, defaultLimitGroup } from '../src/server/rules/limits.mjs'

const RULES = { standard: { per: 'day', max: 1 }, track: { per: 'total', max: 3 }, swimming: { per: 'total', max: 3 } }
const ev = (sport_id, sport_day, limit_group) => ({ sport_id, sport_day, limit_group })
const check = (existing, candidate, rules = RULES, ignoreSportIds) => checkRegistrationLimits({ existing, candidate, rules, ignoreSportIds })

test('standard events: 1 per day, another day is fine', () => {
  assert.equal(check([], ev(1, 'D-01', 'standard')).ok, true)
  const r = check([ev(1, 'D-01', 'standard')], ev(2, 'D-01', 'standard'))
  assert.equal(r.ok, false)
  assert.equal(r.code, 'limit_reached')
  assert.equal(r.per, 'day')
  assert.equal(check([ev(1, 'D-01', 'standard')], ev(2, 'D-02', 'standard')).ok, true)
  assert.equal(check([ev(1, 'D-01', 'standard'), ev(2, 'D-02', 'standard')], ev(3, 'D-03', 'standard')).ok, true)
})

test('track group: 3 in total across individual and team, 4th is blocked', () => {
  const three = [ev(10, 'D-03', 'track'), ev(11, 'D-03', 'track'), ev(12, 'D-03', 'track')]
  assert.equal(check(three.slice(0, 2), ev(12, 'D-03', 'track')).ok, true)
  const r = check(three, ev(13, 'D-03', 'track'))
  assert.equal(r.ok, false)
  assert.deepEqual([r.code, r.group, r.per, r.max], ['limit_reached', 'track', 'total', 3])
})

test('swimming is a separate 3, independent of track and standard', () => {
  const existing = [ev(10, 'D-03', 'track'), ev(11, 'D-03', 'track'), ev(12, 'D-03', 'track'), ev(1, 'D-01', 'standard')]
  assert.equal(check(existing, ev(20, 'D-04', 'swimming')).ok, true)
  const swims = [ev(20, 'D-04', 'swimming'), ev(21, 'D-04', 'swimming'), ev(22, 'D-04', 'swimming')]
  assert.equal(check([...existing, ...swims.slice(0, 2)], ev(22, 'D-04', 'swimming')).ok, true)
  const r = check([...existing, ...swims], ev(23, 'D-04', 'swimming'))
  assert.equal(r.ok, false)
  assert.equal(r.group, 'swimming')
})

test('athletics/swimming and normal sports cannot share a day, in either order', () => {
  const a = check([ev(10, 'D-01', 'track')], ev(1, 'D-01', 'standard'))
  assert.deepEqual([a.ok, a.code], [false, 'day_conflict'])
  const b = check([ev(1, 'D-01', 'standard')], ev(10, 'D-01', 'track'))
  assert.deepEqual([b.ok, b.code], [false, 'day_conflict'])
  assert.equal(check([ev(20, 'D-03', 'swimming')], ev(2, 'D-03', 'standard')).code, 'day_conflict')
  assert.equal(check([ev(2, 'D-03', 'standard')], ev(20, 'D-03', 'swimming')).code, 'day_conflict')
  // another day is fine, and several track events together are still fine
  assert.equal(check([ev(10, 'D-01', 'track')], ev(1, 'D-02', 'standard')).ok, true)
  assert.equal(check([ev(10, 'D-01', 'track')], ev(11, 'D-01', 'track')).ok, true)
  // the road race (own day) never clashes with a track day
  assert.equal(check([ev(10, 'D-01', 'track')], ev(50, 'D-05', 'standard')).ok, true)
})

test('road race on its own day (D-05) never conflicts with the other days', () => {
  const taken = [ev(1, 'D-01', 'standard'), ev(2, 'D-02', 'standard'), ev(3, 'D-03', 'standard'), ev(4, 'D-04', 'standard')]
  assert.equal(check(taken, ev(50, 'D-05', 'standard')).ok, true)
  // and a road-race entrant can still take one standard event on each other day
  assert.equal(check([ev(50, 'D-05', 'standard')], ev(1, 'D-03', 'standard')).ok, true)
})

test('duplicate registration is rejected before any limit', () => {
  const r = check([ev(1, 'D-01', 'standard')], ev(1, 'D-01', 'standard'))
  assert.equal(r.code, 'already_registered')
})

test('moving to another event: the one being given up is not counted', () => {
  const existing = [ev(1, 'D-01', 'standard')]
  assert.equal(check(existing, ev(2, 'D-01', 'standard')).ok, false)
  assert.equal(checkMove({ existing, giveUpSportId: 1, candidate: ev(2, 'D-01', 'standard'), rules: RULES }).ok, true)
  // swapping inside a full track group works only because one slot is released
  const full = [ev(10, 'D-03', 'track'), ev(11, 'D-03', 'track'), ev(12, 'D-03', 'track')]
  assert.equal(checkMove({ existing: full, giveUpSportId: 10, candidate: ev(13, 'D-03', 'track'), rules: RULES }).ok, true)
  assert.equal(checkMove({ existing: full, giveUpSportId: 99, candidate: ev(13, 'D-03', 'track'), rules: RULES }).ok, false)
})

test('limits are configuration, not code (swimming per day, standard max 2)', () => {
  const rules = { ...RULES, standard: { per: 'day', max: 2 }, swimming: { per: 'day', max: 1 } }
  assert.equal(check([ev(1, 'D-01', 'standard')], ev(2, 'D-01', 'standard'), rules).ok, true)
  assert.equal(check([ev(20, 'D-04', 'swimming')], ev(21, 'D-04', 'swimming'), rules).ok, false)
  assert.equal(check([ev(20, 'D-04', 'swimming')], ev(21, 'D-05', 'swimming'), rules).ok, true)
})

test('fails closed when rules are missing or invalid', () => {
  for (const bad of [undefined, null, {}, [], { standard: { per: 'week', max: 1 }, track: RULES.track, swimming: RULES.swimming }, { ...RULES, track: { per: 'total', max: -1 } }, { ...RULES, extra: RULES.track }]) {
    const r = checkRegistrationLimits({ existing: [], candidate: ev(1, 'D-01', 'standard'), rules: bad })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'limits_not_configured')
  }
})

test('validateLimitRules reports what is wrong', () => {
  assert.deepEqual(validateLimitRules(RULES), [])
  assert.ok(validateLimitRules({ standard: { per: 'day', max: 1.5 }, track: RULES.track, swimming: RULES.swimming }).length > 0)
  assert.ok(validateLimitRules('x').length > 0)
})

test('max 0 means the group is closed', () => {
  const rules = { ...RULES, swimming: { per: 'total', max: 0 } }
  assert.equal(check([], ev(20, 'D-04', 'swimming'), rules).ok, false)
})

test('default limit group from sport type (swimming is set explicitly by an admin)', () => {
  assert.equal(defaultLimitGroup('team'), 'standard')
  assert.equal(defaultLimitGroup('individual'), 'standard')
  assert.equal(defaultLimitGroup('trackIndividual'), 'track')
  assert.equal(defaultLimitGroup('trackTeam'), 'track')
})
