'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { awardTrackPoints, getTrackEntries, syncTrackEvents, updateTrackEntry } from '@/services/trackEventsService'
import { ChevronsDown, ChevronsUp, ArrowLeft } from 'lucide-react'

const reorder = (list, fromIndex, toIndex) => {
  const updated = [...list]
  const [moved] = updated.splice(fromIndex, 1)
  updated.splice(toIndex, 0, moved)
  return updated
}

// Parse score/time to a comparable number (handles formats like "10.5", "1:23.45", "01:23:45")
const parseScore = (score) => {
  if (!score || String(score).trim() === '') return null
  const str = String(score).trim()
  
  // Check if it's a time format (contains ":")
  if (str.includes(':')) {
    const parts = str.split(':').map(Number)
    if (parts.some(isNaN)) return null
    // Convert to seconds: supports mm:ss.ms or hh:mm:ss formats
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1]
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
  }
  
  // Try parsing as a number
  const num = parseFloat(str)
  return isNaN(num) ? null : num
}

// Sort entries by score (lower is better for track events)
const sortByScore = (entries) => {
  const hasScores = entries.some((e) => parseScore(e.score) !== null)
  if (!hasScores) return entries
  
  return [...entries].sort((a, b) => {
    const scoreA = parseScore(a.score)
    const scoreB = parseScore(b.score)
    
    // Entries with scores come before those without
    if (scoreA === null && scoreB === null) return 0
    if (scoreA === null) return 1
    if (scoreB === null) return -1
    
    return scoreA - scoreB // Lower score/time = better (ascending)
  })
}

const TrackEventDetail = () => {
  const params = useParams()
  const router = useRouter()
  const sportId = params.sportid

  const [sport, setSport] = useState(null)
  const [entries, setEntries] = useState([])
  const [reserves, setReserves] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [awarding, setAwarding] = useState(false)
  const [expandedTeams, setExpandedTeams] = useState({})
  const [savingAll, setSavingAll] = useState(false)

  const fetchData = useCallback(async () => {
    if (!sportId) return
    try {
      setLoading(true)
      const result = await getTrackEntries(sportId)
      setSport(result.sport)
      // Sort entries by score/time if available
      setEntries(sortByScore(result.entries || []))
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

  const toggleTeam = (teamId) => {
    setExpandedTeams((prev) => ({ ...prev, [teamId]: !prev[teamId] }))
  }

  const header = useMemo(() => {
    if (!sport) return null
    return (
      <div className="flex flex-col gap-2">
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
            <h1 className="text-2xl font-semibold">{sport.sport_name}</h1>
            <p className="text-gray-400 text-sm capitalize">
              {sport.category} • {sport.gender_type} • {sport.sport_type}
            </p>
          </div>
        </div>
      </div>
    )
  }, [router, sport])

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

  const renderIndividualRows = () => (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <div
          key={entry.id || entry.RMIS_ID}
          className="bg-white/5 border border-white/10 rounded-lg p-4"
          draggable
          onDragStart={onDragStart(index)}
          onDragOver={onDragOver}
          onDrop={onDrop(index)}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <p className="font-semibold text-white">#{index + 1} • {entry.name}</p>
              <p className="text-sm text-white/70">{entry.RMIS_ID}</p>
              <p className="text-sm text-white/60">{entry.club_name}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <Input
                value={entry.score ?? ''}
                placeholder="Score / Time"
                onChange={(e) => setEntries((prev) => prev.map((row) => (row.RMIS_ID === entry.RMIS_ID ? { ...row, score: e.target.value } : row)))}
                className="bg-white/10 border-white/20 text-white"
              />
              <div className="text-sm text-white/70 self-center">Drag to reorder</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  const renderTeamRows = () => (
    <div className="space-y-3">
      {entries.map((entry, index) => {
        const isExpanded = expandedTeams[entry.team_id]
        return (
          <div
            key={entry.team_id}
            className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3"
            draggable
            onDragStart={onDragStart(index)}
            onDragOver={onDragOver}
            onDrop={onDrop(index)}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="font-semibold text-white">#{index + 1} • {entry.club_name}</p>
                <p className="text-sm text-white/70">Team #{entry.team_id}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Input
                  value={entry.score ?? ''}
                  placeholder="Score / Time"
                  onChange={(e) =>
                    setEntries((prev) => prev.map((row) => (row.team_id === entry.team_id ? { ...row, score: e.target.value } : row)))
                  }
                  className="bg-white/10 border-white/20 text-white"
                />
                <div className="text-sm text-white/70 self-center">Drag to reorder</div>
                {entry.players?.length ? (
                  <Button
                    variant="outline"
                    onClick={() => toggleTeam(entry.team_id)}
                    className="w-full sm:w-20"
                  >
                    {isExpanded ? <ChevronsUp className="h-4 w-4" /> : <ChevronsDown className="h-4 w-4" />}
                  </Button>
                ) : null}
              </div>
            </div>
            {isExpanded && entry.players?.length ? (
              <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
                {entry.players.map((player) => (
                  <div key={player.RMIS_ID} className="flex items-center justify-between text-sm text-white/80">
                    <span>{player.name}</span>
                    <span className="text-white/60">{player.RMIS_ID}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )

  const hasData = entries.length > 0

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {header}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={syncing}
            className="bg-white/10 border-white/20 text-white"
          >
            {syncing ? 'Syncing...' : 'Sync Players'}
          </Button>
          <Button
            onClick={handleSaveAll}
            disabled={!hasData || savingAll}
            className="bg-white/15 border border-white/30 text-white"
          >
            {savingAll ? 'Saving...' : 'Save Order & Scores'}
          </Button>
          <Button
            onClick={handleAwardPoints}
            disabled={!hasData || awarding}
            className="bg-cranberry/20 border border-cranberry text-white disabled:opacity-60"
          >
            {awarding ? 'Awarding...' : 'Award Points'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center mt-24">
          <img src="/load.svg" alt="Loading" className="w-16" />
        </div>
      ) : !hasData ? (
        <div className="text-center py-10 bg-white/5 rounded-lg">
          <p className="text-gray-400">No participants yet. Try syncing.</p>
        </div>
      ) : sport?.sport_type === 'trackTeam' ? (
        renderTeamRows()
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Main Players</h3>
          </div>
          {renderIndividualRows()}
          {reserves?.length ? (
            <div className="mt-6">
              <h4 className="text-sm uppercase text-white/60 mb-2">Reserves</h4>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
                {reserves.map((res) => (
                  <div key={res.RMIS_ID} className="flex justify-between text-sm text-white/80">
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

export default TrackEventDetail
