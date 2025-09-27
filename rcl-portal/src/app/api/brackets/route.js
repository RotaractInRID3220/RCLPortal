import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sport_id = searchParams.get('sport_id') || '1'; // Default to sport_id 1

    // Fetch matches without foreign key relationships
    const { data: matchesData, error: matchesError } = await supabase
      .from('matches')
      .select(`
        match_id,
        team1_id,
        team2_id,
        team1_score,
        team2_score,
        round_id,
        match_order,
        parent_match1_id,
        parent_match2_id,
        start_time
      `)
      .eq('sport_id', sport_id)
      .order('round_id', { ascending: false })
      .order('match_order', { ascending: true });

    if (matchesError) {
      console.error('Error fetching matches:', matchesError);
      return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
    }

    // Get team data separately
    let teamsData = [];
    if (matchesData && matchesData.length > 0) {
      const teamIds = [...new Set(matchesData.flatMap(match => 
        [match.team1_id, match.team2_id].filter(id => id !== null)
      ))];
      
      if (teamIds.length > 0) {
        const { data: teams, error: teamsError } = await supabase
          .from('teams')
          .select('team_id, club_id')
          .in('team_id', teamIds);

        if (!teamsError && teams) {
          // Get club data separately
          const clubIds = [...new Set(teams.map(t => t.club_id))];
          const { data: clubs, error: clubsError } = await supabase
            .from('clubs')
            .select('club_id, club_name')
            .in('club_id', clubIds);

          if (!clubsError && clubs) {
            // Combine team and club data
            teamsData = teams.map(team => {
              const club = clubs.find(c => c.club_id === team.club_id);
              return {
                ...team,
                club: club || null
              };
            });
          }
        }
      }
    }

    // Add team and club info to matches
    const matchesWithTeams = matchesData.map(match => ({
      ...match,
      team1: match.team1_id ? teamsData.find(t => t.team_id === match.team1_id) || null : null,
      team2: match.team2_id ? teamsData.find(t => t.team_id === match.team2_id) || null : null
    }));

    // Transform data to react-brackets format
    const bracketData = transformToBracketFormat(matchesWithTeams || []);

    return NextResponse.json({
      success: true,
      data: bracketData,
      total_matches: matchesWithTeams?.length || 0
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function transformToBracketFormat(matches) {
  // Round mapping based on your round_id system
  const roundMap = {
      0: '1st Round',
      1: '2nd Round',
      2: 'Quarter Finals',
      3: 'Semi Finals',
      4: 'Consolation Finals',
      5: 'Finals',
  };

  // Group matches by round_id
  const groupedByRound = matches.reduce((acc, match) => {
    const roundName = roundMap[match.round_id] || `Round ${match.round_id}`;
    
    if (!acc[roundName]) {
      acc[roundName] = [];
    }
    
    acc[roundName].push({
      id: match.match_id,
      date: match.start_time ? new Date(match.start_time).toLocaleString() : 'TBD',
      matchId: match.match_id,
      teams: [
        { 
          name: match.team1?.club?.club_name || 'TBD',
          id: match.team1_id,
          seed: match.team1?.seed_number
        },
        { 
          name: match.team2?.club?.club_name || 'TBD',
          id: match.team2_id,
          seed: match.team2?.seed_number
        }
      ],
      score: [match.team1_score || 0, match.team2_score || 0],
      status: (match.team1_score > 0 || match.team2_score > 0) ? 'completed' : 'scheduled',
      round_id: match.round_id,
      match_order: match.match_order
    });
    
    return acc;
  }, {});

  // Convert to rounds array format for react-brackets
  // Sort rounds in the correct order (Finals first, then work backwards)
  const sortedRounds = Object.entries(groupedByRound)
    .sort(([, seedsA], [, seedsB]) => {
      const roundA = seedsA[0]?.round_id || 0;
      const roundB = seedsB[0]?.round_id || 0;
      return roundA - roundB; // Ascending order (0=Finals comes first)
    })
    .map(([title, seeds]) => ({
      title,
      seeds: seeds.sort((a, b) => a.match_order - b.match_order) // Sort seeds by match order
    }));

  return sortedRounds;
}

// POST method to update match results
export async function POST(request) {
  try {
    const body = await request.json();
    const { match_id, team1_score, team2_score } = body;

    if (!match_id || team1_score === undefined || team2_score === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Update match scores
    const { data, error } = await supabase
      .from('matches')
      .update({
        team1_score: parseInt(team1_score),
        team2_score: parseInt(team2_score)
      })
      .eq('match_id', match_id)
      .select();

    if (error) {
      console.error('Error updating match:', error);
      return NextResponse.json({ error: 'Failed to update match' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data[0],
      message: 'Match updated successfully'
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
