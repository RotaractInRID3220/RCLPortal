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
 * Points are stored in club_points table with sport_id=NULL and place=<sport_day_code>.
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
      // Check if already awarded for this day
      const { data: existingPoints, error: checkError } = await supabase
        .from('club_points')
        .select('point_id')
        .eq('club_id', club.club_id)
        .eq('place', sportDayPlace)
        .is('sport_id', null);

      if (checkError) throw checkError;

      if (existingPoints && existingPoints.length > 0) {
        clubsSkipped++;
        continue;
      }

      // Get all sports for this day that the club has registrations for
      const { data: registrations, error: regError } = await supabase
        .from('registrations')
        .select(`
          sport_id,
          RMIS_ID,
          events!inner (
            sport_id,
            sport_day
          )
        `)
        .eq('club_id', club.club_id)
        .eq('events.sport_day', sportDay);

      if (regError) throw regError;

      // Group registrations by sport
      const sportGroups = {};
      registrations.forEach(reg => {
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

      // Calculate eligible sports (≥50% attendance)
      let eligibleSportsCount = 0;
      Object.entries(sportGroups).forEach(([sportId, players]) => {
        const totalPlayers = players.size;
        const attendedPlayers = Array.from(players).filter(rmisId => 
          dayRegisteredPlayers.has(rmisId)
        ).length;

        // Check if ≥50% attended
        if (totalPlayers > 0 && (attendedPlayers / totalPlayers) >= 0.5) {
          eligibleSportsCount++;
        }
      });

      // Award points if eligible
      if (eligibleSportsCount > 0) {
        const totalPoints = eligibleSportsCount * pointsPerSport;

        const { error: insertError } = await supabase
          .from('club_points')
          .insert({
            club_id: club.club_id,
            sport_id: null,
            place: sportDayPlace,
            points: totalPoints,
          });

        if (insertError) throw insertError;

        clubsAwarded++;
        totalPointsAwarded += totalPoints;
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
