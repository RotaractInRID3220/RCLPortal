# RCLPortal NextAuth Implementation - Complete Context

**Last Updated:** November 7, 2025  
**Platform:** Next.js 15 with NextAuth v4  
**Auth Strategy:** JWT with Credentials Provider  
**External Auth Source:** DBMID API (Legacy Club Database)

---

## Table of Contents
1. [Authentication Flow Overview](#authentication-flow-overview)
2. [Credential Retrieval from DBMID API](#credential-retrieval-from-dbmid-api)
3. [NextAuth Configuration](#nextauth-configuration)
4. [Session & JWT Token Storage](#session--jwt-token-storage)
5. [State Management (Jotai)](#state-management-jotai)
6. [PrivateRoute Component](#privateroute-component)
7. [Role-Based Access Control](#role-based-access-control)
8. [Route Protection & Security](#route-protection--security)
9. [Data Flow Diagrams](#data-flow-diagrams)
10. [Implementation Checklist](#implementation-checklist)

---

## Authentication Flow Overview

### Complete User Authentication Journey

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER VISITS LOGIN PAGE                                   │
│    - /admin/login (admin)                                   │
│    - /portal/login (player)                                 │
└──────────────────────┬──────────────────────────────────────┘

┌──────────────────────▼──────────────────────────────────────┐
│ 2. USER ENTERS CREDENTIALS                                  │
│    - Username/Email                                         │
│    - Password                                               │
│    - LoginType (admin/portal)                               │
└──────────────────────┬──────────────────────────────────────┘

┌──────────────────────▼──────────────────────────────────────┐
│ 3. signIn('admin-credentials') CALLED                       │
│    - Triggers NextAuth Credentials Provider                 │
│    - authorize() function invoked                           │
└──────────────────────┬──────────────────────────────────────┘

┌──────────────────────▼──────────────────────────────────────┐
│ 4. FETCH FROM DBMID API                                     │
│    - POST to https://info.rotaract3220.org/api/query        │
│    - Headers: 'x-api-key': NEXT_PUBLIC_DBMID_API_KEY        │
│    - Query: SELECT * FROM club_membership_data              │
│    - WHERE m_username = ?                                   │
└──────────────────────┬──────────────────────────────────────┘

┌──────────────────────▼──────────────────────────────────────┐
│ 5. PASSWORD VERIFICATION                                    │
│    - MD5 hash incoming password                             │
│    - Compare with stored m_password (case-insensitive)      │
│    - Return null if mismatch                                │
└──────────────────────┬──────────────────────────────────────┘

┌──────────────────────▼──────────────────────────────────────┐
│ 6. FETCH PERMISSION LEVEL (Supabase)                        │
│    - Query: permissions table                               │
│    - WHERE RMIS_ID = membership_id                          │
│    - Get: permission_level ('admin' or 'super_admin')       │
└──────────────────────┬──────────────────────────────────────┘

┌──────────────────────▼──────────────────────────────────────┐
│ 7. JWT CALLBACK EXECUTES                                    │
│    - Store role_id, hasAdminAccess, hasPortalAccess         │
│    - Store userDeets (full user object minus password)      │
│    - Store permission_level                                 │
│    - Return token                                           │
└──────────────────────┬──────────────────────────────────────┘

┌──────────────────────▼──────────────────────────────────────┐
│ 8. SESSION CALLBACK EXECUTES                                │
│    - Add token data to session.user                         │
│    - Session sent to client                                 │
└──────────────────────┬──────────────────────────────────────┘

┌──────────────────────▼──────────────────────────────────────┐
│ 9. SESSIONPROVIDER SYNCS SESSION                            │
│    - SessionSync component detects session                  │
│    - Writes session.user.userDeets to userDeetsAtom         │
│    - Available app-wide via Jotai                           │
└──────────────────────┬──────────────────────────────────────┘

┌──────────────────────▼──────────────────────────────────────┐
│ 10. ROUTING DECISION                                        │
│    - If hasAdminAccess → /admin/dashboard                   │
│    - If hasPortalAccess → /portal/dashboard                 │
│    - Otherwise → /unauthorized                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Credential Retrieval from DBMID API

### Location & Purpose
- **File:** `src/app/api/council/route.js`
- **Purpose:** Acts as bridge between DBMID legacy API and NextAuth
- **Responsibility:** Validate user credentials and fetch club member data

### DBMID API Endpoint Details

**Endpoint:** `https://info.rotaract3220.org/api/query`

**Authentication:**
```javascript
headers: {
  'Content-Type': 'application/json',
  'x-api-key': process.env.NEXT_PUBLIC_DBMID_API_KEY,
}
```

**Request Format:**
```javascript
{
  sql: 'SELECT * FROM club_membership_data WHERE m_username = ? LIMIT 1',
  params: ['username_to_search']
}
```

### Response Structure from DBMID
```javascript
{
  results: [
    {
      m_id: 12345,                           // Member ID
      membership_id: 'RID-3220-2024-001',   // Unique membership ID
      m_username: 'rtr.john',               // Login username
      m_password: 'md5hash...',             // MD5 hashed password
      m_name: 'John Doe',                   // Full name
      card_name: 'Rtr. John',               // Card display name
      role_id: 2,                           // Role identifier (1-6)
      club_id: 456,                         // Club identifier
      status: 1,                            // Member status (1=active, 3=inactive, 5=other)
      created_datetime: '2024-01-15 10:30:00'
    }
  ]
}
```

### API Endpoint Handler (`/api/council/route.js`)

**Handles Two Scenarios:**

#### 1. User Authentication (No clubID param)
```javascript
GET /api/council?username=rtr.john&password=mypassword

Response:
{
  "authorized": true,
  "user": {
    // Full user object (without m_password)
  }
}
```

#### 2. Club Members Fetch (with clubID param)
```javascript
GET /api/council?clubID=456

Response:
{
  "success": true,
  "members": [
    // Array of club members
  ],
  "count": 45,
  "clubID": 456
}
```

### Key Features
- **MD5 Password Hashing:** Matches legacy system
- **Status Filtering:** Only includes members with status 1, 3, or 5
- **Membership Cutoff:** Uses `APP_CONFIG.MEMBERSHIP_CUTOFF_DATE` to filter valid members
- **Sensitive Field Removal:** Strips `m_password` from response
- **Status Normalization:** Converts status 3 to 1 for consistency

---

## NextAuth Configuration

### Location & File
**File:** `src/app/api/auth/[...nextauth]/route.js`

### Complete Configuration Structure

```javascript
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { createHash } from "crypto"
import { supabase } from '@/lib/supabaseClient'

const handler = NextAuth({
  // ═══════════════════════════════════════════════════════════════
  // PROVIDER CONFIGURATION
  // ═══════════════════════════════════════════════════════════════
  
  providers: [
    CredentialsProvider({
      id: 'admin-credentials',
      name: 'Admin Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        loginType: { label: 'Login Type', type: 'text' }  // 'admin' or 'portal'
      },
      
      // ───────────────────────────────────────────────────────────
      // AUTHORIZATION LOGIC - VALIDATE CREDENTIALS
      // ───────────────────────────────────────────────────────────
      async authorize(credentials) {
        try {
          // 1. Query DBMID API for user
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
            return null  // User not found
          }

          const user = users[0]
          
          // 2. Verify password (MD5)
          const inputHash = createHash('md5').update(credentials.password).digest('hex')
          const storedHash = (user.m_password || '').toLowerCase()
          if (storedHash !== inputHash.toLowerCase()) {
            return null  // Invalid password
          }

          // 3. Determine access based on role_id
          const roleId = user.role_id
          const hasAdminAccess = [1,2,3,4].includes(roleId)     // Admin roles
          const hasPortalAccess = [1,2,3,4,5,6].includes(roleId) // Portal roles
          
          if (!hasAdminAccess && !hasPortalAccess) {
            return null  // No access permissions
          }

          // 4. Remove sensitive data
          const { m_password, ...safeUser } = user
          
          // 5. Fetch permission level from Supabase
          let permission_level = null
          if (safeUser.membership_id) {
            const { data, error } = await supabase
              .from('permissions')
              .select('permission_level')
              .eq('RMIS_ID', safeUser.membership_id)
              .single()
            if (!error && data) {
              permission_level = data.permission_level  // 'admin' or 'super_admin'
            }
          }
          
          // 6. Return authenticated user object
          return {
            id: safeUser.id || safeUser.m_id,
            email: safeUser.m_username,
            name: safeUser.card_name || safeUser.m_name,
            role_id: safeUser.role_id,
            hasAdminAccess,
            hasPortalAccess,
            userDeets: safeUser,                    // Full user object for API calls
            permission_level                        // 'admin' or 'super_admin'
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],

  // ═══════════════════════════════════════════════════════════════
  // JWT CALLBACK - STORE DATA IN JWT TOKEN
  // ═══════════════════════════════════════════════════════════════
  callbacks: {
    async jwt({ token, user }) {
      // Only runs after successful authorization
      if (user) {
        token.role_id = user.role_id
        token.hasAdminAccess = user.hasAdminAccess
        token.hasPortalAccess = user.hasPortalAccess
        token.userDeets = user.userDeets
        token.permission_level = user.permission_level
      }
      return token
    },

    // ───────────────────────────────────────────────────────────
    // SESSION CALLBACK - SEND JWT DATA TO CLIENT
    // ───────────────────────────────────────────────────────────
    async session({ session, token }) {
      // Only runs when session is accessed on client
      session.user.role_id = token.role_id
      session.user.hasAdminAccess = token.hasAdminAccess
      session.user.hasPortalAccess = token.hasPortalAccess
      session.user.userDeets = token.userDeets
      session.user.permission_level = token.permission_level
      return session
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // SESSION CONFIGURATION
  // ═══════════════════════════════════════════════════════════════
  pages: {
    signIn: '/admin/login',  // Default redirect for unauthenticated users
  },
  session: {
    strategy: 'jwt',         // Use JWT instead of database sessions
    maxAge: 24 * 60 * 60,    // 24-hour session duration
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
```

### Environment Variables Required

```env
# .env.local

# NextAuth
NEXTAUTH_SECRET=your-secret-key-here                    # Generate: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000                      # For local dev; set to production URL in prod

# DBMID API
NEXT_PUBLIC_DBMID_API_KEY=your-api-key-here            # Legacy database API key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_KEY=eyJhbG...                          # For server-side queries
```

---

## Session & JWT Token Storage

### Token Flow & Storage Mechanism

```
┌─────────────────────────────────────────┐
│ authorize() function returns user obj   │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ jwt callback stores data in JWT token   │
│                                         │
│ token = {                               │
│   iat: ...,                             │
│   exp: ...,                             │
│   jti: ...,                             │
│   role_id: 2,                           │
│   hasAdminAccess: true,                 │
│   hasPortalAccess: true,                │
│   userDeets: {...},                     │
│   permission_level: 'admin'             │
│ }                                       │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ Token signed with NEXTAUTH_SECRET       │
│ Token stored in secure HTTP-only cookie │
│ Cookie name: next-auth.session-token    │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ session callback extracts JWT data      │
│ Adds to session.user object             │
│                                         │
│ session.user = {                        │
│   email: 'rtr.john',                    │
│   role_id: 2,                           │
│   hasAdminAccess: true,                 │
│   hasPortalAccess: true,                │
│   userDeets: {...},                     │
│   permission_level: 'admin'             │
│ }                                       │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│ Session available in client components  │
│ via useSession() hook                   │
└─────────────────────────────────────────┘
```

### What's Stored in JWT Token

| Field | Type | Purpose | Source |
|-------|------|---------|--------|
| `role_id` | Number | Determines admin vs portal access | DBMID API |
| `hasAdminAccess` | Boolean | Quick check for admin routes (roles 1-4) | Calculated from role_id |
| `hasPortalAccess` | Boolean | Quick check for portal routes (roles 1-6) | Calculated from role_id |
| `userDeets` | Object | Full user data for API calls | DBMID API response |
| `permission_level` | String | Feature-level control ('admin'\|'super_admin') | Supabase permissions table |

### Session Structure Available to Client

```javascript
// Usage in React component
const { data: session } = useSession()

session = {
  user: {
    email: 'rtr.john',
    role_id: 2,
    hasAdminAccess: true,
    hasPortalAccess: true,
    userDeets: {
      m_id: 12345,
      membership_id: 'RID-3220-2024-001',
      m_username: 'rtr.john',
      m_name: 'John Doe',
      card_name: 'Rtr. John',
      role_id: 2,
      club_id: 456,
      status: 1,
      // ... more fields
    },
    permission_level: 'admin'  // or 'super_admin' or null
  },
  expires: '2025-11-08T10:30:00.000Z'
}
```

---

## State Management (Jotai)

### Jotai Atoms in `/src/state/store.js`

#### User Details Atom
```javascript
import { atomWithStorage } from "jotai/utils"

// Synced with NextAuth session via SessionProvider
export const userDeetsAtom = atomWithStorage('userDeets', null)

// Usage in components:
const [userDeets] = useAtom(userDeetsAtom)
// userDeets contains: { m_id, membership_id, m_username, card_name, role_id, club_id, ... }
```

#### Global Loading State
```javascript
export const loadingAtom = atom(false)

// Set to false when login page renders to stop global loading indicator
```

#### Cache Management
```javascript
export const lastFetchTimestampAtom = atomWithStorage('lastFetchTimestamp', {
  sports: 0,
  clubs: 0,
  leaderboard: 0,
  clubPoints: 0,
  adminDashboard: 0,
  portalDashboard: 0
})

export const CACHE_DURATION = {
  sports: 2 * 60 * 1000,          // 2 minutes
  clubs: 10 * 60 * 1000,          // 10 minutes
  leaderboard: 2 * 60 * 1000,     // 2 minutes
  clubPoints: 2 * 60 * 1000,      // 2 minutes
  adminDashboard: 1 * 60 * 1000,  // 1 minute (high priority)
  portalDashboard: 2 * 60 * 1000  // 2 minutes
}

// Check if cached data is fresh
export const isCacheValid = (timestamp, type = 'sports') => {
  if (!timestamp) return false
  return Date.now() - timestamp < CACHE_DURATION[type]
}

// Invalidate specific cache
export const invalidateCacheAtom = atom(
  null,
  (get, set, cacheType) => {
    set(lastFetchTimestampAtom, (prev) => ({
      ...prev,
      [cacheType]: 0
    }))
  }
)
```

### SessionProvider - Sync Next Auth → Jotai

**File:** `src/components/SessionProvider.jsx`

```javascript
'use client'
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import { useSetAtom } from 'jotai'
import { userDeetsAtom } from '@/app/state/store'
import { useSession } from 'next-auth/react'
import { useEffect } from 'react'

function SessionSync() {
  const { data: session } = useSession()
  const setUserDeets = useSetAtom(userDeetsAtom)

  // When session changes, update Jotai atom
  useEffect(() => {
    if (session?.user?.userDeets) {
      // Sync NextAuth session to Jotai for app-wide access
      setUserDeets(session.user.userDeets)
    } else {
      // Clear when user logs out
      setUserDeets(null)
    }
  }, [session, setUserDeets])

  return null  // Not rendered, just synchronizes state
}

export default function SessionProvider({ children, session }) {
  return (
    <NextAuthSessionProvider session={session}>
      <SessionSync />
      {children}
    </NextAuthSessionProvider>
  )
}
```

**Implementation in Root Layout:**
```javascript
// src/app/layout.js
import SessionProvider from "@/components/SessionProvider"

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SessionProvider>
          {children}
          <Toaster richColors />
        </SessionProvider>
      </body>
    </html>
  )
}
```

---

## PrivateRoute Component

### Location & Purpose
**File:** `src/lib/PrivateRoute.jsx`

**Purpose:** Wrapper component that:
- Checks if user is authenticated
- Validates access type (admin vs portal)
- Checks role-based permissions
- Checks permission level (admin vs super_admin)
- Redirects unauthorized users

### Component API

```javascript
<PrivateRoute 
  accessType="admin"                  // 'admin' or 'portal'
  allowedRoles={[1, 2, 3, 4]}        // Optional: specific role IDs
  redirectTo="/custom/login"          // Optional: custom redirect
  requiredPermission="super_admin"    // Optional: 'admin' or 'super_admin'
>
  {children}
</PrivateRoute>
```

### Usage in Layouts

#### Admin Dashboard Layout
```javascript
// src/app/admin/dashboard/layout.js
import PrivateRoute from "@/lib/PrivateRoute"
import AdminSideNav from "../components/AdminSideNav"

export default function RootLayout({ children }) {
  return (
    <div className="flex w-full">
      <div className="lg:w-2/12 fixed">
        <AdminSideNav />
      </div>
      <div className="lg:w-10/12 ml-auto">
        <PrivateRoute accessType="admin">
          {children}
        </PrivateRoute>
      </div>
    </div>
  )
}
```

#### Portal Dashboard Layout
```javascript
// src/app/portal/dashboard/layout.js
import PrivateRoute from "@/lib/PrivateRoute"
import PortalSideNav from "./components/PortalSideNav"

export default function RootLayout({ children }) {
  return (
    <div className="flex w-full">
      <div className="lg:w-2/12 hidden lg:block fixed">
        <PortalSideNav />
      </div>
      <div className="lg:w-10/12 ml-auto">
        <PrivateRoute accessType="portal">
          {children}
        </PrivateRoute>
      </div>
    </div>
  )
}
```

### Complete Implementation

```javascript
"use client"
import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"

const PrivateRoute = ({ 
  children, 
  allowedRoles = [], 
  accessType = 'admin',           // 'admin' or 'portal'
  redirectTo,
  requiredPermission               // 'admin' or 'super_admin'
}) => {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  // Determine redirect URL based on accessType
  const defaultRedirect = accessType === 'admin' ? '/admin/login' : '/portal/login'
  const finalRedirectTo = redirectTo || defaultRedirect

  useEffect(() => {
    if (status === 'loading') return  // Still checking authentication

    if (!session) {
      // Not authenticated - redirect to login
      router.push(finalRedirectTo)
      return
    }

    // ═══════════════════════════════════════════════════════════════
    // 1. CHECK ACCESS TYPE (Admin vs Portal)
    // ═══════════════════════════════════════════════════════════════
    const hasRequiredAccess = accessType === 'admin' 
      ? session.user.hasAdminAccess 
      : session.user.hasPortalAccess

    if (!hasRequiredAccess) {
      router.push('/unauthorized')
      return
    }

    // ═══════════════════════════════════════════════════════════════
    // 2. CHECK SPECIFIC ROLES (if provided)
    // ═══════════════════════════════════════════════════════════════
    if (allowedRoles.length > 0 && !allowedRoles.includes(session.user.role_id)) {
      router.push('/unauthorized')
      return
    }

    // ═══════════════════════════════════════════════════════════════
    // 3. CHECK PERMISSION LEVEL (admin vs super_admin)
    // ═══════════════════════════════════════════════════════════════
    if (requiredPermission) {
      const userLevel = session.user.permission_level
      if (!userLevel) {
        router.push('/unauthorized')
        return
      }
      
      // Hierarchy: super_admin > admin
      const permissionHierarchy = { 'admin': 1, 'super_admin': 2 }
      const requiredLevel = permissionHierarchy[requiredPermission]
      const userPermissionLevel = permissionHierarchy[userLevel]
      
      if (!requiredLevel || !userPermissionLevel || userPermissionLevel < requiredLevel) {
        router.push('/unauthorized')
        return
      }
    }

  }, [session, status, router, finalRedirectTo, allowedRoles, accessType, requiredPermission])

  // ═══════════════════════════════════════════════════════════════
  // RENDERING LOGIC
  // ═══════════════════════════════════════════════════════════════

  // Don't apply PrivateRoute logic to login pages
  if (pathname === finalRedirectTo) {
    return <>{children}</>
  }

  // Show loading while checking session
  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center h-full">
        <img src="/load.svg" alt="" className="w-20" />
      </div>
    )
  }

  // No session after loading
  if (!session) {
    return (
      <div className="flex justify-center items-center h-full">
        <img src="/load.svg" alt="" className="w-20" />
      </div>
    )
  }

  // Final access check before rendering
  const hasRequiredAccess = accessType === 'admin' 
    ? session.user.hasAdminAccess 
    : session.user.hasPortalAccess

  if (!hasRequiredAccess) {
    return <div>Access Denied - Insufficient Permissions</div>
  }

  // All checks passed - render children
  return <>{children}</>
}

export default PrivateRoute
```

---

## Role-Based Access Control

### Access Hierarchy

#### Role IDs (From DBMID API)
```
role_id 1: Chairperson / President (Highest)
role_id 2: Member at Large (MAL)
role_id 3: Board Member
role_id 4: Club Member
role_id 5: Portal User (Player)
role_id 6: Guest / External User
```

#### Admin Access (Dashboard Admin)
```javascript
const hasAdminAccess = [1, 2, 3, 4].includes(role_id)
// Roles 1-4 can access /admin/dashboard and related routes
```

#### Portal Access (Player Portal)
```javascript
const hasPortalAccess = [1, 2, 3, 4, 5, 6].includes(role_id)
// All roles can access /portal/dashboard
```

#### Permission Levels (Supabase permissions table)
```
permission_level: null          → No special permissions (basic admin)
permission_level: 'admin'       → Extended admin features
permission_level: 'super_admin' → All features enabled
```

### Permission Hierarchy

```
super_admin (Level 2)
  ├── Payments
  ├── Clubs Management
  ├── Replacements
  ├── Permissions Management
  └── Administration
  
admin (Level 1)
  ├── Events
  ├── Teams
  ├── Administration
  └── (cannot access super_admin features)

basic (Level 0)
  ├── Overview (Dashboard)
  ├── Registrations
  ├── Bracket
  └── Leaderboard
```

### Navigation Items Configuration

**File:** `src/app/admin/components/AdminSideNav.jsx`

```javascript
const NAV_ITEMS = [
  // Basic - accessible to all admin users
  { label: "Overview", path: "/admin/dashboard", icon: LayoutDashboard, permission: "basic" },
  { label: "Registrations", path: "/admin/dashboard/registrations", icon: ClipboardList, permission: "basic" },
  { label: "Bracket", path: "/admin/dashboard/bracket", icon: GitBranch, permission: "basic" },
  { label: "Leaderboard", path: "/admin/dashboard/leaderboard", icon: Trophy, permission: "basic" },

  // Admin - requires explicit permission_level
  { label: "Events", path: "/admin/dashboard/events", icon: Calendar, permission: "admin" },
  { label: "Teams", path: "/admin/dashboard/teams", icon: UsersRound, permission: "admin" },
  { label: "Administration", path: "/admin/dashboard/administration", icon: Settings, permission: "admin" },

  // Super Admin - requires explicit super_admin permission
  { label: "Clubs", path: "/admin/dashboard/clubs", icon: Users, permission: "super_admin" },
  { label: "Replacements", path: "/admin/dashboard/replacements", icon: Repeat2, permission: "super_admin" },
  { label: "Payments", path: "/admin/dashboard/payments", icon: CreditCard, permission: "super_admin" },
  { label: "Permissions", path: "/admin/dashboard/permissions", icon: Shield, permission: "super_admin" },
]

// Filter logic in component
const userPermissionLevel = session?.user?.permission_level
const userRoleId = session?.user?.role_id
const isBasicAdmin = [1, 2, 3, 4].includes(userRoleId)

const filteredNavItems = NAV_ITEMS.filter((item) => {
  if (item.permission === "basic" && isBasicAdmin) {
    return true
  }
  
  if (item.permission === "admin") {
    if (!userPermissionLevel) return false
    const permissionHierarchy = { 'admin': 1, 'super_admin': 2 }
    return permissionHierarchy[userPermissionLevel] >= permissionHierarchy[item.permission]
  }
  
  if (item.permission === "super_admin") {
    if (!userPermissionLevel) return false
    return userPermissionLevel === 'super_admin'
  }
  
  return false
})
```

### Example: Permissions Page

**File:** `src/app/admin/dashboard/permissions/page.jsx`

```javascript
'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function PermissionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/admin/login')
      return
    }

    // DIRECT ACCESS CHECK IN PAGE
    // Allow only role_id=1 OR super_admin permission
    const hasAccess = session.user.role_id === 1 || 
                      session.user.permission_level === 'super_admin'
    
    if (!hasAccess) {
      router.push('/unauthorized')
      return
    }
  }, [session, status, router])

  // Page content...
}
```

---

## Route Protection & Security

### Multi-Layer Security Strategy

```
┌─────────────────────────────────────────────────────────┐
│ LAYER 1: LOGIN VALIDATION                               │
│ - Check credentials against DBMID API                   │
│ - Verify MD5 password hash                              │
│ - Return null if invalid                                │
└────────────────────┬────────────────────────────────────┘

┌────────────────────▼────────────────────────────────────┐
│ LAYER 2: ACCESS TYPE CHECK                              │
│ - Check hasAdminAccess (roles 1-4)                      │
│ - Check hasPortalAccess (roles 1-6)                     │
│ - Determine which portal user can access                │
└────────────────────┬────────────────────────────────────┘

┌────────────────────▼────────────────────────────────────┐
│ LAYER 3: PERMISSION LEVEL CHECK                         │
│ - Query Supabase permissions table                      │
│ - Get permission_level (admin/super_admin/null)         │
│ - Feature gating based on permission                    │
└────────────────────┬────────────────────────────────────┘

┌────────────────────▼────────────────────────────────────┐
│ LAYER 4: ROUTE-LEVEL PROTECTION                         │
│ - PrivateRoute component in layout                      │
│ - Check session exists                                  │
│ - Validate access type                                  │
│ - Check allowed roles (if specified)                    │
│ - Verify permission level (if required)                 │
└────────────────────┬────────────────────────────────────┘

┌────────────────────▼────────────────────────────────────┐
│ LAYER 5: COMPONENT-LEVEL CHECKS                         │
│ - useSession() in components                            │
│ - Direct checks in page.jsx                             │
│ - Conditional rendering based on permissions            │
└─────────────────────────────────────────────────────────┘
```

### JWT Token Security

**Strategy:** Use HTTP-only Secure Cookies

```javascript
// NextAuth automatically handles:
// ✓ Token signed with NEXTAUTH_SECRET
// ✓ Stored in HTTP-only cookie (next-auth.session-token)
// ✓ Cannot be accessed via JavaScript (XSS protection)
// ✓ Sent automatically with every request
// ✓ Expires after maxAge (24 hours default)
// ✓ Refreshed automatically if still valid
```

### Session Verification Flow

```javascript
// When component mounts/user navigates:
const { data: session, status } = useSession()

// status values:
// 'loading'     → Session check in progress
// 'unauthenticated' → No valid session
// 'authenticated'   → Valid session exists

// session structure:
// {
//   user: { email, role_id, hasAdminAccess, hasPortalAccess, userDeets, permission_level },
//   expires: 'ISO timestamp'
// }
```

### Preventing Unauthorized Access

#### 1. Try to Access Protected Route Without Auth
```
1. User goes to /admin/dashboard
2. PrivateRoute component checks session
3. status === 'loading' → show spinner
4. status complete, no session → redirect to /admin/login
```

#### 2. Try to Access with Insufficient Role
```
1. Portal user (role_id=5) tries /admin/dashboard
2. useSession() returns session with hasAdminAccess=false
3. PrivateRoute checks: hasAdminAccess === false
4. Redirect to /unauthorized
```

#### 3. Try to Access Super Admin Feature
```
1. Admin user (permission_level='admin') tries /admin/dashboard/payments
2. Navigation item filtered out, link doesn't appear
3. If tries direct URL: /admin/dashboard/payments
4. AdminSideNav permission check blocks access
5. If somehow reaches page: permission check in page.jsx blocks it
6. Multiple fallback checks ensure no leaks
```

---

## Data Flow Diagrams

### Complete Authentication & Access Flow

```
USER INPUT
    │
    ├─ Email/Password
    ├─ Login Type (admin/portal)
    │
    ▼
┌─────────────────────────────┐
│ signIn('admin-credentials') │
│ (Client-side)               │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ NextAuth authorize()        │
│ (Server-side)               │
├─────────────────────────────┤
│ ✓ Query DBMID API           │
│ ✓ Verify MD5 password       │
│ ✓ Check role_id access      │
│ ✓ Fetch Supabase permission │
│ ✓ Return user object        │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ JWT Callback                │
│ (Server-side)               │
├─────────────────────────────┤
│ ✓ Store role_id in token    │
│ ✓ Store hasAdminAccess      │
│ ✓ Store hasPortalAccess     │
│ ✓ Store userDeets           │
│ ✓ Store permission_level    │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Session Callback            │
│ (Server-side)               │
├─────────────────────────────┤
│ ✓ Extract JWT data          │
│ ✓ Populate session.user     │
│ ✓ Send to client            │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ SessionSync (Jotai)         │
│ (Client-side)               │
├─────────────────────────────┤
│ ✓ Watch session changes     │
│ ✓ Store userDeets to atom   │
│ ✓ Available app-wide        │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ Router Decision             │
│ (Client-side)               │
├─────────────────────────────┤
│ if hasAdminAccess           │
│   → /admin/dashboard        │
│                             │
│ if hasPortalAccess          │
│   → /portal/dashboard       │
│                             │
│ if neither                  │
│   → /unauthorized           │
└─────────────────────────────┘
```

### Session & State Flow

```
NextAuth Session
│
├─ session.user.email
├─ session.user.role_id
├─ session.user.hasAdminAccess
├─ session.user.hasPortalAccess
├─ session.user.userDeets
│   └─ m_id, membership_id, m_username, card_name, club_id, ...
│
└─ session.user.permission_level
     └─ 'admin', 'super_admin', or null

         │
         ├─────────────────────────┐
         │                         │
         ▼                         ▼
    Jotai Atom              PrivateRoute
    userDeetsAtom           Component
    └─ Synced with          └─ Access Control
      SessionSync           ├─ accessType check
      └─ App-wide access   ├─ role check
                           ├─ permission check
                           └─ Redirect if denied
```

### Navigation Filtering Flow

```
User Logged In
    │
    ▼
Get session.user data
    │
    ├─ permission_level
    ├─ role_id
    │
    ▼
AdminSideNav Component
    │
    ├─ Get userPermissionLevel
    ├─ Get userRoleId
    ├─ Check isBasicAdmin [1,2,3,4]
    │
    ▼
Filter NAV_ITEMS
    │
    ├─ permission: "basic"
    │  └─ Show if isBasicAdmin
    │
    ├─ permission: "admin"
    │  └─ Show if permission_level >= 'admin'
    │
    ├─ permission: "super_admin"
    │  └─ Show if permission_level === 'super_admin'
    │
    ▼
Render Filtered Navigation
```

---

## Implementation Checklist

### For Replicating in Another Platform

#### Phase 1: Infrastructure Setup
- [ ] Create NextAuth configuration file
- [ ] Set up Credentials Provider with authorize() function
- [ ] Configure JWT callbacks (jwt, session)
- [ ] Set up NEXTAUTH_SECRET environment variable
- [ ] Configure NEXTAUTH_URL environment variable

#### Phase 2: External API Integration
- [ ] Connect to legacy authentication API (or equivalent)
  - [ ] Implement user lookup query
  - [ ] Implement MD5 password verification
  - [ ] Handle API errors gracefully
- [ ] Store API key in secure environment variable
- [ ] Implement retry logic for API failures

#### Phase 3: Database Integration
- [ ] Create permissions table in database
  - Fields: RMIS_ID, permission_level, user_id, created_at, updated_at
  - permission_level values: 'admin', 'super_admin', null
- [ ] Create roles/role_id mapping
- [ ] Fetch permission_level from database after successful login

#### Phase 4: Session Management
- [ ] Implement JWT callback to store required data
- [ ] Implement session callback to populate session object
- [ ] Verify HTTP-only cookie creation
- [ ] Test token expiration and refresh
- [ ] Implement session invalidation on logout

#### Phase 5: State Management
- [ ] Create Jotai atoms for user details
- [ ] Create cache management atoms
- [ ] Create SessionProvider component to sync NextAuth ↔ Jotai
- [ ] Implement cache validity checking
- [ ] Create cache invalidation helpers

#### Phase 6: Route Protection
- [ ] Create PrivateRoute component with:
  - [ ] Authentication check
  - [ ] Access type verification (admin vs portal)
  - [ ] Role-based access control
  - [ ] Permission level checking
  - [ ] Redirect logic
- [ ] Implement loading states
- [ ] Add fallback error handling

#### Phase 7: Authorization Layers
- [ ] Layer 1: Login validation (credentials)
- [ ] Layer 2: Access type check (admin vs portal)
- [ ] Layer 3: Permission level check (Supabase)
- [ ] Layer 4: Route protection (PrivateRoute)
- [ ] Layer 5: Component-level checks

#### Phase 8: Navigation & UI
- [ ] Create navigation configuration with permission levels
- [ ] Implement permission-based filtering
- [ ] Create AdminSideNav component
- [ ] Create PortalSideNav component
- [ ] Add navigation items with permission mappings

#### Phase 9: Login Pages
- [ ] Create /admin/login page
- [ ] Create /portal/login page
- [ ] Implement signIn() calls with loginType
- [ ] Add redirect logic after login
- [ ] Implement error handling and toast notifications

#### Phase 10: Testing & Security
- [ ] Test authentication flow end-to-end
- [ ] Test role-based access control
- [ ] Test permission level restrictions
- [ ] Test route protection redirects
- [ ] Verify JWT token security
- [ ] Test session expiration
- [ ] Test unauthorized access attempts
- [ ] Verify no sensitive data in logs

#### Phase 11: Deployment
- [ ] Set environment variables in production
- [ ] Verify NEXTAUTH_SECRET is secure
- [ ] Set NEXTAUTH_URL to production domain
- [ ] Test authentication in staging
- [ ] Monitor auth errors in production
- [ ] Implement auth analytics/logging

---

## Key Environment Variables Summary

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `NEXTAUTH_SECRET` | Yes | Random 32-char string | JWT signing key |
| `NEXTAUTH_URL` | Yes | http://localhost:3000 | NextAuth callback URL |
| `NEXT_PUBLIC_DBMID_API_KEY` | Yes | your-api-key | Legacy API authentication |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | https://xxx.supabase.co | Supabase endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | eyJhbGc... | Supabase public key |
| `SUPABASE_SERVICE_KEY` | Optional | eyJhbGc... | Supabase admin operations |

---

## Critical Security Notes

1. **Never commit `.env.local`** - Contains secrets
2. **NEXTAUTH_SECRET must be strong** - Use `openssl rand -base64 32` to generate
3. **MD5 passwords are legacy** - Consider migration to bcrypt for new systems
4. **JWT tokens are not encrypted** - Only signed (base64 encoded, readable)
5. **HTTP-only cookies prevent XSS** - But CSRF protection still needed
6. **Permission level is single source of truth** - For feature gating
7. **Role ID from legacy API** - Cannot be changed in modern system directly
8. **Cache sensitive data locally** - But validate server-side on every request
9. **No API calls use JWT directly** - Session passed through context, not headers
10. **DBMID API is point of failure** - Implement timeout and retry logic

---

## Troubleshooting Guide

### Issue: Login Page Redirects Immediately
**Cause:** useEffect redirect check running before session loads
**Solution:** Check status === 'loading' before redirecting

### Issue: Session Is Null After Login
**Cause:** JWT callback not returning all required fields
**Solution:** Verify jwt callback includes: role_id, hasAdminAccess, hasPortalAccess, userDeets

### Issue: Permission Level Always Null
**Cause:** Supabase query failing or no row in permissions table
**Solution:** Check permissions table exists, RMIS_ID matches membership_id

### Issue: PrivateRoute Loops Infinitely
**Cause:** Redirect happens before session fully loaded
**Solution:** Add status === 'loading' check and return loading component

### Issue: Navigation Items Not Filtering
**Cause:** Permission level not included in session
**Solution:** Verify session callback adds permission_level to session.user

### Issue: DBMID API Returning No Results
**Cause:** Username case sensitivity or incorrect field name
**Solution:** Log API response, verify m_username matches input, check case sensitivity

### Issue: MD5 Password Mismatch
**Cause:** Case sensitivity or hash encoding issues
**Solution:** Compare both hashes in lowercase using .toLowerCase()

---

## References & Related Files

### Authentication
- `/src/app/api/auth/[...nextauth]/route.js` - NextAuth configuration
- `/src/app/api/council/route.js` - DBMID API integration
- `/src/app/admin/login/page.jsx` - Admin login UI
- `/src/app/portal/login/page.jsx` - Portal login UI

### Access Control
- `/src/lib/PrivateRoute.jsx` - Route protection component
- `/src/app/admin/components/AdminSideNav.jsx` - Permission-filtered nav
- `/src/app/admin/dashboard/permissions/page.jsx` - Permissions management

### State & Session
- `/src/components/SessionProvider.jsx` - NextAuth + Jotai sync
- `/src/app/state/store.js` - Jotai atom definitions
- `/src/app/layout.js` - Root layout with SessionProvider

### Configuration
- `/src/config/app.config.js` - Feature flags and constraints

---

## Document Version & Changelog

**Version:** 1.0  
**Last Updated:** November 7, 2025  
**Author:** AI Coding Agent (Jarvis)  
**Platform:** Next.js 15, NextAuth v4, Supabase, DBMID API

### Recent Updates
- Added complete authentication flow diagram
- Added session structure details
- Added environmental variable complete reference
- Added troubleshooting guide
- Added implementation checklist for replication
