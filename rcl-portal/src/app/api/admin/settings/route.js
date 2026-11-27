import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fromResult, ok, parseQuery, readJson } from '@/server/http.mjs'
import { clearSetting, listSettingsForAdmin, updateSetting } from '@/server/settings/admin.mjs'

// Super-admin only: dates, fees, points, penalty tiers, limits, check-in switches.
const guard = () => requireUser({ admin: true, permission: 'super_admin' })

export async function GET() {
  const auth = await guard()
  if (!auth.ok) return auth.response
  return ok(await listSettingsForAdmin())
}

export async function PUT(request) {
  const auth = await guard()
  if (!auth.ok) return auth.response
  const body = await readJson(request, z.object({ key: z.string().min(1).max(80), value: z.any() }))
  if (!body.ok) return body.response
  return fromResult(await updateSetting({ actor: auth.user, key: body.data.key, value: body.data.value }), () => ok({ saved: true }))
}

export async function DELETE(request) {
  const auth = await guard()
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { key: z.string().min(1).max(80) })
  if (!q.ok) return q.response
  return fromResult(await clearSetting({ actor: auth.user, key: q.data.key }), () => ok({ cleared: true }))
}
