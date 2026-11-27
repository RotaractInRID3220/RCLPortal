import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fromResult, ok, parseQuery, readJson } from '@/server/http.mjs'
import { deleteEventDay, listEventDays, saveEventDay } from '@/server/settings/admin.mjs'

const guard = () => requireUser({ admin: true, permission: 'super_admin' })

export async function GET() {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  return ok(await listEventDays())
}

const daySchema = z.object({
  day_code: z.string().trim().regex(/^[A-Za-z0-9-]{1,10}$/, 'letters, digits and dashes only (max 10)'),
  label: z.string().trim().min(1).max(40),
  sort_order: z.number().int().min(1).max(99),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
})

export async function PUT(request) {
  const auth = await guard()
  if (!auth.ok) return auth.response
  const body = await readJson(request, daySchema)
  if (!body.ok) return body.response
  return fromResult(await saveEventDay({ actor: auth.user, day: body.data }), () => ok({ saved: true }))
}

export async function DELETE(request) {
  const auth = await guard()
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { day_code: z.string().min(1).max(10) })
  if (!q.ok) return q.response
  return fromResult(await deleteEventDay({ actor: auth.user, dayCode: q.data.day_code }), () => ok({ deleted: true }))
}
