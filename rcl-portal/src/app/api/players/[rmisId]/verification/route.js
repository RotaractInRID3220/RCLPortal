import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

/**
 * OPTIMIZED ENDPOINT: Fetches all player verification data in a single API call
 * Combines player details, sports for day, and registration status
 * 
 * GET /api/players/[rmisId]/verification?sportDay=D-01
 * 
 * Performance: Reduces 3 API calls to 1 (67% reduction)
 * 
 * Returns:
 * {
 *   success: true,
 *   data: {
 *     player: { RMIS_ID, name, NIC, clubs: {...} },
 *     sports: [...],
 *     registration: { isRegistered: boolean, registration: {...} }
 *   }
 * }
 */
export async function GET(request, { params }) {
  try {
    const { rmisId } = await params;
    const { searchParams } = new URL(request.url);
    const sportDay = searchParams.get('sportDay');

    // Validate required parameters
    if (!rmisId) {
      return NextResponse.json(
        { success: false, error: 'RMIS_ID is required' },
        { status: 400 }
      );
    }

    if (!sportDay) {
      return NextResponse.json(
        { success: false, error: 'sportDay is required' },
        { status: 400 }
      );
    }

    // Execute all queries in parallel for maximum performance
    const [playerResult, sportsResult, registrationResult] = await Promise.all([
      // Query 1: Fetch player with club information
      supabase
        .from('players')
        .select(`
          RMIS_ID,
          name,
          NIC,
          club_id,
          clubs (
            club_name,
            category
          )
        `)
        .eq('RMIS_ID', rmisId)
        .single(),

      // Query 2: Fetch player's sports registrations for the specific day
      supabase
        .from('registrations')
        .select(`
          sport_id,
          main_player,
          created_at,
          events (
            sport_name,
            sport_type,
            gender_type,
            sport_day,
            category
          )
        `)
        .eq('RMIS_ID', rmisId)
        .eq('events.sport_day', sportDay),

      // Query 3: Check day registration status
      supabase
        .from('day_registrations')
        .select('*')
        .eq('RMIS_ID', rmisId)
        .eq('sport_day', sportDay)
        .single()
    ]);

    // Handle player not found
    if (playerResult.error) {
      console.error('Player fetch error:', playerResult.error);
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    // Handle sports fetch error (non-critical)
    if (sportsResult.error && sportsResult.error.code !== 'PGRST116') {
      console.error('Sports fetch error:', sportsResult.error);
    }

    // Filter out null events from sports (in case of join failures)
    const validSports = (sportsResult.data || []).filter(s => s.events !== null);

    // Handle registration check (PGRST116 means not found, which is OK)
    const isRegistered = !!registrationResult.data;
    if (registrationResult.error && registrationResult.error.code !== 'PGRST116') {
      console.error('Registration check error:', registrationResult.error);
    }

    // Return combined data in optimized format
    return NextResponse.json({
      success: true,
      data: {
        player: playerResult.data,
        sports: validSports,
        registration: {
          isRegistered,
          registration: registrationResult.data || null
        }
      },
      message: 'Player verification data retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching player verification data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
