import { supabase } from '../../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

/**
 * Generates a player number from registration data
 * Format: D-XX + padded registration ID (6 digits total)
 * Example: D-00 + 0032 = D-000032
 * 
 * @param {string} sportDayValue - The sport day value (e.g., 'D-00', 'D-01')
 * @param {number} registrationId - The registration ID from the database
 * @returns {string} The formatted player number
 */
const generatePlayerNumber = (sportDayValue, registrationId) => {
  // Pad the registration ID to 4 digits
  const paddedId = String(registrationId).padStart(4, '0');
  // Combine sport day prefix with padded ID
  return `${sportDayValue}${paddedId}`;
};

/**
 * Fetches all day registrations for a sport day (handles 1000 row limit)
 */
const fetchAllDayRegistrations = async (sportDay) => {
  let allDayRegs = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('day_registrations')
      .select('RMIS_ID')
      .eq('sport_day', sportDay)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching day registrations:', error);
      return new Set();
    }

    if (data && data.length > 0) {
      allDayRegs = [...allDayRegs, ...data];
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  return new Set(allDayRegs.map(dr => dr.RMIS_ID));
};

// Fetches player numbers for a specific sport day
// If no search term, returns all data for client-side filtering
// If search term provided, returns filtered and paginated data
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sportDay = searchParams.get('sportDay');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const offset = (page - 1) * limit;

    if (!sportDay) {
      return NextResponse.json(
        { success: false, error: 'Sport day is required' },
        { status: 400 }
      );
    }

    // Fetch day registrations in parallel with registrations query
    const dayRegistrationsPromise = fetchAllDayRegistrations(sportDay);

    // Build optimized query with JOINs
    let query = supabase
      .from('registrations')
      .select(`
        id,
        RMIS_ID,
        sport_id,
        main_player,
        created_at,
        players!inner(
          RMIS_ID,
          name,
          club_id,
          clubs!inner(
            club_id,
            club_name
          )
        ),
        events!inner(
          sport_id,
          sport_name,
          sport_day
        )
      `, { count: 'exact' })
      .eq('events.sport_day', sportDay);

    // Apply search filter if provided (server-side filtering for export/compatibility)
    if (search && search.trim()) {
      const searchTerm = search.trim();
      query = query.or(
        `players.name.ilike.%${searchTerm}%,RMIS_ID.ilike.%${searchTerm}%,players.clubs.club_name.ilike.%${searchTerm}%`
      );
      // Apply pagination only when searching server-side
      query = query.range(offset, offset + limit - 1);
    }

    const [{ data: registrations, error, count }, dayRegisteredSet] = await Promise.all([
      query,
      dayRegistrationsPromise
    ]);

    if (error) {
      console.error('Error fetching player numbers:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch player numbers' },
        { status: 500 }
      );
    }

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        totalCount: 0,
        totalPages: search && search.trim() ? 0 : 0,
        currentPage: page
      });
    }

    // Transform data and generate player numbers with day registration status
    const playerNumbers = registrations.map(reg => ({
      playerNumber: generatePlayerNumber(sportDay, reg.id),
      registrationId: reg.id,
      rmisId: reg.RMIS_ID,
      playerName: reg.players?.name || '-',
      clubName: reg.players?.clubs?.club_name || '-',
      clubId: reg.players?.clubs?.club_id || null,
      sportName: reg.events?.sport_name || '-',
      sportId: reg.sport_id,
      isMainPlayer: reg.main_player,
      isDayRegistered: dayRegisteredSet.has(reg.RMIS_ID)
    }));

    // Sort by club name alphabetically
    playerNumbers.sort((a, b) => 
      (a.clubName || '').localeCompare(b.clubName || '')
    );

    // If no search term, return all data (client will handle pagination)
    if (!search || !search.trim()) {
      return NextResponse.json({
        success: true,
        data: playerNumbers,
        totalCount: count || playerNumbers.length,
        totalPages: Math.ceil((count || playerNumbers.length) / limit),
        currentPage: 1, // Always return page 1 for full dataset
        isFullDataset: true
      });
    }

    // For server-side search, return paginated results
    return NextResponse.json({
      success: true,
      data: playerNumbers,
      totalCount: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
      currentPage: page,
      isFullDataset: false
    });

  } catch (error) {
    console.error('Error in player numbers endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export endpoint for fetching all players for a sport day (no pagination for export)
export async function POST(request) {
  try {
    const body = await request.json();
    const { sportDay } = body;

    if (!sportDay) {
      return NextResponse.json(
        { success: false, error: 'Sport day is required' },
        { status: 400 }
      );
    }

    // Fetch all registrations for the sport day without pagination
    // Note: Supabase doesn't support ordering by nested relations, so we sort in JS
    const { data: registrations, error } = await supabase
      .from('registrations')
      .select(`
        id,
        RMIS_ID,
        sport_id,
        main_player,
        players!inner(
          RMIS_ID,
          name,
          club_id,
          clubs!inner(
            club_id,
            club_name
          )
        ),
        events!inner(
          sport_id,
          sport_name,
          sport_day
        )
      `)
      .eq('events.sport_day', sportDay);

    if (error) {
      console.error('Error fetching export data:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch export data' },
        { status: 500 }
      );
    }

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No registrations found for this sport day'
      });
    }

    // Transform data for export
    const exportData = registrations.map(reg => ({
      playerNumber: generatePlayerNumber(sportDay, reg.id),
      rmisId: reg.RMIS_ID,
      playerName: reg.players?.name || '-',
      clubName: reg.players?.clubs?.club_name || '-',
      sportName: reg.events?.sport_name || '-'
    }));

    // Sort alphabetically by club name
    exportData.sort((a, b) => 
      (a.clubName || '').localeCompare(b.clubName || '')
    );

    return NextResponse.json({
      success: true,
      data: exportData,
      count: exportData.length
    });

  } catch (error) {
    console.error('Error in export endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
