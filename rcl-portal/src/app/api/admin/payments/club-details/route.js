import { supabase } from '../../../../../lib/supabaseClient';
import { NextResponse } from 'next/server';
import { APP_CONFIG } from '../../../../../config/app.config.js';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const club_id = searchParams.get('club_id');

    if (!club_id) {
        return NextResponse.json({ error: 'club_id is required' }, { status: 400 });
    }

    try {
        const registrationFee = parseInt(APP_CONFIG.REGISTRATION_FEE) || 800;

        // Use SQL aggregation to get player count and paid amount in one query
        const [{ player_count, paid_amount }, error] = await Promise.all([
            (async () => {
                // Get player count
                const { count, error } = await supabase
                    .from('players')
                    .select('*', { count: 'exact', head: true })
                    .eq('club_id', club_id);
                return { player_count: count || 0, paid_amount: null, error };
            })(),
            (async () => {
                // Get paid amount
                const { data, error } = await supabase
                    .from('payment_slips')
                    .select('value')
                    .eq('club_id', club_id)
                    .eq('approved', true);
                const paid_amount = data?.reduce((sum, payment) => sum + payment.value, 0) || 0;
                return { player_count: null, paid_amount, error };
            })()
        ]);

        if (error?.error) {
            console.error('Error fetching club details:', error.error);
            return NextResponse.json({ error: 'Failed to fetch club details' }, { status: 500 });
        }

        const totalPlayers = player_count || 0;
        const totalAmount = totalPlayers * registrationFee;
        const paidAmount = paid_amount || 0;
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