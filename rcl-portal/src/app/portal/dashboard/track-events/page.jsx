'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchTrackSports } from '@/services/trackEventsService'
import { Button } from '@/components/ui/button'

const TrackEventsList = () => {
  const router = useRouter()
  const [sports, setSports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchTrackSports()
        setSports(data || [])
      } catch (err) {
        // toast handled in service
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const trackSports = useMemo(
    () => (sports || []).filter((s) => ['trackIndividual', 'trackTeam'].includes(s.sport_type)),
    [sports]
  )

  const { instituteSports, communitySports } = useMemo(() => {
    const instituteSports = trackSports.filter((sport) => sport.category === 'institute')
    const communitySports = trackSports.filter((sport) => sport.category === 'community')
    return { instituteSports, communitySports }
  }, [trackSports])

  return (
    <div className="space-y-10">
      <div className="flex w-full justify-between items-center">
        <h1 className="text-3xl font-semibold tracking-wide">TRACK EVENTS</h1>
      </div>

      {loading ? (
        <div className="flex justify-center items-center mt-32">
          <img src="/load.svg" alt="Loading" className="w-16" />
        </div>
      ) : !trackSports.length ? (
        <div className="text-center py-12 bg-white/5 border border-white/10 rounded-lg">
          <p className="text-white/70">No track events found.</p>
        </div>
      ) : (
        <div className="space-y-12">
          <section>
            <div className="flex items-center w-full mb-4">
              <h3 className="text-lg font-light text-white/60">Institute Based</h3>
              <div className="flex-1 ml-4 h-px bg-gradient-to-r from-white/50 to-white/10" />
            </div>
            {!instituteSports.length ? (
              <div className="text-center py-6 bg-white/5 rounded-lg">
                <p className="text-white/60">No institute track events yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {instituteSports.map((sport) => (
                  <div
                    key={sport.sport_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/portal/dashboard/track-events/${sport.sport_id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        router.push(`/portal/dashboard/track-events/${sport.sport_id}`)
                      }
                    }}
                    className="bg-cranberry/85 rounded-lg py-4 px-5 hover:bg-cranberry cursor-pointer text-left w-full border border-white/10 transition outline-none focus:ring-2 focus:ring-white/40"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-white">{sport.sport_name}</p>
                        <p className="text-white/70 text-sm capitalize">
                          {sport.sport_type === 'trackTeam' ? 'Team event' : 'Individual event'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="bg-white/10 border border-white/60 px-3 py-1 rounded-full text-xs text-white/80 capitalize">
                          {sport.gender_type}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="bg-white/10 border border-white/40 text-white hover:bg-white/20 h-8 px-3"
                        >
                          View
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-white/60 mt-2 capitalize">{sport.category} • Track</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center w-full mb-4">
              <h3 className="text-lg font-light text-white/60">Community Based</h3>
              <div className="flex-1 ml-4 h-px bg-gradient-to-r from-white/50 to-white/10" />
            </div>
            {!communitySports.length ? (
              <div className="text-center py-6 bg-white/5 rounded-lg">
                <p className="text-white/60">No community track events yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {communitySports.map((sport) => (
                  <div
                    key={sport.sport_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/portal/dashboard/track-events/${sport.sport_id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        router.push(`/portal/dashboard/track-events/${sport.sport_id}`)
                      }
                    }}
                    className="bg-cranberry/85 rounded-lg py-4 px-5 hover:bg-cranberry cursor-pointer text-left w-full border border-white/10 transition outline-none focus:ring-2 focus:ring-white/40"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-white">{sport.sport_name}</p>
                        <p className="text-white/70 text-sm capitalize">
                          {sport.sport_type === 'trackTeam' ? 'Team event' : 'Individual event'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="bg-white/10 border border-white/60 px-3 py-1 rounded-full text-xs text-white/80 capitalize">
                          {sport.gender_type}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="bg-white/10 border border-white/40 text-white hover:bg-white/20 h-8 px-3"
                        >
                          View
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-white/60 mt-2 capitalize">{sport.category} • Track</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

export default TrackEventsList
