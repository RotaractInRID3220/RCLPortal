import { supabase } from '../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sport_id = searchParams.get('sport_id');
    const limit = parseInt(searchParams.get('limit')) || 20;
    const offset = parseInt(searchParams.get('offset')) || 0;

    let query = supabase
      .from('matches')
      .select('*', { count: 'exact' })
      .order('start_time', { ascending: false });

    // If sport_id parameter is provided, filter by it
    if (sport_id) {
      query = query.eq('sport_id', sport_id);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching matches:', error);
      return NextResponse.json(
        { error: 'Failed to fetch matches' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      matches: data || [],
      filtered_by_sport: sport_id || null,
      totalCount: count || 0,
      limit,
      offset,
      totalPages: limit ? Math.ceil((count || 0) / limit) : 1
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
    
    const { data, error } = await supabase
      .from('matches')
      .insert([body])
      .select();

    if (error) {
      console.error('Error creating match:', error);
      return NextResponse.json(
        { error: 'Failed to create match' },
        { status: 500 }
      );
    }

    return NextResponse.json({ match: data[0] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { match_id, ...updateData } = body;
    
    // Convert empty string start_time to null
    if (updateData.start_time === '') {
      updateData.start_time = null;
    }
    
    const { data, error } = await supabase
      .from('matches')
      .update(updateData)
      .eq('match_id', match_id)
      .select();

    if (error) {
      console.error('Error updating match:', error);
      return NextResponse.json(
        { error: 'Failed to update match' },
        { status: 500 }
      );
    }

    return NextResponse.json({ match: data[0] });
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
    const match_id = searchParams.get('match_id');
    
    if (!match_id) {
      return NextResponse.json(
        { error: 'match_id is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('match_id', match_id);

    if (error) {
      console.error('Error deleting match:', error);
      return NextResponse.json(
        { error: 'Failed to delete match' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}