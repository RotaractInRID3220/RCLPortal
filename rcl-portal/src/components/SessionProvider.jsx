'use client'
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import { useSetAtom } from 'jotai'
import { userDeetsAtom } from '@/app/state/store'
import { useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Component to sync NextAuth session with Jotai atom
function SessionSync() {
  const { data: session } = useSession()
  const setUserDeets = useSetAtom(userDeetsAtom)

  useEffect(() => {
    if (session?.user?.userDeets) {
      // Sync NextAuth session to userDeets atom for API calls
      setUserDeets(session.user.userDeets)
    } else {
      // Clear userDeets atom if no session
      setUserDeets(null)
    }
  }, [session, setUserDeets])

  return null
}

// Public website routes never read the session, so they skip the NextAuth provider entirely
// (no /api/auth/session request on the landing page, e-arena or player pages).
const isPublicPath = (path) => path === '/' || path.startsWith('/e-arena') || path.startsWith('/player')

export default function SessionProvider({ children, session }) {
  const pathname = usePathname() || ''
  if (isPublicPath(pathname)) return children

  return (
    <NextAuthSessionProvider session={session}>
      <SessionSync />
      {children}
    </NextAuthSessionProvider>
  )
}