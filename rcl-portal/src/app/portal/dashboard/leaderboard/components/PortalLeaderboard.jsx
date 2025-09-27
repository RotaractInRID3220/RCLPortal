'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Trophy, Medal, Award } from 'lucide-react'

const PortalLeaderboard = ({ category }) => {
  const router = useRouter()
  const [leaderboardData, setLeaderboardData] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  
  const itemsPerPage = 10

  useEffect(() => {
    fetchLeaderboardData()
    setCurrentPage(1) // Reset to first page when category changes
  }, [category])

  useEffect(() => {
    // Calculate total pages whenever leaderboardData changes
    setTotalPages(Math.ceil(leaderboardData.length / itemsPerPage))
  }, [leaderboardData])

  const fetchLeaderboardData = async () => {
    try {
      setLoading(true)
      
      // Fetch clubs and club points data
      const [clubsResponse, pointsResponse] = await Promise.all([
        fetch('/api/clubs'),
        fetch('/api/club-points')
      ])

      if (!clubsResponse.ok || !pointsResponse.ok) {
        throw new Error('Failed to fetch data')
      }

      const clubsResult = await clubsResponse.json()
      const pointsResult = await pointsResponse.json()

      const clubs = clubsResult.clubs || []
      const allPoints = pointsResult.data || []

      // Filter clubs by category
      const filteredClubs = clubs.filter(club => club.category === category)

      // Calculate total points for each club
      const clubTotals = filteredClubs.map(club => {
        const clubPoints = allPoints.filter(point => point.club_id === club.club_id)
        const totalPoints = clubPoints.reduce((sum, point) => sum + (point.points || 0), 0)
        
        return {
          ...club,
          totalPoints,
          entriesCount: clubPoints.length
        }
      })

      // Sort by total points (descending), then by club name (ascending) for ties
      clubTotals.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints
        }
        return a.club_name.localeCompare(b.club_name)
      })

      // Add ranking with proper tie handling
      let currentRank = 1
      const rankedClubs = clubTotals.map((club, index) => {
        if (index > 0 && club.totalPoints !== clubTotals[index - 1].totalPoints) {
          currentRank = index + 1
        }
        return {
          ...club,
          rank: currentRank
        }
      })

      setLeaderboardData(rankedClubs)
    } catch (error) {
      console.error('Error fetching leaderboard data:', error)
      toast.error('Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }

  const handleClubClick = (club) => {
    console.log('Clicking on club:', club)
    console.log('Club ID being navigated to:', club.club_id)
    router.push(`/portal/dashboard/leaderboard/${club.club_id}`)
  }

  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

  const getPaginatedData = () => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return leaderboardData.slice(startIndex, endIndex)
  }

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-400" />
      case 2:
        return <Medal className="w-6 h-6 text-gray-300" />
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />
      default:
        return null
    }
  }

  const getRankStyle = (rank) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border-yellow-500/30 shadow-lg shadow-yellow-500/10'
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/30 shadow-lg shadow-gray-400/10'
      case 3:
        return 'bg-gradient-to-r from-amber-600/20 to-amber-700/20 border-amber-600/30 shadow-lg shadow-amber-600/10'
      default:
        return 'bg-white/5 border-white/10 hover:bg-white/10'
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <img src="/load.svg" alt="" className="w-20" />
      </div>
    )
  }

  if (leaderboardData.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">No clubs found in {category} category.</p>
        <p className="text-gray-500 text-sm mt-2">Clubs will appear here once points are added.</p>
      </div>
    )
  }

  const paginatedData = getPaginatedData()
  const startIndex = (currentPage - 1) * itemsPerPage

  return (
    <div className="space-y-6">
      {/* Leaderboard Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-2 capitalize">{category} Leaderboard</h2>
        <p className="text-gray-400">
          Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, leaderboardData.length)} of {leaderboardData.length} clubs
        </p>
      </div>

      {/* Leaderboard List */}
      <div className="space-y-3">
        {paginatedData.map((club, index) => {
          const actualRank = club.rank
          const isTopThree = actualRank <= 3
          
          return (
            <div
              key={club.club_id}
              onClick={() => handleClubClick(club)}
              className={`
                flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all duration-200
                ${getRankStyle(actualRank)}
                ${isTopThree ? 'transform hover:scale-[1.02]' : ''}
              `}
            >
              <div className="flex items-center space-x-4 flex-1">
                {/* Rank */}
                <div className="flex items-center justify-center w-12 h-12">
                  {getRankIcon(actualRank) || (
                    <div className={`
                      flex items-center justify-center w-8 h-8 rounded-full font-bold
                      ${actualRank <= 3 ? 'text-white text-lg' : 'bg-white/10 text-white/70'}
                    `}>
                      {actualRank}
                    </div>
                  )}
                </div>

                {/* Club Info */}
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold truncate ${isTopThree ? 'text-xl' : 'text-lg'}`}>
                    {club.club_name}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {club.entriesCount} point{club.entriesCount !== 1 ? 's' : ''} entry/entries
                  </p>
                </div>

                {/* Points */}
                <div className="text-right">
                  <div className={`font-bold ${isTopThree ? 'text-2xl' : 'text-xl'}`}>
                    {club.totalPoints}
                  </div>
                  <p className="text-sm text-gray-400">points</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="bg-transparent border-white/20 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          
          {/* Page Numbers */}
          <div className="flex space-x-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePageChange(page)}
                className={
                  page === currentPage
                    ? 'bg-cranberry hover:bg-cranberry/90 text-white'
                    : 'bg-transparent border-white/20 text-white/70 hover:bg-white/10 hover:text-white'
                }
              >
                {page}
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="bg-transparent border-white/20 text-white/70 hover:bg-white/10 hover:text-white"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

export default PortalLeaderboard