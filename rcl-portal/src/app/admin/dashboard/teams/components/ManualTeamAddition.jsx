'use client'
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Users } from 'lucide-react'

const ManualTeamAddition = ({ sportId, sportName, onTeamAdded }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedClubId, setSelectedClubId] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [availableClubs, setAvailableClubs] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasInitialFetch, setHasInitialFetch] = useState(false)

  const fetchAvailableClubs = async () => {
    if (!sportId) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/available-clubs?sport_id=${sportId}`)
      const result = await response.json()
      
      if (result.success) {
        setAvailableClubs(result.available_clubs || [])
        setHasInitialFetch(true)
      }
    } catch (error) {
      console.error('Error fetching available clubs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isDialogOpen && sportId && !hasInitialFetch) {
      fetchAvailableClubs()
    }
  }, [isDialogOpen, sportId, hasInitialFetch])

  const handleAddTeam = async () => {
    if (!selectedClubId) {
      toast.error('Please select a club')
      return
    }

    setIsAdding(true)
    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          manual_addition: true,
          sport_id: parseInt(sportId),
          club_id: parseInt(selectedClubId)
        })
      })

      const result = await response.json()

      if (result.success) {
        const selectedClub = availableClubs.find(c => c.club_id == selectedClubId)
        toast.success(`Team added for ${selectedClub?.club_name}`)
        setIsDialogOpen(false)
        setSelectedClubId('')
        
        // Refresh available clubs data since one club now has a team
        await fetchAvailableClubs()
        
        if (onTeamAdded) onTeamAdded()
      } else {
        toast.error(result.error || 'Failed to add team')
      }
    } catch (error) {
      console.error('Error adding team:', error)
      toast.error('Failed to add team')
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button 
          size="sm"
          className="bg-green-600/5 border-green-600/10 border text-green-400 hover:bg-green-600/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Team Manually
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-black/70 backdrop-blur-sm border-cranberry/40 p-8">
        <DialogHeader>
          <DialogTitle className="text-white">Add Team Manually</DialogTitle>
          <DialogDescription className="text-slate-300">
            Add a team for any club in the same category as {sportName}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-white mb-2 block">
              Select Club
            </label>
            {loading ? (
              <div className="flex justify-center py-4">
                <img src="/load.svg" alt="Loading" className="w-8" />
              </div>
            ) : (
              <Select value={selectedClubId} onValueChange={setSelectedClubId}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white w-full">
                  <SelectValue placeholder="Choose a club..." />
                </SelectTrigger>
                <SelectContent className="bg-black border-gray-700">
                  {availableClubs.map((club) => (
                    <SelectItem 
                      key={club.club_id} 
                      value={club.club_id.toString()}
                      className="text-white hover:bg-slate-700"
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{club.club_name}</span>
                        <div className="flex items-center space-x-2 ml-2">
                          {club.registration_count > 0 && (
                            <Badge variant="secondary" className="bg-blue-500/20 text-blue-300">
                              {club.registration_count} players
                            </Badge>
                          )}
                          {club.has_team && (
                            <Badge variant="secondary" className="bg-red-500/20 text-red-300">
                              Has Team
                            </Badge>
                          )}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="bg-slate-900/50 p-3 rounded-lg">
            <div className="flex items-center space-x-2 text-sm text-slate-300">
              <Users className="w-4 h-4" />
              <span>
                You can add teams for any club in the same category, regardless of registration count.
              </span>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsDialogOpen(false)}
              className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600 cursor-pointer"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddTeam}
              disabled={isAdding || !selectedClubId || loading}
              className="bg-cranberry/80 hover:bg-cranberry text-white cursor-pointer"
            >
              {isAdding ? 'Adding...' : 'Add Team'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ManualTeamAddition