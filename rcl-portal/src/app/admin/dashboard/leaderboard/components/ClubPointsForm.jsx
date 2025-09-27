'use client'
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { fetchClubs } from '@/services/clubServices'
import { toast } from 'sonner'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const ClubPointsForm = ({ sport, onPointAdded }) => {
  const [clubs, setClubs] = useState([])
  const [filteredClubs, setFilteredClubs] = useState([])
  const [selectedClub, setSelectedClub] = useState('')
  const [place, setPlace] = useState('')
  const [points, setPoints] = useState('')
  const [loading, setLoading] = useState(false)
  const [clubsLoading, setClubsLoading] = useState(true)
  
  // Combobox states
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  useEffect(() => {
    const loadClubs = async () => {
      try {
        setClubsLoading(true)
        const clubsData = await fetchClubs()
        setClubs(clubsData)
        
        // Filter clubs based on sport category
        const filtered = clubsData.filter(club => club.category === sport.category)
        setFilteredClubs(filtered)
      } catch (error) {
        console.error('Failed to fetch clubs:', error)
        toast.error('Failed to load clubs')
      } finally {
        setClubsLoading(false)
      }
    }

    if (sport) {
      loadClubs()
    }
  }, [sport])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!selectedClub || !place || !points) {
      toast.error('Please fill in all fields')
      return
    }

    // Validate points must be double digits
    const placeNum = parseInt(place)
    const pointsNum = parseInt(points)
    
    if (pointsNum < 10 || pointsNum > 99) {
      toast.error('Points must be between 10-99')
      return
    }
    
    if (placeNum < 1) {
      toast.error('Place must be a positive number')
      return
    }

    try {
      setLoading(true)
      
      const response = await fetch('/api/club-points', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          club_id: selectedClub,
          sport_id: sport.sport_id,
          place: placeNum,
          points: pointsNum
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add points')
      }

      const result = await response.json()
      
      if (result.success) {
        toast.success('Points added successfully!')
        
        // Reset form
        setSelectedClub('')
        setValue('')
        setPlace('')
        setPoints('')
        
        // Notify parent component
        if (onPointAdded) {
          onPointAdded()
        }
      }
    } catch (error) {
      console.error('Error adding points:', error)
      toast.error(error.message || 'Failed to add points')
    } finally {
      setLoading(false)
    }
  }

  const handleClubSelect = (currentValue) => {
    setValue(currentValue === value ? '' : currentValue)
    setSelectedClub(currentValue === value ? '' : currentValue)
    setOpen(false)
  }

  const getSelectedClubName = () => {
    const club = filteredClubs.find(c => c.club_id === value)
    return club ? club.club_name : 'Select club...'
  }

  if (clubsLoading) {
    return (
      <div className="bg-white/5 rounded-lg p-6">
        <h3 className="text-xl font-medium mb-4">Add Club Points</h3>
        <div className="flex justify-center py-8">
          <img src="/load.svg" alt="" className="w-8" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/5 rounded-lg p-6">
      <h3 className="text-xl font-medium mb-4">Add Club Points</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Club Selection */}
          <div className="space-y-2">
            <Label htmlFor="club">Select Club</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  {getSelectedClubName()}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search clubs..." />
                  <CommandEmpty>No clubs found.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-auto">
                    {filteredClubs.map((club) => (
                      <CommandItem
                        key={club.club_id}
                        value={club.club_id}
                        onSelect={() => handleClubSelect(club.club_id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === club.club_id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {club.club_name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Place Input */}
          <div className="space-y-2">
            <Label htmlFor="place">Place</Label>
            <Input
              id="place"
              type="number"
              min="1"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="Enter place"
              className="w-full"
            />
          </div>

          {/* Points Input */}
          <div className="space-y-2">
            <Label htmlFor="points">Points (10-99)</Label>
            <Input
              id="points"
              type="number"
              min="10"
              max="99"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="Enter points"
              className="w-full"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={loading || !selectedClub || !place || !points}
            className="min-w-32"
          >
            {loading ? (
              <div className="flex items-center">
                <img src="/load.svg" alt="" className="w-4 mr-2" />
                Adding...
              </div>
            ) : (
              'Add Points'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default ClubPointsForm