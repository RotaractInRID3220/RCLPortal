'use client'
import React from 'react'
import { Button } from '@/components/ui/button'

const LeaderboardFilters = ({ filterMode, setFilterMode }) => {
  return (
    <div className="flex gap-2">
      <Button 
        variant={filterMode === 'community' ? 'default' : 'outline'}
        onClick={() => setFilterMode('community')}
        className={`
          ${filterMode === 'community' 
            ? 'bg-cranberry hover:bg-cranberry/90 text-white cursor-pointer' 
            : 'bg-transparent border border-white/20 text-white/70 hover:bg-white/10 hover:text-white cursor-pointer'
          }
        `}
      >
        Community
      </Button>
      <Button 
        variant={filterMode === 'institute' ? 'default' : 'outline'}
        onClick={() => setFilterMode('institute')}
        className={`
          ${filterMode === 'institute' 
            ? 'bg-cranberry hover:bg-cranberry/90 text-white cursor-pointer' 
            : 'bg-transparent border border-white/20 text-white/70 hover:bg-white/10 hover:text-white cursor-pointer'
          }
        `}
      >
        Institute
      </Button>
    </div>
  )
}

export default LeaderboardFilters