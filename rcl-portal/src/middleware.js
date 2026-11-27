import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { decideAccess } from '@/server/auth/access-policy.mjs'

// Default-deny gate in front of every /api route (see access-policy.mjs for the rules).
export async function middleware(request) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  const verdict = decideAccess({ pathname: request.nextUrl.pathname, method: request.method, token })
  if (verdict.allow) return NextResponse.next()
  return NextResponse.json({ error: { code: verdict.code, message: verdict.message } }, { status: verdict.status })
}

export const config = { matcher: ['/api/:path*'] }
