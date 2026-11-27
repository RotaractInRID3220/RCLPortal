import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fromResult, ok, readJson } from '@/server/http.mjs'
import { LEVELS, listPermissions, removePermission, setPermission } from '@/server/auth/permissions-admin.mjs'

// Administrators only. The member is identified by RMIS member_id; every rule (last administrator,
// own level, member must be an RMIS admin role) lives in permissions-admin.mjs.
const guard = () => requireUser({ admin: true, permission: 'administrator' })
const noStore = (res) => { res.headers.set('Cache-Control', 'no-store'); return res }

export async function GET() {
  const auth = await guard()
  if (!auth.ok) return auth.response
  const permissions = await listPermissions()
  return noStore(ok(permissions, { permissions, self: auth.user.member_id }))
}

const setBody = z.object({ member_id: z.coerce.number().int().positive(), permission_level: z.enum(LEVELS) })
const delBody = z.object({ member_id: z.coerce.number().int().positive() })

export async function POST(request) {
  const auth = await guard()
  if (!auth.ok) return auth.response
  const body = await readJson(request, setBody)
  if (!body.ok) return body.response
  return fromResult(await setPermission({ actor: auth.user, memberId: body.data.member_id, level: body.data.permission_level }),
    (r) => ok(r.permission, { permission: r.permission, unchanged: r.unchanged }))
}

export async function DELETE(request) {
  const auth = await guard()
  if (!auth.ok) return auth.response
  const body = await readJson(request, delBody)
  if (!body.ok) return body.response
  return fromResult(await removePermission({ actor: auth.user, memberId: body.data.member_id }), () => ok({ removed: true }))
}
