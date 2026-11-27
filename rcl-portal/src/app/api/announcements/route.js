import { requireUser } from '@/server/auth/guards'
import { ok } from '@/server/http.mjs'
import { listForUser, maybeRunDeadlineReminders } from '@/server/announcements/service.mjs'

// Everyone with portal or admin access sees the same list; `read` is per user. Never cached.
export async function GET(request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  maybeRunDeadlineReminders()                 // keeps reminders going even if the worker is down (throttled)
  // the sender's name is only for the admin portal (`?names=1`, admins only); the portal shows "By Admin" / "By RDSC"
  const withNames = Boolean(auth.user.hasAdminAccess) && new URL(request.url).searchParams.get('names') === '1'
  const r = await listForUser(auth.user.member_id, { withNames })
  return Response.json({ success: true, data: r.items, unread: r.unread }, { headers: { 'Cache-Control': 'no-store' } })
}
