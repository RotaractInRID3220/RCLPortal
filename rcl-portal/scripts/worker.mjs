#!/usr/bin/env node
// Background worker (own container/process, DIRECT database connection):
//   * RMIS change feed sync          every `worker.rmis_changes_interval_s` seconds (setting, default 90, 30..600)
//   * RMIS clubs sync                 hourly (+ once shortly after start)
//   * leaderboard snapshot rebuild    on NOTIFY rcl_changed (short debounce), plus a 10 s fallback poll
//                                     and a forced re-verification every 60 s
// Every job is also exported as a runOnce function (used by tests and by one-off runs).
// Usage: node scripts/worker.mjs
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { loadEnv } from './load-env.mjs'

loadEnv()

const { getSetting } = await import('../src/server/settings.mjs')
const { syncChangesOnce, syncClubs } = await import('../src/server/rmis/mirror.mjs')
const { rebuildLeaderboard } = await import('../src/server/leaderboard/service.mjs')
const { runDeadlineReminders } = await import('../src/server/announcements/service.mjs')

const log = (...a) => console.log(new Date().toISOString(), '[worker]', ...a)
const rmisConfigured = () => Boolean(process.env.RMIS_API_URL && process.env.RMIS_API_KEY)

export const DEFAULTS = { rmisIntervalS: 90, clubsIntervalMs: 3_600_000, pollMs: 10_000, verifyMs: 60_000, debounceMs: 300 }

// ---- runOnce jobs ---------------------------------------------------------------------------
export async function runRmisChangesOnce() {
  if (!rmisConfigured()) return { skipped: 'rmis_not_configured' }
  return syncChangesOnce()
}
export async function runClubsSyncOnce() {
  if (!rmisConfigured()) return { skipped: 'rmis_not_configured' }
  return syncClubs()
}
/** Rebuild the leaderboard snapshots if stale (counter moved / older than maxAge); `force` always rebuilds. */
export const runRemindersOnce = () => runDeadlineReminders()
export const runSnapshotsOnce = (opts = {}) => rebuildLeaderboard(opts)

export async function rmisIntervalMs() {
  const v = Number(await getSetting('worker.rmis_changes_interval_s'))
  const s = Number.isFinite(v) && v > 0 ? Math.min(600, Math.max(30, v)) : DEFAULTS.rmisIntervalS
  return s * 1000
}

// ---- scheduler ------------------------------------------------------------------------------
/** A job that never overlaps itself and never throws. */
function guarded(name, fn) {
  let running = false
  return async (...args) => {
    if (running) return
    running = true
    try {
      const r = await fn(...args)
      if (r && (r.built || r.seen || r.clubs || r.playersChanged)) log(name, JSON.stringify(r).slice(0, 300))
    } catch (err) {
      log(`${name} failed:`, err.message)
    } finally {
      running = false
    }
  }
}

export async function startWorker() {
  const timers = []
  let stopped = false
  let listener = null

  const snapshots = guarded('snapshots', () => runSnapshotsOnce({ maxAge: DEFAULTS.verifyMs }))
  const rmisChanges = guarded('rmis-changes', runRmisChangesOnce)
  const clubs = guarded('rmis-clubs', runClubsSyncOnce)
  const reminders = guarded('deadline-reminders', runRemindersOnce)

  // self-rescheduling so the interval setting is re-read every round
  const loopRmis = async () => {
    if (stopped) return
    await rmisChanges()
    timers.push(setTimeout(loopRmis, await rmisIntervalMs().catch(() => DEFAULTS.rmisIntervalS * 1000)))
  }

  // LISTEN on a dedicated direct connection, reconnecting with backoff
  let debounce = null
  const connectListener = async (attempt = 0) => {
    if (stopped) return
    const client = new pg.Client({ connectionString: process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL })
    client.on('error', (e) => log('listener error:', e.message))
    client.on('notification', () => {
      clearTimeout(debounce)
      debounce = setTimeout(snapshots, DEFAULTS.debounceMs)
    })
    client.on('end', () => {
      if (!stopped) setTimeout(() => connectListener(Math.min(attempt + 1, 6)), 1000 * 2 ** attempt)
    })
    try {
      await client.connect()
      await client.query('LISTEN rcl_changed')
      listener = client
      log('listening on rcl_changed')
      snapshots() // catch up with anything that changed while we were disconnected
    } catch (e) {
      log('listener connect failed:', e.message)
      client.removeAllListeners('end')
      try { await client.end() } catch { /* ignore */ }
      if (!stopped) setTimeout(() => connectListener(Math.min(attempt + 1, 6)), 1000 * 2 ** attempt)
    }
  }

  await snapshots({}) // first build before anything else
  timers.push(setInterval(snapshots, DEFAULTS.pollMs))
  timers.push(setInterval(guarded('snapshots-verify', () => runSnapshotsOnce({ force: true })), DEFAULTS.verifyMs))
  timers.push(setInterval(clubs, DEFAULTS.clubsIntervalMs))
  timers.push(setInterval(reminders, 60_000))
  reminders()
  timers.push(setTimeout(clubs, 5_000))
  timers.push(setTimeout(loopRmis, 2_000))
  connectListener()
  log('started')

  return async function stop() {
    stopped = true
    clearTimeout(debounce)
    timers.forEach((t) => { clearTimeout(t); clearInterval(t) })
    if (listener) { listener.removeAllListeners('end'); try { await listener.end() } catch { /* ignore */ } }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const stop = await startWorker()
  const quit = async (sig) => {
    log(`${sig}, stopping`)
    await stop()
    const { closePool } = await import('../src/server/db.mjs')
    await closePool()
    process.exit(0)
  }
  process.on('SIGTERM', () => quit('SIGTERM'))
  process.on('SIGINT', () => quit('SIGINT'))
}
