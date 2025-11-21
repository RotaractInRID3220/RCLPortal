import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { request_id, approved_by } = await request.json();

    if (!request_id || !approved_by) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch request details
    const { data: swapRequest, error: fetchError } = await supabase
      .from('swap_requests')
      .select('*')
      .eq('id', request_id)
      .single();

    if (fetchError || !swapRequest) {
      return NextResponse.json(
        { success: false, error: 'Swap request not found' },
        { status: 404 }
      );
    }

    if (swapRequest.status !== null) {
      return NextResponse.json(
        { success: false, error: 'Request already processed' },
        { status: 400 }
      );
    }

    // Perform the swap
    if (swapRequest.player2_registrations_id) {
      // Player-to-Player Swap
      // Update Player 1 -> Sport 2
      const { error: update1 } = await supabase
        .from('registrations')
        .update({ sport_id: swapRequest.sport2_id })
        .eq('id', swapRequest.player1_registrations_id);

      if (update1) throw update1;

      // Update Player 2 -> Sport 1
      const { error: update2 } = await supabase
        .from('registrations')
        .update({ sport_id: swapRequest.sport1_id })
        .eq('id', swapRequest.player2_registrations_id);

      if (update2) throw update2;

    } else {
      // Single Move
      // Update Player 1 -> Sport 2
      const { error: update1 } = await supabase
        .from('registrations')
        .update({ sport_id: swapRequest.sport2_id })
        .eq('id', swapRequest.player1_registrations_id);

      if (update1) throw update1;
    }

    // Update request status
    const { error: updateStatus } = await supabase
      .from('swap_requests')
      .update({
        status: true,
        approved_by,
        approved_at: new Date().toISOString()
      })
      .eq('id', request_id);

    if (updateStatus) throw updateStatus;

    return NextResponse.json({
      success: true,
      message: 'Swap approved successfully'
    });

  } catch (error) {
    console.error('Error approving swap:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve swap' },
      { status: 500 }
    );
  }
}
