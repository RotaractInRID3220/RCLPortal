import { supabase } from '../../../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const requestData = await request.json();
        const { payment_id, rejected_by } = requestData;

        if (!payment_id || !rejected_by) {
            return NextResponse.json({ 
                error: 'Missing required fields: payment_id and rejected_by' 
            }, { status: 400 });
        }

        // Update the payment slip to rejected
        const { data, error } = await supabase
            .from('payment_slips')
            .update({
                approved: false,
                approved_by: rejected_by
            })
            .eq('payment_id', payment_id)
            .select();

        if (error) {
            console.error('Error rejecting payment:', error);
            return NextResponse.json({ error: 'Failed to reject payment' }, { status: 500 });
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        return NextResponse.json({ 
            success: true, 
            payment: data[0],
            message: 'Payment rejected successfully' 
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}