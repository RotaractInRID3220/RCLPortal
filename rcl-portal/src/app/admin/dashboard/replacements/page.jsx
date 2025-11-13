'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAtom } from 'jotai'
import { userDeetsAtom } from '@/app/state/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Repeat2,
  Users,
  User,
  ArrowRight,
} from 'lucide-react'
import PrivateRoute from '@/lib/PrivateRoute'
import { useRouter } from 'next/navigation'

const AdminReplacementsPage = () => {
  const [userDetails] = useAtom(userDeetsAtom)
  const [activeTab, setActiveTab] = useState('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [requests, setRequests] = useState([])
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const itemsPerPage = 10

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams({
        tab: activeTab,
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        search: searchTerm,
      })

      const response = await fetch(`/api/admin/replacements?${params}`)
      const result = await response.json()

      if (!result.success) {
        toast.error(result.error || 'Failed to fetch replacement requests')
        return
      }

      setRequests(result.requests || [])
      setTotalPages(result.totalPages || 0)
      setTotalCount(result.totalCount || 0)
    } catch (error) {
      console.error('Error fetching replacement requests:', error)
      toast.error('Failed to fetch replacement requests')
    } finally {
      setLoading(false)
    }
  }, [activeTab, currentPage, searchTerm])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleSearch = (e) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1)
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setCurrentPage(1)
    setSearchTerm('')
  }

  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

  const handleRowClick = (request) => {
    router.push(`/admin/dashboard/replacements/${request.id}`)
  }

  const getStatusBadge = (status, approvedBy = null) => {
    if (status === true) {
      return (
        <div className="flex items-center gap-2">
          <Badge className="bg-green-500/10 text-green-500 border-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
          {approvedBy && <span className="text-xs text-white/50">by: {approvedBy}</span>}
        </div>
      )
    } else if (status === false) {
      return (
        <div className="flex items-center gap-2">
          <Badge className="bg-red-500/10 text-red-500 border-red-500">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
          {approvedBy && <span className="text-xs text-white/50">by: {approvedBy}</span>}
        </div>
      )
    } else {
      return (
        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      )
    }
  }

  const formatDateTime = (date) => {
    if (!date) return '-'
    const d = new Date(date)
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }

  const renderPagination = () => {
    if (totalPages <= 1) return null

    const pages = []
    const startPage = Math.max(1, currentPage - 2)
    const endPage = Math.min(totalPages, currentPage + 2)

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <Button
          key={i}
          variant={currentPage === i ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePageChange(i)}
          className="cursor-pointer"
        >
          {i}
        </Button>
      )
    }

    return (
      <div className="flex items-center justify-between mt-6">
        <p className="text-sm text-white/60">
          Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of{' '}
          {totalCount} requests
        </p>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="cursor-pointer"
          >
            Previous
          </Button>
          {pages}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="cursor-pointer"
          >
            Next
          </Button>
        </div>
      </div>
    )
  }

  if (loading && requests.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        <img src="/load.svg" alt="Loading..." className="w-20" />
      </div>
    )
  }

  return (
    <PrivateRoute requiredPermission="super_admin" accessType="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex w-full justify-between items-center">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Player Replacement Requests</h1>
            <p className="text-sm text-white/60 mt-1">Review and manage player replacement requests from clubs</p>
          </div>
        </div>

        {/* Tabs and Search */}
        <Card className="bg-white/5 border-white/15">
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
              <div className="flex space-x-2">
                <Button
                  variant={activeTab === 'pending' ? 'default' : 'outline'}
                  onClick={() => handleTabChange('pending')}
                  className="cursor-pointer"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Pending
                </Button>
                <Button
                  variant={activeTab === 'approved' ? 'default' : 'outline'}
                  onClick={() => handleTabChange('approved')}
                  className="cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approved
                </Button>
                <Button
                  variant={activeTab === 'rejected' ? 'default' : 'outline'}
                  onClick={() => handleTabChange('rejected')}
                  className="cursor-pointer"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Rejected
                </Button>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40" />
                <Input
                  placeholder="Search by club, sport, or player..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pl-10 w-80 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading && requests.length > 0 && (
              <div className="flex justify-center py-2 mb-4">
                <img src="/load.svg" alt="Loading..." className="w-6 h-6" />
              </div>
            )}
            {requests.length === 0 && !loading ? (
              <div className="text-center py-12">
                <Repeat2 className="w-12 h-12 mx-auto text-white/30 mb-3" />
                <p className="text-white/60">No {activeTab} replacement requests found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 border border-white/15 rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer group"
                    onClick={() => handleRowClick(request)}
                  >
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-cranberry/20 flex items-center justify-center">
                          <Repeat2 className="w-5 h-5 text-cranberry" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <p className="font-semibold text-white/90">{request.club_name}</p>
                          <span className="text-white/40">•</span>
                          <p className="text-sm text-white/70">{request.sport?.sport_name}</p>
                          <Badge variant="outline" className="text-xs border-white/30 text-white/60">
                            {request.sport?.gender_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-white/60">
                          <User className="w-3.5 h-3.5" />
                          <span className="truncate">{request.original_player?.name || request.original_player?.RMIS_ID}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-cranberry" />
                          <span className="truncate">{request.replacement_player?.name || request.replacement_player?.RMIS_ID}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 flex-shrink-0">
                      <div className="text-right hidden md:block">
                        <p className="text-xs text-white/50">{formatDateTime(request.created_at)}</p>
                      </div>
                      {getStatusBadge(request.status, request.approved_by)}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRowClick(request)
                        }}
                        className="cursor-pointer bg-white/5 border-white/20 hover:bg-white/10"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {renderPagination()}
          </CardContent>
        </Card>
      </div>
    </PrivateRoute>
  )
}

export default AdminReplacementsPage
