import { z } from 'zod'
import { requireUser } from '@/server/auth/guards'
import { fromResult, ok, readJson } from '@/server/http.mjs'
import { query } from '@/server/db.mjs'
import { updateSetting } from '@/server/settings/admin.mjs'

// The "portal" switch on the settings page is the day check-in switch (`checkin.open`).
// Registration windows are dates (settings), not a switch.
const status = async () => {
  const { rows: [r] } = await query("SELECT value, updated_by, updated_at FROM settings WHERE key = 'checkin.open'")
  const { rows: [d] } = await query("SELECT value FROM settings WHERE key = 'checkin.current_day'")
  const isOpen = r?.value === true
  return { isOpen, currentDay: d?.value ?? null, updatedBy: r?.updated_by ?? null, updatedAt: r?.updated_at ?? null, message: isOpen ? 'Check-in is open' : 'Check-in is currently closed' }
}

export async function GET() {
  const auth = await requireUser({ admin: true })
  if (!auth.ok) return auth.response
  return ok(await status())
}

export async function PATCH(request) {
  const auth = await requireUser({ admin: true, permission: 'administrator' })
  if (!auth.ok) return auth.response
  const body = await readJson(request, z.object({ isOpen: z.boolean() }).passthrough())
  if (!body.ok) return body.response
  return fromResult(await updateSetting({ actor: auth.user, key: 'checkin.open', value: body.data.isOpen }), async () => ok(await status()))
}
