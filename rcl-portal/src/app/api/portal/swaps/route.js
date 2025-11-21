import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const MIXED_GENDER_VALUES = new Set(['open', 'mixed', 'mix', 'any']);

// Check if a player's gender is compatible with a sport's gender requirement
// For boy sports (m/male): only male players allowed
// For girl sports (f/female): only female players allowed
// For mixed/open sports: both male and female players allowed
const isGenderCompatible = (playerGender, sportGender) => {
  if (!sportGender) return true; // no restriction
  
  const normSportGender = sportGender.toLowerCase();
  const normPlayerGender = playerGender?.toLowerCase();
  
  // If sport is mixed/open, any gender can participate
  if (MIXED_GENDER_VALUES.has(normSportGender)) return true;
  
  // If player has no gender, deny access to restricted sports
  if (!normPlayerGender) return false;
  
  // Boy sports require male players
  if (normSportGender === 'm' || normSportGender === 'male') {
    return normPlayerGender === 'm' || normPlayerGender === 'male';
  }
  
  // Girl sports require female players
  if (normSportGender === 'f' || normSportGender === 'female') {
    return normPlayerGender === 'f' || normPlayerGender === 'female';
  }
  
  return false;
};

const parseDescription = (value) => {
  if (!value) {
    return { reason: '' };
  }

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        reason: parsed.reason || '',
      };
    }
  } catch (error) {
    // fall through to treat as plain text
  }

  return { reason: value };
};

const serializeDescription = (reason) => JSON.stringify({ reason });

const mapRegistrationsBySport = (registrations = []) => {
  const sportsIndex = new Map();
  const sportRegistrations = {};
  const playerRegistrationMap = {};

  registrations.forEach((record) => {
    if (!record) return;

    const sport = record.events;
    const player = record.players;

    if (sport) {
      if (!sportsIndex.has(sport.sport_id)) {
        sportsIndex.set(sport.sport_id, {
          sport_id: sport.sport_id,
          sport_name: sport.sport_name,
          sport_type: sport.sport_type,
          gender_type: sport.gender_type,
          sport_day: sport.sport_day,
          category: sport.category,
          max_count: sport.max_count,
        });
      }

      if (!sportRegistrations[sport.sport_id]) {
        sportRegistrations[sport.sport_id] = [];
      }

      sportRegistrations[sport.sport_id].push({
        id: record.id,
        sport_id: record.sport_id,
        club_id: record.club_id,
        RMIS_ID: record.RMIS_ID,
        main_player: record.main_player,
        created_at: record.created_at,
        player: player
          ? {
              RMIS_ID: player.RMIS_ID,
              name: player.name,
              status: player.status,
              RI_ID: player.RI_ID,
              gender: player.gender,
            }
          : null,
      });
    }

    if (player) {
      if (!playerRegistrationMap[player.RMIS_ID]) {
        playerRegistrationMap[player.RMIS_ID] = [];
      }

      if (sport) {
        playerRegistrationMap[player.RMIS_ID].push({
          registration_id: record.id,
          sport_id: sport.sport_id,
          sport_name: sport.sport_name,
          sport_type: sport.sport_type,
          sport_day: sport.sport_day,
          main_player: record.main_player,
        });
      }
    }
  });

  const sports = Array.from(sportsIndex.values()).sort((a, b) =>
    a.sport_name.localeCompare(b.sport_name)
  );

  Object.values(sportRegistrations).forEach((registrationsList) => {
    registrationsList.sort((a, b) => {
      if (a.main_player === b.main_player) {
        return (a.player?.name || '').localeCompare(b.player?.name || '');
      }
      return a.main_player ? -1 : 1;
    });
  });

  return { sports, sportRegistrations, playerRegistrationMap };
};

