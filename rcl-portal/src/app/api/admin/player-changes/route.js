import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

// Helper: Check gender compatibility
const MIXED_GENDER_VALUES = new Set(['open', 'mixed', 'mix', 'any']);

const isGenderCompatible = (playerGender, sportGender) => {
  if (!sportGender) return true;
  
  const normSportGender = sportGender.toLowerCase();
  const normPlayerGender = playerGender?.toLowerCase();
  
  if (MIXED_GENDER_VALUES.has(normSportGender)) return true;
  if (!normPlayerGender) return false;
  
  if (normSportGender === 'm' || normSportGender === 'male') {
    return normPlayerGender === 'm' || normPlayerGender === 'male';
  }
  
  if (normSportGender === 'f' || normSportGender === 'female') {
    return normPlayerGender === 'f' || normPlayerGender === 'female';
  }
  
  return false;
};

const serializeDescription = (reason) => JSON.stringify({ reason });

// GET: Fetch context data for admin player changes
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

    // Fetch registrations for the specified club
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
      console.error('Error fetching registrations:', registrationsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch club registrations' },
        { status: 500 }
      );
    }

    // Build sports and registration maps
    const sportsIndex = new Map();
    const sportRegistrations = {};
    const playerRegistrationMap = {};

    registrationsData?.forEach((record) => {
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

    // Sort players within each sport
    Object.values(sportRegistrations).forEach((registrationsList) => {
      registrationsList.sort((a, b) => {
        if (a.main_player === b.main_player) {
          return (a.player?.name || '').localeCompare(b.player?.name || '');
        }
        return a.main_player ? -1 : 1;
      });
    });

    // Fetch all sports (for destination options in swaps)
    const { data: allSports, error: allSportsError } = await supabase
      .from('events')
      .select('sport_id, sport_name, sport_type, gender_type, sport_day, category, max_count')
      .order('sport_name', { ascending: true });

    if (allSportsError) {
      console.error('Error fetching all sports:', allSportsError);
    }

    return NextResponse.json({
      success: true,
      data: {
        sports,
        sportRegistrations,
        playerRegistrationMap,
        allSports: allSports || [],
      },
    });
  } catch (error) {
    console.error('Unexpected error in admin player-changes GET:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Execute admin direct replacement or swap
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, admin_id, admin_name, ...payload } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action type is required' },
        { status: 400 }
      );
    }

    if (!admin_id) {
      return NextResponse.json(
        { success: false, error: 'Admin ID is required' },
        { status: 400 }
      );
    }

    if (action === 'replacement') {
      return handleReplacement(payload, admin_id, admin_name);
    } else if (action === 'swap') {
      return handleSwap(payload, admin_id, admin_name);
    } else if (action === 'move') {
      return handleMove(payload, admin_id, admin_name);
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action type. Use: replacement, swap, or move' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Unexpected error in admin player-changes POST:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle direct replacement (admin bypasses approval)
async function handleReplacement(payload, adminId, adminName) {
  const {
    club_id,
    sport_id,
    registrations_id,
    replacement_member,
    reason,
  } = payload;

  if (!club_id || !sport_id || !registrations_id || !replacement_member?.membership_id) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields for replacement' },
      { status: 400 }
    );
  }

  if (!reason?.trim()) {
    return NextResponse.json(
      { success: false, error: 'Reason is required' },
      { status: 400 }
    );
  }

  const cleanedReason = reason.trim();
  const newPlayerRMIS = replacement_member.membership_id;

  // Get current player RMIS from registration
  const { data: currentRegistration, error: regFetchError } = await supabase
    .from('registrations')
    .select('RMIS_ID')
    .eq('id', registrations_id)
    .single();

  if (regFetchError || !currentRegistration?.RMIS_ID) {
    console.error('Error fetching registration:', regFetchError);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch current player information' },
      { status: 500 }
    );
  }

  // Step 1: Upsert replacement player record
  const replacementRecord = {
    replacement_id: newPlayerRMIS,
    name: replacement_member.card_name || replacement_member.name || null,
    status: replacement_member.status ?? null,
    ri_number: replacement_member.ri_number || null,
    club_id,
    gender: replacement_member.gender || null,
    nic: replacement_member.nic || null,
    birthdate: replacement_member.birthdate || null,
  };

  const { error: upsertError } = await supabase
    .from('replacement_players')
    .upsert(replacementRecord, { onConflict: 'replacement_id' });

  if (upsertError) {
    console.error('Error upserting replacement player:', upsertError);
    return NextResponse.json(
      { success: false, error: 'Failed to store replacement player' },
      { status: 500 }
    );
  }

  // Step 2: Check if the new player exists in players table
  const { data: existingPlayer, error: playerCheckError } = await supabase
    .from('players')
    .select('RMIS_ID')
    .eq('RMIS_ID', newPlayerRMIS)
    .maybeSingle();

  if (playerCheckError) {
    console.error('Error checking player existence:', playerCheckError);
    return NextResponse.json(
      { success: false, error: 'Failed to verify player record' },
      { status: 500 }
    );
  }

  // Step 3: If player doesn't exist, create a new record
  if (!existingPlayer) {
    const { error: insertPlayerError } = await supabase.from('players').insert({
      RMIS_ID: newPlayerRMIS,
      name: replacement_member.card_name || replacement_member.name || null,
      club_id: club_id,
      RI_ID: replacement_member.ri_number || null,
      NIC: replacement_member.nic || null,
      birthdate: replacement_member.birthdate || null,
      gender: replacement_member.gender,
      status: replacement_member.status,
      registered_at: new Date().toISOString(),
    });

    if (insertPlayerError) {
      console.error('Error creating player record:', insertPlayerError);
      return NextResponse.json(
        { success: false, error: 'Failed to create player record' },
        { status: 500 }
      );
    }
  }

  // Step 4: Update the registration record with the new player RMIS_ID
  const { error: updateRegistrationError } = await supabase
    .from('registrations')
    .update({
      RMIS_ID: newPlayerRMIS,
    })
    .eq('id', registrations_id);

  if (updateRegistrationError) {
    console.error('Error updating registration:', updateRegistrationError);
    return NextResponse.json(
      { success: false, error: 'Failed to update registration' },
      { status: 500 }
    );
  }

  // Step 5: Create a replacement request record with auto-approval
  const now = new Date().toISOString();
  const requestPayload = {
    sport_id,
    registrations_id,
    original_player_rmis_id: currentRegistration.RMIS_ID,
    replacement_id: newPlayerRMIS,
    club_id,
    reason: cleanedReason,
    supporting_link: null,
    ri_number: replacement_member.ri_number || null,
    requested_by: adminId,
    status: true, // Auto-approved
    approved_at: now,
    approved_by: adminName || adminId,
  };

  const { data: insertedRequest, error: insertError } = await supabase
    .from('replacement_requests')
    .insert(requestPayload)
    .select()
    .single();

  if (insertError) {
    console.error('Error creating replacement request:', insertError);
    return NextResponse.json(
      { success: false, error: 'Failed to log replacement request' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Replacement completed and approved by admin',
    data: insertedRequest,
  });
}

