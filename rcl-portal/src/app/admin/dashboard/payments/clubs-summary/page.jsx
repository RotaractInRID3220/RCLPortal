'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Building2, ArrowLeft, Loader2 } from 'lucide-react'
import PrivateRoute from '@/lib/PrivateRoute'

const ClubsSummaryPage = () => {
  const [clubsSummary, setClubsSummary] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch('/api/admin/payments/clubs-summary')
        if (response.ok) {
          const data = await response.json()
          setClubsSummary(data.clubs || [])
        } else {
          toast.error('Failed to fetch clubs summary')
        }
      } catch (error) {
        console.error('Error fetching clubs summary:', error)
        toast.error('Failed to fetch clubs summary')
      } finally {
        setLoading(false)
      }
    }

    fetchSummary()
  }, [])

  return (
    <PrivateRoute requiredPermission="super_admin" accessType="admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex w-full justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard/payments">
              <Button variant="ghost" size="sm" className="cursor-pointer">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-semibold tracking-wide">Clubs Payment Summary</h1>
              <p className="text-sm text-gray-400">Overview of clubs, players, and payment status</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Building2 className="w-4 h-4" />
            Payments
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="bg-white/5">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-gray-400">Total Clubs</p>
              {loading ? <div className="h-6 w-16 mx-auto bg-white/10 animate-pulse rounded" /> : (
                <p className="text-lg font-bold">{clubsSummary.length}</p>
              )}
            </CardContent>
          </Card>
          <Card className="bg-white/5">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-gray-400">Total Players</p>
              {loading ? <div className="h-6 w-20 mx-auto bg-white/10 animate-pulse rounded" /> : (
                <p className="text-lg font-bold">{clubsSummary.reduce((sum, c) => sum + c.playerCount, 0)}</p>
              )}
            </CardContent>
          </Card>
          <Card className="bg-white/5">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-gray-400">Total Paid</p>
              {loading ? <div className="h-6 w-24 mx-auto bg-white/10 animate-pulse rounded" /> : (
                <p className="text-lg font-bold text-green-500">Rs. {clubsSummary.reduce((sum, c) => sum + c.paidAmount, 0).toLocaleString()}</p>
              )}
            </CardContent>
          </Card>
          <Card className="bg-white/5">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-gray-400">Total Pending</p>
              {loading ? <div className="h-6 w-24 mx-auto bg-white/10 animate-pulse rounded" /> : (
                <p className="text-lg font-bold text-orange-500">Rs. {clubsSummary.reduce((sum, c) => sum + c.toBePaid, 0).toLocaleString()}</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Clubs Table */}
        <Card className="bg-white/5">
          <CardHeader>
            <CardTitle>Clubs</CardTitle>
            <CardDescription>Club wise player counts and payment collection</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading...
              </div>
            ) : clubsSummary.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No clubs with registered players found</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white/5">
                      <TableHead>Club Name</TableHead>
                      <TableHead className="text-center">Players</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">To Be Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clubsSummary.map((club) => (
                      <TableRow key={club.club_id} className="hover:bg-white/5">
                        <TableCell className="font-medium">{club.club_name}</TableCell>
                        <TableCell className="text-center">{club.playerCount}</TableCell>
                        <TableCell className="text-right">Rs. {club.totalAmount.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-green-500">Rs. {club.paidAmount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {club.toBePaid === 0 ? (
                            <Badge className="bg-green-500/20 text-green-500 border-green-500">Paid</Badge>
                          ) : (
                            <span className="text-orange-500">Rs. {club.toBePaid.toLocaleString()}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PrivateRoute>
  )
}

export default ClubsSummaryPage
