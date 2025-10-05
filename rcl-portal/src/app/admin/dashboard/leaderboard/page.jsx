'use client'
import React from 'react'
import LeaderboardSportSelector from './components/LeaderboardSportSelector'

const page = () => {
  return (
    <div>
      <div className="flex w-full justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold tracking-wide">CLUB LEADERBOARD</h1>
      </div>
      
      <div>
        <LeaderboardSportSelector />
      </div>
    </div>
  )
}

export default page