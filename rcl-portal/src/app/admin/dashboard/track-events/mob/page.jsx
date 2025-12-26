'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { fetchTrackSports, syncTrackEvents } from '@/services/trackEventsService'
import { ArrowLeft, RefreshCcw } from 'lucide-react'

const TrackEventsMobile = () => {
  const router = useRouter()
  const [sports, setSports] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')

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

  const filteredSports = useMemo(() => {
    if (!search) return sports
    return sports.filter((sport) => sport.sport_name.toLowerCase().includes(search.toLowerCase()))
  }, [sports, search])

  const { instituteSports, communitySports } = useMemo(() => {
    const instituteSports = filteredSports.filter((sport) => sport.category === 'institute')
    const communitySports = filteredSports.filter((sport) => sport.category === 'community')
    return { instituteSports, communitySports }
  }, [filteredSports])

  return (
    <div className="min-h-screen p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            onClick={() => router.back()}
            size="icon"
            variant="outline"
            className="h-9 w-9 bg-white/10 border-white/20 text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Track Events</h1>
            <p className="text-xs text-white/60">Track Individual & Track Team</p>
          </div>
        </div>
        <Button
          size="icon"
          onClick={handleSync}
          disabled={syncing}
          className="h-9 w-9 bg-cranberry/20 border border-cranberry text-white"
        >
          <RefreshCcw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search track events"
        className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
      />

      {loading ? (
        <div className="flex justify-center items-center mt-16">
          <img src="/load.svg" alt="Loading" className="w-14" />
        </div>
      ) : filteredSports.length === 0 ? (
        <div className="text-center py-10 bg-white/5 rounded-lg">
          <p className="text-gray-300">No track events found.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <section>
            <div className="flex items-center w-full mb-3">
              <h3 className="text-sm font-medium text-white/70">Institute</h3>
              <div className="flex-1 ml-3 h-px bg-gradient-to-r from-white/40 to-white/5" />
            </div>
            {instituteSports.length === 0 ? (
              <div className="text-center py-4 bg-white/5 rounded-lg">
                <p className="text-gray-400 text-sm">No institute track events</p>
              </div>
            ) : (
              <div className="space-y-3">
                {instituteSports.map((sport) => (
                  <button
                    key={sport.sport_id}
                    onClick={() => router.push(`/admin/dashboard/track-events/mob/${sport.sport_id}`)}
                    className="w-full text-left bg-cranberry/85 p-4 rounded-lg border border-white/15"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-semibold">{sport.sport_name}</p>
                        <p className="text-xs text-white/70 mt-1 capitalize">{sport.sport_type}</p>
                      </div>
                      <span className="text-xs bg-white/10 px-2 py-1 rounded-full border border-white/40">
                        {sport.gender_type}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center w-full mb-3">
              <h3 className="text-sm font-medium text-white/70">Community</h3>
              <div className="flex-1 ml-3 h-px bg-gradient-to-r from-white/40 to-white/5" />
            </div>
            {communitySports.length === 0 ? (
              <div className="text-center py-4 bg-white/5 rounded-lg">
                <p className="text-gray-400 text-sm">No community track events</p>
              </div>
            ) : (
              <div className="space-y-3">
                {communitySports.map((sport) => (
                  <button
                    key={sport.sport_id}
                    onClick={() => router.push(`/admin/dashboard/track-events/mob/${sport.sport_id}`)}
                    className="w-full text-left bg-cranberry/85 p-4 rounded-lg border border-white/15"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="font-semibold">{sport.sport_name}</p>
                        <p className="text-xs text-white/70 mt-1 capitalize">{sport.sport_type}</p>
                      </div>
                      <span className="text-xs bg-white/10 px-2 py-1 rounded-full border border-white/40">
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

export default TrackEventsMobile
