import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

// Gets dashboard statistics for a specific club
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('club_id');
    
    if (!clubId) {
      return NextResponse.json(
        { success: false, error: 'Club ID is required' },
        { status: 400 }
      );
    }

    // Get club information first to determine category
    const { data: clubData, error: clubError } = await supabase
      .from('clubs')
      .select('club_id, club_name, category')
      .eq('club_id', clubId)
      .single();

    if (clubError || !clubData) {
      return NextResponse.json(
        { success: false, error: 'Club not found' },
        { status: 404 }
      );
    }

    // Get registered events count for the club
    const { data: eventsData, error: eventsError } = await supabase
      .from('registrations')
      .select('sport_id')
      .eq('club_id', clubId);

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch registered events' },
        { status: 500 }
      );
    }

    // Count unique sports/events the club is registered for
    const uniqueEvents = [...new Set(eventsData?.map(item => item.sport_id) || [])];
    const registeredEvents = uniqueEvents.length;

    // Get registered players count for the club
    const { data: playersData, error: playersError } = await supabase
      .from('registrations')
      .select('RMIS_ID')
      .eq('club_id', clubId);

    if (playersError) {
      console.error('Error fetching players:', playersError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch registered players' },
        { status: 500 }
      );
    }

    // Count unique players registered for the club
    const uniquePlayers = [...new Set(playersData?.map(item => item.RMIS_ID) || [])];
    const registeredPlayers = uniquePlayers.length;

    // Get total points for the club using the same logic as admin
    const { data: clubWithPoints, error: pointsError } = await supabase
      .from('clubs')
      .select(`
        club_id,
        club_name,
        category,
        club_points!left (
          points
        )
      `)
      .eq('club_id', clubId)
      .single();

    if (pointsError) {
      console.error('Error fetching club points:', pointsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch club points' },
        { status: 500 }
      );
    }

    // Sum all points for the club
    const totalPoints = clubWithPoints?.club_points?.reduce((sum, point) => sum + (point.points || 0), 0) || 0;

    // Get all clubs in the same category with their points to calculate rank
    const { data: allClubsInCategory, error: leaderboardError } = await supabase
      .from('clubs')
      .select(`
        club_id,
        club_name,
        category,
        club_points!left (
          points
        )
      `)
      .eq('category', clubData.category);

    if (leaderboardError) {
      console.error('Error fetching clubs for ranking:', leaderboardError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch club rank' },
        { status: 500 }
      );
    }

    // Process and rank clubs within category
    const processedClubs = allClubsInCategory.map(club => {
      const clubTotalPoints = club.club_points?.reduce((sum, point) => sum + (point.points || 0), 0) || 0;
      return {
        club_id: club.club_id,
        club_name: club.club_name,
        total_points: clubTotalPoints
      };
    });

    // Sort by total points (descending)
    processedClubs.sort((a, b) => b.total_points - a.total_points);

    // Find club rank within its category
    const clubRank = processedClubs.findIndex(club => club.club_id === parseInt(clubId)) + 1 || 0;

    const stats = {
      registeredEvents,
      registeredPlayers,
      totalPoints,
      clubRank,
      clubInfo: {
        club_id: clubData.club_id,
        club_name: clubData.club_name,
        category: clubData.category
      }
    };

    return NextResponse.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('Error in portal dashboard stats API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}