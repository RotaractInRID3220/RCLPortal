import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

// Rejects a replacement request
export async function POST(request) {
  try {
    const requestData = await request.json();
    const { request_id, rejected_by } = requestData;

    if (!request_id || !rejected_by) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: request_id and rejected_by',
        },
        { status: 400 }
      );
    }

    // Update the replacement request to rejected
    const { data, error } = await supabase
      .from('replacement_requests')
      .update({
        status: false,
        approved_at: new Date().toISOString(),
        approved_by: rejected_by,
      })
      .eq('id', request_id)
      .select();

    if (error) {
      console.error('Error rejecting replacement request:', error);
      return NextResponse.json({ success: false, error: 'Failed to reject replacement request' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: 'Replacement request not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      request: data[0],
      message: 'Replacement request rejected successfully',
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
