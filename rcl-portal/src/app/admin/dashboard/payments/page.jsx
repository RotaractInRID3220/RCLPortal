'use client'

import React, { useState, useEffect } from 'react'
import { useAtom } from 'jotai'
import { userDeetsAtom } from '@/app/state/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Search, Eye, Download, CheckCircle, XCircle, Clock, Receipt, Users, DollarSign } from 'lucide-react'
import PrivateRoute from '@/lib/PrivateRoute'

const AdminPaymentsPage = () => {
  const [userDetails] = useAtom(userDeetsAtom)
  const [activeTab, setActiveTab] = useState('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [payments, setPayments] = useState([])
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [clubDetails, setClubDetails] = useState(null)
  const [approving, setApproving] = useState(false)
  const [approvingId, setApprovingId] = useState(null)
  const [rejectingId, setRejectingId] = useState(null)
  const [componentLoading, setComponentLoading] = useState(false)

  const itemsPerPage = 10

  useEffect(() => {
    fetchPayments()
  }, [activeTab, currentPage, searchTerm])

  const fetchPayments = async () => {
    try {
      setComponentLoading(true)
      
      const params = new URLSearchParams({
        tab: activeTab,
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        search: searchTerm
      })

      const response = await fetch(`/api/admin/payments?${params}`)
      
      if (response.ok) {
        const data = await response.json()
        setPayments(data.payments || [])
        setTotalPages(data.totalPages || 0)
        setTotalCount(data.totalCount || 0)
      } else {
        throw new Error('Failed to fetch payments')
      }
    } catch (error) {
      console.error('Error fetching payments:', error)
      toast.error('Failed to fetch payments')
    } finally {
      setComponentLoading(false)
    }
  }

  const handleSearch = (e) => {
    setSearchTerm(e.target.value)
    setCurrentPage(1) // Reset to first page when searching
  }

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setCurrentPage(1)
    setSearchTerm('')
  }

  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

  const handleApprovePayment = async (paymentId) => {
    try {
      setApprovingId(paymentId)
      
      const response = await fetch('/api/admin/payments/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          payment_id: paymentId,
          approved_by: userDetails.membership_id
        })
      })

      if (response.ok) {
        toast.success('Payment approved successfully')
        fetchPayments() // Refresh the list
        setSelectedPayment(null) // Close modal if open
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to approve payment')
      }
    } catch (error) {
      console.error('Error approving payment:', error)
      toast.error('Failed to approve payment: ' + error.message)
    } finally {
      setApprovingId(null)
    }
  }

  const handleRejectPayment = async (paymentId) => {
    try {
      setRejectingId(paymentId)
      
      const response = await fetch('/api/admin/payments/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          payment_id: paymentId,
          rejected_by: userDetails.membership_id
        })
      })

      if (response.ok) {
        toast.success('Payment rejected successfully')
        fetchPayments() // Refresh the list
        setSelectedPayment(null) // Close modal if open
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reject payment')
      }
    } catch (error) {
      console.error('Error rejecting payment:', error)
      toast.error('Failed to reject payment: ' + error.message)
    } finally {
      setRejectingId(null)
    }
  }

  const fetchClubDetails = async (clubId) => {
    try {
      const response = await fetch(`/api/admin/payments/club-details?club_id=${clubId}`)
      
      if (response.ok) {
        const data = await response.json()
        setClubDetails(data)
      } else {
        throw new Error('Failed to fetch club details')
      }
    } catch (error) {
      console.error('Error fetching club details:', error)
      toast.error('Failed to fetch club details')
    }
  }

  const handleRowClick = (payment) => {
    setSelectedPayment(payment)
    fetchClubDetails(payment.club_id)
  }

  const handleDownloadSlip = (imageUrl, clubName, slipNumber) => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `payment_slip_${clubName}_${slipNumber}.jpg`
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getStatusBadge = (approved, approvedBy = null) => {
    if (approved === true) {
      return (
        <div className="flex items-center gap-2 justify-end">
          <Badge className="bg-green-500/10 text-green-500 border-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
          {approvedBy && (
            <span className="text-xs text-gray-400 whitespace-nowrap">by: {approvedBy}</span>
          )}
        </div>
      )
    } else if (approved === false) {
      return (
        <div className="flex items-center gap-2 justify-end">
          <Badge className="bg-red-500/10 text-red-500 border-red-500">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
          {approvedBy && (
            <span className="text-xs text-gray-400 whitespace-nowrap">by: {approvedBy}</span>
          )}
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

  const renderPagination = () => {
    if (totalPages <= 1) return null

    const pages = []
    const startPage = Math.max(1, currentPage - 2)
    const endPage = Math.min(totalPages, currentPage + 2)

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <Button
          key={i}
          variant={currentPage === i ? "default" : "outline"}
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
        <p className="text-sm text-gray-400">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} payments
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

  if (componentLoading && payments.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        <img src="/load.svg" alt="Loading..." className="w-20" />
      </div>
    )
  }

  return (
    <PrivateRoute requiredPermission="super_admin"  accessType="admin">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex w-full justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold tracking-wide">PAYMENT MANAGEMENT</h1>
      </div>

      {/* Tabs and Search */}
      <Card className="bg-white/5">
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
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by club name..."
                value={searchTerm}
                onChange={handleSearch}
                className="pl-10 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {componentLoading && payments.length > 0 && (
            <div className="flex justify-center py-2 mb-4">
              <img src="/load.svg" alt="Loading..." className="w-6 h-6" />
            </div>
          )}
          {payments.length === 0 && !componentLoading ? (
            <p className="text-gray-400 text-center py-8">
              No {activeTab} payments found
            </p>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.payment_id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                  onClick={() => handleRowClick(payment)}
                >
                  <div className="flex items-center space-x-4 flex-1">
                    <Receipt className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div>
                          <p className="font-medium">{payment.club_name}</p>
                          <p className="text-sm text-gray-400">
                            Rs. {payment.value.toLocaleString()} • {new Date(payment.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {getStatusBadge(payment.approved, payment.approved_by)}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(payment.link, '_blank')
                      }}
                      className="cursor-pointer"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    {activeTab === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleApprovePayment(payment.payment_id)
                          }}
                          disabled={approvingId === payment.payment_id || rejectingId === payment.payment_id}
                          className="cursor-pointer bg-green-500/20 border border-green-500 text-green-500 hover:bg-green-500 hover:text-white"
                        >
                          {approvingId === payment.payment_id ? (
                            <>
                              <img src="/load.svg" alt="Loading..." className="w-4 h-4 mr-1" />
                              Approving...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRejectPayment(payment.payment_id)
                          }}
                          disabled={rejectingId === payment.payment_id || approvingId === payment.payment_id}
                          className="cursor-pointer bg-red-500/20 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                        >
                          {rejectingId === payment.payment_id ? (
                            <>
                              <img src="/load.svg" alt="Loading..." className="w-4 h-4 mr-1" />
                              Rejecting...
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {renderPagination()}
        </CardContent>
      </Card>

      {/* Payment Details Modal */}
      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <DialogTitle>Payment Details</DialogTitle>
            <DialogDescription>
              Detailed information about the payment slip
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-6 px-1">
              {/* Club Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-white/5">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-4">
                      <Users className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-gray-400">Club Name</p>
                        <p className="font-semibold">{selectedPayment.club_name}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-white/5">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-4">
                      <Receipt className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="text-sm text-gray-400">Slip Number</p>
                        <p className="font-semibold">{selectedPayment.slip_number}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Payment Statistics */}
              {clubDetails && (
                <div className="grid grid-cols-2  gap-4">
                  <Card className="bg-white/5">
                    <CardContent className="p-3">
                      <div className="text-center">
                        <p className="text-sm text-gray-400">Players</p>
                        <p className="text-lg font-semibold">{clubDetails.totalPlayers}</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white/5">
                    <CardContent className="p-3">
                      <div className="text-center">
                        <p className="text-sm text-gray-400">Total Amount</p>
                        <p className="text-lg font-semibold">Rs. {clubDetails.totalAmount.toLocaleString()}</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white/5">
                    <CardContent className="p-3">
                      <div className="text-center">
                        <p className="text-sm text-gray-400">Paid Amount</p>
                        <p className="text-lg font-semibold">Rs. {clubDetails.paidAmount.toLocaleString()}</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white/5">
                    <CardContent className="p-3">
                      <div className="text-center">
                        <p className="text-sm text-gray-400">Remaining</p>
                        <p className="text-lg font-semibold">Rs. {clubDetails.remainingAmount.toLocaleString()}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap justify-center gap-3 pt-4 border-t border-white/10">
                <Button
                  variant="outline"
                  onClick={() => window.open(selectedPayment.link, '_blank')}
                  className="cursor-pointer flex-shrink-0 w-full"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Slip
                </Button>
                
                
                {activeTab === 'pending' && (
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <Button
                      onClick={() => handleApprovePayment(selectedPayment.payment_id)}
                      disabled={approvingId === selectedPayment.payment_id || rejectingId === selectedPayment.payment_id}
                      className="cursor-pointer bg-green-500/20 border border-green-500 text-green-500 hover:bg-green-500 hover:text-white w-full"
                    >
                      {approvingId === selectedPayment.payment_id ? (
                        <>
                          <img src="/load.svg" alt="Loading..." className="w-4 h-4 mr-2" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve Payment
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleRejectPayment(selectedPayment.payment_id)}
                      disabled={rejectingId === selectedPayment.payment_id || approvingId === selectedPayment.payment_id}
                      className="cursor-pointer bg-red-500/20 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white w-full"
                    >
                      {rejectingId === selectedPayment.payment_id ? (
                        <>
                          <img src="/load.svg" alt="Loading..." className="w-4 h-4 mr-2" />
                          Rejecting...
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject Payment
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </PrivateRoute>
  )
}

export default AdminPaymentsPage