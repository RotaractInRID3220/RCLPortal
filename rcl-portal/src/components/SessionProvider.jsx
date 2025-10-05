'use client'
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import { useSetAtom } from 'jotai'
import { userDeetsAtom } from '@/app/state/store'
import { useSession } from 'next-auth/react'
import { useEffect } from 'react'

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

export default function SessionProvider({ children, session }) {
  return (
    <NextAuthSessionProvider session={session}>
      <SessionSync />
      {children}
    </NextAuthSessionProvider>
  )
}