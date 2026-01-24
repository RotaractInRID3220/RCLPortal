import { supabase } from '../../../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

/**
 * GET /api/leaderboard/club-details/[clubId]
 * Returns detailed points breakdown for a specific club
 */
export async function GET(request, { params }) {
  try {
    const { clubId } = params;

    if (!clubId) {
      return NextResponse.json(
        { error: 'Club ID is required' },
        { status: 400 }
      );
    }

    // Fetch club info and points in one optimized query
    const { data: clubData, error: clubError } = await supabase
      .from('clubs')
      .select(`
        club_id,
        club_name,
        category,
        club_points (
          point_id,
          points,
          place,
          sport_id,
          sports:sport_id (
            sport_name,
            category,
            gender_type,
            sport_type
          )
        )
      `)
      .eq('club_id', clubId)
      .single();

    if (clubError) {
      if (clubError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Club not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching club details:', clubError);
      return NextResponse.json(
        { error: 'Failed to fetch club details' },
        { status: 500 }
      );
    }

    // Calculate total points
    const totalPoints = clubData.club_points?.reduce(
      (sum, point) => sum + (point.points || 0), 
      0
    ) || 0;

    // Group points by sport for better organization
    const pointsBySport = {};
    clubData.club_points?.forEach(point => {
      const sportInfo = point.sports;
      if (!pointsBySport[point.sport_id]) {
        pointsBySport[point.sport_id] = {
          sport_info: sportInfo,
          entries: [],
          total_points: 0
        };
      }
      pointsBySport[point.sport_id].entries.push({
        point_id: point.point_id,
        points: point.points,
        place: point.place
      });
      pointsBySport[point.sport_id].total_points += point.points || 0;
    });

    // Convert to array and sort by total points per sport
    const sportsBreakdown = Object.entries(pointsBySport)
      .map(([sportId, data]) => ({
        sport_id: parseInt(sportId),
        sport_info: data.sport_info,
        entries: data.entries.sort((a, b) => b.points - a.points), // Sort entries by points desc
        total_points: data.total_points,
        entries_count: data.entries.length
      }))
      .sort((a, b) => b.total_points - a.total_points); // Sort sports by total points desc

    const result = {
      club: {
        club_id: clubData.club_id,
        club_name: clubData.club_name,
        category: clubData.category
      },
      summary: {
        total_points: totalPoints,
        total_entries: clubData.club_points?.length || 0,
        sports_count: sportsBreakdown.length
      },
      sports_breakdown: sportsBreakdown,
      raw_entries: clubData.club_points || [] // For backward compatibility
    };

    return NextResponse.json({
      success: true,
      data: result
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}