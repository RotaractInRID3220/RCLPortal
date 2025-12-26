'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { fetchTrackSports, syncTrackEvents } from '@/services/trackEventsService'

const TrackEventsSelector = () => {
  const router = useRouter()
  const [sports, setSports] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const fetchSports = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchTrackSports()
      setSports(data || [])
    } catch (error) {
      // toast handled in service
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSports()
  }, [fetchSports])

  const handleSync = async () => {
    try {
      setSyncing(true)
      const result = await syncTrackEvents()
      toast.success(`Synced ${result.inserted || 0} entries`)
      await fetchSports()
    } catch (error) {
      // toast handled in service
    } finally {
      setSyncing(false)
    }
  }

  const handleNavigate = (sportId) => {
    router.push(`/admin/dashboard/track-events/${sportId}`)
  }

  const { instituteSports, communitySports } = useMemo(() => {
    const instituteSports = sports.filter((sport) => sport.category === 'institute')
    const communitySports = sports.filter((sport) => sport.category === 'community')
    return { instituteSports, communitySports }
  }, [sports])

  return (
    <div className="space-y-10">
      <div className="flex w-full justify-between items-center mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-wide">TRACK EVENTS</h1>
          <p className="text-gray-400 text-sm mt-1">Track Individual & Track Team</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="hidden md:inline-flex"
            onClick={() => router.push('/admin/dashboard/track-events/mob')}
          >
            Mobile View
          </Button>
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="bg-cranberry/20 border border-cranberry hover:bg-cranberry text-white disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {syncing ? 'Syncing...' : 'Sync Players'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center mt-32">
          <img src="/load.svg" alt="Loading" className="w-16" />
        </div>
      ) : sports.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-400">No track events found.</p>
        </div>
      ) : (
        <div className="space-y-12">
          <section>
            <div className="flex items-center w-full mb-4">
              <h3 className="text-lg font-light text-white/60">Institute Based</h3>
              <div className="flex-1 ml-4 h-px bg-gradient-to-r from-white/50 to-white/10" />
            </div>
            {instituteSports.length === 0 ? (
              <div className="text-center py-6 bg-white/5 rounded-lg">
                <p className="text-gray-400">No institute track events yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {instituteSports.map((sport) => (
                  <button
                    key={sport.sport_id}
                    onClick={() => handleNavigate(sport.sport_id)}
                    className="bg-cranberry/85 rounded-lg py-4 px-5 hover:bg-cranberry cursor-pointer text-left w-full border border-white/10"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="text-lg font-semibold">{sport.sport_name}</p>
                        <p className="text-white/70 text-sm mt-1 capitalize">{sport.sport_type}</p>
                      </div>
                      <span className="bg-white/10 border border-white/60 px-3 py-1 rounded-full text-xs text-white/80">
                        {sport.gender_type}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center w-full mb-4">
              <h3 className="text-lg font-light text-white/60">Community Based</h3>
              <div className="flex-1 ml-4 h-px bg-gradient-to-r from-white/50 to-white/10" />
            </div>
            {communitySports.length === 0 ? (
              <div className="text-center py-6 bg-white/5 rounded-lg">
                <p className="text-gray-400">No community track events yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {communitySports.map((sport) => (
                  <button
                    key={sport.sport_id}
                    onClick={() => handleNavigate(sport.sport_id)}
                    className="bg-cranberry/85 rounded-lg py-4 px-5 hover:bg-cranberry cursor-pointer text-left w-full border border-white/10"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="text-lg font-semibold">{sport.sport_name}</p>
                        <p className="text-white/70 text-sm mt-1 capitalize">{sport.sport_type}</p>
                      </div>
                      <span className="bg-white/10 border border-white/60 px-3 py-1 rounded-full text-xs text-white/80">
                        {sport.gender_type}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

export default TrackEventsSelector
