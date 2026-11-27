'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAtom } from 'jotai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { fetchClubs } from '@/services/clubServices'
import { addClubPoints } from '@/services/leaderboardServices'
import { 
  clubsDataAtom, 
  lastFetchTimestampAtom, 
  isCacheValid 
} from '@/app/state/store'
import { toast } from 'sonner'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const ClubPointsForm = React.memo(({ sport, onPointAdded }) => {
  const [clubsData, setClubsData] = useAtom(clubsDataAtom)
  const [lastFetchTimestamp, setLastFetchTimestamp] = useAtom(lastFetchTimestampAtom)
  const [selectedClub, setSelectedClub] = useState('')
  const [place, setPlace] = useState('')
  const [points, setPoints] = useState('')
  const [loading, setLoading] = useState(false)
  const [clubsLoading, setClubsLoading] = useState(false)
  
  // Combobox states
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  // Memoized filtered clubs based on sport category
  const filteredClubs = useMemo(() => {
    if (!sport?.category || !clubsData.length) return []
    return clubsData.filter(club => club.category === sport.category)
  }, [clubsData, sport?.category])

  // Optimized clubs loading with caching
  const loadClubs = useCallback(async (forceRefresh = false) => {
    try {
      // Check cache validity
      if (!forceRefresh && clubsData.length > 0 && isCacheValid(lastFetchTimestamp.clubs)) {
        console.log('Using cached clubs data')
        return
      }

      setClubsLoading(true)
      const clubs = await fetchClubs()
      setClubsData(clubs)
      setLastFetchTimestamp(prev => ({ ...prev, clubs: Date.now() }))
      console.log('Clubs data loaded and cached:', clubs.length, 'clubs')
    } catch (error) {
      console.error('Failed to fetch clubs:', error)
      toast.error('Failed to load clubs')
    } finally {
      setClubsLoading(false)
    }
  }, [clubsData.length, lastFetchTimestamp.clubs, setClubsData, setLastFetchTimestamp])

  useEffect(() => {
    if (sport) {
      loadClubs()
    }
  }, [sport, loadClubs])

  // Optimized submit handler using the new service
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    
    if (!selectedClub || !points) {
      toast.error('Please select a club and enter the points')
      return
    }

    // Manual entry: any non-zero whole number (negative = deduction)
    const placeNum = place ? parseInt(place) : null
    const pointsNum = parseInt(points)

    if (!Number.isInteger(pointsNum) || pointsNum === 0 || Math.abs(pointsNum) > 1000) {
      toast.error('Points must be a non-zero whole number (max 1000, negative to deduct)')
      return
    }

    if (placeNum !== null && placeNum < 1) {
      toast.error('Place must be a positive number')
      return
    }

    try {
      setLoading(true)
      
      const result = await addClubPoints({
        clubId: selectedClub,
        sportId: sport.sport_id,
        place: placeNum,
        points: pointsNum
      })
      
      if (!result.success) {
        toast.error(result.error || 'Failed to add points')
      } else {
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
  }, [selectedClub, place, points, sport?.sport_id, onPointAdded])

  const handleClubSelect = useCallback((currentValue) => {
    setValue(currentValue === value ? '' : currentValue)
    setSelectedClub(currentValue === value ? '' : currentValue)
    setOpen(false)
  }, [value])

  const getSelectedClubName = useCallback(() => {
    const club = filteredClubs.find(c => c.club_id === value)
    return club ? club.club_name : 'Select club...'
  }, [filteredClubs, value])

  if (clubsLoading && clubsData.length === 0) {
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
      <h3 className="text-xl font-medium mb-4">Add Manual Club Points</h3>
      
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
            <Label htmlFor="place">Place (optional)</Label>
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
            <Label htmlFor="points">Points (negative to deduct)</Label>
            <Input
              id="points"
              type="number"
              min="-1000"
              max="1000"
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
            disabled={loading || !selectedClub || !points}
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
})

export default ClubPointsForm