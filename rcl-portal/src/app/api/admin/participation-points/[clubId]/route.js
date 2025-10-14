import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { APP_CONFIG } from '@/config/app.config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * GET /api/admin/participation-points/[clubId]?sportDay=D-01
 *
 * Fetches detailed participation breakdown for a specific club.
 * Returns players, their sports, and day registration status.
 */
export async function GET(request, { params }) {
  try {
    const { clubId } = await params;
    const { searchParams } = new URL(request.url);
    const sportDay = searchParams.get('sportDay') || APP_CONFIG.CURRENT_SPORT_DAY;

    // Get club information
    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('club_id, club_name')
      .eq('club_id', parseInt(clubId))
      .single();

    if (clubError) throw clubError;
    if (!club) {
      return NextResponse.json(
        { success: false, error: 'Club not found' },
        { status: 404 }
      );
    }

    // Get all registrations for this club on the specified sport day
    const { data: registrations, error: regError } = await supabase
      .from('registrations')
      .select(`
        RMIS_ID,
        sport_id,
        events!inner (
          sport_id,
          sport_name,
          sport_day
        ),
        players (
          RMIS_ID,
          name,
          gender
        )
      `)
      .eq('club_id', parseInt(clubId))
      .eq('events.sport_day', sportDay);

    if (regError) throw regError;

    // Get day registrations for this club's players
    const playerIds = [...new Set(registrations.map(r => r.RMIS_ID))];
    const { data: dayRegs, error: dayRegsError } = await supabase
      .from('day_registrations')
      .select('RMIS_ID')
      .eq('sport_day', sportDay)
      .in('RMIS_ID', playerIds);

    if (dayRegsError) throw dayRegsError;

    // Create a set of players who have registered for the day
    const dayRegisteredPlayers = new Set(dayRegs.map(dr => dr.RMIS_ID));

    // Group data by sport
    const sportsData = {};
    const playersData = {};

    registrations.forEach(reg => {
      const sportId = reg.sport_id;
      const playerId = reg.RMIS_ID;

      // Initialize sport if not exists
      if (!sportsData[sportId]) {
        sportsData[sportId] = {
          sport_id: sportId,
          sport_name: reg.events.sport_name,
          players: []
        };
      }

      // Initialize player if not exists
      if (!playersData[playerId]) {
        playersData[playerId] = {
          RMIS_ID: playerId,
          name: reg.players.name,
          gender: reg.players.gender,
          sports: [],
          day_registered: dayRegisteredPlayers.has(playerId)
        };
      }

      // Add sport to player's sports list
      if (!playersData[playerId].sports.includes(sportId)) {
        playersData[playerId].sports.push(sportId);
      }

      // Add player to sport's players list
      if (!sportsData[sportId].players.find(p => p.RMIS_ID === playerId)) {
        sportsData[sportId].players.push({
          RMIS_ID: playerId,
          name: reg.players.name,
          gender: reg.players.gender,
          day_registered: dayRegisteredPlayers.has(playerId)
        });
      }
    });

    // Convert to arrays and sort
    const sports = Object.values(sportsData).sort((a, b) => a.sport_name.localeCompare(b.sport_name));
    const players = Object.values(playersData).sort((a, b) => {
      // Sort by day registration status first (registered first), then by name
      if (a.day_registered !== b.day_registered) {
        return b.day_registered ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });

    // Calculate summary stats
    const totalPlayers = players.length;
    const dayRegisteredCount = players.filter(p => p.day_registered).length;
    const totalSports = sports.length;

    return NextResponse.json({
      success: true,
      data: {
        club,
        sports,
        players,
        summary: {
          total_players: totalPlayers,
          day_registered_count: dayRegisteredCount,
          total_sports: totalSports,
          sport_day: sportDay
        }
      }
    });

  } catch (error) {
    console.error('Error fetching club participation details:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}