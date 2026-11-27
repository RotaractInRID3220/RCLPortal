import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnv } from '../scripts/load-env.mjs'
loadEnv()
const { query, closePool } = await import('../src/server/db.mjs')
const { getSetting, setSetting } = await import('../src/server/settings.mjs')
const { subscribe } = await import('../src/server/realtime/hub.mjs')

const saved = await getSetting('checkin.open')
after(async () => {
  if (saved === undefined) await query("DELETE FROM settings WHERE key = 'checkin.open'"); else await setSetting('checkin.open', saved)
  await closePool()
})
const waitFor = async (pred, ms = 2000) => { const t = Date.now(); while (Date.now() - t < ms) { if (pred()) return true; await new Promise((r) => setTimeout(r, 10)) } return false }

test('a settings change is pushed to every subscriber within a moment, and unsubscribed ones hear nothing', async () => {
  const a = [], b = []
  const offA = await subscribe((ch, key) => a.push([ch, key]))
  const offB = await subscribe((ch, key) => b.push([ch, key]))
  await setSetting('checkin.open', true)
  assert.ok(await waitFor(() => a.length >= 1 && b.length >= 1), 'both subscribers notified')
  assert.deepEqual(a[0], ['rcl_settings', 'checkin.open'])
  await offB()
  const seenByB = b.length
  await setSetting('checkin.open', false)
  assert.ok(await waitFor(() => a.length >= 2))
  assert.equal(b.length, seenByB)
  await offA()
})
