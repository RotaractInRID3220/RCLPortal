'use client'
import React from 'react'
import { Button } from '@/components/ui/button'

const RegistrationFilters = ({ filterMode, setFilterMode }) => {
  return (
    <div className="flex gap-2">
      <Button 
        variant={filterMode === 'sport' ? 'default' : 'outline'}
        onClick={() => setFilterMode('sport')}
        className={`
          ${filterMode === 'sport' 
            ? 'bg-cranberry hover:bg-cranberry/90 text-white cursor-pointer' 
            : 'bg-transparent border border-white/20 text-white/70 hover:bg-white/10 hover:text-white cursor-pointer'
          }
        `}
      >
        By Sport
      </Button>
      <Button 
        variant={filterMode === 'club' ? 'default' : 'outline'}
        onClick={() => setFilterMode('club')}
        className={`
          ${filterMode === 'club' 
            ? 'bg-cranberry hover:bg-cranberry/90 text-white cursor-pointer' 
            : 'bg-transparent border border-white/20 text-white/70 hover:bg-white/10 hover:text-white cursor-pointer'
          }
        `}
      >
        By Club
      </Button>
    </div>
  )
}

export default RegistrationFilters
