import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { createHash } from "crypto"
import { supabase } from '@/lib/supabaseClient'

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      id: 'admin-credentials',
      name: 'Admin Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        loginType: { label: 'Login Type', type: 'text' }
      },
      async authorize(credentials) {
        try {
          // Call your existing authentication API
          const sql = 'SELECT * FROM club_membership_data WHERE m_username = ? LIMIT 1'
          
          const res = await fetch('https://info.rotaract3220.org/api/query', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.NEXT_PUBLIC_DBMID_API_KEY,
            },
            body: JSON.stringify({
              sql,
              params: [credentials.email],
            }),
          })

          const data = await res.json()
          if (!res.ok) {
            console.error('API Error:', data.error)
            return null
          }

          const users = data.results || []
          if (users.length === 0) {
            return null // Return null for user not found
          }

          const user = users[0]
          
          // Verify password
          const inputHash = createHash('md5').update(credentials.password).digest('hex')
          const storedHash = (user.m_password || '').toLowerCase()
          if (storedHash !== inputHash.toLowerCase()) {
            return null // Return null for invalid password
          }

          // Determine access permissions based on role_id
          const roleId = user.role_id
          const hasAdminAccess = [1,2,3,4].includes(roleId)
          const hasPortalAccess = [1,2,3,4,5,6].includes(roleId)
          
          // User must have at least one type of access
          if (!hasAdminAccess && !hasPortalAccess) {
            return null // No access permissions
          }

          // Remove sensitive data and return user
          const { m_password, ...safeUser } = user
          
          // Fetch permission level
          let permission_level = null;
          if (safeUser.membership_id) {
            const { data, error } = await supabase
              .from('permissions')
              .select('permission_level')
              .eq('RMIS_ID', safeUser.membership_id)
              .single();
            if (!error && data) {
              permission_level = data.permission_level;
            }
          }
          
          return {
            id: safeUser.id || safeUser.m_id,
            email: safeUser.m_username,
            name: safeUser.card_name || safeUser.m_name,
            role_id: safeUser.role_id,
            hasAdminAccess: [1,2,3,4].includes(safeUser.role_id),
            hasPortalAccess: [1,2,3,4,5,6].includes(safeUser.role_id),
            userDeets: safeUser,
            permission_level: permission_level
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Store user details in JWT token
      if (user) {
        token.role_id = user.role_id
        token.hasAdminAccess = user.hasAdminAccess
        token.hasPortalAccess = user.hasPortalAccess
        token.userDeets = user.userDeets
        token.permission_level = user.permission_level
      }
      return token
    },
    async session({ session, token }) {
      // Send properties to the client
      session.user.role_id = token.role_id
      session.user.hasAdminAccess = token.hasAdminAccess
      session.user.hasPortalAccess = token.hasPortalAccess
      session.user.userDeets = token.userDeets
      session.user.permission_level = token.permission_level
      return session
    }
  },
  pages: {
    signIn: '/admin/login', // Default sign in page
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }