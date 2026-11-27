import { requireUser } from '@/server/auth/guards'
import { subscribe } from '@/server/realtime/hub.mjs'

export const dynamic = 'force-dynamic'

// Server-sent events: a `changed` event the moment an announcement is created or retracted, so every
// open portal/admin page refreshes at once. The page falls back to polling if the stream is unavailable.
export async function GET(request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const enc = new TextEncoder()
  let unsub = null, timer = null, closed = false
  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk) => { if (!closed) controller.enqueue(enc.encode(chunk)) }
      const close = () => { if (closed) return; closed = true; clearInterval(timer); unsub?.(); try { controller.close() } catch { /* already closed */ } }
      request.signal.addEventListener('abort', close)
      send('retry: 3000\n\n')
      send('event: ready\ndata: {}\n\n')
      unsub = await subscribe((channel, id) => { if (channel === 'rcl_announce') send(`event: changed\ndata: ${JSON.stringify({ id })}\n\n`) })
      if (closed) unsub?.()
      timer = setInterval(() => send(': ping\n\n'), 20000)
    },
    cancel() { closed = true; clearInterval(timer); unsub?.() },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } })
}
