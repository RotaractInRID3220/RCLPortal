'use client'
import React, { useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'

const LeaderboardFilters = React.memo(({ filterMode, setFilterMode }) => {
  const handleCommunityClick = useCallback(() => {
    setFilterMode('community')
  }, [setFilterMode])

  const handleInstituteClick = useCallback(() => {
    setFilterMode('institute')
  }, [setFilterMode])

  const communityButtonClass = useMemo(() => {
    return filterMode === 'community' 
      ? 'bg-cranberry hover:bg-cranberry/90 text-white cursor-pointer' 
      : 'bg-transparent border border-white/20 text-white/70 hover:bg-white/10 hover:text-white cursor-pointer'
  }, [filterMode])

  const instituteButtonClass = useMemo(() => {
    return filterMode === 'institute' 
      ? 'bg-cranberry hover:bg-cranberry/90 text-white cursor-pointer' 
      : 'bg-transparent border border-white/20 text-white/70 hover:bg-white/10 hover:text-white cursor-pointer'
  }, [filterMode])

  return (
    <div className="flex gap-2">
      <Button 
        variant={filterMode === 'community' ? 'default' : 'outline'}
        onClick={handleCommunityClick}
        className={communityButtonClass}
      >
        Community
      </Button>
      <Button 
        variant={filterMode === 'institute' ? 'default' : 'outline'}
        onClick={handleInstituteClick}
        className={instituteButtonClass}
      >
        Institute
      </Button>
    </div>
  )
})

export default LeaderboardFilters