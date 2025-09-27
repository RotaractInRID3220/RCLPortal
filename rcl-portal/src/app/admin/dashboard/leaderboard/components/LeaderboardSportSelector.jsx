'use client'
import React, { useState, useEffect } from 'react'
import { useAtom } from 'jotai'
import { useRouter } from 'next/navigation'
import { sportsDataAtom, sportsLoadingAtom } from '@/app/state/store'
import { getAllEvents } from '@/services/sportServices'

const LeaderboardSportSelector = () => {
  const [sportsData, setSportsData] = useAtom(sportsDataAtom)
  const [sportsLoading, setSportsLoading] = useAtom(sportsLoadingAtom)
  const router = useRouter()

  // Fetch all sports data when component mounts
  const fetchAllSports = async () => {
    try {
      setSportsLoading(true)
      const result = await getAllEvents({ type: ["team", "individual"] })
      if (result.success) {
        setSportsData(result.data)
        console.log('Sports data loaded:', result.data)
      }
    } catch (error) {
      console.error('Failed to fetch sports:', error)
    } finally {
      setSportsLoading(false)
    }
  }

  // Load sports data when component mounts
  useEffect(() => {
    fetchAllSports()
  }, [])

  const handleSportClick = (sport) => {
    router.push(`/admin/dashboard/leaderboard/${sport.sport_id}`)
  }

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
                  {sportsData
                    .filter(sport => sport.category === 'institute')
                    .map((sport, index) => (
                      <div 
                        key={sport.sport_id || index} 
                        className="bg-cranberry/85 rounded-lg py-3 px-5 hover:bg-cranberry cursor-pointer"
                        onClick={() => handleSportClick(sport)}
                      >
                        <div className='justify-between flex'>
                          <h1 className="text-lg">{sport.sport_name}</h1>
                          <p className="bg-white/5 border border-white/80 px-4 py-1 rounded-full text-sm text-white/80">{sport.gender_type}</p>
                        </div>
                      </div>
                    ))
                  }
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
                  {sportsData
                    .filter(sport => sport.category === 'community')
                    .map((sport, index) => (
                      <div 
                        key={sport.sport_id || index} 
                        className="bg-cranberry/85 rounded-lg py-3 px-5 hover:bg-cranberry cursor-pointer"
                        onClick={() => handleSportClick(sport)}
                      >
                        <div className='justify-between flex'>
                          <h1 className="text-lg">{sport.sport_name}</h1>
                          <p className="bg-white/5 border border-white/80 px-4 py-1 rounded-full text-sm text-white/80">{sport.gender_type}</p>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LeaderboardSportSelector