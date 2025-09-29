'use client'
import React, { useState, useCallback } from 'react'
import LeaderboardFilters from './components/LeaderboardFilters'
import PortalLeaderboard from './components/PortalLeaderboard'

const page = React.memo(() => {
  const [filterMode, setFilterMode] = useState('community') // 'community' or 'institute'

  const handleFilterChange = useCallback((newMode) => {
    setFilterMode(newMode)
  }, [])

  return (
    <div>
      <div className="flex w-full justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold tracking-wide">LEADERBOARD</h1>
        <LeaderboardFilters 
          filterMode={filterMode} 
          setFilterMode={handleFilterChange} 
        />
      </div>
      
      <div>
        <PortalLeaderboard category={filterMode} />
      </div>
    </div>
  )
})

export default page