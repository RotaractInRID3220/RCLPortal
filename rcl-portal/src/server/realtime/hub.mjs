// One Postgres LISTEN connection per web server process, fanned out to every open browser stream.
// Browsers connect with EventSource (server-sent events); a setting change reaches them in milliseconds.
import pg from 'pg'

const state = (globalThis.__rclHub ??= { subs: new Set(), client: null, starting: null })

async function connect() {
  const url = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL
  const client = new pg.Client({ connectionString: url })
  client.on('notification', (msg) => { for (const fn of state.subs) { try { fn(msg.channel, msg.payload) } catch { /* a dead stream must not stop the others */ } } })
  const drop = () => { if (state.client === client) { state.client = null; state.starting = null; if (state.subs.size) setTimeout(() => ensure().catch(() => {}), 1000) } }
  client.on('error', drop); client.on('end', drop)
  await client.connect()
  await client.query('LISTEN rcl_settings')
  await client.query('LISTEN rcl_announce')
  state.client = client
}

function ensure() {
  if (state.client) return Promise.resolve()
  return (state.starting ??= connect().catch((e) => { state.starting = null; throw e }))
}

/** Subscribe to (channel, payload) notifications. Returns an unsubscribe function. */
export async function subscribe(fn) {
  state.subs.add(fn)
  try { await ensure() } catch { /* clients fall back to polling; we retry on the next subscriber */ }
  return () => {
    state.subs.delete(fn)
    if (!state.subs.size && state.client) { const c = state.client; state.client = null; state.starting = null; c.end().catch(() => {}) }
  }
}
