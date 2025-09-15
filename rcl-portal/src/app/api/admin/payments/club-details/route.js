import { supabase } from '../../../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const club_id = searchParams.get('club_id');

    if (!club_id) {
        return NextResponse.json({ error: 'club_id is required' }, { status: 400 });
    }

    try {
        const registrationFee = parseInt(process.env.NEXT_PUBLIC_REGISTRATION_FEE) || 800;

        // Get player count for the club
        const { count: playerCount, error: playersError } = await supabase
            .from('players')
            .select('*', { count: 'exact', head: true })
            .eq('club_id', club_id);

        if (playersError) {
            console.error('Error counting players:', playersError);
            return NextResponse.json({ error: 'Failed to count players' }, { status: 500 });
        }

        // Get approved payments for the club
        const { data: approvedPayments, error: paymentsError } = await supabase
            .from('payment_slips')
            .select('value')
            .eq('club_id', club_id)
            .eq('approved', true);

        if (paymentsError) {
            console.error('Error fetching approved payments:', paymentsError);
            return NextResponse.json({ error: 'Failed to fetch approved payments' }, { status: 500 });
        }

        // Calculate amounts
        const totalPlayers = playerCount || 0;
        const totalAmount = totalPlayers * registrationFee;
        const paidAmount = approvedPayments?.reduce((sum, payment) => sum + payment.value, 0) || 0;
        const remainingAmount = Math.max(0, totalAmount - paidAmount);

        return NextResponse.json({
            success: true,
            totalPlayers,
            totalAmount,
            paidAmount,
            remainingAmount,
            registrationFee
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}