const buildRequestsPayload = (requests = [], registrationLookup = new Map(), sportsLookup = new Map()) =>
  requests.map((request) => {
    const playerOne = registrationLookup.get(request.player1_registrations_id) || null;
    const playerTwo = registrationLookup.get(request.player2_registrations_id) || null;
    const sportOne = sportsLookup.get(request.sport1_id) || playerOne?.events || null;
    const sportTwo = sportsLookup.get(request.sport2_id) || playerTwo?.events || null;
    const { reason } = parseDescription(request.description);

    return {
      id: request.id,
      club_id: request.club_id,
      player1_registrations_id: request.player1_registrations_id,
      player2_registrations_id: request.player2_registrations_id,
      sport1_id: request.sport1_id,
      sport2_id: request.sport2_id,
      requested_by: request.requested_by,
      created_at: request.created_at,
      approved_by: request.approved_by,
      approved_at: request.approved_at,
      status: request.status,
      reason,
      player_one: playerOne
        ? {
            registration_id: playerOne.id,
            RMIS_ID: playerOne.RMIS_ID,
            name: playerOne.players?.name || null,
            gender: playerOne.players?.gender || null,
          }
        : null,
      player_two: playerTwo
        ? {
            registration_id: playerTwo.id,
            RMIS_ID: playerTwo.RMIS_ID,
            name: playerTwo.players?.name || null,
            gender: playerTwo.players?.gender || null,
          }
        : null,
      sport_one: sportOne
        ? {
            sport_id: sportOne.sport_id,
            sport_name: sportOne.sport_name,
            sport_type: sportOne.sport_type,
            gender_type: sportOne.gender_type,
            sport_day: sportOne.sport_day,
          }
        : null,
      sport_two: sportTwo
        ? {
            sport_id: sportTwo.sport_id,
            sport_name: sportTwo.sport_name,
            sport_type: sportTwo.sport_type,
            gender_type: sportTwo.gender_type,
            sport_day: sportTwo.sport_day,
          }
        : null,
    };
  });

const fetchPlayerSchedule = async (RMIS_ID) => {
  if (!RMIS_ID) return [];

  const { data, error } = await supabase
    .from('registrations')
    .select(
      `id,
       sport_id,
       events:sport_id(
         sport_id,
         sport_day
       )`
    )
    .eq('RMIS_ID', RMIS_ID);

  if (error) {
    console.error('Failed to fetch player schedule:', error);
    return [];
  }

  return Array.isArray(data) ? data : [];
};

// Check if player has a sport on the target day, excluding specific registration IDs
// This is used to prevent day conflicts when swapping
const hasDayConflict = (schedule = [], targetDay, excludeIds = []) => {
  if (!targetDay) return false;
  
  return schedule.some(
    (entry) =>
      entry?.events?.sport_day === targetDay && 
      !excludeIds.includes(entry.sport_id) // Exclude the sports being swapped
  );
};

const ensureNoPendingSwap = async (registrationIds = []) => {
  if (!registrationIds.length) return false;

  const orFilters = registrationIds
    .filter(Boolean)
    .map((id) => `player1_registrations_id.eq.${id},player2_registrations_id.eq.${id}`)
    .join(',');

  if (!orFilters) return false;

  const { data, error } = await supabase
    .from('swap_requests')
    .select('id')
    .or(orFilters)
    .is('status', null)
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Failed to check pending swap:', error);
    throw new Error('Failed to validate existing swap requests');
  }

  return Boolean(data);
};

