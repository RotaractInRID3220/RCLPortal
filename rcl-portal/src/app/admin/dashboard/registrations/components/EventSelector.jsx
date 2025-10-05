'use client'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAtom } from 'jotai'
import { sportsDataAtom, sportsLoadingAtom, lastFetchTimestampAtom, isCacheValid } from '@/app/state/store'
import { getAllEvents } from '@/services/sportServices'
import RegistrationsList from './RegistrationsList'

const EventSelector = React.memo(() => {
  const [sportsData, setSportsData] = useAtom(sportsDataAtom)
  const [sportsLoading, setSportsLoading] = useAtom(sportsLoadingAtom)
  const [lastFetchTimestamp, setLastFetchTimestamp] = useAtom(lastFetchTimestampAtom)
  const [selectedEvent, setSelectedEvent] = useState(null)

  // Memoized filtered events to prevent unnecessary recalculations
  const { instituteEvents, communityEvents } = useMemo(() => {
    const institute = sportsData.filter(event => event.category === 'institute');
    const community = sportsData.filter(event => event.category === 'community');
    return { instituteEvents: institute, communityEvents: community };
  }, [sportsData]);

  // Optimized fetch function with caching
  const fetchAllSports = useCallback(async () => {
    // Check cache validity first
    if (sportsData.length > 0 && isCacheValid(lastFetchTimestamp.sports, 'sports')) {
      console.log('Using cached sports data');
      return;
    }

    try {
      setSportsLoading(true)
      const result = await getAllEvents({ type: ["team", "individual"] })
      if (result.success) {
        setSportsData(result.data)
        setLastFetchTimestamp(prev => ({ ...prev, sports: Date.now() }))
        console.log('Sports data loaded and cached:', result.data)
      }
    } catch (error) {
      console.error('Failed to fetch sports:', error)
    } finally {
      setSportsLoading(false)
    }
  }, [setSportsData, setSportsLoading, setLastFetchTimestamp, sportsData.length, lastFetchTimestamp.sports])

  // Load sports data when component mounts
  useEffect(() => {
    fetchAllSports()
  }, [fetchAllSports])

  const handleEventClick = useCallback((event) => {
    setSelectedEvent(event)
  }, [])

  const handleBackToEvents = useCallback(() => {
    setSelectedEvent(null)
  }, [])

  // Memoized event card component to prevent unnecessary re-renders
  const EventCard = React.memo(({ event, onClick }) => (
    <div 
      className="bg-cranberry/85 rounded-lg py-3 px-5 hover:bg-cranberry cursor-pointer"
      onClick={() => onClick(event)}
    >
      <div className='justify-between flex'>
        <h1 className="text-lg">{event.sport_name}</h1>
        <p className="bg-white/5 border border-white/80 px-4 py-1 rounded-full text-sm text-white/80">
          {event.gender_type}
        </p>
      </div>
    </div>
  ))
  
  EventCard.displayName = 'EventCard'

  if (selectedEvent) {
    return (
      <RegistrationsList 
        event={selectedEvent}
        onBack={handleBackToEvents}
        filterType="sport"
      />
    )
  }

  return (
    <div>
      <div className="flex w-full justify-between items-center mb-8">
        <h2 className="text-lg font-medium tracking-wide">SELECT EVENT</h2>
      </div>

      <div>
        {sportsLoading ? (
          <div className="flex justify-center items-center mt-40">
            <img src="/load.svg" alt="" className="w-20" />
          </div>
        ) : sportsData.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">No events found.</p>
          </div>
        ) : (
          <div className="space-y-16">
            {/* Institute Based Events */}
            <div>
              <div className='flex items-center w-full mb-4'>
                <h3 className="text-lg font-light text-white/50 flex items-center">
                  Institute Based Events
                </h3>
                <div className="flex-1 ml-4 h-px bg-gradient-to-r from-white/50 to-white/10"></div>
              </div>
              {instituteEvents.length === 0 ? (
                <div className="text-center py-6 bg-white/5 rounded-lg">
                  <p className="text-gray-400">No institute based events yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {instituteEvents.map((event, index) => (
                    <EventCard
                      key={event.id || index}
                      event={event}
                      onClick={handleEventClick}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Community Based Events */}
            <div>
              <div className='flex items-center w-full mb-4'>
                <h3 className="text-lg font-light text-white/50 flex items-center">
                  Community Based Events
                </h3>
                <div className="flex-1 ml-4 h-px bg-gradient-to-r from-white/50 to-white/10"></div>
              </div>
              {communityEvents.length === 0 ? (
                <div className="text-center py-6 bg-white/5 rounded-lg">
                  <p className="text-gray-400">No community based events yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {communityEvents.map((event, index) => (
                    <EventCard
                      key={event.id || index}
                      event={event}
                      onClick={handleEventClick}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

EventSelector.displayName = 'EventSelector'

export default EventSelector
