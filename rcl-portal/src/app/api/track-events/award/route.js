import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { APP_CONFIG } from '@/config/app.config'

const TRACK_TYPES = ['trackIndividual', 'trackTeam']

// Point maps for different track types
const TRACK_INDIVIDUAL_POINT_MAP = {
  1: APP_CONFIG.TRACK_INDIVIDUAL_FIRST_PLACE_POINTS,
  2: APP_CONFIG.TRACK_INDIVIDUAL_SECOND_PLACE_POINTS,
  3: APP_CONFIG.TRACK_INDIVIDUAL_THIRD_PLACE_POINTS,
}

const TRACK_TEAM_POINT_MAP = {
  1: APP_CONFIG.FIRST_PLACE_POINTS,
  2: APP_CONFIG.SECOND_PLACE_POINTS,
  3: APP_CONFIG.THIRD_PLACE_POINTS,
}

const PARTICIPATION_POINTS = APP_CONFIG.PARTICIPATION_POINTS_PER_SPORT

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

const getSport = async (sportId) => {
  const { data: sport, error } = await supabase
    .from('events')
    .select('*')
    .eq('sport_id', sportId)
    .single()
  if (error || !sport) return { error: 'Sport not found' }
  if (!TRACK_TYPES.includes(sport.sport_type)) return { error: 'Not a track sport' }
  return { sport }
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const sportId = body?.sport_id

  if (!sportId) {
    return NextResponse.json({ success: false, error: 'sport_id is required' }, { status: 400 })
  }

  const { sport, error: sportError } = await getSport(sportId)
  if (sportError) {
    return NextResponse.json({ success: false, error: sportError }, { status: 400 })
  }

  try {
    const { data: rows, error: rowsError } = await supabase
      .from('track_events')
      .select('id, rmis_id, team_id, score')
      .eq('sport_id', sportId)

    if (rowsError) throw rowsError

    const isIndividual = sport.sport_type === 'trackIndividual'
    const pointMap = isIndividual ? TRACK_INDIVIDUAL_POINT_MAP : TRACK_TEAM_POINT_MAP

    // Map to aggregate points by club_id: { points: number, bestPlace: number | null }
    const clubPointsMap = new Map()

    if (isIndividual) {
      const rmisIds = Array.from(new Set((rows || []).map((r) => r.rmis_id))).filter(Boolean)
      if (!rmisIds.length) {
        return NextResponse.json({ success: true, updated: 0, sport })
      }

      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('RMIS_ID, club_id')
        .in('RMIS_ID', rmisIds)

      if (playersError) throw playersError

      const playerMap = new Map((players || []).map((p) => [p.RMIS_ID, p.club_id]))

      // Filter entries with scores and sort by score (lower is better)
      const entriesWithScores = (rows || [])
        .filter(r => parseScore(r.score) !== null && playerMap.has(r.rmis_id))
        .map(r => ({ ...r, parsedScore: parseScore(r.score), clubId: playerMap.get(r.rmis_id) }))
        .sort((a, b) => a.parsedScore - b.parsedScore)

      // Assign places based on sorted order (1st = lowest score)
      entriesWithScores.forEach((entry, index) => {
        const place = index + 1 // 1-based placement
        const clubId = entry.clubId
        
        let points = 0
        if (place <= 3) {
          // Placement points for top 3
          points = pointMap[place] || 0
        } else {
          // Participation points for others with scores
          points = PARTICIPATION_POINTS
        }

        const existing = clubPointsMap.get(clubId) || { points: 0, bestPlace: null }
        existing.points += points
        // Track the best (lowest) place for this club
        if (existing.bestPlace === null || place < existing.bestPlace) {
          existing.bestPlace = place
        }
        clubPointsMap.set(clubId, existing)
      })
    } else {
      // Track Team
      const teamIds = Array.from(new Set((rows || []).map((r) => r.team_id))).filter(Boolean)
      if (!teamIds.length) {
        return NextResponse.json({ success: true, updated: 0, sport })
      }

      const { data: teams, error: teamError } = await supabase
        .from('teams')
        .select('team_id, club_id')
        .in('team_id', teamIds)

      if (teamError) throw teamError

      const teamMap = new Map((teams || []).map((t) => [t.team_id, t.club_id]))

      // Filter entries with scores and sort by score (lower is better)
      const entriesWithScores = (rows || [])
        .filter(r => parseScore(r.score) !== null && teamMap.has(r.team_id))
        .map(r => ({ ...r, parsedScore: parseScore(r.score), clubId: teamMap.get(r.team_id) }))
        .sort((a, b) => a.parsedScore - b.parsedScore)

      // Assign places based on sorted order (1st = lowest score)
      entriesWithScores.forEach((entry, index) => {
        const place = index + 1
        const clubId = entry.clubId

        let points = 0
        if (place <= 3) {
          points = pointMap[place] || 0
        } else {
          points = PARTICIPATION_POINTS
        }

        const existing = clubPointsMap.get(clubId) || { points: 0, bestPlace: null }
        existing.points += points
        if (existing.bestPlace === null || place < existing.bestPlace) {
          existing.bestPlace = place
        }
        clubPointsMap.set(clubId, existing)
      })
    }

    // Build inserts from aggregated data
    const inserts = Array.from(clubPointsMap.entries()).map(([clubId, data]) => ({
      sport_id: sportId,
      club_id: clubId,
      points: data.points,
      place: data.bestPlace, // Can be null if only participation
    }))

    // Delete all existing points for this sport (covers all cases)
    const { error: deleteError } = await supabase
      .from('club_points')
      .delete()
      .eq('sport_id', sportId)

    if (deleteError) throw deleteError

    let inserted = 0
    if (inserts.length) {
      const { error: insertError, count } = await supabase
        .from('club_points')
        .insert(inserts, { count: 'exact' })

      if (insertError) throw insertError
      inserted = count || inserts.length
    }

    return NextResponse.json({ success: true, updated: inserted, sport })
  } catch (error) {
    console.error('Track award error:', error)
    return NextResponse.json({ success: false, error: 'Failed to award points' }, { status: 500 })
  }
}
