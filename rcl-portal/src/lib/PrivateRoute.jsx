"use client";
import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

const PrivateRoute = ({ 
  children, 
  allowedRoles = [], 
  accessType = 'admin', // 'admin' or 'portal'
  redirectTo 
}) => {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  // Set default redirect based on accessType
  const defaultRedirect = accessType === 'admin' ? '/admin/login' : '/portal/login'
  const finalRedirectTo = redirectTo || defaultRedirect

  useEffect(() => {
    if (status === 'loading') return // Still loading

    if (!session) {
      // Not authenticated - redirect to login
      console.log('No session, redirecting to:', finalRedirectTo)
      router.push(finalRedirectTo)
      return
    }

    // Check access permissions based on session data (no DB calls needed)
    const hasRequiredAccess = accessType === 'admin' 
      ? session.user.hasAdminAccess 
      : session.user.hasPortalAccess

    if (!hasRequiredAccess) {
      console.log(`${accessType} access denied for user`)
      router.push('/unauthorized')
      return
    }

    // Check specific role-based access if allowedRoles specified
    if (allowedRoles.length > 0 && !allowedRoles.includes(session.user.role_id)) {
      console.log('Role access denied, user role:', session.user.role_id, 'allowed:', allowedRoles)
      router.push('/unauthorized')
      return
    }

  }, [session, status, router, finalRedirectTo, allowedRoles, accessType])

  // If we're on the login page, don't apply PrivateRoute logic
  if (pathname === finalRedirectTo) {
    return <>{children}</>
  }

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center h-screen">
        <img src="/load.svg" alt="" className="w-20" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex justify-center items-center h-screen">
        <img src="/load.svg" alt="" className="w-20" />
      </div>
    )
  }

  // Check access permissions (no DB calls needed)
  const hasRequiredAccess = accessType === 'admin' 
    ? session.user.hasAdminAccess 
    : session.user.hasPortalAccess

  if (!hasRequiredAccess) {
    return <div>Access Denied - Insufficient Permissions</div>
  }

  // Check specific role access if specified
  if (allowedRoles.length > 0 && !allowedRoles.includes(session.user.role_id)) {
    return <div>Access Denied - Insufficient Permissions</div>
  }

  return <>{children}</>
}

export default PrivateRoute
