import { supabase } from '../../../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const requestData = await request.json();
        const { payment_id, approved_by } = requestData;

        if (!payment_id || !approved_by) {
            return NextResponse.json({ 
                error: 'Missing required fields: payment_id and approved_by' 
            }, { status: 400 });
        }

        // Update the payment slip to approved
        const { data, error } = await supabase
            .from('payment_slips')
            .update({
                approved: true,
                approved_by: approved_by
            })
            .eq('payment_id', payment_id)
            .select();

        if (error) {
            console.error('Error approving payment:', error);
            return NextResponse.json({ error: 'Failed to approve payment' }, { status: 500 });
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        return NextResponse.json({ 
            success: true, 
            payment: data[0],
            message: 'Payment approved successfully' 
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}