// Handle direct swap (player-to-player swap, admin bypasses approval)
async function handleSwap(payload, adminId, adminName) {
  const {
    club_id,
    player1_registrations_id,
    player2_registrations_id,
    reason,
  } = payload;

  if (!club_id || !player1_registrations_id || !player2_registrations_id) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields for swap' },
      { status: 400 }
    );
  }

  if (!reason?.trim()) {
    return NextResponse.json(
      { success: false, error: 'Reason is required' },
      { status: 400 }
    );
  }

  if (player1_registrations_id === player2_registrations_id) {
    return NextResponse.json(
      { success: false, error: 'Cannot swap the same registration' },
      { status: 400 }
    );
  }

  const cleanedReason = reason.trim();

  // Fetch both registrations
  const { data: playerOneReg, error: playerOneError } = await supabase
    .from('registrations')
    .select(
      `id,
       sport_id,
       club_id,
       RMIS_ID,
       main_player,
       players:RMIS_ID(RMIS_ID, name, gender),
       events:sport_id(sport_id, sport_name, gender_type, sport_day)`
    )
    .eq('id', player1_registrations_id)
    .single();

  if (playerOneError || !playerOneReg) {
    return NextResponse.json(
      { success: false, error: 'Player 1 registration not found' },
      { status: 404 }
    );
  }

  const { data: playerTwoReg, error: playerTwoError } = await supabase
    .from('registrations')
    .select(
      `id,
       sport_id,
       club_id,
       RMIS_ID,
       main_player,
       players:RMIS_ID(RMIS_ID, name, gender),
       events:sport_id(sport_id, sport_name, gender_type, sport_day)`
    )
    .eq('id', player2_registrations_id)
    .single();

  if (playerTwoError || !playerTwoReg) {
    return NextResponse.json(
      { success: false, error: 'Player 2 registration not found' },
      { status: 404 }
    );
  }

  // Validate clubs match
  if (Number(playerOneReg.club_id) !== Number(club_id) || Number(playerTwoReg.club_id) !== Number(club_id)) {
    return NextResponse.json(
      { success: false, error: 'Both registrations must belong to the same club' },
      { status: 403 }
    );
  }

  // Gender validation
  if (!isGenderCompatible(playerOneReg.players?.gender, playerTwoReg.events?.gender_type)) {
    return NextResponse.json(
      { success: false, error: 'Player 1 gender does not match sport 2 requirements' },
      { status: 400 }
    );
  }

  if (!isGenderCompatible(playerTwoReg.players?.gender, playerOneReg.events?.gender_type)) {
    return NextResponse.json(
      { success: false, error: 'Player 2 gender does not match sport 1 requirements' },
      { status: 400 }
    );
  }

  // Execute the swap
  const { error: update1 } = await supabase
    .from('registrations')
    .update({ sport_id: playerTwoReg.sport_id })
    .eq('id', player1_registrations_id);

  if (update1) {
    console.error('Error updating player 1:', update1);
    return NextResponse.json(
      { success: false, error: 'Failed to update player 1 registration' },
      { status: 500 }
    );
  }

  const { error: update2 } = await supabase
    .from('registrations')
    .update({ sport_id: playerOneReg.sport_id })
    .eq('id', player2_registrations_id);

  if (update2) {
    console.error('Error updating player 2:', update2);
    return NextResponse.json(
      { success: false, error: 'Failed to update player 2 registration' },
      { status: 500 }
    );
  }

  // Log the swap request with auto-approval
  const now = new Date().toISOString();
  const insertPayload = {
    club_id,
    player1_registrations_id,
    player2_registrations_id,
    sport1_id: playerOneReg.sport_id,
    sport2_id: playerTwoReg.sport_id,
    requested_by: adminId,
    description: serializeDescription(cleanedReason),
    status: true,
    approved_by: adminName || adminId,
    approved_at: now,
  };

  const { data, error: insertError } = await supabase
    .from('swap_requests')
    .insert(insertPayload)
    .select('id')
    .single();

  if (insertError) {
    console.error('Failed to log swap request:', insertError);
    // Swap already completed, just log error
  }

  return NextResponse.json({
    success: true,
    message: 'Player swap completed and approved by admin',
    data: data || { id: null },
  });
}

