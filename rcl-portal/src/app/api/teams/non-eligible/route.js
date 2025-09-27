import { supabase } from '../../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sport_id = searchParams.get('sport_id');

    if (!sport_id) {
      return NextResponse.json(
        { error: 'Sport ID is required' },
        { status: 400 }
      );
    }

    // Get sport details to find category and min_count
    const { data: sportData, error: sportError } = await supabase
      .from('events')
      .select('category, min_count, sport_name')
      .eq('sport_id', sport_id)
      .single();

    if (sportError) {
      console.error('Error fetching sport data:', sportError);
      return NextResponse.json(
        { error: 'Failed to fetch sport information' },
        { status: 500 }
      );
    }

    // Get all registrations for this sport
    const { data: registrations, error: regError } = await supabase
      .from('registrations')
      .select('RMIS_ID')
      .eq('sport_id', sport_id);

    if (regError) {
      console.error('Error fetching registrations:', regError);
      return NextResponse.json(
        { error: 'Failed to fetch registrations' },
        { status: 500 }
      );
    }

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({
        success: true,
        non_eligible_clubs: [],
        min_count: sportData.min_count,
        sport_name: sportData.sport_name
      });
    }

    // Get player details for all registrations
    const registrationIds = registrations.map(r => r.RMIS_ID);
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('RMIS_ID, club_id, name')
      .in('RMIS_ID', registrationIds);

    if (playersError) {
      console.error('Error fetching players:', playersError);
      return NextResponse.json(
        { error: 'Failed to fetch player data' },
        { status: 500 }
      );
    }

    // Get club details for the sport category
    const uniqueClubIds = [...new Set(players.map(p => p.club_id))];
    const { data: clubs, error: clubsError } = await supabase
      .from('clubs')
      .select('club_id, club_name, category')
      .in('club_id', uniqueClubIds)
      .eq('category', sportData.category);

    if (clubsError) {
      console.error('Error fetching clubs:', clubsError);
      return NextResponse.json(
        { error: 'Failed to fetch club data' },
        { status: 500 }
      );
    }

    // Get existing teams to exclude clubs that already have teams
    const { data: existingTeams, error: teamsError } = await supabase
      .from('teams')
      .select('club_id')
      .eq('sport_id', sport_id);

    const existingTeamClubIds = new Set((existingTeams || []).map(t => t.club_id));

    // Count registrations per club
    const clubCounts = {};
    players.forEach(player => {
      const club = clubs.find(c => c.club_id === player.club_id);
      if (club && !existingTeamClubIds.has(club.club_id)) {
        if (!clubCounts[player.club_id]) {
          clubCounts[player.club_id] = {
            club_id: player.club_id,
            club_name: club.club_name,
            category: club.category,
            registration_count: 0
          };
        }
        clubCounts[player.club_id].registration_count++;
      }
    });

    // Filter clubs that have >0 and <min_count registrations
    const nonEligibleClubs = Object.values(clubCounts).filter(club =>
      club.registration_count > 0 && club.registration_count < sportData.min_count
    );

    // Sort by registration count descending
    nonEligibleClubs.sort((a, b) => b.registration_count - a.registration_count);

    return NextResponse.json({
      success: true,
      non_eligible_clubs: nonEligibleClubs,
      min_count: sportData.min_count,
      sport_name: sportData.sport_name
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}