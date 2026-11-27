import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { ok, parseQuery } from '@/server/http.mjs'
import { searchAdminMembers } from '@/server/auth/permissions-admin.mjs'

// Find RMIS members with an admin access role (for the permissions screen). Reads the local
// rmis_members mirror, not the old external SQL endpoint.
export async function GET(request) {
  const auth = await requireUser({ admin: true, permission: 'administrator' })
  if (!auth.ok) return auth.response
  const q = parseQuery(request, { name: z.string().trim().min(3).max(80) })
  if (!q.ok) return q.response
  const users = await searchAdminMembers(q.data.name)
  return ok(users, { users })
}
