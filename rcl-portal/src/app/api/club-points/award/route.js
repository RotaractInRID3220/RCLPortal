import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

// Awards tournament points by updating existing club_points records
export async function POST(request) {
  try {
    const body = await request.json();
    const { sport_id, standings } = body;

    // Validate required fields
    if (!sport_id || !standings || !Array.isArray(standings)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: sport_id, standings (array)' },
        { status: 400 }
      );
    }

    // Validate standings array is not empty
    if (standings.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Standings array cannot be empty' },
        { status: 400 }
      );
    }

    // Validate each standing entry
    for (const standing of standings) {
      if (!standing.club_id || standing.place === undefined || standing.points === undefined) {
        return NextResponse.json(
          { success: false, error: 'Each standing must have club_id, place, and points' },
          { status: 400 }
        );
      }
    }

    // Filter standings to only update top 3 places (1, 2, 3)
    const topThreeStandings = standings.filter(s => s.place >= 1 && s.place <= 3);

    if (topThreeStandings.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No top 3 placements found to update' },
        { status: 400 }
      );
    }

    // Update each club's points and place
    const updatePromises = topThreeStandings.map(async (standing) => {
      const { data, error } = await supabase
        .from('club_points')
        .update({
          points: standing.points,
          place: standing.place
        })
        .eq('sport_id', sport_id)
        .eq('club_id', standing.club_id)
        .select();

      if (error) {
        console.error(`Error updating club ${standing.club_id}:`, error);
        throw new Error(`Failed to update points for club ${standing.club_id}`);
      }

      return data;
    });

    const results = await Promise.all(updatePromises);

    // Count successful updates
    const successCount = results.filter(r => r && r.length > 0).length;

    return NextResponse.json({
      success: true,
      message: `Successfully awarded points to ${successCount} club(s)`,
      updated: successCount
    });

  } catch (error) {
    console.error('Error awarding tournament points:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
