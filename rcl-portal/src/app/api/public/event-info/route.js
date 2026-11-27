import { ok } from '@/server/http.mjs'
import { getPublicEventInfo } from '@/server/settings/admin.mjs'

// PUBLIC: dates and day labels for the countdown and info banners. Never cached by the browser.
export async function GET() {
  const info = await getPublicEventInfo()
  return Response.json({ success: true, data: info }, { headers: { 'Cache-Control': 'no-store' } })
}
