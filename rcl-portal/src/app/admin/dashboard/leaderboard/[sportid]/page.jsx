'use client'
import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAtom } from 'jotai'
import { sportsDataAtom } from '@/app/state/store'
import { getAllEvents } from '@/services/sportServices'
import { Button } from '@/components/ui/button'
import ClubPointsForm from '../components/ClubPointsForm'
import LeaderboardDisplay from '../components/LeaderboardDisplay'

const page = () => {
  const params = useParams()
  const router = useRouter()
  const [sportsData, setSportsData] = useAtom(sportsDataAtom)
  const [selectedSport, setSelectedSport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const sportId = params.sportid

  useEffect(() => {
    const fetchSportData = async () => {
      try {
        setLoading(true)
        let currentSportsData = sportsData
        
        // Fetch sports data if not already available
        if (!sportsData || sportsData.length === 0) {
          const result = await getAllEvents({ type: ["team", "individual"] })
          if (result.success) {
            currentSportsData = result.data
            setSportsData(currentSportsData)
          }
        }
        
        // Find the selected sport
        const sport = currentSportsData.find(s => s.sport_id == sportId)
        setSelectedSport(sport)
      } catch (error) {
        console.error('Failed to fetch sport data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (sportId) {
      fetchSportData()
    }
  }, [sportId, sportsData, setSportsData])

  const handleBackToSports = () => {
    router.push('/admin/dashboard/leaderboard')
  }

  const handlePointAdded = () => {
    // Refresh the leaderboard display when a point is added
    setRefreshKey(prev => prev + 1)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center mt-40">
        <img src="/load.svg" alt="" className="w-20" />
      </div>
    )
  }

  if (!selectedSport) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 mb-4">Sport not found.</p>
        <Button onClick={handleBackToSports} variant="outline">
          Back to Sports
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
            onClick={handleBackToSports}
            variant="outline" 
            className="mb-2"
          >
            ← Back to Sports
          </Button>
          <h1 className="text-3xl font-semibold tracking-wide">
            {selectedSport.sport_name} - LEADERBOARD
          </h1>
          <p className="text-gray-400 mt-1">
            {selectedSport.category} • {selectedSport.gender_type} • {selectedSport.sport_type}
          </p>
        </div>
      </div>

      {/* Add Points Form */}
      <div className="mb-8">
        <ClubPointsForm 
          sport={selectedSport} 
          onPointAdded={handlePointAdded}
        />
      </div>

      {/* Leaderboard Display */}
      <div>
        <LeaderboardDisplay 
          sport={selectedSport} 
          refreshKey={refreshKey}
          onPointDeleted={handlePointAdded}
        />
      </div>
    </div>
  )
}

export default page