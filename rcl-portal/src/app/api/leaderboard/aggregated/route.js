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

    // Build the aggregation query with JOIN and GROUP BY
    let query = `
      SELECT 
        c.club_id,
        c.club_name,
        c.category,
        COALESCE(SUM(cp.points), 0) as total_points,
        COUNT(cp.point_id) as entries_count,
        RANK() OVER (ORDER BY COALESCE(SUM(cp.points), 0) DESC, c.club_name ASC) as rank
      FROM clubs c
      LEFT JOIN club_points cp ON c.club_id = cp.club_id
    `;

    const params = [];
    let paramIndex = 1;

    // Add category filter if provided
    if (category) {
      query += ` WHERE c.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    query += `
      GROUP BY c.club_id, c.club_name, c.category
      ORDER BY total_points DESC, c.club_name ASC
    `;

    // Add pagination if limit is provided
    if (limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(parseInt(limit));
      paramIndex++;
      
      if (offset !== '0') {
        query += ` OFFSET $${paramIndex}`;
        params.push(parseInt(offset));
      }
    }

    const { data, error } = await supabase.rpc('exec_sql', {
      query,
      params
    });

    if (error) {
      console.error('Error fetching aggregated leaderboard:', error);
      
      // Fallback to individual queries if RPC fails
      const fallbackData = await getFallbackLeaderboard(category, limit, offset);
      return NextResponse.json({
        success: true,
        data: fallbackData.clubs,
        total: fallbackData.total,
        usedFallback: true
      });
    }

    // Get total count for pagination
    let totalQuery = `
      SELECT COUNT(DISTINCT c.club_id) as total
      FROM clubs c
    `;
    
    if (category) {
      totalQuery += ` WHERE c.category = $1`;
    }

    const { data: countData } = await supabase.rpc('exec_sql', {
      query: totalQuery,
      params: category ? [category] : []
    });

    const total = countData?.[0]?.total || data?.length || 0;

    return NextResponse.json({
      success: true,
      data: data || [],
      total,
      pagination: {
        limit: limit ? parseInt(limit) : null,
        offset: parseInt(offset),
        hasMore: limit ? (parseInt(offset) + parseInt(limit)) < total : false
      }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    
    // Fallback on any error
    try {
      const fallbackData = await getFallbackLeaderboard(
        new URL(request.url).searchParams.get('category'),
        new URL(request.url).searchParams.get('limit'),
        new URL(request.url).searchParams.get('offset') || '0'
      );
      
      return NextResponse.json({
        success: true,
        data: fallbackData.clubs,
        total: fallbackData.total,
        usedFallback: true
      });
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
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