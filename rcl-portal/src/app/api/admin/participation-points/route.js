import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { APP_CONFIG, getSportDayPlace } from '@/config/app.config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * GET /api/admin/participation-points?sportDay=D-01
 * 
 * Fetches participation data for all clubs for a specific sport day.
 * Returns the number of registered players, day registrations, registered sports, and eligible sports per club.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sportDay = searchParams.get('sportDay') || APP_CONFIG.CURRENT_SPORT_DAY;

    // Get the place value for this sport day (for checking if already awarded)
    const sportDayPlace = getSportDayPlace(sportDay);

    // Fetch all clubs
    const { data: clubs, error: clubsError } = await supabase
      .from('clubs')
      .select('club_id, club_name')
      .order('club_name');

    if (clubsError) throw clubsError;

    // For each club, calculate participation metrics
    const participationData = await Promise.all(
      clubs.map(async (club) => {
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
        const registeredPlayersCount = registeredPlayers.size;

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
        const dayRegistrationCount = dayRegisteredPlayers.size;

        // Calculate eligible sports (≥50% attendance)
        let eligibleSportsCount = 0;
        const eligibleSportIds = [];
        
        Object.entries(sportGroups).forEach(([sportId, players]) => {
          const totalPlayers = players.size;
          const attendedPlayers = Array.from(players).filter(rmisId => 
            dayRegisteredPlayers.has(rmisId)
          ).length;

          // Check if ≥50% attended
          if (totalPlayers > 0 && (attendedPlayers / totalPlayers) >= 0.5) {
            eligibleSportsCount++;
            eligibleSportIds.push(parseInt(sportId));
          }
        });

        // Check if points already awarded for eligible sports
        let alreadyAwarded = false;
        
        if (eligibleSportIds.length > 0) {
          const { data: existingPoints, error: pointsError } = await supabase
            .from('club_points')
            .select('sport_id')
            .eq('club_id', club.club_id)
            .eq('place', sportDayPlace)
            .in('sport_id', eligibleSportIds);

          if (pointsError) throw pointsError;

          // If any eligible sport has been awarded, mark as already awarded
          alreadyAwarded = existingPoints && existingPoints.length > 0;
        }

        return {
          club_id: club.club_id,
          club_name: club.club_name,
          registered_players_count: registeredPlayersCount,
          day_registration_count: dayRegistrationCount,
          registered_sports_count: Object.keys(sportGroups).length,
          eligible_sports_count: eligibleSportsCount,
          already_awarded: alreadyAwarded,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: participationData,
      sportDay,
    });

  } catch (error) {
    console.error('Error fetching participation data:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
