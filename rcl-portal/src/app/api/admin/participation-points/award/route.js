import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { APP_CONFIG, getSportDayPlace } from '@/config/app.config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * POST /api/admin/participation-points/award
 * 
 * Awards participation points to clubs based on 50%+ attendance criteria.
 * Points are stored in club_points table with sport_id for each eligible sport and place=<sport_day_code>.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { sportDay } = body;

    if (!sportDay) {
      return NextResponse.json(
        { success: false, error: 'sportDay is required' },
        { status: 400 }
      );
    }

    // Get the place value for this sport day
    const sportDayPlace = getSportDayPlace(sportDay);
    if (!sportDayPlace) {
      return NextResponse.json(
        { success: false, error: 'Invalid sport day' },
        { status: 400 }
      );
    }

    // Fetch all clubs
    const { data: clubs, error: clubsError } = await supabase
      .from('clubs')
      .select('club_id, club_name')
      .order('club_name');

    if (clubsError) throw clubsError;

    let clubsAwarded = 0;
    let clubsSkipped = 0;
    let totalPointsAwarded = 0;
    const pointsPerSport = APP_CONFIG.PARTICIPATION_POINTS_PER_SPORT;

    // Process each club
    for (const club of clubs) {
      // Get all sports for this day that the club has registrations for
      const { data: registrations, error: regError } = await supabase
        .from('registrations')
        .select(`
          sport_id,
          RMIS_ID,
          events!inner (
            sport_id,
            sport_day,
            sport_type
          )
        `)
        .eq('club_id', club.club_id)
        .eq('events.sport_day', sportDay);

      if (regError) throw regError;

      // Filter out track events (they have their own point awarding system)
      const EXCLUDED_SPORT_TYPES = ['trackIndividual', 'trackTeam'];
      const filteredRegistrations = registrations.filter(
        reg => !EXCLUDED_SPORT_TYPES.includes(reg.events?.sport_type)
      );

      // Group registrations by sport
      const sportGroups = {};
      filteredRegistrations.forEach(reg => {
        if (!sportGroups[reg.sport_id]) {
          sportGroups[reg.sport_id] = new Set();
        }
        sportGroups[reg.sport_id].add(reg.RMIS_ID);
      });

      // Get unique players registered for this day
      const registeredPlayers = new Set(registrations.map(r => r.RMIS_ID));

      if (registeredPlayers.size === 0) {
        continue; // No players registered, skip
      }

      // Get day registrations for this club's players using the foreign key relationship
      const { data: dayRegs, error: dayRegsError } = await supabase
        .from('day_registrations')
        .select(`
          RMIS_ID,
          players!inner (
            RMIS_ID,
            club_id
          )
        `)
        .eq('sport_day', sportDay)
        .eq('players.club_id', club.club_id)
        .in('RMIS_ID', Array.from(registeredPlayers));

      if (dayRegsError) throw dayRegsError;

      const dayRegisteredPlayers = new Set(dayRegs.map(dr => dr.RMIS_ID));

      // Calculate eligible sports (≥50% attendance) and award points per sport
      const eligibleSports = [];
      
      for (const [sportId, players] of Object.entries(sportGroups)) {
        const totalPlayers = players.size;
        const attendedPlayers = Array.from(players).filter(rmisId => 
          dayRegisteredPlayers.has(rmisId)
        ).length;

        // Check if ≥50% attended
        if (totalPlayers > 0 && (attendedPlayers / totalPlayers) >= 0.5) {
          eligibleSports.push(parseInt(sportId));
        }
      }

      // Award points per eligible sport
      if (eligibleSports.length > 0) {
        // Check if points already awarded for any of these sports
        const { data: existingPoints, error: checkError } = await supabase
          .from('club_points')
          .select('sport_id')
          .eq('club_id', club.club_id)
          .eq('place', sportDayPlace)
          .in('sport_id', eligibleSports);

        if (checkError) throw checkError;

        // Get sports that haven't been awarded yet
        const alreadyAwardedSportIds = new Set(existingPoints?.map(p => p.sport_id) || []);
        const sportsToAward = eligibleSports.filter(sportId => !alreadyAwardedSportIds.has(sportId));

        if (sportsToAward.length === 0) {
          clubsSkipped++;
          continue;
        }

        // Prepare bulk insert for all eligible sports
        const pointsToInsert = sportsToAward.map(sportId => ({
          club_id: club.club_id,
          sport_id: sportId,
          place: sportDayPlace,
          points: pointsPerSport,
        }));

        const { error: insertError } = await supabase
          .from('club_points')
          .insert(pointsToInsert);

        if (insertError) throw insertError;

        clubsAwarded++;
        totalPointsAwarded += sportsToAward.length * pointsPerSport;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Participation points awarded successfully to ${clubsAwarded} club(s)`,
      summary: {
        clubsAwarded,
        clubsSkipped,
        totalPointsAwarded,
        sportDay,
      },
    });

  } catch (error) {
    console.error('Error awarding participation points:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
