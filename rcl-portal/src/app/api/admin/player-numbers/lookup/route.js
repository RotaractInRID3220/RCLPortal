import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

/**
 * Player Lookup API - Search by Player Number, RMIS ID, or NIC
 * 
 * GET /api/admin/player-numbers/lookup?query=D-010032&searchType=playerNumber
 * GET /api/admin/player-numbers/lookup?query=RMIS123456&searchType=rmisId
 * GET /api/admin/player-numbers/lookup?query=200012345678&searchType=nic
 * 
 * Returns player data with registration info for the queried parameter
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const sportDay = searchParams.get('sportDay');
    const searchType = searchParams.get('searchType') || 'auto'; // playerNumber, rmisId, nic, or auto

    // Validate input
    if (!query || !query.trim()) {
      return NextResponse.json(
        { success: false, error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    if (!sportDay) {
      return NextResponse.json(
        { success: false, error: 'sportDay parameter is required' },
        { status: 400 }
      );
    }

    const trimmedQuery = query.trim();
    const upperQuery = trimmedQuery.toUpperCase();
    const normalizedSportDay = sportDay.trim();

    // Determine search type
    let effectiveSearchType = searchType;
    if (searchType === 'auto') {
      // Auto-detect based on format
      if (/^D-\d+$/.test(upperQuery)) {
        effectiveSearchType = 'playerNumber';
      } else {
        effectiveSearchType = 'rmisId';
      }
    }

    let playerData = null;

    if (effectiveSearchType === 'playerNumber') {
      // Query by player number
      // Format: D-XXXXXX where first 2 chars after D- are sport day index, rest is registration ID
      const numberPart = upperQuery.substring(2); // Remove "D-"
      const registrationId = parseInt(numberPart.substring(2)); // Skip first 2 digits (sport day), remaining is reg ID

      if (isNaN(registrationId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid player number format' },
          { status: 400 }
        );
      }

      // Fetch registration with related data
      // Use !inner join to ensure events filter actually filters registrations
      const { data, error } = await supabase
        .from('registrations')
        .select(`
          id,
          RMIS_ID,
          sport_id,
          main_player,
          created_at,
          players (
            RMIS_ID,
            name,
            NIC,
            club_id,
            clubs (
              club_name,
              category
            )
          ),
          events!inner (
            sport_name,
            sport_type,
            gender_type,
            sport_day,
            category
          )
        `)
        .eq('id', registrationId)
        .eq('events.sport_day', normalizedSportDay)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json(
            { success: false, error: 'Player number not found for this sport day' },
            { status: 404 }
          );
        }
        throw error;
      }

      playerData = data;
    } else if (effectiveSearchType === 'nic') {
      // Query by NIC - first find player, then their registrations
      const { data: playerRecord, error: playerError } = await supabase
        .from('players')
        .select('RMIS_ID')
        .ilike('NIC', trimmedQuery)
        .single();

      if (playerError) {
        if (playerError.code === 'PGRST116') {
          return NextResponse.json(
            { success: false, error: 'Player with this NIC not found' },
            { status: 404 }
          );
        }
        throw playerError;
      }

      // Now fetch ALL their registrations for this sport day
      // Use !inner join to ensure events filter actually filters registrations
      const { data: registrationRecords, error: regError } = await supabase
        .from('registrations')
        .select(`
          id,
          RMIS_ID,
          sport_id,
          main_player,
          created_at,
          players (
            RMIS_ID,
            name,
            NIC,
            club_id,
            clubs (
              club_name,
              category
            )
          ),
          events!inner (
            sport_name,
            sport_type,
            gender_type,
            sport_day,
            category
          )
        `)
        .eq('RMIS_ID', playerRecord.RMIS_ID)
        .eq('events.sport_day', normalizedSportDay);

      if (regError) {
        throw regError;
      }

      if (!registrationRecords || registrationRecords.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Player not registered for this sport day' },
          { status: 404 }
        );
      }

      playerData = registrationRecords;
    } else {
      // Query by RMIS ID (default)
      // Use !inner join to ensure events filter actually filters registrations
      const { data: playerRecords, error: playerError } = await supabase
        .from('registrations')
        .select(`
          id,
          RMIS_ID,
          sport_id,
          main_player,
          created_at,
          players (
            RMIS_ID,
            name,
            NIC,
            club_id,
            clubs (
              club_name,
              category
            )
          ),
          events!inner (
            sport_name,
            sport_type,
            gender_type,
            sport_day,
            category
          )
        `)
        .ilike('RMIS_ID', trimmedQuery)
        .eq('events.sport_day', normalizedSportDay);

      if (playerError) {
        throw playerError;
      }

      if (!playerRecords || playerRecords.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Player not found for this sport day' },
          { status: 404 }
        );
      }

      playerData = playerRecords;
    }

    if (!playerData || (Array.isArray(playerData) && playerData.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    // Normalize to array format for all search types (playerNumber returns single, others return array)
    const registrations = Array.isArray(playerData) ? playerData : [playerData];
    
    // Extract player info from first registration (all should have same player)
    const firstReg = registrations[0];
    const player = firstReg.players;

    if (!player) {
      return NextResponse.json(
        { success: false, error: 'Player profile missing for this registration' },
        { status: 404 }
      );
    }

    // Build sports array with all registrations for this day
    const sports = registrations
      .filter(reg => reg.events && reg.events.sport_day)
      .map(reg => ({
        id: reg.id,
        sportId: reg.sport_id,
        name: reg.events.sport_name,
        type: reg.events.sport_type,
        genderType: reg.events.gender_type,
        category: reg.events.category,
        sportDay: reg.events.sport_day,
        isMainPlayer: reg.main_player,
        registeredAt: reg.created_at,
        playerNumber: `${reg.events.sport_day}${String(reg.id).padStart(4, '0')}`,
      }));

    if (sports.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid sport registrations found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        player: {
          RMIS_ID: player.RMIS_ID,
          name: player.name,
          NIC: player.NIC,
          club: player.clubs,
        },
        sports,
        // Keep backwards compatibility with single sport response
        playerNumber: sports[0].playerNumber,
        registrationId: sports[0].id,
        sport: {
          name: sports[0].name,
          type: sports[0].type,
          genderType: sports[0].genderType,
          category: sports[0].category,
          sportDay: sports[0].sportDay,
        },
        registration: {
          isMainPlayer: sports[0].isMainPlayer,
          registeredAt: sports[0].registeredAt,
        },
      },
      message: 'Player data retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching player lookup data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
