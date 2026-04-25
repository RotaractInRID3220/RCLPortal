import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

const INDIVIDUAL_SPORT_TYPES = new Set(['individual', 'trackIndividual']);
const TEAM_SPORT_TYPES = new Set(['team', 'trackTeam']);

function getRequiredDayRegistrations(sportType, minCount) {
  if (TEAM_SPORT_TYPES.has(sportType)) {
    return Math.max(1, Math.ceil((minCount || 1) / 2));
  }

  if (INDIVIDUAL_SPORT_TYPES.has(sportType)) {
    return 1;
  }

  return 1;
}

export async function GET(request, { params }) {
  try {
    const { clubId } = await params;
    const normalizedClubId = Number.parseInt(clubId, 10);

    if (!Number.isInteger(normalizedClubId)) {
      return NextResponse.json(
        { success: false, error: 'Valid club ID is required' },
        { status: 400 }
      );
    }

    const [clubResponse, registrationsResponse] = await Promise.all([
      supabase
        .from('clubs')
        .select('club_id, club_name, category')
        .eq('club_id', normalizedClubId)
        .single(),
      supabase
        .from('registrations')
        .select(`
          sport_id,
          RMIS_ID,
          events!inner (
            sport_id,
            sport_name,
            sport_day,
            sport_type,
            min_count
          )
        `)
        .eq('club_id', normalizedClubId)
    ]);

    const { data: club, error: clubError } = clubResponse;
    const { data: registrations, error: registrationsError } = registrationsResponse;

    if (clubError) {
      if (clubError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Club not found' },
          { status: 404 }
        );
      }

      console.error('Error fetching club:', clubError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch club' },
        { status: 500 }
      );
    }

    if (registrationsError) {
      console.error('Error fetching registrations:', registrationsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch registrations' },
        { status: 500 }
      );
    }

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          club,
          summary: {
            event_count: 0,
            eligible_events_count: 0,
            raw_registered_events_count: 0,
            registered_players_count: 0,
            day_registered_players_count: 0
          },
          events: []
        }
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    const registeredPlayerIds = [...new Set(
      registrations
        .map((registration) => registration.RMIS_ID)
        .filter(Boolean)
    )];
    const relevantSportDays = [...new Set(
      registrations
        .map((registration) => registration.events?.sport_day)
        .filter(Boolean)
    )];

    let dayRegistrations = [];

    if (registeredPlayerIds.length > 0 && relevantSportDays.length > 0) {
      const { data, error: dayRegistrationsError } = await supabase
        .from('day_registrations')
        .select('RMIS_ID, sport_day')
        .in('RMIS_ID', registeredPlayerIds)
        .in('sport_day', relevantSportDays);

      if (dayRegistrationsError) {
        console.error('Error fetching day registrations:', dayRegistrationsError);
        return NextResponse.json(
          { success: false, error: 'Failed to fetch day registrations' },
          { status: 500 }
        );
      }

      dayRegistrations = data || [];
    }

    const dayRegistrationsByDay = new Map();
    const uniqueDayRegisteredPlayers = new Set();

    dayRegistrations.forEach((entry) => {
      if (!dayRegistrationsByDay.has(entry.sport_day)) {
        dayRegistrationsByDay.set(entry.sport_day, new Set());
      }

      dayRegistrationsByDay.get(entry.sport_day).add(entry.RMIS_ID);
      uniqueDayRegisteredPlayers.add(entry.RMIS_ID);
    });

    const eventsBySportId = new Map();

    registrations.forEach((registration) => {
      const eventDetails = registration.events;
      if (!eventDetails) {
        return;
      }

      if (!eventsBySportId.has(registration.sport_id)) {
        eventsBySportId.set(registration.sport_id, {
          sport_id: registration.sport_id,
          sport_name: eventDetails.sport_name,
          sport_day: eventDetails.sport_day,
          sport_type: eventDetails.sport_type,
          min_count: eventDetails.min_count,
          registeredPlayers: new Set()
        });
      }

      if (registration.RMIS_ID) {
        eventsBySportId.get(registration.sport_id).registeredPlayers.add(registration.RMIS_ID);
      }
    });

    const events = Array.from(eventsBySportId.values())
      .map((event) => {
        const dayRegisteredPlayers = dayRegistrationsByDay.get(event.sport_day) || new Set();
        const registeredPlayers = Array.from(event.registeredPlayers);
        const attendedCount = registeredPlayers.filter((playerId) => dayRegisteredPlayers.has(playerId)).length;
        const requiredDayRegistrations = getRequiredDayRegistrations(event.sport_type, event.min_count);
        const eligible = attendedCount >= requiredDayRegistrations;

        return {
          sport_id: event.sport_id,
          sport_name: event.sport_name,
          sport_day: event.sport_day,
          sport_type: event.sport_type,
          min_count: event.min_count,
          registered_player_count: registeredPlayers.length,
          day_registered_player_count: attendedCount,
          required_day_registered_count: requiredDayRegistrations,
          eligible
        };
      })
      .sort((left, right) => {
        if (left.sport_day === right.sport_day) {
          return left.sport_name.localeCompare(right.sport_name);
        }

        return left.sport_day.localeCompare(right.sport_day);
      });

    const eligibleEventsCount = events.filter((event) => event.eligible).length;

    return NextResponse.json({
      success: true,
      data: {
        club,
        summary: {
          event_count: eligibleEventsCount,
          eligible_events_count: eligibleEventsCount,
          raw_registered_events_count: events.length,
          registered_players_count: registeredPlayerIds.length,
          day_registered_players_count: uniqueDayRegisteredPlayers.size
        },
        events
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error fetching club registered event count:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}