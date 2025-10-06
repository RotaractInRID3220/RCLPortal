'use client'
import React, { useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'

const EArenaLeaderboardFilters = React.memo(({ filterMode, setFilterMode }) => {
  const handleCommunityClick = useCallback(() => {
    setFilterMode('community')
  }, [setFilterMode])

  const handleInstituteClick = useCallback(() => {
    setFilterMode('institute')
  }, [setFilterMode])

  const communityButtonClass = useMemo(() => {
    return filterMode === 'community'
      ? 'bg-cranberry/30 border-cranberry/80 text-white shadow-lg shadow-cranberry/30'
      : 'bg-cranberry/10 border border-cranberry text-cranberry/70 hover:bg-cranberry/30 hover:border-cranberry/80 hover:text-white hover:shadow-lg hover:shadow-cranberry/30'
  }, [filterMode])

  const instituteButtonClass = useMemo(() => {
    return filterMode === 'institute'
      ? 'bg-cranberry/30 border-cranberry/80 text-white shadow-lg shadow-cranberry/30'
      : 'bg-cranberry/10 border border-cranberry text-cranberry/70 hover:bg-cranberry/30 hover:border-cranberry/80 hover:text-white hover:shadow-lg hover:shadow-cranberry/30'
  }, [filterMode])

  return (
    <div className="flex gap-4">
      <Button
        // variant={filterMode === 'community' ? 'default' : 'outline'}
        onClick={handleCommunityClick}
        className={`group relative cursor-pointer px-8 py-3 rounded-lg overflow-hidden transition-all duration-300 font-bebas text-2xl leading-none ${communityButtonClass}`}
      >
        <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        <span className="relative z-10">
          Community
        </span>
      </Button>
      <Button
        // variant={filterMode === 'institute' ? 'default' : 'outline'}
        onClick={handleInstituteClick}
        className={`group relative cursor-pointer px-8 py-3 rounded-lg overflow-hidden transition-all duration-300 font-bebas text-2xl leading-none ${instituteButtonClass}`}
      >
        <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        <span className="relative z-10">
          Institute
        </span>
      </Button>
    </div>
  )
})

export default EArenaLeaderboardFilters