import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'
import { APP_CONFIG } from '@/config/app.config'

const TRACK_TYPES = ['trackIndividual', 'trackTeam']
const POINT_MAP = {
  1: APP_CONFIG.FIRST_PLACE_POINTS,
  2: APP_CONFIG.SECOND_PLACE_POINTS,
  3: APP_CONFIG.THIRD_PLACE_POINTS,
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
      .select('id, rmis_id, team_id, place')
      .eq('sport_id', sportId)

    if (rowsError) throw rowsError

    let winners = []

    if (sport.sport_type === 'trackIndividual') {
      const rmisIds = Array.from(new Set((rows || []).map((r) => r.rmis_id))).filter(Boolean)
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('RMIS_ID, club_id')
        .in('RMIS_ID', rmisIds)

      if (playersError) throw playersError

      const playerMap = new Map((players || []).map((p) => [p.RMIS_ID, p.club_id]))
      winners = (rows || [])
        .filter((row) => row.place && [1, 2, 3].includes(row.place))
        .map((row) => ({ place: row.place, club_id: playerMap.get(row.rmis_id) }))
        .filter((w) => w.club_id)
    } else {
      const teamIds = Array.from(new Set((rows || []).map((r) => r.team_id))).filter(Boolean)
      const { data: teams, error: teamError } = await supabase
        .from('teams')
        .select('team_id, club_id')
        .in('team_id', teamIds)

      if (teamError) throw teamError

      const teamMap = new Map((teams || []).map((t) => [t.team_id, t.club_id]))
      winners = (rows || [])
        .filter((row) => row.place && [1, 2, 3].includes(row.place))
        .map((row) => ({ place: row.place, club_id: teamMap.get(row.team_id) }))
        .filter((w) => w.club_id)
    }

    // Deduplicate by place (take best per place)
    const placeMap = new Map()
    winners.forEach((winner) => {
      if (!placeMap.has(winner.place)) {
        placeMap.set(winner.place, winner)
      }
    })

    const inserts = Array.from(placeMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([place, winner]) => ({
        sport_id: sportId,
        club_id: winner.club_id,
        points: POINT_MAP[place] || 0,
        place,
      }))

    // Overwrite previous points for this sport
    const { error: deleteError } = await supabase
      .from('club_points')
      .delete()
      .eq('sport_id', sportId)
      .in('place', [1, 2, 3])

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
