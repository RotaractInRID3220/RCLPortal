import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

// Fetches a single replacement request by ID
export async function GET(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Request ID is required' }, { status: 400 });
    }

    const { data: requestData, error } = await supabase
      .from('replacement_requests')
      .select(
        `
        *,
        events:sport_id (sport_id, sport_name, sport_type, gender_type, sport_day, category),
        clubs:club_id (club_id, club_name),
        replacement_players:replacement_id (replacement_id, name, status, ri_number, gender, nic, birthdate),
        registrations:registrations_id (id, main_player)
      `
      )
      .eq('id', id)
      .single();

    if (error || !requestData) {
      console.error('Error fetching replacement request:', error);
      return NextResponse.json({ success: false, error: 'Replacement request not found' }, { status: 404 });
    }

    // Fetch original player from DBMID
    let originalPlayer = null;
    if (requestData.original_player_rmis_id && requestData.club_id) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/council?clubID=${requestData.club_id}`,
          {
            headers: {
              'x-api-key': process.env.NEXT_PUBLIC_DBMID_API_KEY,
            },
          }
        );
        const data = await response.json();
        
        if (data.success && Array.isArray(data.members)) {
          const member = data.members.find((m) => m.membership_id === requestData.original_player_rmis_id);
          if (member) {
            originalPlayer = {
              RMIS_ID: member.membership_id,
              name: member.card_name || member.name,
              status: member.status,
              RI_ID: member.ri_number,
              gender: member.gender,
            };
          }
        }
      } catch (error) {
        console.error('Error fetching original player from DBMID:', error);
      }
    }

    // Transform the data
    const transformedRequest = {
      id: requestData.id,
      sport_id: requestData.sport_id,
      registrations_id: requestData.registrations_id,
      replacement_id: requestData.replacement_id,
      club_id: requestData.club_id,
      reason: requestData.reason,
      supporting_link: requestData.supporting_link,
      ri_number: requestData.ri_number,
      status: requestData.status,
      requested_by: requestData.requested_by,
      created_at: requestData.created_at,
      approved_at: requestData.approved_at,
      approved_by: requestData.approved_by,
      club_name: requestData.clubs?.club_name || 'Unknown Club',
      sport: requestData.events
        ? {
            sport_id: requestData.events.sport_id,
            sport_name: requestData.events.sport_name,
            sport_type: requestData.events.sport_type,
            gender_type: requestData.events.gender_type,
            sport_day: requestData.events.sport_day,
            category: requestData.events.category,
          }
        : null,
      replacement_player: requestData.replacement_players
        ? {
            RMIS_ID: requestData.replacement_players.replacement_id,
            name: requestData.replacement_players.name,
            status: requestData.replacement_players.status,
            ri_number: requestData.replacement_players.ri_number,
            gender: requestData.replacement_players.gender,
            nic: requestData.replacement_players.nic,
            birthdate: requestData.replacement_players.birthdate,
          }
        : null,
      original_player: originalPlayer
        ? {
            RMIS_ID: originalPlayer.RMIS_ID,
            name: originalPlayer.name,
            status: originalPlayer.status,
            RI_ID: originalPlayer.RI_ID,
            gender: originalPlayer.gender,
            main_player: requestData.registrations?.main_player,
          }
        : null,
    };

    return NextResponse.json({
      success: true,
      request: transformedRequest,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
