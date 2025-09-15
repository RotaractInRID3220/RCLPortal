import { supabase } from '../../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'pending';
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const search = searchParams.get('search') || '';

    try {
        const offset = (page - 1) * limit;

        // First, get all clubs for search filtering
        let clubsToFilter = [];
        if (search.trim()) {
            const { data: clubs, error: clubsError } = await supabase
                .from('clubs')
                .select('club_id')
                .ilike('club_name', `%${search.trim()}%`);
            
            if (clubsError) {
                console.error('Error fetching clubs for search:', clubsError);
                return NextResponse.json({ error: 'Failed to search clubs' }, { status: 500 });
            }
            
            clubsToFilter = clubs?.map(c => c.club_id) || [];
            
            // If no clubs match the search, return empty results
            if (clubsToFilter.length === 0) {
                return NextResponse.json({
                    success: true,
                    payments: [],
                    totalCount: 0,
                    totalPages: 0,
                    currentPage: page
                });
            }
        }

        // Build the payment slips query
        let query = supabase
            .from('payment_slips')
            .select('*', { count: 'exact' });

        // Filter by approval status
        if (tab === 'pending') {
            query = query.is('approved', null);
        } else if (tab === 'approved') {
            query = query.eq('approved', true);
        } else if (tab === 'rejected') {
            query = query.eq('approved', false);
        }

        // Apply club filter if searching
        if (search.trim() && clubsToFilter.length > 0) {
            query = query.in('club_id', clubsToFilter);
        }

        // Order by date (latest first) and apply pagination
        query = query
            .order('date', { ascending: false })
            .range(offset, offset + limit - 1);

        const { data: payments, error, count } = await query;

        if (error) {
            console.error('Error fetching payments:', error);
            return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
        }

        // Get club names for the payments
        const uniqueClubIds = [...new Set(payments?.map(p => p.club_id) || [])];
        let clubsMap = {};
        
        if (uniqueClubIds.length > 0) {
            const { data: clubs, error: clubsError } = await supabase
                .from('clubs')
                .select('club_id, club_name')
                .in('club_id', uniqueClubIds);
            
            if (clubsError) {
                console.error('Error fetching club names:', clubsError);
            } else {
                clubsMap = Object.fromEntries(
                    clubs?.map(club => [club.club_id, club.club_name]) || []
                );
            }
        }

        // Transform the data to include club names
        const transformedPayments = payments?.map(payment => ({
            ...payment,
            club_name: clubsMap[payment.club_id] || 'Unknown Club'
        })) || [];

        const totalPages = Math.ceil((count || 0) / limit);

        return NextResponse.json({
            success: true,
            payments: transformedPayments,
            totalPages,
            totalCount: count || 0,
            currentPage: page
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}