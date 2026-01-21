import { supabase } from '../../../../../lib/supabaseClient';
import { NextResponse } from 'next/server';
import { APP_CONFIG } from '../../../../../config/app.config.js';

export async function GET(request) {
    try {
        const registrationFee = parseInt(APP_CONFIG.REGISTRATION_FEE) || 800;

        // Fetch all clubs with their player counts and payment data
        const [clubsResult, playersResult, paymentsResult] = await Promise.all([
            supabase
                .from('clubs')
                .select('club_id, club_name')
                .order('club_name', { ascending: true }),
            supabase
                .from('players')
                .select('club_id'),
            supabase
                .from('payment_slips')
                .select('club_id, value, approved')
                .eq('approved', true)
        ]);

        if (clubsResult.error) {
            console.error('Error fetching clubs:', clubsResult.error);
            return NextResponse.json({ error: 'Failed to fetch clubs' }, { status: 500 });
        }

        if (playersResult.error) {
            console.error('Error fetching players:', playersResult.error);
            return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
        }

        if (paymentsResult.error) {
            console.error('Error fetching payments:', paymentsResult.error);
            return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
        }

        // Create player count map by club_id
        const playerCountMap = {};
        playersResult.data?.forEach(player => {
            playerCountMap[player.club_id] = (playerCountMap[player.club_id] || 0) + 1;
        });

        // Create payment sum map by club_id
        const paymentSumMap = {};
        paymentsResult.data?.forEach(payment => {
            paymentSumMap[payment.club_id] = (paymentSumMap[payment.club_id] || 0) + (payment.value || 0);
        });

        // Build clubs summary with calculated values
        const clubsSummary = clubsResult.data?.map(club => {
            const playerCount = playerCountMap[club.club_id] || 0;
            const totalAmount = playerCount * registrationFee;
            const paidAmount = paymentSumMap[club.club_id] || 0;
            const toBePaid = Math.max(0, totalAmount - paidAmount);

            return {
                club_id: club.club_id,
                club_name: club.club_name,
                playerCount,
                totalAmount,
                paidAmount,
                toBePaid
            };
        }).filter(club => club.playerCount > 0) || []; // Only include clubs with players

        // Sort by club name
        clubsSummary.sort((a, b) => a.club_name.localeCompare(b.club_name));

        return NextResponse.json({
            success: true,
            clubs: clubsSummary,
            totalClubs: clubsSummary.length,
            registrationFee
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
