# RCLPortal AI Coding Agent Instructions

## Project Overview

**RCLPortal** is a Next.js 15 web application for managing Rotaract club registrations, tournament brackets, and leaderboards. The app serves dual audiences: administrative dashboard (club leaders, organizers) and player portal (individual participants). Built with modern React patterns (Jotai atoms, server components), Supabase backend, and NextAuth for authentication.

**Key Tech Stack:**
- Frontend: Next.js 15 (App Router), React 19, Tailwind CSS + Radix UI
- State: Jotai (client-side atoms with localStorage persistence)
- Auth: NextAuth v4 with custom credentials provider
- Backend Services: Supabase (PostgreSQL), external DBMID API (club membership data)
- Deployment: Firebase App Hosting with Secret Manager

---

## Architecture & Data Flow

### Authentication & Authorization

1. **Dual Login System**: Admin login (`/admin/login`) and Portal login (`/portal/login`)
   - Both use NextAuth CredentialsProvider → `/api/auth/[...nextauth]/route.js`
   - Sources user data from **DBMID external API** (legacy club database) via `/api/auth/validate`
   - MD5 password verification against `club_membership_data` table

2. **Permission Hierarchy** (critical for access control):
   - `role_id 1-4`: Admin access (admin dashboard)
   - `role_id 1-6`: Portal access (player dashboard)
   - **Optional permission_level** field in Supabase `permissions` table: `'admin'` or `'super_admin'`
     - Controls feature gating (e.g., Payments, Clubs mgmt require `super_admin`)
     - See `AdminSideNav.jsx` `filteredNavItems` logic

3. **Session Sync Pattern**: `SessionProvider.jsx` syncs NextAuth session → `userDeetsAtom` for API access
   - User details stored in `session.user.userDeets` throughout request lifecycle

### Data Sources & Integration

- **Supabase**: Sports, teams, registrations, brackets, matches, permissions
- **DBMID API** (`https://info.rotaract3220.org/api/query`): Club membership, user validation
  - Requires `NEXT_PUBLIC_DBMID_API_KEY` header
  - Used in `/api/auth/validate` and `/api/council/route.js` for member lookups

### State Management (Jotai)

- **Cache Strategy**: `atomWithStorage` persists data to localStorage with timestamp validation
  - `CACHE_DURATION` object defines freshness thresholds (2-10 min per data type)
  - Admin dashboard cached for 1 min (high priority), sports for 2 min
- **Key Atoms**: `userDeetsAtom`, `sportsDataAtom`, `adminDashboardDataAtom`, `matchesAtom`, `bracketDataAtom`
- **Invalidation**: `invalidateCacheAtom` helper sets timestamp to 0 to force refresh

### Admin Dashboard Pattern

1. **Single Optimized API**: `/api/admin/dashboard/optimized` fetches all data in parallel
   - Returns: `{ stats, leaderboard, pendingRequests }`
   - Example usage in `src/app/admin/dashboard/page.jsx`:
     ```javascript
     const [dashboardData, setDashboardData] = useAtom(adminDashboardDataAtom);
     const fetchOptimizedDashboardData = useCallback(async (forceRefresh = false) => {
       if (!forceRefresh && isDataCacheValid && dashboardData.stats.totalClubs > 0) {
         return; // Skip if cached and valid
       }
       const data = await getOptimizedDashboardData(category, limit);
       setDashboardData({...});
     }, [isDataCacheValid, dashboardData.stats.totalClubs]);
     ```

2. **Service Layer**: All API calls wrapped in `src/services/*Service.js`
   - Pattern: Fetch → Error handling → Return `{ success, data/error, message }`
   - Example: `getOptimizedDashboardData()` in `adminServices.js`

---

## Project-Specific Conventions

### App Configuration

- **Centeralized Config**: `src/config/app.config.js` houses all feature flags and constraints
  - `SPORT_DAYS` enum (E_SPORT, DAY_01, etc.) with place values for participation points
  - `APP_CONFIG` object: registration dates, fees (800 Rs), participation points per sport
  - **Always update** this for season changes (REGISTRATION_OPENING_DATE, CURRENT_SPORT_DAY)

### API Route Patterns

1. **Standard Response Format**:
   ```javascript
   // Success
   NextResponse.json({ success: true, data: {...}, message: "..." }, { status: 200 });
   // Error
   NextResponse.json({ success: false, error: "...", statusCode: 400 }, { status: 400 });
   ```

2. **Query Parameter Handling**:
   ```javascript
   const { searchParams } = new URL(request.url);
   const page = parseInt(searchParams.get('page') || '1');
   const limit = parseInt(searchParams.get('limit') || '10');
   const offset = (page - 1) * limit;
   ```

3. **Filter Syntax** (seen in registrations route):
   - Pass JSON filter objects as query params: `?filter={"sport_id":4,"status":"approved"}`
   - Parse and apply via Supabase `.eq()` chains

4. **Supabase Parallel Queries**:
   - Use `Promise.all()` for independent queries (see `teams/route.js`):
   ```javascript
   const [sportData, teamsData, registrations] = await Promise.all([
     supabase.from('events').select(...).eq('sport_id', sport_id).single(),
     supabase.from('teams').select(...).eq('sport_id', sport_id),
     supabase.from('registrations').select(...).eq('sport_id', sport_id)
   ]);
   ```

