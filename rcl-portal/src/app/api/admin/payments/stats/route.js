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

        // Get exact player count (head:true doesn't hit row limit)
        const playersCountResult = await supabase
            .from('players')
            .select('*', { count: 'exact', head: true });

        if (playersCountResult.error) {
            console.error('Error fetching players count:', playersCountResult.error);
            return NextResponse.json({ error: 'Failed to fetch player stats' }, { status: 500 });
        }

        // Fetch all approved payments using pagination
        let allPayments;
        try {
            allPayments = await fetchAllRows('payment_slips', 'value', { approved: true });
        } catch (error) {
            console.error('Error fetching payments:', error);
            return NextResponse.json({ error: 'Failed to fetch payment stats' }, { status: 500 });
        }

        const totalPlayers = playersCountResult.count || 0;
        const totalIncome = totalPlayers * registrationFee;
        const totalPaymentsReceived = allPayments.reduce((sum, payment) => sum + (payment.value || 0), 0);
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
