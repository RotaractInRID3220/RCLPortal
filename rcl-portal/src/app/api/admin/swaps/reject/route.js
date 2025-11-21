import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { request_id, rejected_by } = await request.json();

    if (!request_id || !rejected_by) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('swap_requests')
      .update({
        status: false,
        approved_by: rejected_by, // Using approved_by field for rejecter as per schema
        approved_at: new Date().toISOString()
      })
      .eq('id', request_id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Swap request rejected'
    });

  } catch (error) {
    console.error('Error rejecting swap:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reject swap' },
      { status: 500 }
    );
  }
}