### Component Structure

1. **Use Client Components** for user interactions (buttons, forms, modals)
   - Always include `'use client'` directive
   - Example: `AdminSideNav.jsx`, `page.jsx` files in dashboard

2. **Shadcn UI Components**: Located in `src/components/ui/` (button, dialog, select, table, etc.)
   - Use `cn()` utility (from `lib/utils.js`) to merge Tailwind classes

3. **Permission Checking**: Use `PrivateRoute.jsx` wrapper for protected pages
   - Props: `allowedRoles`, `accessType` ('admin'|'portal'), `requiredPermission` ('admin'|'super_admin')
   - Auto-redirects unauthenticated users to `/admin/login` or `/portal/login`

### UI Patterns

- **Notifications**: Use `sonner` toast library (already configured in layout)
  - `import { toast } from 'sonner'; toast.success/error/loading(...)`
- **Loading States**: Leverage Jotai atoms (`*LoadingAtom`) to show spinners
- **Responsive**: Tailwind dark mode enabled (`dark` class in body)

---

## Critical Workflows

### Setting Up Development Environment

1. **Install Dependencies**:
   ```powershell
   cd rcl-portal
   npm install
   ```

2. **Environment Variables** (`.env.local`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
   NEXT_PUBLIC_DBMID_API_KEY=your-key-here
   NEXTAUTH_SECRET=your-secret (generate: `openssl rand -base64 32`)
   NEXTAUTH_URL=http://localhost:3000
   ```

3. **Run Dev Server**:
   ```powershell
   npm run dev
   # Server at http://localhost:3000
   ```

### Building & Deploying

1. **Local Build** (catch errors early):
   ```powershell
   npm run build
   ```

2. **Firebase Deployment** (requires Firebase CLI):
   - Create secrets in Google Secret Manager (SUPABASE_URL, SUPABASE_ANON_KEY, DBMID_API_KEY, NEXTAUTH_SECRET)
   - Grant access: `firebase apphosting:secrets:grantaccess SECRET_NAME --backend rcl-portal`
   - Deploy: `firebase deploy`
   - See `DEPLOYMENT.md` for full walkthrough

3. **Linting**:
   ```powershell
   npm run lint
   ```

---

## Common Patterns & Anti-Patterns

### ✅ DO:

1. **Validate Input** before API calls
   ```javascript
   if (!name.trim() && !nic.trim() && !rmisId.trim()) {
     return NextResponse.json({ success: true, data: { players: [] } });
   }
   ```

2. **Use Admin Dashboard Cache** to avoid redundant fetches
   ```javascript
   if (!forceRefresh && isCacheValid(timestamp, 'adminDashboard')) {
     return; // Skip fetch
   }
   ```

3. **Check Permission Level** for sensitive operations
   ```javascript
   if (userPermissionLevel !== 'super_admin') {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
   }
   ```

4. **Batch API Calls** when independent (teams + sports + registrations)
   - Use `Promise.all()` to reduce latency

### ❌ DON'T:

1. **Hardcode Secrets** in code or environment defaults
   - Always use `process.env.VARIABLE_NAME`

2. **Forget Role ID Ranges**:
   - Admin: `[1, 2, 3, 4]`
   - Portal: `[1, 2, 3, 4, 5, 6]`
   - Incorrectly checking roles breaks authorization

3. **Ignore Cache Timestamps** in admin operations
   - Always call `isCacheValid(timestamp, 'typeKey')` before fetching

4. **Use Direct Supabase Client** in components
   - Always route through `/api/*` endpoints for consistency and security

---

## Key File References

| Path | Purpose |
|------|---------|
| `src/app/api/auth/[...nextauth]/route.js` | NextAuth config, credential provider |
| `src/app/api/auth/validate/route.js` | DBMID API validation, portal auth |
| `src/app/api/admin/dashboard/optimized/route.js` | Parallel admin data fetch |
| `src/config/app.config.js` | Feature flags, sport days, constraints |
| `src/app/state/store.js` | Jotai atom definitions, cache duration constants |
| `src/services/adminServices.js` | Admin API wrappers |
| `src/lib/PrivateRoute.jsx` | Role-based access control |
| `src/components/SessionProvider.jsx` | NextAuth + Jotai sync |
| `src/app/admin/components/AdminSideNav.jsx` | Permission-filtered navigation |

---

## Debugging Tips

1. **Session Issues**: Check browser DevTools → Application → Cookies → `next-auth.session-token`
2. **Cache Stale**: Manually invalidate: `invalidateCacheAtom.set(set, 'adminDashboard')`
3. **DBMID Errors**: Verify `NEXT_PUBLIC_DBMID_API_KEY` and endpoint reachability
4. **Supabase Connection**: Check RLS policies if queries return empty results
5. **NextAuth Redirect Loops**: Verify `session.user` has `userDeets` property after login

---

## Questions Before Implementing

When adding new features, clarify:
- Does this require **new permission level** (admin vs super_admin)?
- Should data be **cached** (and for how long)?
- Is this **admin-only** (role 1-4) or **portal access** (role 1-6)?
- Does it integrate with **DBMID API** (legacy system)?
- Should it appear in **optimized dashboard** or separate endpoint?