const fetchDestinationSport = async (sportId) => {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('sport_id', sportId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch sport info:', error);
    return null;
  }

  return data;
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clubId = searchParams.get('club_id');

    if (!clubId) {
      return NextResponse.json(
        { success: false, error: 'club_id is required' },
        { status: 400 }
      );
    }

    const { data: registrationsData, error: registrationsError } = await supabase
      .from('registrations')
      .select(
        `id,
         sport_id,
         club_id,
         RMIS_ID,
         main_player,
         created_at,
         players:RMIS_ID(
           RMIS_ID,
           name,
           status,
           RI_ID,
           gender
         ),
         events:sport_id(
           sport_id,
           sport_name,
           sport_type,
           gender_type,
           sport_day,
           category,
           max_count
         )`
      )
      .eq('club_id', clubId);

    if (registrationsError) {
      console.error('Error fetching registrations for swaps:', registrationsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch club registrations' },
        { status: 500 }
      );
    }

    const registrationLookup = new Map();
    const sportsLookup = new Map();
    registrationsData?.forEach((row) => {
      registrationLookup.set(row.id, row);
      if (row.events) {
        sportsLookup.set(row.events.sport_id, row.events);
      }
    });

    const { sports, sportRegistrations, playerRegistrationMap } =
      mapRegistrationsBySport(registrationsData);

    const { data: requestsData, error: requestsError } = await supabase
      .from('swap_requests')
      .select(
        `id,
         club_id,
         player1_registrations_id,
         player2_registrations_id,
         sport1_id,
         sport2_id,
         requested_by,
         created_at,
         approved_by,
         approved_at,
         status,
         description`
      )
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });

    if (requestsError) {
      console.error('Error fetching swap requests:', requestsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch swap requests' },
        { status: 500 }
      );
    }

    const requests = buildRequestsPayload(
      requestsData || [],
      registrationLookup,
      sportsLookup
    );

    return NextResponse.json({
      success: true,
      data: {
        sports,
        sportRegistrations,
        playerRegistrationMap,
        requests,
      },
    });
  } catch (error) {
    console.error('Unexpected error in swaps GET:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      club_id,
      player1_registrations_id,
      player2_registrations_id,
      sport2_id,
      reason,
      requested_by,
    } = body || {};

    if (!club_id || !player1_registrations_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { success: false, error: 'Reason is required' },
        { status: 400 }
      );
    }

    const cleanedReason = reason.trim();
    // Supporting links are no longer required; only a plain reason is stored.

    const isPlayerSwap = Boolean(player2_registrations_id);
    const isSingleMove = Boolean(sport2_id) && !player2_registrations_id;

    if (!isPlayerSwap && !isSingleMove) {
      return NextResponse.json(
        { success: false, error: 'Select a swap type and required fields' },
        { status: 400 }
      );
    }

    if (isPlayerSwap && player1_registrations_id === player2_registrations_id) {
      return NextResponse.json(
        { success: false, error: 'Cannot swap the same registration' },
        { status: 400 }
      );
    }

    const { data: playerOneReg, error: playerOneError } = await supabase
      .from('registrations')
      .select(
        `id,
         sport_id,
         club_id,
         RMIS_ID,
         main_player,
         players:RMIS_ID(
           RMIS_ID,
           name,
           gender
         ),
         events:sport_id(
           sport_id,
           sport_name,
           gender_type,
           sport_day,
           max_count
         )`
      )
      .eq('id', player1_registrations_id)
      .single();

    if (playerOneError || !playerOneReg) {
      return NextResponse.json(
        { success: false, error: 'Primary registration not found' },
        { status: 404 }
      );
    }

    if (Number(playerOneReg.club_id) !== Number(club_id)) {
      return NextResponse.json(
        { success: false, error: 'Registration does not belong to club' },
        { status: 403 }
      );
    }

    const pendingExists = await ensureNoPendingSwap([
      player1_registrations_id,
      player2_registrations_id,
    ]);

    if (pendingExists) {
      return NextResponse.json(
        { success: false, error: 'A pending swap already exists for selected player(s)' },
        { status: 409 }
      );
    }

    const playerOneSchedule = await fetchPlayerSchedule(playerOneReg.RMIS_ID);

    let insertPayload = {
      club_id,
      player1_registrations_id,
      sport1_id: playerOneReg.sport_id,
      requested_by: requested_by || null,
      description: serializeDescription(cleanedReason),
    };

    if (isPlayerSwap) {
      const { data: playerTwoReg, error: playerTwoError } = await supabase
        .from('registrations')
        .select(
          `id,
           sport_id,
           club_id,
           RMIS_ID,
           main_player,
           players:RMIS_ID(
             RMIS_ID,
             name,
             gender
           ),
           events:sport_id(
             sport_id,
             sport_name,
             gender_type,
             sport_day
           )`
        )
        .eq('id', player2_registrations_id)
        .single();

      if (playerTwoError || !playerTwoReg) {
        return NextResponse.json(
          { success: false, error: 'Second registration not found' },
          { status: 404 }
        );
      }

      if (Number(playerTwoReg.club_id) !== Number(club_id)) {
        return NextResponse.json(
          { success: false, error: 'Second registration does not belong to club' },
          { status: 403 }
        );
      }

      const playerTwoSchedule = await fetchPlayerSchedule(playerTwoReg.RMIS_ID);

      // Gender validation: Check if players can participate in target sports
      if (
        !isGenderCompatible(
          playerOneReg.players?.gender,
          playerTwoReg.events?.gender_type
        )
      ) {
        return NextResponse.json(
          { success: false, error: 'Player one gender does not match second sport requirements' },
          { status: 400 }
        );
      }

      if (
        !isGenderCompatible(
          playerTwoReg.players?.gender,
          playerOneReg.events?.gender_type
        )
      ) {
        return NextResponse.json(
          { success: false, error: 'Player two gender does not match first sport requirements' },
          { status: 400 }
        );
      }

      // Day conflict validation: Check if players have other sports on swap days
      // Exclude the two sports being swapped (sport1_id and sport2_id)
      if (
        hasDayConflict(
          playerOneSchedule,
          playerTwoReg.events?.sport_day,
          [playerOneReg.sport_id, playerTwoReg.sport_id]
        )
      ) {
        return NextResponse.json(
          { success: false, error: 'Player one already has another sport registered on the second sport day' },
          { status: 400 }
        );
      }

      if (
        hasDayConflict(
          playerTwoSchedule,
          playerOneReg.events?.sport_day,
          [playerOneReg.sport_id, playerTwoReg.sport_id]
        )
      ) {
        return NextResponse.json(
          { success: false, error: 'Player two already has another sport registered on the first sport day' },
          { status: 400 }
        );
      }

      insertPayload = {
        ...insertPayload,
        player2_registrations_id,
        sport2_id: playerTwoReg.sport_id,
      };
    } else {
      // Single move (player to free slot)
      const destinationSportId = Number(sport2_id);
      const destinationSport = await fetchDestinationSport(destinationSportId);

      if (!destinationSport) {
        return NextResponse.json(
          { success: false, error: 'Destination sport not found' },
          { status: 404 }
        );
      }

      // Gender validation: Check if player can participate in destination sport
      if (
        !isGenderCompatible(
          playerOneReg.players?.gender,
          destinationSport.gender_type
        )
      ) {
        return NextResponse.json(
          { success: false, error: 'Player gender does not match destination sport requirements' },
          { status: 400 }
        );
      }

      // Day conflict validation: Check if player has other sports on destination day
      // Exclude the current sport (sport1_id) and destination sport (sport2_id)
      if (
        hasDayConflict(
          playerOneSchedule,
          destinationSport.sport_day,
          [playerOneReg.sport_id, destinationSportId]
        )
      ) {
        return NextResponse.json(
          { success: false, error: 'Player already has another sport registered on the destination sport day' },
          { status: 400 }
        );
      }

      // Note: Capacity check is intentionally skipped for swap requests
      // The player is leaving their current sport, so this is a swap, not adding a new player
      // Capacity validation should be done during swap approval/execution if needed

      insertPayload = {
        ...insertPayload,
        sport2_id: destinationSportId,
      };
    }

    const { data, error: insertError } = await supabase
      .from('swap_requests')
      .insert(insertPayload)
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to create swap request:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to create swap request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Swap request submitted',
    });
  } catch (error) {
    console.error('Unexpected error in swaps POST:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
