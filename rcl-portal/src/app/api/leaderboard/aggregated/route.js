import { supabase } from '../../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

/**
 * GET /api/leaderboard/aggregated
 * Returns aggregated leaderboard data with total points per club
 * Query params:
 * - category: filter by club category (optional)
 * - limit: number of clubs to return (optional, default: unlimited)
 * - offset: pagination offset (optional, default: 0)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset') || '0';

    // Use optimized Supabase queries instead of RPC
    const optimizedData = await getOptimizedLeaderboard(category, limit, offset);
    
    return NextResponse.json({
      success: true,
      data: optimizedData.clubs,
      total: optimizedData.total,
      pagination: {
        limit: limit ? parseInt(limit) : null,
        offset: parseInt(offset),
        hasMore: limit ? (parseInt(offset) + parseInt(limit)) < optimizedData.total : false
      }
    });

  } catch (error) {
    console.error('Error fetching aggregated leaderboard:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Optimized leaderboard fetching using Supabase queries with JOINs
 * Replaces the problematic RPC call with efficient queries
 */
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
    // Fallback to the existing method if optimization fails
    return getFallbackLeaderboard(category, limit, offset);
  }
}

/**
 * Fallback method using separate queries (maintains compatibility)
 */
async function getFallbackLeaderboard(category, limit, offset) {
  // Fetch clubs
  let clubsQuery = supabase
    .from('clubs')
    .select('club_id, club_name, category')
    .order('club_name', { ascending: true });

  if (category) {
    clubsQuery = clubsQuery.eq('category', category);
  }

  const { data: clubs, error: clubsError } = await clubsQuery;
  if (clubsError) throw clubsError;

  // Fetch all club points with club info in one query
  const { data: allPoints, error: pointsError } = await supabase
    .from('club_points')
    .select('club_id, points');

  if (pointsError) throw pointsError;

  // Group points by club_id for faster lookup
  const pointsByClub = {};
  allPoints.forEach(point => {
    if (!pointsByClub[point.club_id]) {
      pointsByClub[point.club_id] = { total: 0, count: 0 };
    }
    pointsByClub[point.club_id].total += point.points || 0;
    pointsByClub[point.club_id].count += 1;
  });

  // Calculate totals and add ranking
  const clubsWithPoints = clubs.map(club => ({
    club_id: club.club_id,
    club_name: club.club_name,
    category: club.category,
    total_points: pointsByClub[club.club_id]?.total || 0,
    entries_count: pointsByClub[club.club_id]?.count || 0
  }));

  // Sort by total points (desc), then by name (asc)
  clubsWithPoints.sort((a, b) => {
    if (b.total_points !== a.total_points) {
      return b.total_points - a.total_points;
    }
    return a.club_name.localeCompare(b.club_name);
  });

  // Add ranking
  let currentRank = 1;
  const rankedClubs = clubsWithPoints.map((club, index) => {
    if (index > 0 && club.total_points !== clubsWithPoints[index - 1].total_points) {
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
}