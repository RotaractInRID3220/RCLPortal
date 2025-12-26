import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

const TRACK_TYPES = ['trackIndividual', 'trackTeam']

const sortByPlaceThenName = (items, nameKey) => {
  const getName = (item) => (item?.[nameKey] || '').toString().toLowerCase()
  const hasPlace = (item) => Number.isFinite(item?.place) && item.place > 0

  return [...(items || [])].sort((a, b) => {
    const aHas = hasPlace(a)
    const bHas = hasPlace(b)

    if (aHas && bHas) return a.place - b.place
    if (aHas) return -1
    if (bHas) return 1

    return getName(a).localeCompare(getName(b))
  })
}

const getSport = async (sportId) => {
  const { data: sport, error } = await supabase
    .from('events')
    .select('*')
    .eq('sport_id', sportId)
    .single()
  if (error || !sport) {
    return { error: 'Sport not found' }
  }
  if (!TRACK_TYPES.includes(sport.sport_type)) {
    return { error: 'Sport is not a track event' }
  }
  return { sport }
}

const parseRmisArray = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch (err) {
    return []
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const sportId = searchParams.get('sport_id')

  if (!sportId) {
    return NextResponse.json({ success: false, error: 'sport_id is required' }, { status: 400 })
  }

  const { sport, error: sportError } = await getSport(sportId)
  if (sportError) {
    return NextResponse.json({ success: false, error: sportError }, { status: 400 })
  }

  try {
    if (sport.sport_type === 'trackIndividual') {
      const [trackRes, registrationsRes] = await Promise.all([
        supabase.from('track_events').select('*').eq('sport_id', sportId),
        supabase
          .from('registrations')
          .select('RMIS_ID, main_player, club_id')
          .eq('sport_id', sportId),
      ])

      if (trackRes.error) throw trackRes.error
      if (registrationsRes.error) throw registrationsRes.error

      const registrations = registrationsRes.data || []
      const mainRegs = registrations.filter((r) => r.main_player)
      const reserveRegs = registrations.filter((r) => !r.main_player)
      const rmisIds = Array.from(new Set(registrations.map((r) => r.RMIS_ID))).filter(Boolean)

      const [playersRes, clubsRes] = await Promise.all([
        rmisIds.length
          ? supabase.from('players').select('RMIS_ID, name, club_id').in('RMIS_ID', rmisIds)
          : Promise.resolve({ data: [], error: null }),
        registrations.length
          ? supabase
              .from('clubs')
              .select('club_id, club_name')
              .in(
                'club_id',
                Array.from(new Set(registrations.map((r) => r.club_id))).filter(Boolean)
              )
          : Promise.resolve({ data: [], error: null }),
      ])

      if (playersRes.error) throw playersRes.error
      if (clubsRes.error) throw clubsRes.error

      const playerMap = new Map((playersRes.data || []).map((p) => [p.RMIS_ID, p]))
      const clubMap = new Map((clubsRes.data || []).map((c) => [c.club_id, c.club_name]))
      const trackMap = new Map((trackRes.data || []).map((t) => [t.rmis_id, t]))

      const entries = mainRegs.map((reg) => {
        const player = playerMap.get(reg.RMIS_ID)
        const track = trackMap.get(reg.RMIS_ID)
        return {
          id: track?.id,
          rmis_id: reg.RMIS_ID,
          name: player?.name || '-',
          club_id: player?.club_id || reg.club_id,
          club_name: clubMap.get(player?.club_id || reg.club_id) || '-',
          score: track?.score || '',
          place: track?.place || null,
          main_player: true,
        }
      })

      const reserves = reserveRegs.map((reg) => {
        const player = playerMap.get(reg.RMIS_ID)
        return {
          rmis_id: reg.RMIS_ID,
          name: player?.name || '-',
          club_id: player?.club_id || reg.club_id,
          club_name: clubMap.get(player?.club_id || reg.club_id) || '-',
          main_player: false,
        }
      })

      const sortedEntries = sortByPlaceThenName(entries, 'name')
      const sortedReserves = sortByPlaceThenName(reserves, 'name')

      return NextResponse.json({
        success: true,
        data: {
          sport,
          entries: sortedEntries,
          reserves: sortedReserves,
        },
      })
    }

    // Track Team
    const [trackRes, teamsRes] = await Promise.all([
      supabase.from('track_events').select('*').eq('sport_id', sportId),
      supabase
        .from('teams')
        .select('team_id, club_id, sport_id')
        .eq('sport_id', sportId),
    ])

    if (trackRes.error) throw trackRes.error
    if (teamsRes.error) throw teamsRes.error

    const teams = teamsRes.data || []
    const teamIds = teams.map((t) => t.team_id)
    const clubsNeeded = Array.from(new Set(teams.map((t) => t.club_id))).filter(Boolean)

    // Get registrations for these clubs in this sport to list players
    const { data: regData, error: regErr } = await supabase
      .from('registrations')
      .select('RMIS_ID, club_id')
      .eq('sport_id', sportId)
      .in('club_id', clubsNeeded)

    if (regErr) throw regErr

    const rmisForClubs = Array.from(new Set((regData || []).map((r) => r.RMIS_ID))).filter(Boolean)

    const [clubsRes, playersRes] = await Promise.all([
      clubsNeeded.length
        ? supabase.from('clubs').select('club_id, club_name').in('club_id', clubsNeeded)
        : Promise.resolve({ data: [], error: null }),
      rmisForClubs.length
        ? supabase.from('players').select('RMIS_ID, name, club_id').in('RMIS_ID', rmisForClubs)
        : Promise.resolve({ data: [], error: null }),
    ])

    if (clubsRes.error) throw clubsRes.error
    if (playersRes.error) throw playersRes.error

    const clubMap = new Map((clubsRes.data || []).map((c) => [c.club_id, c.club_name]))
    const playersMap = new Map((playersRes.data || []).map((p) => [p.RMIS_ID, p]))
    const trackMap = new Map((trackRes.data || []).map((t) => [t.team_id, t]))

    // Group registrations by club for player display
    const clubPlayers = new Map()
    ;(regData || []).forEach((reg) => {
      if (!clubPlayers.has(reg.club_id)) clubPlayers.set(reg.club_id, [])
      const player = playersMap.get(reg.RMIS_ID)
      clubPlayers.get(reg.club_id).push({
        rmis_id: reg.RMIS_ID,
        name: player?.name || '-',
        club_id: player?.club_id || reg.club_id,
      })
    })

    const entries = teams.map((team) => {
      const track = trackMap.get(team.team_id)
      const playerList = clubPlayers.get(team.club_id) || []

      return {
        id: track?.id,
        team_id: team.team_id,
        club_id: team.club_id,
        club_name: clubMap.get(team.club_id) || '-',
        score: track?.score || '',
        place: track?.place || null,
        players: playerList,
      }
    })

    const sortedEntries = sortByPlaceThenName(entries, 'club_name')

    return NextResponse.json({
      success: true,
      data: { sport, entries: sortedEntries, reserves: [] },
    })
  } catch (error) {
    console.error('Track events GET error:', error)
    return NextResponse.json({ success: false, error: 'Failed to load track events' }, { status: 500 })
  }
}

