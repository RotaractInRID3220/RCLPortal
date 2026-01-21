import { supabase } from '../../../../../lib/supabaseClient';
import { NextResponse } from 'next/server';
import { APP_CONFIG } from '../../../../../config/app.config.js';

export async function GET(request) {
    try {
        const registrationFee = parseInt(APP_CONFIG.REGISTRATION_FEE) || 800;

        // Fetch total players count and total approved payments in parallel
        const [playersResult, paymentsResult] = await Promise.all([
            supabase
                .from('players')
                .select('*', { count: 'exact', head: true }),
            supabase
                .from('payment_slips')
                .select('value')
                .eq('approved', true)
        ]);

        if (playersResult.error) {
            console.error('Error fetching players:', playersResult.error);
            return NextResponse.json({ error: 'Failed to fetch player stats' }, { status: 500 });
        }

        if (paymentsResult.error) {
            console.error('Error fetching payments:', paymentsResult.error);
            return NextResponse.json({ error: 'Failed to fetch payment stats' }, { status: 500 });
        }

        const totalPlayers = playersResult.count || 0;
        const totalIncome = totalPlayers * registrationFee;
        const totalPaymentsReceived = paymentsResult.data?.reduce((sum, payment) => sum + (payment.value || 0), 0) || 0;
        const amountYetToCome = Math.max(0, totalIncome - totalPaymentsReceived);

        return NextResponse.json({
            success: true,
            totalPlayers,
            registrationFee,
            totalIncome,
            totalPaymentsReceived,
            amountYetToCome
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
