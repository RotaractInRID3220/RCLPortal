import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

/**
 * Gets day registrations grouped by sport day and event
 * GET /api/admin/day-registrations
 * Query params:
 *   - sportDay: Filter by specific sport day (e.g., 'D-01')
 *   - sportId: Filter by specific sport/event ID
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sportDay = searchParams.get('sportDay');
    const sportId = searchParams.get('sportId');

    // First get all events that match the sport day filter
    let eventsQuery = supabase
      .from('events')
      .select('sport_id, sport_name, sport_type, gender_type, category, sport_day')
      .order('sport_name', { ascending: true });

    if (sportDay) {
      eventsQuery = eventsQuery.eq('sport_day', sportDay);
    }

    if (sportId) {
      eventsQuery = eventsQuery.eq('sport_id', parseInt(sportId));
    }

    const { data: events, error: eventsError } = await eventsQuery;

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch events' },
        { status: 500 }
      );
    }

    // Get all day registrations with player and registration info
    let dayRegistrationsQuery = supabase
      .from('day_registrations')
      .select(`
        id,
        RMIS_ID,
        sport_day,
        created_at,
        approved_by
      `)
      .order('created_at', { ascending: false });

    if (sportDay) {
      dayRegistrationsQuery = dayRegistrationsQuery.eq('sport_day', sportDay);
    }

    const { data: dayRegistrations, error: dayRegError } = await dayRegistrationsQuery;

    if (dayRegError) {
      console.error('Error fetching day registrations:', dayRegError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch day registrations' },
        { status: 500 }
      );
    }

    // Get all players who have day registrations
    const rmisIds = [...new Set(dayRegistrations.map(dr => dr.RMIS_ID))];

    if (rmisIds.length === 0) {
      // No registrations found
      return NextResponse.json({
        success: true,
        data: {
          events: events.map(event => ({
            ...event,
            registrations: [],
            registrationCount: 0
          })),
          summary: {
            totalRegistrations: 0,
            uniquePlayers: 0,
            byDay: {}
          }
        }
      });
    }

    // Get player info for these RMIS_IDs
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('RMIS_ID, name, club_id, clubs(club_name)')
      .in('RMIS_ID', rmisIds);

    if (playersError) {
      console.error('Error fetching players:', playersError);
    }

    // Create a player lookup map
    const playerMap = {};
    (players || []).forEach(player => {
      playerMap[player.RMIS_ID] = {
        name: player.name,
        club_id: player.club_id,
        club_name: player.clubs?.club_name || 'Unknown Club'
      };
    });

    // Get sport registrations to match players with events
    const { data: registrations, error: regError } = await supabase
      .from('registrations')
      .select('id, RMIS_ID, sport_id, club_id, main_player')
      .in('RMIS_ID', rmisIds);

    if (regError) {
      console.error('Error fetching registrations:', regError);
    }

    // Create a map of RMIS_ID -> sport_id -> registration
    const registrationMap = {};
    (registrations || []).forEach(reg => {
      if (!registrationMap[reg.RMIS_ID]) {
        registrationMap[reg.RMIS_ID] = {};
      }
      registrationMap[reg.RMIS_ID][reg.sport_id] = reg;
    });

    // Build event-wise registrations
    const eventRegistrations = events.map(event => {
      const eventDayRegistrations = dayRegistrations.filter(dr => {
        // Match day registrations to events by checking if:
        // 1. The day registration is for this event's sport_day
        // 2. The player is registered for this specific event
        if (dr.sport_day !== event.sport_day) return false;
        
        const playerRegs = registrationMap[dr.RMIS_ID];
        return playerRegs && playerRegs[event.sport_id];
      });

      const registrationsWithDetails = eventDayRegistrations.map(dr => {
        const playerInfo = playerMap[dr.RMIS_ID] || {};
        const sportReg = registrationMap[dr.RMIS_ID]?.[event.sport_id];
        
        return {
          id: dr.id,
          RMIS_ID: dr.RMIS_ID,
          name: playerInfo.name || 'Unknown',
          club_name: playerInfo.club_name || 'Unknown Club',
          club_id: playerInfo.club_id,
          main_player: sportReg?.main_player ?? true,
          checked_in_at: dr.created_at,
          approved_by: dr.approved_by
        };
      });

      return {
        ...event,
        registrations: registrationsWithDetails,
        registrationCount: registrationsWithDetails.length
      };
    });

    // Build summary stats
    const byDay = {};
    dayRegistrations.forEach(dr => {
      if (!byDay[dr.sport_day]) {
        byDay[dr.sport_day] = 0;
      }
      byDay[dr.sport_day]++;
    });

    return NextResponse.json({
      success: true,
      data: {
        events: eventRegistrations,
        summary: {
          totalRegistrations: dayRegistrations.length,
          uniquePlayers: rmisIds.length,
          byDay
        }
      }
    });

  } catch (error) {
    console.error('Error in day registrations API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
