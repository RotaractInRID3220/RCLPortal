import { supabase } from '../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const club_id = searchParams.get('club_id');

    if (!club_id) {
        return NextResponse.json({ error: 'club_id is required' }, { status: 400 });
    }

    try {
        // Fetch payment slips for the club
        const { data: payments, error } = await supabase
            .from('payment_slips')
            .select('*')
            .eq('club_id', club_id)
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching payment slips:', error);
            return NextResponse.json({ error: 'Failed to fetch payment slips' }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            payments: payments || [] 
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const requestData = await request.json();
        const { value, slip_number, link, club_id } = requestData;

        // Validate input
        if (!value || !slip_number || !link || !club_id) {
            return NextResponse.json({ 
                error: 'Missing required fields: value, slip_number, link, club_id' 
            }, { status: 400 });
        }

        if (isNaN(value) || parseFloat(value) <= 0) {
            return NextResponse.json({ 
                error: 'Invalid value: must be a positive number' 
            }, { status: 400 });
        }

        // Insert payment slip record
        const { data, error } = await supabase
            .from('payment_slips')
            .insert([{
                value: parseFloat(value),
                slip_number: slip_number.trim(),
                link: link,
                club_id: club_id,
                approved: null, // Pending approval
                date: new Date().toISOString()
            }])
            .select();

        if (error) {
            console.error('Error inserting payment slip:', error);
            return NextResponse.json({ error: 'Failed to create payment slip' }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            payment: data[0],
            message: 'Payment slip submitted successfully' 
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
