import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get('tab') || 'pending';
  const page = parseInt(searchParams.get('page')) || 1;
  const limit = parseInt(searchParams.get('limit')) || 10;
  const search = searchParams.get('search') || '';

  try {
    const offset = (page - 1) * limit;

    let query = supabase
      .from('swap_requests')
      .select(
        `
        *,
        clubs:club_id (club_id, club_name),
        sport1:sport1_id (sport_id, sport_name, sport_type, gender_type, sport_day),
        sport2:sport2_id (sport_id, sport_name, sport_type, gender_type, sport_day),
        reg1:player1_registrations_id (
          id, 
          RMIS_ID, 
          player:RMIS_ID (RMIS_ID, name, gender)
        ),
        reg2:player2_registrations_id (
          id, 
          RMIS_ID, 
          player:RMIS_ID (RMIS_ID, name, gender)
        )
      `,
        { count: 'exact' }
      );

    // Filter by status
    if (tab === 'pending') {
      query = query.is('status', null);
    } else if (tab === 'approved') {
      query = query.eq('status', true);
    } else if (tab === 'rejected') {
      query = query.eq('status', false);
    }

    // Order by date
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: requests, error, count } = await query;

    if (error) {
      console.error('Error fetching swap requests:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch swap requests' }, { status: 500 });
    }

    // Transform data for frontend
    const transformedRequests = requests.map(req => ({
      id: req.id,
      club_id: req.club_id,
      club_name: req.clubs?.club_name,
      created_at: req.created_at,
      status: req.status,
      approved_by: req.approved_by,
      approved_at: req.approved_at,
      description: req.description,
      requested_by: req.requested_by,
      type: req.player2_registrations_id ? 'player-swap' : 'single-move',
      
      // Player 1 details
      player1: {
        id: req.reg1?.player?.RMIS_ID,
        name: req.reg1?.player?.name,
        gender: req.reg1?.player?.gender,
        current_sport: req.sport1
      },
      
      // Player 2 details (if exists)
      player2: req.reg2 ? {
        id: req.reg2?.player?.RMIS_ID,
        name: req.reg2?.player?.name,
        gender: req.reg2?.player?.gender,
        current_sport: req.sport2
      } : null,
      
      // Target sport for single move
      target_sport: !req.player2_registrations_id ? req.sport2 : null
    }));

    return NextResponse.json({
      success: true,
      data: transformedRequests,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count / limit)
      }
    });

  } catch (error) {
    console.error('Unexpected error in admin swaps GET:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
