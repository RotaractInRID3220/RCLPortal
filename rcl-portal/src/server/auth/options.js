import CredentialsProvider from 'next-auth/providers/credentials'
import { authorizeCredentials, LoginError, SESSION_FIELDS } from './authorize.mjs'

// Login is verified by RMIS 2.0 (username + password). RCL never sees a password hash and does
// not store the member record in the session: only the small SESSION_FIELDS shape.
export const authOptions = {
  providers: [
    CredentialsProvider({
      id: 'admin-credentials', // id kept: both login pages (admin and portal) use it
      name: 'RMIS Login',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
        loginType: { label: 'Login Type', type: 'text' },
      },
      async authorize(credentials) {
        try {
          return await authorizeCredentials(credentials)
        } catch (e) {
          // The message is a stable code (invalid_credentials, club_terminated, rate_limited:300, ...)
          // that the login pages translate. Unknown failures must not leak details.
          if (e instanceof LoginError) throw new Error(e.code)
          console.error('[auth] unexpected login failure:', e?.message)
          throw new Error('rmis_unavailable')
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) for (const f of SESSION_FIELDS) token[f] = user[f] ?? null
      return token
    },
    async session({ session, token }) {
      const u = session.user
      for (const f of SESSION_FIELDS) u[f] = token[f] ?? null
      // Compatibility with pages not yet ported: same keys as before, but only the small set.
      u.userDeets = {
        member_id: token.member_id,
        membership_id: token.membership_id,
        card_name: token.card_name,
        full_name: token.full_name,
        club_id: token.club_id,
        club_name: token.club_name,
        role_id: token.role_id,
      }
      return session
    },
  },
  pages: { signIn: '/admin/login' },
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 }, // 24 hours
  secret: process.env.NEXTAUTH_SECRET,
}
