'use client'
import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import ClubDetailsDisplay from '../components/ClubDetailsDisplay'
import { toast } from 'sonner'

const page = () => {
  const params = useParams()
  const router = useRouter()
  const [clubData, setClubData] = useState(null)
  const [clubPoints, setClubPoints] = useState([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [loading, setLoading] = useState(true)

  const clubId = params.clubId

  useEffect(() => {
    const fetchClubData = async () => {
      if (!clubId) {
        console.log('No clubId provided')
        return
      }

      try {
        setLoading(true)
        console.log('Fetching data for clubId:', clubId)
        
        // Fetch club info and all club points
        const [clubsResponse, pointsResponse] = await Promise.all([
          fetch('/api/clubs'),
          fetch('/api/club-points')
        ])

        if (!clubsResponse.ok || !pointsResponse.ok) {
          throw new Error('Failed to fetch data')
        }

        const clubsResult = await clubsResponse.json()
        const pointsResult = await pointsResponse.json()

        console.log('Clubs data:', clubsResult.clubs)
        console.log('Looking for club with ID:', clubId)

        // Find the specific club - handle both string and number comparisons
        const club = clubsResult.clubs?.find(c => 
          c.club_id === clubId || 
          c.club_id === String(clubId) || 
          String(c.club_id) === String(clubId)
        )
        
        console.log('Found club:', club)
        
        if (!club) {
          console.error('Club not found. Available clubs:', clubsResult.clubs?.map(c => ({ id: c.club_id, name: c.club_name })))
          toast.error('Club not found')
          router.push('/portal/dashboard/leaderboard')
          return
        }
        setClubData(club)

        // Filter points for this club and calculate total - handle type conversion
        const clubPointsData = pointsResult.data?.filter(point => 
          point.club_id === clubId || 
          point.club_id === String(clubId) || 
          String(point.club_id) === String(clubId)
        ) || []
        
        console.log('Club points data:', clubPointsData)
        setClubPoints(clubPointsData)
        
        const total = clubPointsData.reduce((sum, point) => sum + (point.points || 0), 0)
        setTotalPoints(total)

      } catch (error) {
        console.error('Error fetching club data:', error)
        toast.error('Failed to load club details')
      } finally {
        setLoading(false)
      }
    }

    fetchClubData()
  }, [clubId, router])

  const handleBackToLeaderboard = () => {
    router.push('/portal/dashboard/leaderboard')
  }

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