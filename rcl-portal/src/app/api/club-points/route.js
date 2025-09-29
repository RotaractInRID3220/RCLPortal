import { supabase } from '../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sport_id = searchParams.get('sport_id');
    const club_id = searchParams.get('club_id');
    const category = searchParams.get('category');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset') || '0';

    let query = supabase
      .from('club_points')
      .select(`
        point_id,
        club_id,
        sport_id,
        points,
        place,
        clubs:club_id (
          club_name,
          category
        )
      `)
      .order('points', { ascending: false });

    // Apply filters
    if (sport_id) {
      query = query.eq('sport_id', sport_id);
    }
    
    if (club_id) {
      query = query.eq('club_id', club_id);
    }

    // Filter by club category if provided
    if (category) {
      query = query.eq('clubs.category', category);
    }

    // Apply pagination if provided
    if (limit) {
      query = query.range(
        parseInt(offset), 
        parseInt(offset) + parseInt(limit) - 1
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching club points:', error);
      return NextResponse.json(
        { error: 'Failed to fetch club points' },
        { status: 500 }
      );
    }

    // Get total count for pagination info
    let totalCount = null;
    if (limit) {
      let countQuery = supabase
        .from('club_points')
        .select('point_id', { count: 'exact', head: true });
      
      if (sport_id) {
        countQuery = countQuery.eq('sport_id', sport_id);
      }
      if (club_id) {
        countQuery = countQuery.eq('club_id', club_id);
      }
      
      const { count } = await countQuery;
      totalCount = count;
    }

    return NextResponse.json({ 
      success: true,
      data: data || [],
      pagination: limit ? {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: totalCount,
        hasMore: totalCount ? (parseInt(offset) + parseInt(limit)) < totalCount : false
      } : null
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { club_id, sport_id, points, place } = body;

    // Validate required fields
    if (!club_id || !sport_id || !points || !place) {
      return NextResponse.json(
        { error: 'Missing required fields: club_id, sport_id, points, place' },
        { status: 400 }
      );
    }

    // Validate that points and place are numbers
    if (isNaN(points) || isNaN(place)) {
      return NextResponse.json(
        { error: 'Points and place must be valid numbers' },
        { status: 400 }
      );
    }

    // Validate points must be double digits (10-99)
    if (points < 10 || points > 99) {
      return NextResponse.json(
        { error: 'Points must be double digits (10-99)' },
        { status: 400 }
      );
    }

    // Validate place must be positive
    if (place < 1) {
      return NextResponse.json(
        { error: 'Place must be a positive number' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('club_points')
      .insert([{ 
        club_id: club_id,
        sport_id: parseInt(sport_id),
        points: parseInt(points),
        place: parseInt(place)
      }])
      .select(`
        point_id,
        club_id,
        sport_id,
        points,
        place,
        clubs:club_id (
          club_name,
          category
        )
      `);

    if (error) {
      console.error('Error creating club point entry:', error);
      return NextResponse.json(
        { error: 'Failed to create club point entry' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      data: data[0] 
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const point_id = searchParams.get('point_id');

    if (!point_id) {
      return NextResponse.json(
        { error: 'Missing required parameter: point_id' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('club_points')
      .delete()
      .eq('point_id', parseInt(point_id))
      .select();

    if (error) {
      console.error('Error deleting club point entry:', error);
      return NextResponse.json(
        { error: 'Failed to delete club point entry' },
        { status: 500 }
      );
    }

    if (data.length === 0) {
      return NextResponse.json(
        { error: 'Club point entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Club point entry deleted successfully' 
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}