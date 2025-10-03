import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/admin/dashboard/optimized
 * 
 * Consolidated endpoint that fetches all admin dashboard data in optimized queries
 * Replaces 3 separate API calls with 1 optimized call
 * 
 * Query Parameters:
 * @param {string} leaderboard_category - Category for leaderboard (optional, default: community)
 * @param {number} leaderboard_limit - Number of leaderboard entries (optional, default: 10)
 * 
 * Returns:
 * {
 *   success: boolean,
 *   data: {
 *     stats: {
 *       totalClubs: number,
 *       totalPlayers: number, 
 *       communityClubs: number,
 *       instituteClubs: number
 *     },
 *     leaderboard: Array,
 *     pendingRequests: number
 *   }
 * }
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const leaderboardCategory = searchParams.get('leaderboard_category') || 'community';
    const leaderboardLimit = parseInt(searchParams.get('leaderboard_limit') || '10');

    // Execute all queries in parallel for maximum performance
    const [statsResult, leaderboardResult, pendingResult] = await Promise.all([
      getOptimizedStats(),
      getOptimizedLeaderboard(leaderboardCategory, leaderboardLimit),
      getOptimizedPendingRequests()
    ]);

    return NextResponse.json({
      success: true,
      data: {
        stats: statsResult,
        leaderboard: leaderboardResult.clubs,
        pendingRequests: pendingResult
      }
    });

  } catch (error) {
    console.error('Error fetching optimized dashboard data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Optimized stats fetching with single query for club categories
 */
async function getOptimizedStats() {
  try {
    // Use Promise.all for parallel execution
    const [clubsResult, playersResult] = await Promise.all([
      // Get clubs count and categories in one query
      supabase
        .from('clubs')
        .select('category', { count: 'exact' }),
      
      // Get players count
      supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
    ]);

    const { data: clubCategories, count: totalClubs, error: clubsError } = clubsResult;
    const { count: totalPlayers, error: playersError } = playersResult;

    if (clubsError) throw clubsError;
    if (playersError) throw playersError;

    // Count categories efficiently
    const communityClubs = clubCategories?.filter(club => club.category === 'community').length || 0;
    const instituteClubs = clubCategories?.filter(club => club.category === 'institute').length || 0;

    return {
      totalClubs: totalClubs || 0,
      totalPlayers: totalPlayers || 0,
      communityClubs,
      instituteClubs
    };

  } catch (error) {
    console.error('Error fetching optimized stats:', error);
    throw error;
  }
}

/**
 * Optimized leaderboard fetching using JOIN queries
 */
async function getOptimizedLeaderboard(category, limit) {
  try {
    // Fetch clubs with points using JOIN
    let clubsQuery = supabase
      .from('clubs')
      .select(`
        club_id,
        club_name,
        category,
        club_points!left (
          points
        )
      `);

    if (category) {
      clubsQuery = clubsQuery.eq('category', category);
    }

    const { data: clubsWithPoints, error } = await clubsQuery;
    if (error) throw error;

    // Process and rank clubs
    const processedClubs = clubsWithPoints
      .map(club => {
        const totalPoints = club.club_points?.reduce((sum, point) => sum + (point.points || 0), 0) || 0;
        return {
          club_id: club.club_id,
          club_name: club.club_name,
          category: club.category,
          total_points: totalPoints,
          entries_count: club.club_points?.length || 0
        };
      })
      .sort((a, b) => {
        if (b.total_points !== a.total_points) {
          return b.total_points - a.total_points;
        }
        return a.club_name.localeCompare(b.club_name);
      })
      .slice(0, limit); // Apply limit

    // Add rankings
    let currentRank = 1;
    const rankedClubs = processedClubs.map((club, index) => {
      if (index > 0 && club.total_points !== processedClubs[index - 1].total_points) {
        currentRank = index + 1;
      }
      return { ...club, rank: currentRank };
    });

    return { clubs: rankedClubs, total: processedClubs.length };

  } catch (error) {
    console.error('Error fetching optimized leaderboard:', error);
    throw error;
  }
}

/**
 * Optimized pending requests count
 */
async function getOptimizedPendingRequests() {
  try {
    // Assuming this queries a requests table - adjust as needed
    const { count, error } = await supabase
      .from('replacement_requests') // Adjust table name as needed
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (error) throw error;

    return count || 0;

  } catch (error) {
    console.error('Error fetching pending requests:', error);
    // Return 0 if there's an error (graceful degradation)
    return 0;
  }
}