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

    // Get sport details to find category
    const { data: sportData, error: sportError } = await supabase
      .from('events')
      .select('category, sport_name')
      .eq('sport_id', sport_id)
      .single();

    if (sportError) {
      console.error('Error fetching sport data:', sportError);
      return NextResponse.json(
        { error: 'Failed to fetch sport information' },
        { status: 500 }
      );
    }

    // Get all clubs in the same category
    const { data: allClubs, error: clubsError } = await supabase
      .from('clubs')
      .select('club_id, club_name, category')
      .eq('category', sportData.category);

    if (clubsError) {
      console.error('Error fetching clubs:', clubsError);
      return NextResponse.json(
        { error: 'Failed to fetch clubs' },
        { status: 500 }
      );
    }

    // Get existing teams for this sport
    const { data: existingTeams, error: teamsError } = await supabase
      .from('teams')
      .select('club_id')
      .eq('sport_id', sport_id);

    const existingTeamClubIds = new Set((existingTeams || []).map(t => t.club_id));

    // Get registrations for this sport
    const { data: registrations, error: regError } = await supabase
      .from('registrations')
      .select('RMIS_ID')
      .eq('sport_id', sport_id);

    // Get player data to count registrations per club
    let clubRegistrationCounts = {};
    if (registrations && registrations.length > 0) {
      const registrationIds = registrations.map(r => r.RMIS_ID);
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('RMIS_ID, club_id')
        .in('RMIS_ID', registrationIds);

      if (!playersError && players) {
        players.forEach(player => {
          if (allClubs.find(club => club.club_id === player.club_id)) {
            clubRegistrationCounts[player.club_id] = (clubRegistrationCounts[player.club_id] || 0) + 1;
          }
        });
      }
    }

    // Prepare available clubs data
    const availableClubs = allClubs.map(club => ({
      club_id: club.club_id,
      club_name: club.club_name,
      category: club.category,
      registration_count: clubRegistrationCounts[club.club_id] || 0,
      has_team: existingTeamClubIds.has(club.club_id)
    }));

    // Sort: clubs without teams first, then by registration count descending, then alphabetically
    availableClubs.sort((a, b) => {
      if (a.has_team !== b.has_team) {
        return a.has_team ? 1 : -1; // Non-team clubs first
      }
      if (b.registration_count !== a.registration_count) {
        return b.registration_count - a.registration_count;
      }
      return a.club_name.localeCompare(b.club_name);
    });

    return NextResponse.json({
      success: true,
      available_clubs: availableClubs,
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