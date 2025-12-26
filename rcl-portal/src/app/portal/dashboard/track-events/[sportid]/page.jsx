'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getTrackEntries } from '@/services/trackEventsService'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

const rankStyles = (entry) => {
  const hasScore = Boolean(entry?.score)
  const place = entry?.place
  if (!hasScore || !place) return 'bg-white/5 border-white/10 text-white'
  if (place === 1) return 'bg-amber-500/15 border-amber-400/50 text-white'
  if (place === 2) return 'bg-slate-200/15 border-slate-300/40 text-white'
  if (place === 3) return 'bg-orange-500/15 border-orange-400/45 text-white'
  return 'bg-white/5 border-white/10 text-white'
}

const scoreLabel = (entry) => (entry?.score ? entry.score : 'Pending')

const nameLabel = (entry, isTeam) =>
  isTeam ? entry.club_name || 'Team' : `${entry.name || '-'}${entry.club_name ? ' • ' + entry.club_name : ''}`

const TrackEventScorecard = () => {
  const params = useParams()
  const router = useRouter()
  const sportId = params.sportid

  const [sport, setSport] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!sportId) return
      try {
        const data = await getTrackEntries(sportId)
        setSport(data.sport)
        setEntries(data.entries || [])
      } catch (err) {
        // toast handled in service
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sportId])

  const isTeam = useMemo(() => sport?.sport_type === 'trackTeam', [sport])
  const hasData = entries.length > 0

  const renderEntry = (entry, index) => {
    const rank = entry.place || index + 1
    return (
      <div
        key={entry.id || entry.rmis_id || entry.team_id}
        className={`flex items-center gap-4 p-4 rounded-lg border ${rankStyles(entry)}`}
      >
        <div className="w-11 h-11 rounded-full flex items-center justify-center font-semibold bg-black/20 border border-white/10">
          {rank}
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold">{nameLabel(entry, isTeam)}</p>
          {isTeam ? (
            <p className="text-sm text-white/60">Team #{entry.team_id}</p>
          ) : (
            <p className="text-sm text-white/60">{entry.rmis_id}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-white font-semibold">{scoreLabel(entry)}</p>
          {entry.place ? <p className="text-xs text-white/60">Place {entry.place}</p> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          onClick={() => router.back()}
          variant="outline"
          size="icon"
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="text-sm text-white/60">Track Event</p>
          <h1 className="text-2xl font-semibold text-white">{sport?.sport_name || 'Loading...'}</h1>
          {sport ? (
            <p className="text-xs text-white/60">
              {sport.category} • {sport.gender_type} • {sport.sport_type === 'trackTeam' ? 'Team' : 'Individual'}
            </p>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center mt-20">
          <img src="/load.svg" alt="Loading" className="w-12" />
        </div>
      ) : !hasData ? (
        <div className="text-center py-12 bg-white/5 border border-white/10 rounded-lg">
          <p className="text-white/70">No results yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => renderEntry(entry, index))}
        </div>
      )}
    </div>
  )
}

export default TrackEventScorecard