// Handle direct move (single player to new sport, admin bypasses approval)
async function handleMove(payload, adminId, adminName) {
  const {
    club_id,
    player1_registrations_id,
    sport2_id,
    reason,
  } = payload;

  if (!club_id || !player1_registrations_id || !sport2_id) {
    return NextResponse.json(
      { success: false, error: 'Missing required fields for move' },
      { status: 400 }
    );
  }

  if (!reason?.trim()) {
    return NextResponse.json(
      { success: false, error: 'Reason is required' },
      { status: 400 }
    );
  }

  const cleanedReason = reason.trim();

  // Fetch player registration
  const { data: playerReg, error: playerError } = await supabase
    .from('registrations')
    .select(
      `id,
       sport_id,
       club_id,
       RMIS_ID,
       main_player,
       players:RMIS_ID(RMIS_ID, name, gender),
       events:sport_id(sport_id, sport_name, gender_type, sport_day)`
    )
    .eq('id', player1_registrations_id)
    .single();

  if (playerError || !playerReg) {
    return NextResponse.json(
      { success: false, error: 'Player registration not found' },
      { status: 404 }
    );
  }

  if (Number(playerReg.club_id) !== Number(club_id)) {
    return NextResponse.json(
      { success: false, error: 'Registration does not belong to club' },
      { status: 403 }
    );
  }

  // Fetch destination sport
  const { data: destinationSport, error: sportError } = await supabase
    .from('events')
    .select('sport_id, sport_name, gender_type, sport_day')
    .eq('sport_id', sport2_id)
    .maybeSingle();

  if (sportError || !destinationSport) {
    return NextResponse.json(
      { success: false, error: 'Destination sport not found' },
      { status: 404 }
    );
  }

  // Gender validation
  if (!isGenderCompatible(playerReg.players?.gender, destinationSport.gender_type)) {
    return NextResponse.json(
      { success: false, error: 'Player gender does not match destination sport requirements' },
      { status: 400 }
    );
  }

  // Execute the move
  const { error: updateError } = await supabase
    .from('registrations')
    .update({ sport_id: sport2_id })
    .eq('id', player1_registrations_id);

  if (updateError) {
    console.error('Error updating registration:', updateError);
    return NextResponse.json(
      { success: false, error: 'Failed to update player registration' },
      { status: 500 }
    );
  }

  // Log the swap request with auto-approval
  const now = new Date().toISOString();
  const insertPayload = {
    club_id,
    player1_registrations_id,
    sport1_id: playerReg.sport_id,
    sport2_id,
    requested_by: adminId,
    description: serializeDescription(cleanedReason),
    status: true,
    approved_by: adminName || adminId,
    approved_at: now,
  };

  const { data, error: insertError } = await supabase
    .from('swap_requests')
    .insert(insertPayload)
    .select('id')
    .single();

  if (insertError) {
    console.error('Failed to log move request:', insertError);
    // Move already completed, just log error
  }

  return NextResponse.json({
    success: true,
    message: 'Player move completed and approved by admin',
    data: data || { id: null },
  });
}
