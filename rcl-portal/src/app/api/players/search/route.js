import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

/**
 * Searches for players by name, NIC, or RMIS_ID
 * GET /api/players/search?name=&nic=&rmisId=&page=1&limit=10
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || '';
    const nic = searchParams.get('nic') || '';
    const rmisId = searchParams.get('rmisId') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Check if at least one search field has a value
    if (!name.trim() && !nic.trim() && !rmisId.trim()) {
      return NextResponse.json({
        success: true,
        data: { players: [], total: 0, page, limit }
      });
    }

    const offset = (page - 1) * limit;

    // Build the query dynamically based on which fields are provided
    let query = supabase
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
      `, { count: 'exact' });

    // Build OR conditions for search
    const conditions = [];
    if (name.trim()) {
      conditions.push(`name.ilike.%${name.trim()}%`);
    }
    if (nic.trim()) {
      conditions.push(`NIC.ilike.%${nic.trim()}%`);
    }
    if (rmisId.trim()) {
      conditions.push(`RMIS_ID.ilike.%${rmisId.trim()}%`);
    }

    // Apply OR filter if we have conditions
    if (conditions.length > 0) {
      query = query.or(conditions.join(','));
    }

    // Execute query with ordering and pagination
    const { data: players, error, count } = await query
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Supabase search error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        players: players || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      },
      message: `Found ${players?.length || 0} players`
    });

  } catch (error) {
    console.error('Player search error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
