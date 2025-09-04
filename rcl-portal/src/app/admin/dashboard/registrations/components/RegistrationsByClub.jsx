'use client'
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fetchClubs } from '@/services/clubServices'
import { getAllEvents } from '@/services/sportServices'
import RegistrationsList from './RegistrationsList'
import { toast } from 'sonner'

const RegistrationsByClub = () => {
  const [clubs, setClubs] = useState([])
  const [sports, setSports] = useState([])
  const [selectedClub, setSelectedClub] = useState('')
  const [selectedSport, setSelectedSport] = useState('all')
  const [loading, setLoading] = useState(false)
  const [showRegistrations, setShowRegistrations] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        
        // Fetch clubs
        const clubsData = await fetchClubs()
        setClubs(clubsData)
        
        // Fetch sports
        const sportsResult = await getAllEvents({ type: ["team", "individual"] })
        if (sportsResult.success) {
          setSports(sportsResult.data)
        }
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error('Failed to load clubs and sports data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleSeeRegistrations = () => {
    if (!selectedClub) {
      toast.error('Please select a club')
      return
    }
    setShowRegistrations(true)
  }

  const handleBackToFilters = () => {
    setShowRegistrations(false)
  }

  if (showRegistrations) {
    return (
      <RegistrationsList 
        clubId={selectedClub}
        sportId={selectedSport === 'all' ? null : selectedSport}
        onBack={handleBackToFilters}
        filterType="club"
      />
    )
  }

  return (
    <div>
      <div className="flex w-full justify-between items-center mb-8">
        <h2 className="text-lg font-medium tracking-wide">FILTER BY CLUB</h2>
      </div>

      {loading ? (
        <div className="flex justify-center items-center mt-40">
          <img src="/load.svg" alt="" className="w-20" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white/5 border border-white/20 rounded-lg p-6">
            <h3 className="text-lg font-medium mb-4">Select Filters</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              {/* Club Selection (Required) */}
              <div className="space-y-2 w-full flex flex-col">
                <label className="text-sm font-medium text-white/70">
                  Club <span className="text-red-400">*</span>
                </label>
                <Select value={selectedClub} onValueChange={setSelectedClub}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white w-full">
                    <SelectValue placeholder="Select a club" />
                  </SelectTrigger>
                  <SelectContent>
                    {clubs.map((club) => (
                      <SelectItem key={club.club_id} value={club.club_id.toString()}>
                        {club.club_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sport Selection (Optional) */}
              <div className="space-y-2 w-full flex flex-col">
                <label className="text-sm font-medium text-white/70">
                  Sport <span className="text-white/50">(Optional)</span>
                </label>
                <Select value={selectedSport} onValueChange={setSelectedSport}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white w-full">
                    <SelectValue placeholder="All sports" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sports</SelectItem>
                    {sports.map((sport) => (
                      <SelectItem key={sport.sport_id} value={sport.sport_id.toString()}>
                        {sport.sport_name} ({sport.gender_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
                          {/* See Registrations Button */}
              <div>
                <Button 
                  onClick={handleSeeRegistrations}
                  disabled={!selectedClub}
                  className="w-1/4 mt-6 bg-cranberry hover:bg-cranberry/90 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  See Registrations
                </Button>
              </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RegistrationsByClub
