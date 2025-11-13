import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

// Fetches replacement requests with pagination, search, and filtering
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get('tab') || 'pending';
  const page = parseInt(searchParams.get('page')) || 1;
  const limit = parseInt(searchParams.get('limit')) || 10;
  const search = searchParams.get('search') || '';

  try {
    const offset = (page - 1) * limit;

    let query = supabase
      .from('replacement_requests')
      .select(
        `
        *,
        events:sport_id (sport_id, sport_name, sport_type, gender_type, sport_day, category),
        clubs:club_id (club_id, club_name),
        replacement_players:replacement_id (replacement_id, name, status, ri_number, gender, nic, birthdate)
      `,
        { count: 'exact' }
      );

    // Filter by approval status
    if (tab === 'pending') {
      query = query.is('status', null);
    } else if (tab === 'approved') {
      query = query.eq('status', true);
    } else if (tab === 'rejected') {
      query = query.eq('status', false);
    }

    // Apply club name or sport name search
    if (search.trim()) {
      // Note: For complex search across joins, we'll filter in memory
      // For production, consider full-text search or separate queries
    }

    // Order by date (latest first) and apply pagination
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: requests, error, count } = await query;

    if (error) {
      console.error('Error fetching replacement requests:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch replacement requests' }, { status: 500 });
    }

    // Fetch original players from DBMID
    const clubIds = [...new Set(requests?.map((r) => r.club_id).filter(Boolean))];
    const originalPlayerIds = [...new Set(requests?.map((r) => r.original_player_rmis_id).filter(Boolean))];
    let originalPlayersMap = {};

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

    // Transform and filter by search term if needed
    let transformedRequests = requests?.map((request) => ({
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
      club_name: request.clubs?.club_name || 'Unknown Club',
      sport: request.events
        ? {
            sport_id: request.events.sport_id,
            sport_name: request.events.sport_name,
            sport_type: request.events.sport_type,
            gender_type: request.events.gender_type,
            sport_day: request.events.sport_day,
            category: request.events.category,
          }
        : null,
      replacement_player: request.replacement_players
        ? {
            RMIS_ID: request.replacement_players.replacement_id,
            name: request.replacement_players.name,
            status: request.replacement_players.status,
            ri_number: request.replacement_players.ri_number,
            gender: request.replacement_players.gender,
            nic: request.replacement_players.nic,
            birthdate: request.replacement_players.birthdate,
          }
        : null,
      original_player: originalPlayersMap[request.original_player_rmis_id]
        ? {
            RMIS_ID: originalPlayersMap[request.original_player_rmis_id].RMIS_ID,
            name: originalPlayersMap[request.original_player_rmis_id].name,
            status: originalPlayersMap[request.original_player_rmis_id].status,
            RI_ID: originalPlayersMap[request.original_player_rmis_id].RI_ID,
            gender: originalPlayersMap[request.original_player_rmis_id].gender,
          }
        : null,
    })) || [];

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.trim().toLowerCase();
      transformedRequests = transformedRequests.filter(
        (req) =>
          req.club_name?.toLowerCase().includes(searchLower) ||
          req.sport?.sport_name?.toLowerCase().includes(searchLower) ||
          req.replacement_player?.name?.toLowerCase().includes(searchLower) ||
          req.original_player?.name?.toLowerCase().includes(searchLower)
      );
    }

    const filteredCount = search.trim() ? transformedRequests.length : count;
    const totalPages = Math.ceil((filteredCount || 0) / limit);

    return NextResponse.json({
      success: true,
      requests: transformedRequests,
      totalPages,
      totalCount: filteredCount || 0,
      currentPage: page,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
