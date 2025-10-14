'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAtom } from 'jotai'
import { userDeetsAtom, loadingAtom } from '@/app/state/store'
import { APP_CONFIG } from '../../../../config/app.config.js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Upload, DollarSign, Receipt, CheckCircle, XCircle, Clock, UserMinus } from 'lucide-react'

const PaymentPage = () => {
  const [userDetails, setUserDetails] = useAtom(userDeetsAtom)
  const [loading, setLoading] = useAtom(loadingAtom)
  const [dataLoading, setDataLoading] = useState(false)
  const [formData, setFormData] = useState({
    value: '',
    slip_number: '',
    image: null
  })
  const [paymentStats, setPaymentStats] = useState({
    totalPlayers: 0,
    totalAmount: 0,
    paidAmount: 0,
    remainingAmount: 0
  })
  const [previousPayments, setPreviousPayments] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [hasLoadedData, setHasLoadedData] = useState(false)
  const [cleaningPlayers, setCleaningPlayers] = useState(false)

  const registrationFee = parseInt(APP_CONFIG.REGISTRATION_FEE) || 800

  // Check if registration deadline has passed
  const isAfterDeadline = useMemo(() => {
    const currentDate = new Date();
    const deadlineDate = new Date(APP_CONFIG.REGISTRATION_DEADLINE);
    return currentDate > deadlineDate;
  }, []);

  useEffect(() => {
    if (userDetails?.club_id && !hasLoadedData && !dataLoading) {
      fetchPaymentData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDetails?.club_id, hasLoadedData, dataLoading])

  const fetchPaymentData = useCallback(async () => {
    if (!userDetails?.club_id) return;
    
    try {
      setDataLoading(true)
      
      // Fetch player count and payment history
      const [playersResponse, paymentsResponse] = await Promise.all([
        fetch(`/api/players?club_id=${userDetails.club_id}`),
        fetch(`/api/payment-slips?club_id=${userDetails.club_id}`)
      ])

      if (playersResponse.ok && paymentsResponse.ok) {
        const playersData = await playersResponse.json()
        const paymentsData = await paymentsResponse.json()

        const playerCount = playersData.count || 0
        const totalAmount = playerCount * registrationFee
        const approvedPayments = paymentsData.payments?.filter(p => p.approved) || []
        const paidAmount = approvedPayments.reduce((sum, payment) => sum + payment.value, 0)
        const remainingAmount = Math.max(0, totalAmount - paidAmount)

        setPaymentStats({
          totalPlayers: playerCount,
          totalAmount,
          paidAmount,
          remainingAmount
        })

        setPreviousPayments(paymentsData.payments || [])
        setHasLoadedData(true)
      }
    } catch (error) {
      console.error('Error fetching payment data:', error)
      toast.error('Failed to fetch payment data')
    } finally {
      setDataLoading(false)
    }
  }, [userDetails?.club_id, registrationFee])

  const cleanPlayers = async () => {
    if (!userDetails?.club_id) return;
    
    try {
      setCleaningPlayers(true)
      
      const response = await fetch('/api/players/clean', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          club_id: userDetails.club_id
        })
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`Successfully removed ${result.deletedCount} players without registrations`)
        
        // Refresh payment data to update counts
        setHasLoadedData(false)
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to clean players')
      }
    } catch (error) {
      console.error('Error cleaning players:', error)
      toast.error('Failed to clean players: ' + error.message)
    } finally {
      setCleaningPlayers(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Check if it's an image
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file')
        return
      }
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB')
        return
      }

      setFormData(prev => ({
        ...prev,
        image: file
      }))
    }
  }

  const compressImage = (file, quality = 0.8) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        const maxWidth = 1200
        const maxHeight = 1200
        let { width, height } = img

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(resolve, 'image/jpeg', quality)
      }

      img.src = URL.createObjectURL(file)
    })
  }

  const uploadImage = async (file) => {
    try {
      setUploading(true)
      
      // Compress image
      const compressedFile = await compressImage(file)
      
      // Create form data for upload
      const uploadData = new FormData()
      uploadData.append('file', compressedFile)
      uploadData.append('club_id', userDetails.club_id)
      
      const response = await fetch('/api/payment-slips/upload', {
        method: 'POST',
        body: uploadData
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const result = await response.json()
      return result.publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      throw error
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.value || !formData.slip_number || !formData.image) {
      toast.error('Please fill all fields and select an image')
      return
    }

    if (isNaN(formData.value) || parseFloat(formData.value) <= 0) {
      toast.error('Please enter a valid payment amount')
      return
    }

    try {
      setSubmitting(true)
      
      // Upload image first
      const imageUrl = await uploadImage(formData.image)
      
      // Submit payment slip data
      const response = await fetch('/api/payment-slips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          value: parseFloat(formData.value),
          slip_number: formData.slip_number,
          link: imageUrl,
          club_id: userDetails.club_id
        })
      })

      if (response.ok) {
        toast.success('Payment slip submitted successfully')
        setFormData({ value: '', slip_number: '', image: null })
        
        // Reset file input
        const fileInput = document.getElementById('image-upload')
        if (fileInput) fileInput.value = ''
        
        // Refresh payment data
        setHasLoadedData(false)
      } else {
        throw new Error('Failed to submit payment slip')
      }
    } catch (error) {
      console.error('Error submitting payment:', error)
      toast.error('Failed to submit payment slip')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (approved) => {
    if (approved === true) {
      return <Badge className="bg-green-500/10 text-green-500 border-green-500"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>
    } else if (approved === false) {
      return <Badge className="bg-red-500/10 text-red-500 border-red-500"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>
    } else {
      return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
    }
  }

  if (dataLoading && !hasLoadedData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <img src="/load.svg" alt="Loading..." className="w-20" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex w-full justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold tracking-wide">PAYMENT MANAGEMENT</h1>
        {!isAfterDeadline && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={cleaningPlayers || dataLoading} className="cursor-pointer">
                {cleaningPlayers ? (
                  <>
                    <img src="/load.svg" alt="Loading..." className="w-4 h-4 mr-2" />
                    Cleaning...
                  </>
                ) : (
                  <>
                    <UserMinus className="w-4 h-4 mr-2" />
                    Clean Players
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clean Players Without Registrations</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all players from your club who don't have any registration records. 
                  This action will update your payment calculations. Are you sure you want to continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={cleanPlayers} className="cursor-pointer">
                  Yes, Clean Players
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Payment Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-white/5">
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <DollarSign className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-400">Total Players</p>
                <p className="text-xl font-semibold">{paymentStats.totalPlayers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5">
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <Receipt className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-gray-400">Total Amount</p>
                <p className="text-xl font-semibold">Rs. {paymentStats.totalAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5">
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <CheckCircle className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-400">Paid Amount</p>
                <p className="text-xl font-semibold">Rs. {paymentStats.paidAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white/5">
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <Clock className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-400">Remaining</p>
                <p className="text-xl font-semibold">Rs. {paymentStats.remainingAmount.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Form */}
      <Card className="bg-white/5">
        <CardHeader>
          <CardTitle>Submit Payment Slip</CardTitle>
          {/* <CardDescription>
            Upload your payment slip for verification. Amount remaining to pay: Rs. {paymentStats.remainingAmount.toLocaleString()}
          </CardDescription> */}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-3" htmlFor="value">Payment Amount (Rs.)</Label>
                <Input
                  id="value"
                  name="value"
                  type="number"
                  value={formData.value}
                  onChange={handleInputChange}
                  placeholder="Enter payment amount"
                  min="1"
                  step="0.01"
                />
              </div>
              
              <div>
                <Label className="mb-3" htmlFor="slip_number">Slip Number</Label>
                <Input
                  id="slip_number"
                  name="slip_number"
                  type="text"
                  value={formData.slip_number}
                  onChange={handleInputChange}
                  placeholder="Enter slip number"
                />
              </div>
            </div>
            
            <div>
              <Label className="mb-3" htmlFor="image-upload">Payment Slip Image (only images are accepted)</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="cursor-pointer"
                />
              </div>
            </div>
            
            <Button 
              
              disabled={submitting || uploading}
              className="w-full md:w-auto mt-3 bg-cranberry/20 border border-cursor hover:bg-cranberry cursor-pointer text-white"
            >
              {uploading ? (
                <>
                  <img src="/load.svg" alt="Loading..." className="w-4 h-4 mr-2" />
                  Uploading Image...
                </>
              ) : submitting ? (
                <>
                  <img src="/load.svg" alt="Loading..." className="w-4 h-4 mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Submit Payment Slip
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Previous Payments */}
      <Card className="bg-white/5">
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>
            Your previous payment submissions and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {previousPayments.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No previous payments found</p>
          ) : (
            <div className="space-y-3">
              {previousPayments.map((payment) => (
                <div
                  key={payment.payment_id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-white/5"
                >
                  <div className="flex items-center space-x-4">
                    <Receipt className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium">Rs. {payment.value.toLocaleString()}</p>
                      <p className="text-sm text-gray-400">
                        Slip: {payment.slip_number} • {new Date(payment.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(payment.approved)}
                    {payment.link && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(payment.link, '_blank')}
                        className="cursor-pointer"
                      >
                        View Slip
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default PaymentPage
