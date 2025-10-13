'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useAtom } from 'jotai'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
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
    try {
      const clubsResult = await fetchClubs()
      setClubsData(clubsResult)
      setLastFetchTimestamp(prev => ({ ...prev, clubs: Date.now() }))
      console.log('Clubs data loaded and cached:', clubsResult)
    } catch (error) {
      console.error('Error loading clubs:', error)
      toast.error('Failed to load clubs data')
    }
  }, [setClubsData, setLastFetchTimestamp])

  const loadSportsData = useCallback(async () => {
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
  }, [setSportsData, setSportsLoading, setLastFetchTimestamp])

  useEffect(() => {
    const loadData = async () => {
      const needsClubsData = !(clubsData.length > 0 && isCacheValid(lastFetchTimestamp.clubs, 'clubs'))
      const needsSportsData = !(sportsData.length > 0 && isCacheValid(lastFetchTimestamp.sports, 'sports'))
      
      if (needsClubsData || needsSportsData) {
        setLoading(true)
      }
      
      try {
        const promises = []
        if (needsClubsData) {
          console.log('Loading clubs data...')
          promises.push(loadClubsData())
        } else {
          console.log('Using cached clubs data')
        }
        
        if (needsSportsData) {
          console.log('Loading sports data...')
          promises.push(loadSportsData())
        } else {
          console.log('Using cached sports data')
        }
        
        await Promise.all(promises)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, []) // Only run once on mount

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
                <Combobox
                  options={clubsData.map((club) => ({
                    value: club.club_id.toString(),
                    label: club.club_name
                  }))}
                  value={selectedClub}
                  onValueChange={setSelectedClub}
                  placeholder="Select a club"
                  searchPlaceholder="Search clubs..."
                  emptyMessage="No clubs found."
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>

              {/* Sport Selection (Optional) */}
              <div className="space-y-2 w-full flex flex-col">
                <label className="text-sm font-medium text-white/70">
                  Sport <span className="text-white/50">(Optional)</span>
                </label>
                <Combobox
                  options={[
                    { value: "all", label: "All sports" },
                    ...sportsData.map((sport) => ({
                      value: sport.sport_id.toString(),
                      label: `${sport.sport_name} (${sport.gender_type})`
                    }))
                  ]}
                  value={selectedSport}
                  onValueChange={setSelectedSport}
                  placeholder="All sports"
                  searchPlaceholder="Search sports..."
                  emptyMessage="No sports found."
                  className="bg-white/10 border-white/20 text-white"
                />
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
