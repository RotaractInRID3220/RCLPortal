import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

/**
 * Fetches player's registered sports for a specific sport day
 * GET /api/players/[rmisId]/sports?sportDay=D-01
 */
export async function GET(request, { params }) {
  try {
    const { rmisId } = await params;
    const { searchParams } = new URL(request.url);
    const sportDay = searchParams.get('sportDay');

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

    // Fetch player's sports registrations for the specific day
    const { data: sports, error } = await supabase
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
      .eq('events.sport_day', sportDay);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch sports' },
        { status: 500 }
      );
    }

    // Filter out null events (in case of join failures)
    const validSports = (sports || []).filter(s => s.events !== null);

    return NextResponse.json({
      success: true,
      data: validSports,
      message: `Found ${validSports.length} sports for ${sportDay}`
    });

  } catch (error) {
    console.error('Error fetching player sports:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
