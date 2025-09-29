'use client'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAtom } from 'jotai'
import { useRouter } from 'next/navigation'
import { 
  sportsDataAtom, 
  sportsLoadingAtom, 
  lastFetchTimestampAtom, 
  isCacheValid 
} from '@/app/state/store'
import { getAllEvents } from '@/services/sportServices'

const LeaderboardSportSelector = React.memo(() => {
  const [sportsData, setSportsData] = useAtom(sportsDataAtom)
  const [sportsLoading, setSportsLoading] = useAtom(sportsLoadingAtom)
  const [lastFetchTimestamp, setLastFetchTimestamp] = useAtom(lastFetchTimestampAtom)
  const router = useRouter()

  // Memoized sports categories for better performance
  const { instituteSports, communitySports } = useMemo(() => {
    const instituteSports = sportsData.filter(sport => sport.category === 'institute')
    const communitySports = sportsData.filter(sport => sport.category === 'community')
    
    return { instituteSports, communitySports }
  }, [sportsData])

  // Optimized fetch function with caching
  const fetchAllSports = useCallback(async (forceRefresh = false) => {
    try {
      // Check cache validity
      if (!forceRefresh && sportsData.length > 0 && isCacheValid(lastFetchTimestamp.sports)) {
        console.log('Using cached sports data')
        return
      }

      setSportsLoading(true)
      const result = await getAllEvents({ type: ["team", "individual"] })
      if (result.success) {
        setSportsData(result.data)
        setLastFetchTimestamp(prev => ({ ...prev, sports: Date.now() }))
        console.log('Sports data loaded and cached:', result.data)
      }
    } catch (error) {
      console.error('Failed to fetch sports:', error)
    } finally {
      setSportsLoading(false)
    }
  }, [sportsData.length, lastFetchTimestamp.sports, setSportsData, setSportsLoading, setLastFetchTimestamp])

  // Load sports data when component mounts
  useEffect(() => {
    fetchAllSports()
  }, [fetchAllSports])

  const handleSportClick = useCallback((sport) => {
    router.push(`/admin/dashboard/leaderboard/${sport.sport_id}`)
  }, [router])

  // Memoized sport card component
  const SportCard = React.memo(({ sport, onClick }) => (
    <div 
      className="bg-cranberry/85 rounded-lg py-3 px-5 hover:bg-cranberry cursor-pointer"
      onClick={() => onClick(sport)}
    >
      <div className='justify-between flex'>
        <h1 className="text-lg">{sport.sport_name}</h1>
        <p className="bg-white/5 border border-white/80 px-4 py-1 rounded-full text-sm text-white/80">
          {sport.gender_type}
        </p>
      </div>
    </div>
  ))

  return (
    <div>
      <div className="flex w-full justify-between items-center mb-8">
        <h2 className="text-lg font-medium tracking-wide">SELECT SPORT</h2>
      </div>

      <div>
        {sportsLoading ? (
          <div className="flex justify-center items-center mt-40">
            <img src="/load.svg" alt="" className="w-20" />
          </div>
        ) : sportsData.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">No sports found.</p>
          </div>
        ) : (
          <div className="space-y-16">
            {/* Institute Based Events */}
            <div>
              <div className='flex items-center w-full mb-4'>
                <h3 className="text-lg font-light text-white/50 flex items-center">
                  Institute Based Sports
                </h3>
                <div className="flex-1 ml-4 h-px bg-gradient-to-r from-white/50 to-white/10"></div>
              </div>
              {sportsData.filter(sport => sport.category === 'institute').length === 0 ? (
                <div className="text-center py-6 bg-white/5 rounded-lg">
                  <p className="text-gray-400">No institute based sports yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {instituteSports.map((sport, index) => (
                    <SportCard 
                      key={sport.sport_id || index} 
                      sport={sport} 
                      onClick={handleSportClick}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Community Based Events */}
            <div>
              <div className='flex items-center w-full mb-4'>
                <h3 className="text-lg font-light text-white/50 flex items-center">
                  Community Based Sports
                </h3>
                <div className="flex-1 ml-4 h-px bg-gradient-to-r from-white/50 to-white/10"></div>
              </div>
              {sportsData.filter(sport => sport.category === 'community').length === 0 ? (
                <div className="text-center py-6 bg-white/5 rounded-lg">
                  <p className="text-gray-400">No community based sports yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {communitySports.map((sport, index) => (
                    <SportCard 
                      key={sport.sport_id || index} 
                      sport={sport} 
                      onClick={handleSportClick}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

export default LeaderboardSportSelector