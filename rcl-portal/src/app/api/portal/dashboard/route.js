import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

// Import the leaderboard function directly to avoid internal HTTP calls
async function getOptimizedLeaderboard(category, limit, offset) {
  try {
    // First, get clubs with their total points using a single query with aggregation
    let clubsQuery = supabase
      .from('clubs')
      .select(`
        club_id,
        club_name,
        category,
        club_points!left (
          points
        )
      `)
      .order('club_name', { ascending: true });

    if (category) {
      clubsQuery = clubsQuery.eq('category', category);
    }

    const { data: clubsWithPoints, error: clubsError } = await clubsQuery;
    if (clubsError) throw clubsError;

    // Process and aggregate the data
    const processedClubs = clubsWithPoints.map(club => {
      const totalPoints = club.club_points?.reduce((sum, point) => sum + (point.points || 0), 0) || 0;
      const entriesCount = club.club_points?.length || 0;

      return {
        club_id: club.club_id,
        club_name: club.club_name,
        category: club.category,
        total_points: totalPoints,
        entries_count: entriesCount
      };
    });

    // Sort by total points (desc), then by name (asc)
    processedClubs.sort((a, b) => {
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }
      return a.club_name.localeCompare(b.club_name);
    });

    // Add ranking
    let currentRank = 1;
    const rankedClubs = processedClubs.map((club, index) => {
      if (index > 0 && club.total_points !== processedClubs[index - 1].total_points) {
        currentRank = index + 1;
      }
      return { ...club, rank: currentRank };
    });

    // Apply pagination
    const total = rankedClubs.length;
    let paginatedClubs = rankedClubs;
    
    if (limit) {
      const startIndex = parseInt(offset);
      const endIndex = startIndex + parseInt(limit);
      paginatedClubs = rankedClubs.slice(startIndex, endIndex);
    }

    return { clubs: paginatedClubs, total };
  } catch (error) {
    console.error('Error in optimized leaderboard:', error);
    // Return empty result instead of throwing to prevent dashboard failure
    return { clubs: [], total: 0 };
  }
}

// Gets complete dashboard data for portal user including stats and leaderboard
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('club_id');
    const leaderboardCategory = searchParams.get('leaderboard_category') || 'community';
    const leaderboardLimit = parseInt(searchParams.get('leaderboard_limit')) || 10;
    
    if (!clubId) {
      return NextResponse.json(
        { success: false, error: 'Club ID is required' },
        { status: 400 }
      );
    }

    // Parallel data fetching for better performance
    const [
      clubResult,
      eventsResult,
      playersResult,
      pointsResult
    ] = await Promise.allSettled([
      // Get club information
      supabase
        .from('clubs')
        .select('club_id, club_name, category')
        .eq('club_id', clubId)
        .single(),
      
      // Get registered events
      supabase
        .from('registrations')
        .select('sport_id')
        .eq('club_id', clubId),
      
      // Get registered players
      supabase
        .from('players')
        .select('RMIS_ID, status')
        .eq('club_id', clubId),
      
      // Get club with points
      supabase
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
        .single()
    ]);

    // Get leaderboard data separately (not in Promise.allSettled since it's a direct call)
    const leaderboardResult = await getOptimizedLeaderboard(leaderboardCategory, leaderboardLimit, 0);

    // Check for errors in club data (most critical)
    if (clubResult.status === 'rejected' || !clubResult.value.data) {
      return NextResponse.json(
        { success: false, error: 'Club not found' },
        { status: 404 }
      );
    }

    const clubData = clubResult.value.data;

    // Process events data
    const eventsData = eventsResult.status === 'fulfilled' ? eventsResult.value.data : [];
    const uniqueEvents = [...new Set(eventsData?.map(item => item.sport_id) || [])];
    const registeredEvents = uniqueEvents.length;

  // Process players data
  const playersData = playersResult.status === 'fulfilled' ? playersResult.value.data : [];
  // General: status == 1, Prospective: status == 5
  const generalMembers = playersData.filter(p => p.status === 1).length;
  const prospectiveMembers = playersData.filter(p => p.status === 5).length;
  const registeredPlayers = playersData.length;

    // Process points data from club with points relationship
    const clubWithPoints = pointsResult.status === 'fulfilled' ? pointsResult.value.data : null;
    const totalPoints = clubWithPoints?.club_points?.reduce((sum, point) => sum + (point.points || 0), 0) || 0;

    // Process leaderboard data and find club rank
    let clubRank = 0;
    let leaderboard = [];
    
    if (leaderboardResult && leaderboardResult.clubs) {
      leaderboard = leaderboardResult.clubs;
      
      // Find club rank from the leaderboard data
      const clubIdNum = parseInt(clubId);
      clubRank = leaderboard.findIndex(club => club.club_id === clubIdNum) + 1;
      
      console.log(`Looking for club ${clubIdNum} in leaderboard:`, leaderboard.map(c => ({ id: c.club_id, name: c.club_name })));
      console.log(`Found club at rank: ${clubRank}`);
      
      // If club not found in limited leaderboard, get full ranking
      if (clubRank === 0) {
        console.log(`Club ${clubIdNum} not found in limited leaderboard, fetching full leaderboard for category: ${clubData.category}`);
        try {
          const fullLeaderboardResult = await getOptimizedLeaderboard(clubData.category, null, 0);
          
          if (fullLeaderboardResult && fullLeaderboardResult.clubs) {
            clubRank = fullLeaderboardResult.clubs.findIndex(club => club.club_id === clubIdNum) + 1;
            console.log(`Club rank from full leaderboard: ${clubRank}`);
          } else {
            console.error('Full leaderboard fetch failed');
          }
        } catch (error) {
          console.error('Error fetching full leaderboard for ranking:', error);
        }
      }
      
      // If still not found, set to last position + 1
      if (clubRank === 0) {
        console.log('Club not found in any leaderboard, setting rank to unranked');
        clubRank = leaderboard.length > 0 ? leaderboard.length + 1 : 1;
      }
    }

    const dashboardData = {
      stats: {
        registeredEvents,
        registeredPlayers,
        totalPoints,
        clubRank,
        clubInfo: {
          club_id: clubData.club_id,
          club_name: clubData.club_name,
          category: clubData.category
        },
        playerBreakdown: {
          general: generalMembers,
          prospective: prospectiveMembers,
          total: registeredPlayers
        }
      },
      leaderboard: leaderboard
    };

    return NextResponse.json({
      success: true,
      data: dashboardData
    });
    
  } catch (error) {
    console.error('Error in portal dashboard API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}