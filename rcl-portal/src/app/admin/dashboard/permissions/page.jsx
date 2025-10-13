'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

export default function PermissionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [searchName, setSearchName] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [permissions, setPermissions] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/admin/login')
      return
    }
    // Allow access for role_id=1 (super admin role) or if user has super_admin permission
    const hasAccess = session.user.role_id === 1 || session.user.permission_level === 'super_admin'
    if (!hasAccess) {
      router.push('/unauthorized')
      return
    }
    fetchPermissions()
  }, [session, status, router])

  const fetchPermissions = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/permissions')
      const data = await res.json()
      if (res.ok) {
        setPermissions(data.permissions)
      } else {
        toast.error("Failed to fetch permissions")
      }
    } catch (error) {
      console.error('Error fetching permissions:', error)
      toast.error("Error fetching permissions")
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (searchName.length < 3) {
      toast.error("Please enter at least 3 characters")
      return
    }
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/admin/search-users?name=${encodeURIComponent(searchName)}`)
      const data = await res.json()
      if (res.ok) {
        setSearchResults(data.users)
        if (data.users.length === 0) {
          toast.info("No users found matching the search criteria")
        }
      } else {
        toast.error("Failed to search users")
      }
    } catch (error) {
      console.error('Error searching users:', error)
      toast.error("Error searching users")
    } finally {
      setSearchLoading(false)
    }
  }

  const handleAddPermission = async (user, permissionLevel) => {
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RMIS_ID: user.RMIS_ID, permission_level: permissionLevel, card_name: user.card_name })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Permission "${permissionLevel}" added to ${user.card_name}`)
        fetchPermissions()
        setSearchResults([])
        setSearchName('')
      } else {
        toast.error(data.error || "Failed to add permission")
      }
    } catch (error) {
      console.error('Error adding permission:', error)
      toast.error("Error adding permission")
    }
  }

  const handleRemovePermission = async (rmisId, userName) => {
    if (!confirm(`Are you sure you want to remove permissions from ${userName}?`)) {
      return
    }
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ RMIS_ID: rmisId })
      })
      if (res.ok) {
        toast.success("Permission removed successfully")
        fetchPermissions()
      } else {
        toast.error("Failed to remove permission")
      }
    } catch (error) {
      console.error('Error removing permission:', error)
      toast.error("Error removing permission")
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center h-full">
        <img src="/load.svg" alt="" className="w-20" />
      </div>
    )
  }

  return (
    <PrivateRoute requiredPermission="super_admin"  accessType="admin">
    <div className="">
      <div className="flex w-full justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold tracking-wide">PERMISSIONS MANAGEMENT</h1>
      </div>

      {/* Search Users Section */}
      <div className="bg-white/5 rounded-lg p-8 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-white">Search Users</h2>
        <p className="text-white/60 mb-4">Search for users by name to assign permissions.</p>

        <div className="flex gap-4 mb-6">
          <Input
            type="text"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            placeholder="Enter user name (min 3 characters)"
            className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button
            onClick={handleSearch}
            disabled={searchName.length < 3 || searchLoading}
            className="bg-cranberry/80 hover:bg-cranberry border border-cranberry hover:shadow hover:shadow-cranberry text-white px-6 cursor-pointer"
          >
            {searchLoading ? 'Searching...' : 'Search'}
          </Button>
        </div>

        {searchResults.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">Search Results</h3>
            <div className="space-y-3">
              {searchResults.map((user) => (
                <div key={user.RMIS_ID} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{user.card_name}</h4>
                      <p className="text-sm text-white/60">RMIS ID: {user.RMIS_ID} | Role: {user.role_id}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Select defaultValue="admin">
                        <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="super_admin">Super Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => {
                          const selectElement = document.querySelector(`[data-radix-select-value]`)
                          const level = selectElement?.textContent?.toLowerCase().replace(' ', '_') || 'admin'
                          handleAddPermission(user, level)
                        }}
                        className="bg-green-500/80 hover:bg-green-500 border border-green-500 hover:shadow hover:shadow-green-500 text-white px-4 cursor-pointer"
                      >
                        Add Permission
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Current Permissions Section */}
      <div className="bg-white/5 rounded-lg p-8">
        <h2 className="text-xl font-semibold mb-4 text-white">Current Permissions</h2>
        <p className="text-white/60 mb-6">Manage existing user permissions. Super Admin has higher privileges than Admin.</p>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-white/60">Loading permissions...</p>
          </div>
        ) : permissions.length === 0 ? (
          <div className="text-center py-8 text-white/50">
            <p>No permissions assigned yet. Search for users above to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {permissions.map((perm) => (
              <div key={perm.RMIS_ID} className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-white">{perm.card_name || 'Unknown User'}</h4>
                    <p className="text-sm text-white/60">
                      RMIS ID: {perm.RMIS_ID} |
                      <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                        perm.permission_level === 'super_admin'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        {perm.permission_level === 'super_admin' ? 'Super Admin' : 'Admin'}
                      </span>
                    </p>
                  </div>
                  <Button
                    onClick={() => handleRemovePermission(perm.RMIS_ID, perm.card_name || 'Unknown User')}
                    variant="destructive"
                    className="bg-red-500/80 hover:bg-red-500 border border-red-500 hover:shadow hover:shadow-red-500 text-white px-4 cursor-pointer"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </PrivateRoute>
  )
}