export async function POST(request) {
  // Sync track events from registrations/teams
  const body = await request.json().catch(() => ({}))
  const sportId = body?.sport_id

  try {
    const { data: sports, error: sportsError } = await supabase
      .from('events')
      .select('*')
      .in('sport_type', TRACK_TYPES)
      .order('sport_id', { ascending: true })

    if (sportsError) throw sportsError

    const filteredSports = sportId
      ? (sports || []).filter((s) => s.sport_id === Number(sportId))
      : sports || []

    if (sportId && filteredSports.length === 0) {
      return NextResponse.json({ success: false, error: 'Track sport not found' }, { status: 404 })
    }

    let inserted = 0
    let deleted = 0

    for (const sport of filteredSports) {
      // Fetch existing rows for preservation
      const { data: existingRows, error: trackError } = await supabase
        .from('track_events')
        .select('*')
        .eq('sport_id', sport.sport_id)

      if (trackError) throw trackError

      if (sport.sport_type === 'trackIndividual') {
        const { data: regs, error: regError } = await supabase
          .from('registrations')
          .select('RMIS_ID, main_player')
          .eq('sport_id', sport.sport_id)

        if (regError) throw regError

        const mainRegs = (regs || []).filter((r) => r.main_player)
        const mainIds = mainRegs.map((r) => r.RMIS_ID).filter(Boolean)

        // Preserve scores/places where possible
        const preservedMap = new Map((existingRows || []).map((row) => [row.rmis_id, row]))
        const desiredRows = mainIds.map((id) => {
          const existing = preservedMap.get(id)
          return {
            sport_id: sport.sport_id,
            rmis_id: id,
            team_id: null,
            score: existing?.score || null,
            place: existing?.place || null,
          }
        })

        const { error: delError, count: delCount } = await supabase
          .from('track_events')
          .delete({ count: 'exact' })
          .eq('sport_id', sport.sport_id)

        if (delError) throw delError
        deleted += delCount || 0

        if (desiredRows.length) {
          const { error: insertError, count: insertCount } = await supabase
            .from('track_events')
            .insert(desiredRows, { count: 'exact' })

          if (insertError) throw insertError
          inserted += insertCount || 0
        }
        continue
      }

      // trackTeam
      const { data: teams, error: teamError } = await supabase
        .from('teams')
        .select('team_id')
        .eq('sport_id', sport.sport_id)

      if (teamError) throw teamError

      const preservedMap = new Map((existingRows || []).map((row) => [row.team_id, row]))
      const desiredRows = (teams || []).map((team) => {
        const existing = preservedMap.get(team.team_id)
        return {
          sport_id: sport.sport_id,
          team_id: team.team_id,
          rmis_id: null,
          score: existing?.score || null,
          place: existing?.place || null,
        }
      })

      const { error: delError, count: delCount } = await supabase
        .from('track_events')
        .delete({ count: 'exact' })
        .eq('sport_id', sport.sport_id)

      if (delError) throw delError
      deleted += delCount || 0

      if (desiredRows.length) {
        const { error: insertError, count: insertCount } = await supabase
          .from('track_events')
          .insert(desiredRows, { count: 'exact' })

        if (insertError) throw insertError
        inserted += insertCount || 0
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Track events synced',
      inserted,
      deleted,
      processed: filteredSports.length,
    })
  } catch (error) {
    console.error('Track events sync error:', error)
    return NextResponse.json({ success: false, error: 'Failed to sync track events' }, { status: 500 })
  }
}

export async function PATCH(request) {
  const body = await request.json().catch(() => ({}))
  const { id, score = null, place = null } = body

  if (!id) {
    return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
  }

  try {
    const { data, error } = await supabase
      .from('track_events')
      .update({ score, place })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Track events update error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update track entry' }, { status: 500 })
  }
}
