import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const mapRegistrationsBySport = (registrations = []) => {
  const sportsIndex = new Map();
  const sportRegistrations = {};
  const playerRegistrationMap = {};

  registrations.forEach((record) => {
    if (!record) {
      return;
    }

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
          sport_id: sport.sport_id,
          sport_type: sport.sport_type,
          sport_day: sport.sport_day,
        });
      }
    }
  });

  const sports = Array.from(sportsIndex.values()).sort((a, b) =>
    a.sport_name.localeCompare(b.sport_name)
  );

  Object.values(sportRegistrations).forEach((list) => {
    list.sort((a, b) => {
      if (a.main_player === b.main_player) {
        return (a.player?.name || '').localeCompare(b.player?.name || '');
      }
      return a.main_player ? -1 : 1;
    });
  });

  return { sports, sportRegistrations, playerRegistrationMap };
};

const buildRequestPayload = async (rawRequests = [], registrationLookup = new Map()) => {
  // Get unique club IDs and original player IDs
  const clubIds = [...new Set(rawRequests.map((r) => r.club_id).filter(Boolean))];
  const originalPlayerIds = [...new Set(rawRequests.map((r) => r.original_player_rmis_id).filter(Boolean))];
  
  let originalPlayersMap = {};

  // Fetch club members from DBMID for all clubs
  if (clubIds.length > 0 && originalPlayerIds.length > 0) {
    try {
      const membersByClub = await Promise.all(
        clubIds.map(async (clubId) => {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/council?clubID=${clubId}`,
            {
              headers: {
                'x-api-key': process.env.NEXT_PUBLIC_DBMID_API_KEY,
              },
            }
          );
          const data = await response.json();
          return data.success && Array.isArray(data.members) ? data.members : [];
        })
      );

      // Flatten all members and filter for original players
      const allMembers = membersByClub.flat();
      originalPlayersMap = allMembers.reduce((acc, member) => {
        if (originalPlayerIds.includes(member.membership_id)) {
          acc[member.membership_id] = {
            RMIS_ID: member.membership_id,
            name: member.card_name || member.name,
            status: member.status,
            RI_ID: member.ri_number,
            gender: member.gender,
          };
        }
        return acc;
      }, {});
    } catch (error) {
      console.error('Error fetching original players from DBMID:', error);
    }
  }

  return rawRequests.map((request) => {
    const registration = registrationLookup.get(request.registrations_id);
    const sportDetails = registration?.events || null;
    const originalPlayer = originalPlayersMap[request.original_player_rmis_id] || null;

    // Log missing player data for debugging
    if (request.original_player_rmis_id && !originalPlayer) {
      console.warn(`Original player not found in DBMID: ${request.original_player_rmis_id} for request ${request.id}`);
    }

    return {
      id: request.id,
      sport_id: request.sport_id,
      registrations_id: request.registrations_id,
      replacement_id: request.replacement_id,
      club_id: request.club_id,
      reason: request.reason,
      supporting_link: request.supporting_link,
      ri_number: request.ri_number,
      status: request.status,
      requested_by: request.requested_by,
      created_at: request.created_at,
      approved_at: request.approved_at,
      approved_by: request.approved_by,
      original_player: originalPlayer
        ? {
            RMIS_ID: originalPlayer.RMIS_ID,
            name: originalPlayer.name,
            status: originalPlayer.status,
            RI_ID: originalPlayer.RI_ID,
            gender: originalPlayer.gender,
            main_player: registration?.main_player ?? null,
          }
        : null,
      replacement_player: request.replacement_players
        ? {
            RMIS_ID: request.replacement_players.replacement_id,
            name: request.replacement_players.name,
            status: request.replacement_players.status,
            ri_number: request.replacement_players.ri_number,
            gender: request.replacement_players.gender,
          }
        : null,
      sport: sportDetails
        ? {
            sport_id: sportDetails.sport_id,
            sport_name: sportDetails.sport_name,
            sport_type: sportDetails.sport_type,
            gender_type: sportDetails.gender_type,
            sport_day: sportDetails.sport_day,
          }
        : null,
    };
  });
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
           category
         )`
      )
      .eq('club_id', clubId);

    if (registrationsError) {
      console.error('Error fetching registrations for replacements:', registrationsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch club registrations' },
        { status: 500 }
      );
    }

    const registrationLookup = new Map();
    registrationsData?.forEach((row) => {
      registrationLookup.set(row.id, row);
    });

    const { sports, sportRegistrations, playerRegistrationMap } = mapRegistrationsBySport(
      registrationsData
    );

    const { data: requestsData, error: requestsError } = await supabase
      .from('replacement_requests')
      .select(
        `id,
         sport_id,
         registrations_id,
         original_player_rmis_id,
         replacement_id,
         club_id,
         reason,
         supporting_link,
         ri_number,
         status,
         requested_by,
         created_at,
         approved_at,
         approved_by,
         replacement_players:replacement_id(
           replacement_id,
           name,
           status,
           ri_number,
           gender
         )`
      )
      .eq('club_id', clubId)
      .order('created_at', { ascending: false });

    if (requestsError) {
      console.error('Error fetching replacement requests:', requestsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch replacement requests' },
        { status: 500 }
      );
    }

    const requests = await buildRequestPayload(requestsData, registrationLookup);

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
    console.error('Unexpected error in replacements GET:', error);
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
      sport_id,
      registrations_id,
      replacement_member,
      reason,
      supporting_link,
      ri_number,
      requested_by,
    } = body;

    if (!club_id || !sport_id || !registrations_id || !replacement_member?.membership_id) {
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
    const cleanedLink = supporting_link?.trim() || null;

    if (cleanedLink && !cleanedLink.startsWith('https://')) {
      return NextResponse.json(
        { success: false, error: 'Supporting link must be a valid https URL' },
        { status: 400 }
      );
    }

    const requiresRiNumber =
      replacement_member.status === 1 || replacement_member.status === 3;

    const replacementRiNumber = (ri_number || replacement_member.ri_number || '').trim();

    if (requiresRiNumber && !replacementRiNumber) {
      return NextResponse.json(
        { success: false, error: 'RI number is required for general members' },
        { status: 400 }
      );
    }

    const { data: existingPending, error: existingPendingError } = await supabase
      .from('replacement_requests')
      .select('id, status')
      .eq('registrations_id', registrations_id)
      .is('status', null)
      .maybeSingle();

    if (existingPendingError) {
      console.error('Error checking existing pending requests:', existingPendingError);
      return NextResponse.json(
        { success: false, error: 'Failed to validate existing requests' },
        { status: 500 }
      );
    }

    if (existingPending) {
      return NextResponse.json(
        { success: false, error: 'A pending request already exists for this player' },
        { status: 409 }
      );
    }

    // Get the current player's RMIS_ID from the registration before creating the request
    const { data: currentRegistration, error: regFetchError } = await supabase
      .from('registrations')
      .select('RMIS_ID')
      .eq('id', registrations_id)
      .single();

    if (regFetchError || !currentRegistration?.RMIS_ID) {
      console.error('Error fetching registration RMIS_ID:', regFetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch current player information' },
        { status: 500 }
      );
    }

    const replacementRecord = {
      replacement_id: replacement_member.membership_id,
      name: replacement_member.card_name || replacement_member.name || null,
      status: replacement_member.status ?? null,
      ri_number: replacementRiNumber || null,
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

    const requestPayload = {
      sport_id,
      registrations_id,
      original_player_rmis_id: currentRegistration.RMIS_ID,
      replacement_id: replacement_member.membership_id,
      club_id,
      reason: cleanedReason,
      supporting_link: cleanedLink,
      ri_number: replacementRiNumber || null,
      requested_by: requested_by || null,
    };

    const { data: insertedRequest, error: insertError } = await supabase
      .from('replacement_requests')
      .insert(requestPayload)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating replacement request:', insertError);
      return NextResponse.json(
        { success: false, error: 'Failed to create replacement request' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: insertedRequest,
      message: 'Replacement request submitted successfully',
    });
  } catch (error) {
    console.error('Unexpected error in replacements POST:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
