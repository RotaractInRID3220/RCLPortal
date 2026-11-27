import { test } from 'node:test'
import assert from 'node:assert/strict'
import { penaltyFor, sharePercent, penaltyTarget } from '../src/server/penalties/rules.mjs'

const TIERS = [{ lt: 62, points: -80 }, { lt: 67, points: -50 }, { lt: 70, points: -25 }]
const pen = (general, total, o = {}) => penaltyFor({ general, total, tiers: o.tiers ?? TIERS, minPlayers: o.minPlayers ?? 5 })

test('tiers: the lowest threshold the share is below applies; at/above the top threshold nothing', () => {
  assert.equal(pen(70, 100), 0)      // exactly 70% -> no penalty
  assert.equal(pen(69, 100), -25)
  assert.equal(pen(67, 100), -25)    // exactly 67% is NOT below 67
  assert.equal(pen(66, 100), -50)
  assert.equal(pen(62, 100), -50)    // exactly 62% is NOT below 62
  assert.equal(pen(61, 100), -80)
  assert.equal(pen(0, 10), -80)
  assert.equal(pen(10, 10), 0)
})

test('exact boundaries on small clubs (no floating-point surprises)', () => {
  // 70% exactly is safe whatever the club size
  for (const [g, t] of [[7, 10], [14, 20], [21, 30], [35, 50], [49, 70]]) assert.equal(pen(g, t), 0, `${g}/${t}`)
  assert.equal(pen(6, 10), -80)   // 60%  < 62
  assert.equal(pen(13, 20), -50)  // 65%  between 62 and 67
  assert.equal(pen(20, 30), -50)  // 66.67% is below 67, so -50 (not -25)
  assert.equal(pen(2, 3, { minPlayers: 1 }), -50) // 66.67% again
  assert.equal(pen(21, 31), -25)  // 67.74% is at/above 67 but below 70
  assert.equal(pen(31, 50), -50)  // exactly 62.0% is NOT below 62, so it is the next tier
}, { todo: false })

test('minimum players: smaller clubs are never penalised; the minimum itself is included', () => {
  assert.equal(pen(0, 4), 0)
  assert.equal(pen(0, 5), -80)
  assert.equal(pen(1, 4, { minPlayers: 4 }), -80)
  assert.equal(pen(0, 0), 0)
  assert.equal(pen(0, 3, { minPlayers: 0 }), -80)
})

test('tiers are configuration: order in the list does not matter; custom tiers work; empty tiers = no penalty', () => {
  const shuffled = [TIERS[2], TIERS[0], TIERS[1]]
  for (const g of [0, 50, 61, 62, 66, 67, 69, 70, 100]) assert.equal(pen(g, 100, { tiers: shuffled }), pen(g, 100))
  assert.equal(pen(50, 100, { tiers: [{ lt: 60, points: -10 }] }), -10)
  assert.equal(pen(60, 100, { tiers: [{ lt: 60, points: -10 }] }), 0)
  assert.equal(pen(1, 100, { tiers: [] }), 0)
  assert.equal(pen(62, 100, { tiers: [{ lt: 62.5, points: -7 }] }), -7)   // fractional thresholds
  assert.equal(pen(5, 8, { tiers: [{ lt: 62.5, points: -7 }] }), 0)       // 5/8 = 62.5% exactly
})

test('bad input never throws or penalises', () => {
  assert.equal(penaltyFor({ general: NaN, total: 10, tiers: TIERS, minPlayers: 5 }), 0)
  assert.equal(penaltyFor({ general: 1, total: -3, tiers: TIERS, minPlayers: 5 }), 0)
})

test('share and target helpers', () => {
  assert.equal(sharePercent(7, 10), 70)
  assert.equal(sharePercent(0, 0), 0)
  assert.equal(penaltyTarget(TIERS), 70)
  assert.equal(penaltyTarget([]), null)
})
