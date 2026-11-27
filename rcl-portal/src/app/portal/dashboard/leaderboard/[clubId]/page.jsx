'use client'
import React, { useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import ClubDetailsDisplay from '../components/ClubDetailsDisplay'
import { toast } from 'sonner'
import { fetchClubDetails } from '@/services/leaderboardServices'
import { useLivePoll } from '@/hooks/useLivePoll'

const page = () => {
  const params = useParams()
  const router = useRouter()
  const clubId = params.clubId

  // Live data: polled every 20 s (ETag revalidation), never stored in the browser.
  const { data: clubDetailsData, loading, updatedAt, extra } = useLivePoll(
    () => fetchClubDetails(clubId),
    [clubId],
    { intervalMs: 20_000, enabled: Boolean(clubId) }
  )

  const { clubData, clubPoints, totalPoints } = useMemo(() => {
    if (!clubDetailsData) return { clubData: null, clubPoints: [], totalPoints: 0 }
    return {
      clubData: clubDetailsData.club,
      clubPoints: clubDetailsData.raw_entries || [],
      totalPoints: clubDetailsData.summary?.total_points || 0
    }
  }, [clubDetailsData])

  useEffect(() => {
    if (extra && !extra.success) {
      if (extra.error === 'Club not found') {
        toast.error('Club not found')
        router.push('/portal/dashboard/leaderboard')
      } else if (!clubDetailsData) {
        toast.error(extra.error || 'Failed to load club details')
      }
    }
  }, [extra, clubDetailsData, router])

  // Rest of the component logic remains the same but uses optimized data
  const handleBackToLeaderboard = useCallback(() => {
    router.push('/portal/dashboard/leaderboard')
  }, [router])


  if (loading && !clubDetailsData) {
    return (
      <div className="flex justify-center items-center mt-40">
        <img src="/load.svg" alt="" className="w-20" />
      </div>
    )
  }

  if (!clubData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 mb-4">Club not found.</p>
        <Button onClick={handleBackToLeaderboard} variant="outline">
          Back to Leaderboard
        </Button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex w-full justify-between items-center mb-8">
        <div>
          <Button 
            onClick={handleBackToLeaderboard}
            variant="outline" 
            className="mb-2"
          >
            ← Back to Leaderboard
          </Button>
          <h1 className="text-3xl font-semibold tracking-wide">
            {clubData.club_name}
          </h1>
          <p className="text-gray-400 mt-1 capitalize">
            {clubData.category} Club
          </p>
        </div>
      </div>

      {/* Total Points Display */}
      <div className="bg-gradient-to-r from-cranberry/20 to-purple-600/20 rounded-lg p-6 mb-8 border border-white/20">
        <div className="text-center">
          <h2 className="text-lg font-medium text-white/70 mb-2">Total Points</h2>
          <div className="text-5xl font-bold text-white mb-2">
            {totalPoints}
          </div>
          <p className="text-white/60">
            {clubPoints.length} point{clubPoints.length !== 1 ? 's' : ''} entry/entries
          </p>
          {updatedAt && <p className="text-white/40 text-xs mt-1">Updated {updatedAt.toLocaleTimeString()}</p>}
        </div>
      </div>

      {/* Points Breakdown */}
      <div>
        <ClubDetailsDisplay clubPoints={clubPoints} />
      </div>
    </div>
  )
}

export default page