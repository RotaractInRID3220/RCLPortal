import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

/**
 * Fetches a single player by RMIS_ID
 * GET /api/players/[rmisId]
 */
export async function GET(request, { params }) {
  try {
    const { rmisId } = await params;

    if (!rmisId) {
      return NextResponse.json(
        { success: false, error: 'RMIS_ID is required' },
        { status: 400 }
      );
    }

    // Fetch player with club information
    const { data: player, error } = await supabase
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
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    if (!player) {
      return NextResponse.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: player,
      message: 'Player retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching player:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
