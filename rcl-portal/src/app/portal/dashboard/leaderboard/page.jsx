'use client'
import React, { useState } from 'react'
import LeaderboardFilters from './components/LeaderboardFilters'
import PortalLeaderboard from './components/PortalLeaderboard'

const page = () => {
  const [filterMode, setFilterMode] = useState('community') // 'community' or 'institute'

  return (
    <div>
      <div className="flex w-full justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold tracking-wide">LEADERBOARD</h1>
        <LeaderboardFilters 
          filterMode={filterMode} 
          setFilterMode={setFilterMode} 
        />
      </div>
      
      <div>
        <PortalLeaderboard category={filterMode} />
      </div>
    </div>
  )
}

export default page