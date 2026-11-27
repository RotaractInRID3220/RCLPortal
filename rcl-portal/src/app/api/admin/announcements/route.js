import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fromResult, ok, parseQuery, readJson } from '@/server/http.mjs'
import { createAnnouncement, listForAdmin, retractAnnouncement } from '@/server/announcements/service.mjs'

// Admin side of announcements: history with read counts (any admin), send and retract (super admin).
export async function GET() {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  const r = await listForAdmin()
  return ok(r.items, { audience: r.audience })
}

export async function POST(request) {
  const auth = await requireUser({ admin: true, permission: 'super_admin' })
  if (!auth.ok) return auth.response
  const body = await readJson(request, z.object({ title: z.string().max(150), body: z.string().max(2000).optional(), expires_at: z.string().datetime({ offset: true }).nullish() }))
  if (!body.ok) return body.response
  return fromResult(await createAnnouncement({ actor: auth.user, title: body.data.title, body: body.data.body ?? '', expiresAt: body.data.expires_at ?? null }), (r) => ok({ id: r.announcement.id }, { message: 'Announcement sent to everyone with portal access.' }))
}

export async function DELETE(request) {
  const auth = await requireUser({ admin: true, permission: 'super_admin' })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { id: z.coerce.number().int().positive() })
  if (!q.ok) return q.response
  return fromResult(await retractAnnouncement({ actor: auth.user, id: q.data.id }), () => ok({ retracted: true }))
}
