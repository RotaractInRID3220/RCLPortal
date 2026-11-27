'use client'
import React, { useState, useCallback } from 'react'
import PageBackground from '@/components/landing/PageBackground'
import EArenaLeaderboardFilters from './components/EArenaLeaderboardFilters'
import EArenaPortalLeaderboard from './components/EArenaPortalLeaderboard'

export default function EArenaLeaderboardPage() {
  const [filterMode, setFilterMode] = useState('community') // 'community' or 'institute'

  const handleFilterChange = useCallback((newMode) => {
    setFilterMode(newMode)
  }, [])

  return (
    <>
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Belanosima:wght@400;600;700&display=swap" rel="stylesheet" />

      <div className="min-h-screen bg-black flex flex-col overflow-x-hidden">
        {/* Main Content */}
        <main className="flex-1 relative">
          <PageBackground />

          {/* Content Container */}
          <div className="relative z-10 pb-12 md:pb-20 pt-16 mt-[10%] md:mt-[5%] md:pt-20">
            {/* Leaderboard Section */}
            <section className="max-w-[1920px] mx-auto px-4 md:px-6 lg:px-12 xl:px-24">
              <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-5">
                  <h1 className="font-sakana text-[clamp(2rem,10vw,6rem)] leading-tight font-normal text-white mb-2 select-none drop-shadow-[0_0_28px_rgba(0,217,255,0.35)] tracking-wide">
                    LEADERBOARD
                  </h1>
                  <p className="font-sakana text-brand-glow text-sm md:text-xl lg:text-2xl leading-tight tracking-wide">
                    ROTARACT CLUB RANKINGS
                  </p>
                </div>

                {/* Filters */}
                <div className="flex justify-center mb-8">
                  <EArenaLeaderboardFilters
                    filterMode={filterMode}
                    setFilterMode={handleFilterChange}
                  />
                </div>

                {/* Leaderboard Content */}
                <div className="relative">
                  {/* Animated border container */}
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-cranberry via-brand-glow to-cranberry bg-[length:200%_100%] animate-shimmer opacity-30 rounded-lg"
                         style={{ padding: '2px' }}>
                      <div className="absolute inset-[2px] bg-black/80 backdrop-blur-sm rounded-lg"></div>
                    </div>

                    {/* Content */}
                    <div className="relative bg-black/60 border border-cranberry/30 rounded-lg p-6 md:p-8 lg:p-12 backdrop-blur-sm">
                      <EArenaPortalLeaderboard category={filterMode} />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </>
  )
}