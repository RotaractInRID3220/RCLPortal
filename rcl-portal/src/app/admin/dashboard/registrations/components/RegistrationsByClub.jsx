'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useAtom } from 'jotai'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fetchClubs } from '@/services/clubServices'
import { getAllEvents } from '@/services/sportServices'
import { clubsDataAtom, sportsDataAtom, sportsLoadingAtom, lastFetchTimestampAtom, isCacheValid } from '@/app/state/store'
import RegistrationsList from './RegistrationsList'
import { toast } from 'sonner'

const RegistrationsByClub = React.memo(() => {
  const [clubsData, setClubsData] = useAtom(clubsDataAtom)
  const [sportsData, setSportsData] = useAtom(sportsDataAtom)
  const [sportsLoading, setSportsLoading] = useAtom(sportsLoadingAtom)
  const [lastFetchTimestamp, setLastFetchTimestamp] = useAtom(lastFetchTimestampAtom)
  
  const [selectedClub, setSelectedClub] = useState('')
  const [selectedSport, setSelectedSport] = useState('all')
  const [loading, setLoading] = useState(false)
  const [showRegistrations, setShowRegistrations] = useState(false)

  const loadClubsData = useCallback(async () => {
    // Check cache validity for clubs
    if (clubsData.length > 0 && isCacheValid(lastFetchTimestamp.clubs, 'clubs')) {
      console.log('Using cached clubs data');
      return;
    }

    try {
      const clubsResult = await fetchClubs()
      setClubsData(clubsResult)
      setLastFetchTimestamp(prev => ({ ...prev, clubs: Date.now() }))
      console.log('Clubs data loaded and cached:', clubsResult)
    } catch (error) {
      console.error('Error loading clubs:', error)
      toast.error('Failed to load clubs data')
    }
  }, [clubsData.length, lastFetchTimestamp.clubs, setClubsData, setLastFetchTimestamp])

  const loadSportsData = useCallback(async () => {
    // Check cache validity for sports
    if (sportsData.length > 0 && isCacheValid(lastFetchTimestamp.sports, 'sports')) {
      console.log('Using cached sports data');
      return;
    }

    try {
      setSportsLoading(true)
      const sportsResult = await getAllEvents({ type: ["team", "individual"] })
      if (sportsResult.success) {
        setSportsData(sportsResult.data)
        setLastFetchTimestamp(prev => ({ ...prev, sports: Date.now() }))
        console.log('Sports data loaded and cached:', sportsResult.data)
      }
    } catch (error) {
      console.error('Error loading sports:', error)
      toast.error('Failed to load sports data')
    } finally {
      setSportsLoading(false)
    }
  }, [sportsData.length, lastFetchTimestamp.sports, setSportsData, setSportsLoading, setLastFetchTimestamp])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        await Promise.all([loadClubsData(), loadSportsData()])
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [loadClubsData, loadSportsData])

  const handleSeeRegistrations = useCallback(() => {
    if (!selectedClub) {
      toast.error('Please select a club')
      return
    }
    setShowRegistrations(true)
  }, [selectedClub])

  const handleBackToFilters = useCallback(() => {
    setShowRegistrations(false)
  }, [])

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
                    {clubsData.map((club) => (
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
                    {sportsData.map((sport) => (
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
})

RegistrationsByClub.displayName = 'RegistrationsByClub'

export default RegistrationsByClub
