'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAtom } from 'jotai'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import ClubDetailsDisplay from '../components/ClubDetailsDisplay'
import { toast } from 'sonner'
import { fetchClubDetails } from '@/services/leaderboardServices'
import { 
  clubPointsDataAtom, 
  clubPointsLoadingAtom, 
  lastFetchTimestampAtom, 
  isCacheValid 
} from '@/app/state/store'

const page = () => {
  const params = useParams()
  const router = useRouter()
  const [clubPointsData, setClubPointsData] = useAtom(clubPointsDataAtom)
  const [loading, setLoading] = useAtom(clubPointsLoadingAtom)
  const [lastFetchTimestamp, setLastFetchTimestamp] = useAtom(lastFetchTimestampAtom)
  const [clubDetailsData, setClubDetailsData] = useState(null)

  const clubId = params.clubId

  // Memoized club data extraction
  const { clubData, clubPoints, totalPoints } = useMemo(() => {
    if (!clubDetailsData) {
      return { clubData: null, clubPoints: [], totalPoints: 0 }
    }

    return {
      clubData: clubDetailsData.club,
      clubPoints: clubDetailsData.raw_entries || [],
      totalPoints: clubDetailsData.summary?.total_points || 0
    }
  }, [clubDetailsData])

  // Optimized club details fetching with caching
  const fetchClubDetailsData = useCallback(async (forceRefresh = false) => {
    if (!clubId) {
      console.log('No clubId provided')
      return
    }

    try {
      // Check cache validity
      const cacheKey = `club_${clubId}`
      if (!forceRefresh && clubPointsData[cacheKey] && isCacheValid(lastFetchTimestamp.clubPoints)) {
        console.log('Using cached club details for clubId:', clubId)
        setClubDetailsData(clubPointsData[cacheKey])
        return
      }

      setLoading(true)
      console.log('Fetching optimized data for clubId:', clubId)
      
      const result = await fetchClubDetails(clubId)
      
      if (result.success) {
        setClubDetailsData(result.data)
        
        // Cache the result
        setClubPointsData(prev => ({
          ...prev,
          [cacheKey]: result.data
        }))
        setLastFetchTimestamp(prev => ({ ...prev, clubPoints: Date.now() }))
        
        console.log('Club details loaded and cached:', result.data)
      } else {
        if (result.error === 'Club not found') {
          console.error('Club not found for ID:', clubId)
          toast.error('Club not found')
          router.push('/portal/dashboard/leaderboard')
          return
        }
        toast.error(result.error || 'Failed to load club details')
      }
    } catch (error) {
      console.error('Error fetching club details:', error)
      toast.error('Failed to load club details')
    } finally {
      setLoading(false)
    }
  }, [clubId, clubPointsData, lastFetchTimestamp.clubPoints, setClubPointsData, setLastFetchTimestamp, setLoading, router])

  useEffect(() => {
    fetchClubDetailsData()
  }, [fetchClubDetailsData])

  // Rest of the component logic remains the same but uses optimized data
  const handleBackToLeaderboard = useCallback(() => {
    router.push('/portal/dashboard/leaderboard')
  }, [router])


  if (loading) {
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