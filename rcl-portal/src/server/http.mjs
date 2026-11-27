// Small helpers so every route answers in the same shape the pages already read:
//   success: { success: true, data, ... }      failure: { success: false, error: "<message>", code: "<code>" }
import { z } from 'zod'

export const ok = (data, extra = {}, status = 200) => Response.json({ success: true, data, ...extra }, { status })
export const fail = (status, code, message) => Response.json({ success: false, error: message, code }, { status })

/** Map a service result ({ok:false,status,code,message}) to a Response. */
export const fromResult = (r, onOk) => (r.ok ? onOk(r) : fail(r.status ?? 400, r.code, r.message))

export async function readJson(request, schema) {
  let body
  try { body = await request.json() } catch { return { ok: false, response: fail(400, 'invalid_request', 'Request body must be valid JSON.') } }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, response: fail(400, 'invalid_request', `${issue.path.join('.') || 'body'}: ${issue.message}`) }
  }
  return { ok: true, data: parsed.data }
}

export function parseQuery(request, shape) {
  const sp = Object.fromEntries(new URL(request.url).searchParams)
  const parsed = z.object(shape).safeParse(sp)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, response: fail(400, 'invalid_request', `${issue.path.join('.') || 'query'}: ${issue.message}`) }
  }
  return { ok: true, data: parsed.data }
}

export const intParam = z.coerce.number().int().positive()
export const optInt = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().int().positive().optional())
