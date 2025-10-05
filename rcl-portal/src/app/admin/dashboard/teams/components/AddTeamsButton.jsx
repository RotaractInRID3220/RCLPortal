'use client'
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import TeamService from '@/services/teamServices'

const AddTeamsButton = ({ 
  sportId = null, 
  sportName = '', 
  onTeamsCreated = null,
  variant = 'default',
  size = 'default',
  className = ''
}) => {
  const [isCreating, setIsCreating] = useState(false)

  const handleAddTeams = async () => {
    setIsCreating(true)
    
    try {
      const success = await TeamService.createTeamsWithFeedback(sportId, sportName)
      
      if (success && onTeamsCreated) {
        // Call callback to refresh data if provided
        onTeamsCreated()
      }
    } catch (error) {
      console.error('Error in AddTeamsButton:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const defaultClassName = 
    "bg-cranberry/10 border border-cranberry hover:bg-cranberry text-white cursor-pointer"

  return (
    <Button
      onClick={handleAddTeams}
      disabled={isCreating}
      variant={variant}
      size={size}
      className={`${defaultClassName} ${className}`}
    >
      {isCreating ? (
        <img src="/load.svg" alt="Loading" className="w-4 h-4 mr-2" />
      ) : (
        <Plus className="w-4 h-4" />
      )}
      {isCreating 
        ? 'Creating Teams...' 
        : sportId 
          ? 'Add Teams' 
          : 'Create All Teams'
      }
    </Button>
  )
}

export default AddTeamsButton