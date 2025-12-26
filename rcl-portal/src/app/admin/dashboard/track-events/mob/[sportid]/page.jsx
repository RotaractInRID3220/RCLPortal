'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { awardTrackPoints, getTrackEntries, syncTrackEvents, updateTrackEntry } from '@/services/trackEventsService'
import { ArrowLeft } from 'lucide-react'

const reorder = (list, fromIndex, toIndex) => {
  const updated = [...list]
  const [moved] = updated.splice(fromIndex, 1)
  updated.splice(toIndex, 0, moved)
  return updated
}

const TrackEventMobileDetail = () => {
  const params = useParams()
  const router = useRouter()
  const sportId = params.sportid

  const [sport, setSport] = useState(null)
  const [entries, setEntries] = useState([])
  const [reserves, setReserves] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [awarding, setAwarding] = useState(false)
  const [savingAll, setSavingAll] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const result = await getTrackEntries(sportId)
      setSport(result.sport)
      setEntries(result.entries || [])
      setReserves(result.reserves || [])
    } catch (error) {
      // toast handled in service
    } finally {
      setLoading(false)
    }
  }, [sportId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSync = async () => {
    try {
      setSyncing(true)
      const result = await syncTrackEvents(Number(sportId))
      toast.success(`Synced ${result.inserted || 0} entries`)
      await fetchData()
    } catch (error) {
      // toast handled in service
    } finally {
      setSyncing(false)
    }
  }

  const handleSaveAll = async () => {
    const payload = entries
      .filter((entry) => entry.id)
      .map((entry, idx) => ({ id: entry.id, score: entry.score ?? '', place: idx + 1 }))

    if (!payload.length) {
      toast.error('Nothing to save. Sync first?')
      return
    }

    try {
      setSavingAll(true)
      await Promise.all(payload.map((row) => updateTrackEntry(row)))
      setEntries((prev) => prev.map((entry, idx) => ({ ...entry, place: idx + 1 })))
      toast.success('Rankings saved')
    } catch (error) {
      // toast handled in service
    } finally {
      setSavingAll(false)
    }
  }

  const handleAwardPoints = async () => {
    try {
      setAwarding(true)
      const result = await awardTrackPoints(Number(sportId))
      toast.success(`Awarded points to ${result.updated || 0} club(s)`) 
    } catch (error) {
      // toast handled in service
    } finally {
      setAwarding(false)
    }
  }

  const onDragStart = (index) => (e) => {
    e.dataTransfer.setData('text/plain', String(index))
  }

  const onDragOver = (e) => {
    e.preventDefault()
  }

  const onDrop = (toIndex) => (e) => {
    e.preventDefault()
    const fromIndex = Number(e.dataTransfer.getData('text/plain'))
    if (Number.isNaN(fromIndex)) return
    setEntries((prev) => reorder(prev, fromIndex, toIndex))
  }

  const renderIndividual = () => (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <div
          key={entry.id || entry.rmis_id}
          className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3"
          draggable
          onDragStart={onDragStart(index)}
          onDragOver={onDragOver}
          onDrop={onDrop(index)}
        >
          <div>
            <p className="font-semibold text-white">#{index + 1} • {entry.name}</p>
            <p className="text-sm text-white/70">{entry.club_name}</p>
            <p className="text-xs text-white/60">{entry.rmis_id}</p>
          </div>
          <div className="space-y-2">
            <Input
              value={entry.score ?? ''}
              placeholder="Score / Time"
              onChange={(e) => setEntries((prev) => prev.map((row) => (row.id === entry.id ? { ...row, score: e.target.value } : row)))}
              className="bg-white/10 border-white/20 text-white"
            />
            <p className="text-xs text-white/60 text-right">Drag to reorder</p>
          </div>
        </div>
      ))}
    </div>
  )

  const renderTeams = () => (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <div
          key={entry.team_id}
          className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3"
          draggable
          onDragStart={onDragStart(index)}
          onDragOver={onDragOver}
          onDrop={onDrop(index)}
        >
          <div>
            <p className="font-semibold text-white">#{index + 1} • {entry.club_name}</p>
            <p className="text-sm text-white/70">Team #{entry.team_id}</p>
          </div>
          <div className="space-y-2">
            <Input
              value={entry.score ?? ''}
              placeholder="Score / Time"
              onChange={(e) =>
                setEntries((prev) => prev.map((row) => (row.team_id === entry.team_id ? { ...row, score: e.target.value } : row)))
              }
              className="bg-white/10 border-white/20 text-white"
            />
            <p className="text-xs text-white/60 text-right">Drag to reorder</p>
          </div>
          {entry.players?.length ? (
            <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
              {entry.players.map((player) => (
                <div key={player.rmis_id} className="flex justify-between text-sm text-white/80">
                  <span>{player.name}</span>
                  <span className="text-white/60">{player.rmis_id}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )

  return (
    <div className="p-4 space-y-6">
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
            <h1 className="text-xl font-semibold">{sport?.sport_name || 'Track Event'}</h1>
            {sport ? (
              <p className="text-xs text-white/60">
                {sport.category} • {sport.gender_type} • {sport.sport_type}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSync}
            disabled={syncing}
            className="bg-white/10 border-white/20 text-white"
          >
            {syncing ? 'Syncing...' : 'Sync'}
          </Button>
          <Button
            size="sm"
            onClick={handleSaveAll}
            disabled={savingAll || entries.length === 0}
            className="bg-white/15 border border-white/30 text-white"
          >
            {savingAll ? 'Saving...' : 'Save Order'}
          </Button>
          <Button
            size="sm"
            onClick={handleAwardPoints}
            disabled={awarding || entries.length === 0}
            className="bg-cranberry/20 border border-cranberry text-white"
          >
            {awarding ? 'Awarding...' : 'Award'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center mt-16">
          <img src="/load.svg" alt="Loading" className="w-14" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-10 bg-white/5 rounded-lg">
          <p className="text-gray-300">No participants yet. Try syncing.</p>
        </div>
      ) : sport?.sport_type === 'trackTeam' ? (
        renderTeams()
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm uppercase text-white/70">Main Players</h3>
          {renderIndividual()}
          {reserves?.length ? (
            <div className="space-y-2">
              <h4 className="text-sm text-white/70">Reserves</h4>
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                {reserves.map((res) => (
                  <div key={res.rmis_id} className="flex justify-between text-sm text-white/80">
                    <span>{res.name}</span>
                    <span className="text-white/60">{res.club_name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default TrackEventMobileDetail
