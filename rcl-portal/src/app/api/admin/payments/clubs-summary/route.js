import { supabase } from '../../../../../lib/supabaseClient';
import { NextResponse } from 'next/server';
import { APP_CONFIG } from '../../../../../config/app.config.js';

// Helper to fetch all rows using pagination (bypasses 1000 row limit)
async function fetchAllRows(table, selectColumns, filters = {}) {
    const PAGE_SIZE = 1000;
    let allData = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
        let query = supabase.from(table).select(selectColumns).range(from, from + PAGE_SIZE - 1);
        
        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
        });

        const { data, error } = await query;
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            allData = allData.concat(data);
            from += PAGE_SIZE;
            hasMore = data.length === PAGE_SIZE;
        } else {
            hasMore = false;
        }
    }

    return allData;
}

export async function GET(request) {
    try {
        const registrationFee = parseInt(APP_CONFIG.REGISTRATION_FEE) || 800;

        // Fetch all data using pagination to bypass 1000 row limit
        const [clubs, players, payments] = await Promise.all([
            fetchAllRows('clubs', 'club_id, club_name'),
            fetchAllRows('players', 'club_id'),
            fetchAllRows('payment_slips', 'club_id, value', { approved: true })
        ]);

        // Create player count map by club_id
        const playerCountMap = {};
        players.forEach(player => {
            playerCountMap[player.club_id] = (playerCountMap[player.club_id] || 0) + 1;
        });

        // Create payment sum map by club_id
        const paymentSumMap = {};
        payments.forEach(payment => {
            paymentSumMap[payment.club_id] = (paymentSumMap[payment.club_id] || 0) + (payment.value || 0);
        });

        // Build clubs summary with calculated values
        const clubsSummary = clubs.map(club => {
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
        }).filter(club => club.playerCount > 0); // Only include clubs with players

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
