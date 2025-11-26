import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

/**
 * Player Lookup API - Search by Player Number or RMIS ID
 * 
 * GET /api/admin/player-numbers/lookup?query=D-010032
 * GET /api/admin/player-numbers/lookup?query=RMIS123456
 * 
 * Returns player data with registration info for the queried player number or RMIS ID
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const sportDay = searchParams.get('sportDay');

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

    const trimmedQuery = query.trim().toUpperCase();

    // Determine if query is a player number (format: D-XXXXXX) or RMIS ID
    const isPlayerNumber = /^D-\d+$/.test(trimmedQuery);

    let playerData = null;

    if (isPlayerNumber) {
      // Query by player number
      // Extract sport day and registration ID from player number
      // Format: D-XXXXXX where first 3 chars after D- are sport day index, rest is registration ID
      const numberPart = trimmedQuery.substring(2); // Remove "D-"
      const sportDayIndex = numberPart.substring(0, 2); // First 2 digits
      const registrationId = parseInt(numberPart.substring(2)); // Remaining digits

      if (isNaN(registrationId)) {
        return NextResponse.json(
          { success: false, error: 'Invalid player number format' },
          { status: 400 }
        );
      }

      // Fetch registration with related data
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
          events (
            sport_name,
            sport_type,
            gender_type,
            sport_day,
            category
          )
        `)
        .eq('id', registrationId)
        .eq('events.sport_day', sportDay)
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
    } else {
      // Query by RMIS ID
      // Fetch player with their registrations for the specific sport day
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
          events (
            sport_name,
            sport_type,
            gender_type,
            sport_day,
            category
          )
        `)
        .eq('RMIS_ID', trimmedQuery)
        .eq('events.sport_day', sportDay)
        .limit(1);

      if (playerError) {
        throw playerError;
      }

      if (!playerRecords || playerRecords.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Player not found for this sport day' },
          { status: 404 }
        );
      }

      playerData = playerRecords[0];
    }

    if (!playerData) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    // Extract player info
    const player = playerData.players;
    const registration = {
      id: playerData.id,
      main_player: playerData.main_player,
      created_at: playerData.created_at,
    };
    const sport = playerData.events;

    // Generate player number
    const playerNumber = `${sport.sport_day}${String(playerData.id).padStart(4, '0')}`;

    return NextResponse.json({
      success: true,
      data: {
        playerNumber,
        registrationId: playerData.id,
        player: {
          RMIS_ID: player.RMIS_ID,
          name: player.name,
          NIC: player.NIC,
          club: player.clubs,
        },
        sport: {
          name: sport.sport_name,
          type: sport.sport_type,
          genderType: sport.gender_type,
          category: sport.category,
          sportDay: sport.sport_day,
        },
        registration: {
          isMainPlayer: registration.main_player,
          registeredAt: registration.created_at,
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
