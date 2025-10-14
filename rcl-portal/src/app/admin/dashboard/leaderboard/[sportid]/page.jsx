'use client'
import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAtom } from 'jotai'
import { sportsDataAtom } from '@/app/state/store'
import { getAllEvents } from '@/services/sportServices'
import { awardTournamentPoints } from '@/services/clubPointsService'
import { APP_CONFIG } from '@/config/app.config'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import TournamentStandings from './components/TournamentStandings'
import AwardPointsDialog from './components/AwardPointsDialog'

const TournamentLeaderboardPage = () => {
  const params = useParams()
  const router = useRouter()
  const [sportsData, setSportsData] = useAtom(sportsDataAtom)
  const [selectedSport, setSelectedSport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [standings, setStandings] = useState([])
  const [isAwardDialogOpen, setIsAwardDialogOpen] = useState(false)
  const [isAwarding, setIsAwarding] = useState(false)

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
        toast.error('Failed to load sport data')
      } finally {
        setLoading(false)
      }
    }

    if (sportId) {
      fetchSportData()
    }
  }, [sportId, sportsData, setSportsData])

  useEffect(() => {
    if (sportId && selectedSport) {
      calculateStandings()
    }
  }, [sportId, selectedSport])

  // Calculates tournament standings based on match results
  const calculateStandings = async () => {
    try {
      setLoading(true)

      const response = await fetch(`/api/leaderboard/tournament-standings?sportId=${sportId}`)
      const result = await response.json()

      if (response.ok) {
        setStandings(result.standings || [])
      } else {
        toast.error(result.error || 'Failed to fetch tournament standings')
        setStandings([])
      }
    } catch (error) {
      console.error('Error fetching tournament standings:', error)
      toast.error('Failed to load tournament standings')
      setStandings([])
    } finally {
      setLoading(false)
    }
  }

  const handleBackToSports = () => {
    router.push('/admin/dashboard/leaderboard')
  }

  const handleOpenAwardDialog = () => {
    setIsAwardDialogOpen(true)
  }

  const handleCloseAwardDialog = () => {
    setIsAwardDialogOpen(false)
  }

  // Awards points to top 3 teams
  const handleConfirmAward = async () => {
    try {
      setIsAwarding(true)
      
      const result = await awardTournamentPoints(sportId, standings)
      
      if (result.success) {
        toast.success(`Successfully awarded points to ${result.updated} team(s)`)
        setIsAwardDialogOpen(false)
      } else {
        toast.error(result.error || 'Failed to award points')
      }
    } catch (error) {
      toast.error('Failed to award tournament points')
    } finally {
      setIsAwarding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center mt-40">
        <img src="/load.svg" alt="Loading" className="w-20" />
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex w-full justify-between items-start">
        <div>
          <Button 
            onClick={handleBackToSports}
            variant="outline" 
            className="mb-3"
          >
            ← Back to Sports
          </Button>
          <h1 className="text-3xl font-semibold tracking-wide">
            {selectedSport.sport_name} - TOURNAMENT STANDINGS
          </h1>
          <p className="text-gray-400 mt-1">
            {selectedSport.category} • {selectedSport.gender_type} • {selectedSport.sport_type}
          </p>
        </div>

        <Button 
          onClick={handleOpenAwardDialog}
          disabled={standings.length === 0}
          className="bg-cranberry/20 border border-cranberry hover:bg-cranberry text-white disabled:bg-gray-700 disabled:cursor-not-allowed cursor-pointer"
        >
          Award Points
        </Button>
      </div>

      {/* Tournament Standings */}
      <TournamentStandings standings={standings} loading={false} />

      {/* Award Points Confirmation Dialog */}
      <AwardPointsDialog
        isOpen={isAwardDialogOpen}
        onClose={handleCloseAwardDialog}
        onConfirm={handleConfirmAward}
        isAwarding={isAwarding}
        standings={standings}
      />
    </div>
  )
}

export default TournamentLeaderboardPage