import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { ok, readJson } from '@/server/http.mjs'
import { markRead } from '@/server/announcements/service.mjs'

// Mark some (ids) or all of the current user's announcements as read.
export async function POST(request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response
  const body = await readJson(request, z.object({ ids: z.array(z.coerce.number().int().positive()).max(200).optional() }))
  if (!body.ok) return body.response
  return ok(await markRead(auth.user.member_id, body.data.ids ?? null))
}
