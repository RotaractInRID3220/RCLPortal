import { supabase } from '../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

// Helper function to fetch all records with pagination (Supabase default limit is 1000)
async function fetchAllRecords(table, selectColumns, options = {}) {
  const allRecords = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(table)
      .select(selectColumns)
      .range(offset, offset + pageSize - 1);
    
    // Apply any filters if provided
    if (options.eq) {
      for (const [column, value] of Object.entries(options.eq)) {
        query = query.eq(column, value);
      }
    }

    const { data, error } = await query;
    
    if (error) {
      console.error(`Error fetching from ${table}:`, error);
      throw error;
    }

    if (data && data.length > 0) {
      allRecords.push(...data);
      offset += pageSize;
      hasMore = data.length === pageSize; // If we got a full page, there might be more
    } else {
      hasMore = false;
    }
  }

  return allRecords;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sport_id = searchParams.get('sport_id');
    const search = searchParams.get('search');

    let data, error;
    
    if (sport_id) {
      // OPTIMIZATION 1: Batch fetch sport data, teams, and registrations in parallel
      const [
        { data: sportData, error: sportError },
        { data: teamsData, error: teamsError },
        { data: registrations, error: regError }
      ] = await Promise.all([
        supabase
          .from('events')
          .select('category, sport_name, min_count')
          .eq('sport_id', sport_id)
          .single(),
        
        supabase
          .from('teams')
          .select('team_id, sport_id, club_id')
          .eq('sport_id', sport_id),
          
        supabase
          .from('registrations')
          .select('RMIS_ID, main_player')
          .eq('sport_id', sport_id)
      ]);

      if (sportError) {
        console.error('Error fetching sport category:', sportError);
        return NextResponse.json(
          { error: 'Failed to fetch sport information' },
          { status: 500 }
        );
      }

      if (teamsError) {
        console.error('Error fetching teams:', teamsError);
        return NextResponse.json(
          { error: 'Failed to fetch teams' },
          { status: 500 }
        );
      }

      // OPTIMIZATION 2: Get unique club IDs and player IDs for batch fetching
      const registrationIds = (registrations || []).map(r => r.RMIS_ID);
      
      // Batch fetch players and clubs data in parallel
      const [
        { data: allPlayersData, error: playersError },
        { data: allClubsData, error: clubsError }
      ] = await Promise.all([
        registrationIds.length > 0 
          ? supabase
              .from('players')
              .select('RMIS_ID, name, club_id')
              .in('RMIS_ID', registrationIds)
          : Promise.resolve({ data: [], error: null }),
          
        supabase
          .from('clubs')
          .select('club_id, club_name, category')
          .eq('category', sportData.category)
      ]);

      if (playersError || clubsError) {
        console.error('Error fetching related data:', { playersError, clubsError });
        return NextResponse.json(
          { error: 'Failed to fetch related data' },
          { status: 500 }
        );
      }

      // OPTIMIZATION 3: Create lookup maps for O(1) access
      const registrationMap = new Map();
      (registrations || []).forEach(reg => {
        registrationMap.set(reg.RMIS_ID, reg.main_player);
      });
      
      const clubMap = new Map();
      (allClubsData || []).forEach(club => {
        clubMap.set(club.club_id, club);
      });
      
      const playersMap = new Map();
      (allPlayersData || []).forEach(player => {
        playersMap.set(player.RMIS_ID, player);
      });

      // OPTIMIZATION 4: Group players by club_id in single pass
      const clubPlayersMap = new Map();
      const clubRegistrationCounts = new Map();
      
      (allPlayersData || []).forEach(player => {
        const club = clubMap.get(player.club_id);
        if (!club) return; // Skip players from non-matching category clubs
        
        // Group players by club for teams
        if (!clubPlayersMap.has(player.club_id)) {
          clubPlayersMap.set(player.club_id, []);
        }
        
        const playerData = {
          RMIS_ID: player.RMIS_ID,
          main_player: registrationMap.get(player.RMIS_ID),
          players: {
            name: player.name,
            RMIS_ID: player.RMIS_ID,
            club_id: player.club_id
          }
        };
        
        clubPlayersMap.get(player.club_id).push(playerData);
        
        // Count registrations per club
        clubRegistrationCounts.set(
          player.club_id, 
          (clubRegistrationCounts.get(player.club_id) || 0) + 1
        );
      });

      // OPTIMIZATION 5: Process teams with pre-computed data
      let filteredTeamsData = (teamsData || [])
        .filter(team => clubMap.has(team.club_id))
        .map(team => {
          const club = clubMap.get(team.club_id);
          const teamPlayers = clubPlayersMap.get(team.club_id) || [];
          
          return {
            ...team,
            clubs: club,
            player_count: teamPlayers.length,
            registrations: teamPlayers
          };
        });

      // Apply search filter if provided
      if (search) {
        filteredTeamsData = filteredTeamsData.filter(team =>
          team.clubs?.club_name?.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Sort by player count desc, then alphabetically by club name
      filteredTeamsData.sort((a, b) => {
        if (b.player_count !== a.player_count) {
          return b.player_count - a.player_count;
        }
        return a.clubs.club_name.localeCompare(b.clubs.club_name);
      });

      // OPTIMIZATION 6: Calculate eligible clubs from existing data
      const existingTeamClubIds = new Set(filteredTeamsData.map(t => t.club_id));
      const eligibleClubs = Array.from(clubRegistrationCounts.entries())
        .filter(([club_id, count]) => !existingTeamClubIds.has(club_id))
        .map(([club_id, count]) => {
          const club = clubMap.get(club_id);
          return {
            club_id,
            club_name: club.club_name,
            count
          };
        });

      return NextResponse.json({ 
        teams: filteredTeamsData,
        sport_name: sportData.sport_name,
        eligible_clubs: eligibleClubs
      });

    } else {
      // Get all teams if no sport_id filter
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          team_id,
          sport_id,
          club_id,
          clubs (
            club_id,
            club_name,
            category
          )
        `);

      data = teamsData;
      error = teamsError;
      
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
    }

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
    const { sport_id, manual_addition, club_id } = await request.json();

    // Handle manual team addition
    if (manual_addition && sport_id && club_id) {
      // Check if team already exists
      const { data: existingTeam } = await supabase
        .from('teams')
        .select('team_id')
        .eq('sport_id', sport_id)
        .eq('club_id', club_id)
        .single();

      if (existingTeam) {
        return NextResponse.json({
          error: 'Team already exists for this club and sport'
        }, { status: 400 });
      }

      // Create the team
      const { data: newTeam, error: createError } = await supabase
        .from('teams')
        .insert([{ club_id, sport_id }])
        .select('team_id')
        .single();

      if (createError) {
        console.error('Error creating manual team:', createError);
        return NextResponse.json({
          error: 'Failed to create team'
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Team created successfully',
        team: newTeam
      });
    }

    // Original bulk creation logic continues below...

    // If sport_id provided, create teams for specific sport
    // Otherwise, create teams for all eligible sports
    const sportsToProcess = [];

    if (sport_id) {
      // Get specific sport data
      const { data: sportData, error: sportError } = await supabase
        .from('events')
        .select('*')
        .eq('sport_id', sport_id)
        .single();

      if (sportError) {
        return NextResponse.json(
          { error: 'Sport not found' },
          { status: 404 }
        );
      }

      sportsToProcess.push(sportData);
    } else {
      // Get all eligible sports (team, trackTeam, and individual types)
      const { data: sportsData, error: sportsError } = await supabase
        .from('events')
        .select('*')
        .in('sport_type', ['team', 'trackTeam', 'individual']);

      if (sportsError) {
        return NextResponse.json(
          { error: 'Failed to fetch sports' },
          { status: 500 }
        );
      }

      sportsToProcess.push(...(sportsData || []));
    }

    // OPTIMIZATION: Batch fetch all data in parallel instead of per-sport queries
    // NOTE: Using pagination helper for registrations to ensure ALL records are fetched
    const sportIds = new Set(sportsToProcess.map(s => s.sport_id));
    
    // Fetch registrations with pagination to get ALL records
    const [existingTeamsData, registrationsData, clubsData] = await Promise.all([
      // Get ALL existing teams
      fetchAllRecords('teams', 'club_id, sport_id'),
      
      // Get ALL registrations with pagination - this is critical!
      fetchAllRecords('registrations', 'RMIS_ID, sport_id, club_id'),
      
      // Get all clubs
      fetchAllRecords('clubs', 'club_id, club_name, category')
    ]);

    // OPTIMIZATION: Create lookup maps for O(1) access
    const existingTeamsMap = new Map();
    const registrationsMap = new Map();
    const clubsMap = new Map();

    // Build existing teams lookup (sport_id -> Set of club_ids) - filter by our sportIds
    (existingTeamsData || []).forEach(team => {
      if (!sportIds.has(team.sport_id)) return; // Skip teams for sports we're not processing
      if (!existingTeamsMap.has(team.sport_id)) {
        existingTeamsMap.set(team.sport_id, new Set());
      }
      existingTeamsMap.get(team.sport_id).add(team.club_id);
    });

    // Build registrations lookup (sport_id -> array of registration objects with club_id)
    // Filter by our sportIds in code
    let totalRegsForSports = 0;
    (registrationsData || []).forEach(reg => {
      if (!sportIds.has(reg.sport_id)) return; // Skip registrations for sports we're not processing
      totalRegsForSports++;
      if (!registrationsMap.has(reg.sport_id)) {
        registrationsMap.set(reg.sport_id, []);
      }
      registrationsMap.get(reg.sport_id).push({
        RMIS_ID: reg.RMIS_ID,
        club_id: reg.club_id
      });
    });

    // Build clubs lookup (club_id -> club object)
    (clubsData || []).forEach(club => {
      clubsMap.set(club.club_id, club);
    });

    const results = [];
    let totalCreated = 0;
    let totalSkipped = 0;

    // OPTIMIZATION: Process all sports with pre-fetched data
    for (const sport of sportsToProcess) {
      try {
        // Use lookup maps instead of database queries
        const existingClubIds = existingTeamsMap.get(sport.sport_id) || new Set();
        const registrations = registrationsMap.get(sport.sport_id) || [];

        // Group registrations by club_id and count - using club_id directly from registration
        const clubCounts = {};
        registrations.forEach(reg => {
          const club = clubsMap.get(reg.club_id);
          // Only count if club exists and matches sport category
          if (club && club.category === sport.category) {
            if (!clubCounts[reg.club_id]) {
              clubCounts[reg.club_id] = {
                count: 0,
                club_name: club.club_name,
                club_id: reg.club_id
              };
            }
            clubCounts[reg.club_id].count++;
          }
        });

        // Find clubs with enough registrations that don't already have teams
        const eligibleClubs = Object.values(clubCounts).filter(club => 
          club.count >= sport.min_count && !existingClubIds.has(club.club_id)
        );

        // Create teams for eligible clubs
        const teamsToCreate = eligibleClubs.map(club => ({
          club_id: club.club_id,
          sport_id: sport.sport_id
        }));

        if (teamsToCreate.length > 0) {
          const { data: newTeams, error: createError } = await supabase
            .from('teams')
            .insert(teamsToCreate)
            .select('team_id, club_id');

          if (createError) {
            console.error(`Error creating teams for sport ${sport.sport_id}:`, createError);
            results.push({
              sport_id: sport.sport_id,
              sport_name: sport.sport_name,
              error: 'Failed to create teams',
              created: 0,
              skipped: existingClubIds.size
            });
          } else {
            totalCreated += newTeams.length;
            totalSkipped += existingClubIds.size;
            results.push({
              sport_id: sport.sport_id,
              sport_name: sport.sport_name,
              created: newTeams.length,
              skipped: existingClubIds.size,
              eligible_clubs: eligibleClubs.length
            });
          }
        } else {
          totalSkipped += existingClubIds.size;
          results.push({
            sport_id: sport.sport_id,
            sport_name: sport.sport_name,
            created: 0,
            skipped: existingClubIds.size,
            message: 'No eligible clubs found or all teams already exist'
          });
        }

      } catch (sportError) {
        console.error(`Error processing sport ${sport.sport_id}:`, sportError);
        results.push({
          sport_id: sport.sport_id,
          sport_name: sport.sport_name,
          error: 'Processing failed',
          created: 0,
          skipped: 0
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created ${totalCreated} teams, skipped ${totalSkipped} existing teams`,
      total_created: totalCreated,
      total_skipped: totalSkipped,
      results,
      // Debug info to verify data fetch completeness
      _debug: {
        sports_processed: sportsToProcess.length,
        total_registrations_fetched: registrationsData?.length || 0,
        registrations_for_target_sports: totalRegsForSports,
        total_existing_teams_fetched: existingTeamsData?.length || 0,
        total_clubs_fetched: clubsData?.length || 0
      }
    });

  } catch (error) {
    console.error('Error creating teams:', error);
    return NextResponse.json(
      { error: 'Failed to create teams' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const team_id = searchParams.get('team_id');

    if (!team_id) {
      return NextResponse.json(
        { error: 'Team ID is required' },
        { status: 400 }
      );
    }

    // Delete the team
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('team_id', team_id);

    if (error) {
      console.error('Error deleting team:', error);
      return NextResponse.json(
        { error: 'Failed to delete team' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Team deleted successfully'
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}