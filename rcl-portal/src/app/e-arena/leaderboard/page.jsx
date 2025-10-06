'use client'
import React, { useState, useCallback } from 'react'
import Image from 'next/image'
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
          {/* Background Image */}
          <div className="absolute inset-0 top-3 w-full h-screen z-0">
            <Image
              src="/bg image.png"
              alt="E-Arena Background"
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-black/40"></div>
          </div>

          {/* Pink Glow Effect */}
          <div className="fixed top-[-900px] left-0 right-0 mx-auto w-[1490px] h-[864px] bg-cranberry/60 rounded-full z-0"
               style={{ filter: 'blur(1000px)' }}></div>

          {/* Content Container */}
          <div className="relative z-10 pb-12 md:pb-20 pt-16 mt-[10%] md:mt-[5%] md:pt-20">
            {/* Leaderboard Section */}
            <section className="max-w-[1920px] mx-auto px-4 md:px-6 lg:px-12 xl:px-24">
              <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-5">
                  <h1 className="font-bebas text-white text-6xl md:text-7xl lg:text-7xl xl:text-8xl font-normal  tracking-wide select-none"
                      style={{
                        WebkitTextStroke: '2px rgba(216, 27, 93, 0.3)',
                      }}>
                    LEADERBOARD
                  </h1>
                  <p className="font-bebas text-cranberry text-lg md:text-xl lg:text-2xl xl:text-3xl leading-tight tracking-wide">
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
                    <div className="absolute inset-0 bg-gradient-to-r from-cranberry via-pink-500 to-cranberry bg-[length:200%_100%] animate-shimmer opacity-30 rounded-lg"
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