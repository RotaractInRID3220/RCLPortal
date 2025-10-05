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

        // Build the payment slips query with JOIN to clubs and search filtering
        let query = supabase
            .from('payment_slips')
            .select(`*, clubs:club_id (club_id, club_name)`, { count: 'exact' });

        // Filter by approval status
        if (tab === 'pending') {
            query = query.is('approved', null);
        } else if (tab === 'approved') {
            query = query.eq('approved', true);
        } else if (tab === 'rejected') {
            query = query.eq('approved', false);
        }

        // Apply club name search filter directly in JOIN
        if (search.trim()) {
            query = query.ilike('clubs.club_name', `%${search.trim()}%`);
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

        // Transform the data to include club names from JOIN
        const transformedPayments = payments?.map(payment => ({
            ...payment,
            club_name: payment.clubs?.club_name || 'Unknown Club'
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