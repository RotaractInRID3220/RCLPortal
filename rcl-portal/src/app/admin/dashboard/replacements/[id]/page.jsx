'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAtom } from 'jotai'
import { userDeetsAtom } from '@/app/state/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Repeat2,
  Calendar,
  User,
  FileText,
  ExternalLink,
  Shield,
  AlertCircle,
  MapPin,
  Trophy,
  Users,
  Mail,
  Phone,
  ArrowRight,
} from 'lucide-react'
import PrivateRoute from '@/lib/PrivateRoute'
import Link from 'next/link'

const ReplacementRequestDetailPage = () => {
  const params = useParams()
  const router = useRouter()
  const [userDetails] = useAtom(userDeetsAtom)
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState(null)
  const [rejectingId, setRejectingId] = useState(null)

  useEffect(() => {
    fetchRequestDetail()
  }, [params.id])

  const fetchRequestDetail = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/replacements/${params.id}`)
      const result = await response.json()

      if (!result.success) {
        toast.error(result.error || 'Failed to fetch request details')
        router.push('/admin/dashboard/replacements')
        return
      }

      setRequest(result.request)
    } catch (error) {
      console.error('Error fetching request details:', error)
      toast.error('Failed to fetch request details')
      router.push('/admin/dashboard/replacements')
    } finally {
      setLoading(false)
    }
  }

  const handleApproveRequest = async () => {
    try {
      setApprovingId(request.id)

      const response = await fetch('/api/admin/replacements/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request_id: request.id,
          approved_by: userDetails.membership_id,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        toast.error(result.error || 'Failed to approve replacement request')
        return
      }

      toast.success('Replacement request approved successfully')
      router.push('/admin/dashboard/replacements?tab=approved')
    } catch (error) {
      console.error('Error approving replacement request:', error)
      toast.error('Failed to approve replacement request')
    } finally {
      setApprovingId(null)
    }
  }

  const handleRejectRequest = async () => {
    try {
      setRejectingId(request.id)

      const response = await fetch('/api/admin/replacements/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request_id: request.id,
          rejected_by: userDetails.membership_id,
        }),
      })

      const result = await response.json()

      if (!result.success) {
        toast.error(result.error || 'Failed to reject replacement request')
        return
      }

      toast.success('Replacement request rejected successfully')
      router.push('/admin/dashboard/replacements?tab=rejected')
    } catch (error) {
      console.error('Error rejecting replacement request:', error)
      toast.error('Failed to reject replacement request')
    } finally {
      setRejectingId(null)
    }
  }

  const getStatusBadge = (status, approvedBy = null) => {
    if (status === true) {
      return (
        <div className="flex items-center gap-3">
          <Badge className="bg-green-500/10 text-green-500 border-green-500 px-3 py-1">
            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
            Approved
          </Badge>
          {approvedBy && <span className="text-sm text-white/60">by: {approvedBy}</span>}
        </div>
      )
    } else if (status === false) {
      return (
        <div className="flex items-center gap-3">
          <Badge className="bg-red-500/10 text-red-500 border-red-500 px-3 py-1">
            <XCircle className="w-3.5 h-3.5 mr-1.5" />
            Rejected
          </Badge>
          {approvedBy && <span className="text-sm text-white/60">by: {approvedBy}</span>}
        </div>
      )
    } else {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500 px-3 py-1">
          <Clock className="w-3.5 h-3.5 mr-1.5" />
          Pending Review
        </Badge>
      )
    }
  }

  const formatDateTime = (date) => {
    if (!date) return '-'
    const d = new Date(date)
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }

  if (loading) {
    return (
      <PrivateRoute requiredPermission="super_admin" accessType="admin">
        <div className="flex justify-center items-center h-screen">
          <img src="/load.svg" alt="Loading..." className="w-20" />
        </div>
      </PrivateRoute>
    )
  }

  if (!request) {
    return (
      <PrivateRoute requiredPermission="super_admin" accessType="admin">
        <div className="flex flex-col items-center justify-center h-screen">
          <AlertCircle className="w-16 h-16 text-white/30 mb-4" />
          <p className="text-white/60">Request not found</p>
          <Button onClick={() => router.push('/admin/dashboard/replacements')} className="mt-4 cursor-pointer">
            Back to Replacements
          </Button>
        </div>
      </PrivateRoute>
    )
  }

  return (
    <PrivateRoute requiredPermission="super_admin" accessType="admin">
      <div className="space-y-6 pb-8">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/admin/dashboard/replacements')}
              className="cursor-pointer bg-white/5 border-white/20 hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-3">
                <Repeat2 className="w-8 h-8 text-cranberry" />
                Replacement Request #{request.id}
              </h1>
              <p className="text-sm text-white/60 mt-1">Review and process this replacement request</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(request.status, request.approved_by)}
            {request.status === null && (
              <>
                <Button
                  onClick={handleApproveRequest}
                  disabled={approvingId || rejectingId}
                  className="cursor-pointer bg-green-500 hover:bg-green-600 text-white"
                >
                  {approvingId ? (
                    <>
                      <img src="/load.svg" alt="Loading..." className="w-4 h-4 mr-2" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleRejectRequest}
                  disabled={rejectingId || approvingId}
                  className="cursor-pointer bg-red-500 hover:bg-red-600 text-white"
                >
                  {rejectingId ? (
                    <>
                      <img src="/load.svg" alt="Loading..." className="w-4 h-4 mr-2" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Status Timeline Card */}
        {(request.status !== null || request.approved_at) && (
          <Card className="bg-gradient-to-r from-cranberry/10 via-white/5 to-white/5 border-white/15">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-white/50">Submitted</p>
                      <p className="text-sm font-medium">{formatDateTime(request.created_at)}</p>
                    </div>
                  </div>
                  {request.approved_at && (
                    <>
                      <ArrowRight className="w-5 h-5 text-white/30" />
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            request.status === true ? 'bg-green-500/20' : 'bg-red-500/20'
                          }`}
                        >
                          {request.status === true ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-white/50">{request.status === true ? 'Approved' : 'Rejected'}</p>
                          <p className="text-sm font-medium">{formatDateTime(request.approved_at)}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {request.requested_by && (
                  <div className="text-right">
                    <p className="text-xs text-white/50">Requested by</p>
                    <p className="text-sm font-medium">{request.requested_by}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Event & Club Info */}
          <div className="space-y-6">
            {/* Sport Card */}
            <Card className="bg-white/5 border-white/15">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-cranberry" />
                  Sport Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-xs text-white/50 mb-1.5">Sport Name</p>
                  <p className="text-lg font-semibold">{request.sport?.sport_name || '-'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-white/50 mb-1.5">Gender</p>
                    <Badge variant="outline" className="border-white/30">
                      {request.sport?.gender_type}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-white/50 mb-1.5">Type</p>
                    <Badge variant="outline" className="border-white/30">
                      {request.sport?.sport_type}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Calendar className="w-3.5 h-3.5 text-cranberry" />
                      <p className="text-xs text-white/50">Event Day</p>
                    </div>
                    <p className="text-sm font-medium">{request.sport?.sport_day || '-'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-white/50 mb-1.5">Category</p>
                    <Badge className="bg-purple-500/20 text-purple-200 border-purple-500/40">
                      {request.sport?.category || '-'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Club Card */}
            <Card className="bg-white/5 border-white/15">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-cranberry" />
                  Club Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-white/50 mb-1">Club Name</p>
                  <p className="text-lg font-semibold">{request.club_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-white/50 mb-1">Club ID</p>
                  <p className="text-sm text-white/70 font-mono">{request.club_id || '-'}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle Column - Player Comparison */}
          <div className="lg:col-span-2 space-y-6">
            {/* Player Replacement Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Original Player */}
              <Card className="bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent border-red-500/20">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-400" />
                    Original Player
                  </CardTitle>
                  <p className="text-xs text-white/50">Player being replaced</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center border-2 border-red-500/30">
                      <User className="w-8 h-8 text-red-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xl font-bold">{request.original_player?.name || 'Unknown'}</p>
                      <p className="text-sm text-white/50 font-mono">{request.original_player?.RMIS_ID}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
                    <div>
                      <p className="text-xs text-white/50 mb-1">Role</p>
                      <Badge className="bg-white/10 border-white/20 text-white">
                        {request.original_player?.main_player ? 'Main Player' : 'Reserve'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-white/50 mb-1">Gender</p>
                      <Badge className="bg-white/10 border-white/20 text-white">{request.original_player?.gender || '-'}</Badge>
                    </div>
                  </div>
                  {request.original_player?.RI_ID && (
                    <div className="pt-3 border-t border-white/10">
                      <p className="text-xs text-white/50 mb-1">RI Number</p>
                      <p className="text-sm font-mono text-white/70">{request.original_player.RI_ID}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Replacement Player */}
              <Card className="bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent border-green-500/20">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    Replacement Player
                  </CardTitle>
                  <p className="text-xs text-white/50">New player joining the team</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center border-2 border-green-500/30">
                      <User className="w-8 h-8 text-green-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xl font-bold">{request.replacement_player?.name || 'Unknown'}</p>
                      <p className="text-sm text-white/50 font-mono">{request.replacement_player?.RMIS_ID}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10">
                    <div>
                      <p className="text-xs text-white/50 mb-1">Status</p>
                      <Badge
                        className={
                          request.replacement_player?.status === 1 || request.replacement_player?.status === 3
                            ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                            : 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                        }
                      >
                        {request.replacement_player?.status === 1 || request.replacement_player?.status === 3
                          ? 'General'
                          : 'Prospective'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-white/50 mb-1">Gender</p>
                      <Badge className="bg-white/10 border-white/20 text-white">{request.replacement_player?.gender || '-'}</Badge>
                    </div>
                  </div>
                  {request.replacement_player?.ri_number && (
                    <div className="pt-3 border-t border-white/10">
                      <p className="text-xs text-white/50 mb-1">RI Number</p>
                      <p className="text-sm font-mono text-white/70">{request.replacement_player.ri_number}</p>
                    </div>
                  )}
                  {request.replacement_player?.nic && (
                    <div>
                      <p className="text-xs text-white/50 mb-1">NIC</p>
                      <p className="text-sm font-mono text-white/70">{request.replacement_player.nic}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Reason for Replacement */}
            <Card className="bg-white/5 border-white/15">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cranberry" />
                  Reason for Replacement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-white/90 whitespace-pre-wrap leading-relaxed">{request.reason || '-'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Supporting Documents */}
            {request.supporting_link && (
              <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/20">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-400" />
                    Supporting Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Link
                    href={request.supporting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <ExternalLink className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">View Attached Document</p>
                        <p className="text-xs text-white/50">Opens in new tab</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors" />
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PrivateRoute>
  )
}

export default ReplacementRequestDetailPage
