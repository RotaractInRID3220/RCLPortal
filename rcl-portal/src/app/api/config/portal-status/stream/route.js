import { requireUser } from '@/server/auth/guards'
import { subscribe } from '@/server/realtime/hub.mjs'
import { query } from '@/server/db.mjs'

export const dynamic = 'force-dynamic'

const read = async () => {
  const { rows } = await query("SELECT key, value, updated_at FROM settings WHERE key IN ('checkin.open', 'checkin.current_day')")
  const m = Object.fromEntries(rows.map((r) => [r.key, r]))
  return { isOpen: m['checkin.open']?.value === true, currentDay: m['checkin.current_day']?.value ?? null, updatedAt: m['checkin.open']?.updated_at ?? null }
}

// Server-sent events: the current check-in state immediately, then again the moment it changes.
// Admin only (the scanner pages). A heartbeat every 20 s keeps proxies from closing the stream.
export async function GET(request) {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const enc = new TextEncoder()
  let unsub = null, timer = null, closed = false
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event, data) => { if (!closed) controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) }
      const push = async () => { try { send('status', await read()) } catch { /* next change or heartbeat retries */ } }
      const close = () => { if (closed) return; closed = true; clearInterval(timer); unsub?.(); try { controller.close() } catch { /* already closed */ } }
      request.signal.addEventListener('abort', close)
      controller.enqueue(enc.encode('retry: 3000\n\n'))
      await push()
      unsub = await subscribe((channel, key) => { if (channel === 'rcl_settings' && (key === 'checkin.open' || key === 'checkin.current_day')) push() })
      if (closed) unsub?.()
      timer = setInterval(() => { if (!closed) controller.enqueue(enc.encode(': ping\n\n')) }, 20000)
    },
    cancel() { closed = true; clearInterval(timer); unsub?.() },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } })
}
