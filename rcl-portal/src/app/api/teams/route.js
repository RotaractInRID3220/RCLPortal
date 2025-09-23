import { supabase } from '../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sport_id = searchParams.get('sport_id');

    let data, error;
    
    if (sport_id) {
      // First get the sport/event to find its category
      const { data: sportData, error: sportError } = await supabase
        .from('events')
        .select('category')
        .eq('sport_id', sport_id)
        .single();

      if (sportError) {
        console.error('Error fetching sport category:', sportError);
        return NextResponse.json(
          { error: 'Failed to fetch sport information' },
          { status: 500 }
        );
      }

      // Get teams for this sport where club category matches sport category
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          team_id,
          sport_id,
          clubs!inner (
            club_id,
            club_name,
            category
          )
        `)
        .eq('sport_id', sport_id)
        .eq('clubs.category', sportData.category);

      data = teamsData;
      error = teamsError;
    } else {
      // Get all teams if no sport_id filter
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          team_id,
          sport_id,
          club:clubs (
            club_id,
            club_name,
            category
          )
        `);

      data = teamsData;
      error = teamsError;
    }

    if (error) {
      console.error('Error fetching teams:', error);
      return NextResponse.json(
        { error: 'Failed to fetch teams' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      teams: data || []
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}