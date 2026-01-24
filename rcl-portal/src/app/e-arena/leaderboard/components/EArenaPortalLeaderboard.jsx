'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAtom } from 'jotai'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Trophy, Medal, Award } from 'lucide-react'
import { fetchLeaderboardData } from '@/services/leaderboardServices'
import {
  leaderboardDataAtom,
  leaderboardLoadingAtom,
  lastFetchTimestampAtom
} from '@/app/state/store'

const EArenaPortalLeaderboard = React.memo(({ category }) => {
  const router = useRouter()
  const [leaderboardData, setLeaderboardData] = useAtom(leaderboardDataAtom)
  const [loading, setLoading] = useAtom(leaderboardLoadingAtom)
  const [lastFetchTimestamp, setLastFetchTimestamp] = useAtom(lastFetchTimestampAtom)
  const [currentPage, setCurrentPage] = useState(1)

  const itemsPerPage = 10

  // Get category-specific data from cache
  const categoryData = useMemo(() => {
    return leaderboardData[category] || []
  }, [leaderboardData, category])

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.ceil(categoryData.length / itemsPerPage)
  }, [categoryData.length])

  // Fetch data for category - using useEffect directly to avoid stale closure issues
  useEffect(() => {
    const fetchData = async () => {
      // Get category-specific timestamp key
      const timestampKey = category === 'institute' ? 'leaderboardInstitute' : 'leaderboardCommunity'
      const currentCategoryData = leaderboardData[category] || []
      const categoryTimestamp = lastFetchTimestamp[timestampKey] || 0

      // Check cache validity for this specific category
      const cacheValid = currentCategoryData.length > 0 && 
        (Date.now() - categoryTimestamp < 2 * 60 * 1000) // 2 minute cache

      if (cacheValid) {
        console.log('Using cached leaderboard data for category:', category)
        return
      }

      try {
        setLoading(true)
        // Add cache-busting timestamp to prevent browser caching
        const result = await fetchLeaderboardData({ category, _t: Date.now() })

        if (result.success) {
          // Update cache for this category
          setLeaderboardData(prev => ({
            ...prev,
            [category]: result.data
          }))
          setLastFetchTimestamp(prev => ({ 
            ...prev, 
            [timestampKey]: Date.now() 
          }))
          console.log(`Leaderboard data loaded and cached for ${category}:`, result.data.length, 'clubs')
        } else {
          toast.error(result.error || 'Failed to load leaderboard')
        }
      } catch (error) {
        console.error('Error fetching leaderboard data:', error)
        toast.error('Failed to load leaderboard')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    setCurrentPage(1) // Reset to first page when category changes
  }, [category, leaderboardData, lastFetchTimestamp, setLeaderboardData, setLastFetchTimestamp, setLoading])

  const handleClubClick = useCallback((club) => {
    console.log('Clicking on club:', club)
    console.log('Club ID being navigated to:', club.club_id)
    router.push(`/portal/dashboard/leaderboard/${club.club_id}`)
  }, [router])

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page)
  }, [])

  // Memoized paginated data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return categoryData.slice(startIndex, endIndex)
  }, [categoryData, currentPage])

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

  const getRankStyle = useCallback((rank) => {
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
  }, [])

  // Memoized leaderboard row component
  const LeaderboardRow = React.memo(({ club, onClick }) => {
    const actualRank = club.rank
    const isTopThree = actualRank <= 3

    return (
      <div
        className={`
          flex items-center justify-between p-3 md:p-4 rounded-lg border cursor-pointer transition-all duration-200
          ${getRankStyle(actualRank)}
          ${isTopThree ? 'transform hover:scale-[1.02]' : ''}
        `}
      >
        <div className="flex items-center space-x-2 md:space-x-4 flex-1 min-w-0">
          {/* Rank */}
          <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 flex-shrink-0">
            {getRankIcon(actualRank) || (
              <div className={`
                flex items-center justify-center w-6 h-6 md:w-8 md:h-8 rounded-full font-bold text-sm md:text-base
                ${actualRank <= 3 ? 'text-white' : 'bg-white/10 text-white/70'}
              `}>
                {actualRank}
              </div>
            )}
          </div>

          {/* Club Info */}
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold truncate ${isTopThree ? 'text-lg md:text-xl' : 'text-base md:text-lg'}`}>
              {club.club_name}
            </h3>

          </div>

          {/* Points */}
          <div className="text-right flex flex-col lg:flex-row lg:items-center lg:space-x-3 ml-2">
            <div className={`font-bold ${isTopThree ? 'text-xl md:text-2xl' : 'text-lg md:text-xl'}`}>
              {club.total_points}
            </div>
            <p className="text-xs md:text-sm text-gray-400">points</p>
          </div>
        </div>
      </div>
    )
  })

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <img src="/load.svg" alt="" className="w-20" />
      </div>
    )
  }

  if (categoryData.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">No clubs found in {category} category.</p>
        <p className="text-gray-500 text-sm mt-2">Clubs will appear here once points are added.</p>
      </div>
    )
  }

  const startIndex = (currentPage - 1) * itemsPerPage

  return (
    <div className="space-y-6">
      {/* Leaderboard Header */}
      <div className="text-center">
        <h2 className="text-3xl font-semibold mb-2 capitalize font-bebas text-cranberry">{category} Leaderboard</h2>
        <p className="text-gray-400">
          Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, categoryData.length)} of {categoryData.length} clubs
        </p>
      </div>

      {/* Leaderboard List */}
      <div className="space-y-3">
        {paginatedData.map((club) => (
          <LeaderboardRow
            key={club.club_id}
            club={club}
            onClick={handleClubClick}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-1 md:space-x-2 mt-6 md:mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="bg-cranberry/10 border border-cranberry text-cranberry/70 hover:bg-cranberry/30 hover:border-cranberry/80 hover:text-white hover:shadow-lg hover:shadow-cranberry/30 transition-all duration-300 px-2 md:px-3"
          >
            <ChevronLeft className="w-3 h-3 md:w-4 md:h-4" />
            <span className="hidden sm:inline ml-1">Previous</span>
          </Button>

          {/* Page Numbers */}
          <div className="flex space-x-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePageChange(page)}
                className={`px-2 md:px-3 ${
                  page === currentPage
                    ? 'bg-cranberry/30 border-cranberry/80 text-white shadow-lg shadow-cranberry/30'
                    : 'bg-cranberry/10 border border-cranberry text-cranberry/70 hover:bg-cranberry/30 hover:border-cranberry/80 hover:text-white hover:shadow-lg hover:shadow-cranberry/30'
                }`}
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
            className="bg-cranberry/10 border border-cranberry text-cranberry/70 hover:bg-cranberry/30 hover:border-cranberry/80 hover:text-white hover:shadow-lg hover:shadow-cranberry/30 transition-all duration-300 px-2 md:px-3"
          >
            <span className="hidden sm:inline mr-1">Next</span>
            <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
          </Button>
        </div>
      )}
    </div>
  )
})

export default EArenaPortalLeaderboard