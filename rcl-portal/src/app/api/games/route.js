import { supabase } from '../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sport_id = searchParams.get('sport_id');

    let query = supabase.from('matches').select('*');
    
    // If sport_id parameter is provided, filter by it
    if (sport_id) {
      query = query.eq('sport_id', sport_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching matches:', error);
      return NextResponse.json(
        { error: 'Failed to fetch matches' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      matches: data || [],
      filtered_by_sport: sport_id || null 
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