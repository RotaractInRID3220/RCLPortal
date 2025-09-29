import { supabase } from '../../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        // Parse URL search parameters
        const { searchParams } = new URL(request.url);
        
        // Check for filter parameters in the query string
        const filterParams = searchParams.get('filter');
        const page = parseInt(searchParams.get('page')) || null;
        const limit = parseInt(searchParams.get('limit')) || null;
        const search = searchParams.get('search') || null;
        
        // Build optimized query with JOINs to eliminate N+1 problem
        let query = supabase
            .from('registrations')
            .select(`
                *,
                players!inner(
                    RMIS_ID,
                    name,
                    NIC,
                    birthdate,
                    gender,
                    status,
                    RI_ID,
                    club_id,
                    clubs!inner(
                        club_id,
                        club_name,
                        category
                    )
                ),
                sports:sport_id!inner(
                    sport_id,
                    sport_name,
                    gender_type,
                    sport_type,
                    category,
                    sport_day,
                    min_count,
                    max_count,
                    reserve_count,
                    registration_close
                )
            `, { count: page && limit ? 'exact' : undefined });
        
        // Apply search filter if provided
        if (search && search.trim()) {
            const searchTerm = search.trim();
            query = query.or(
                `players.name.ilike.%${searchTerm}%,` +
                `players.RMIS_ID.ilike.%${searchTerm}%,` +
                `players.clubs.club_name.ilike.%${searchTerm}%`
            );
        }
        
        // Apply filters if they exist
        if (filterParams) {
            try {
                const filters = JSON.parse(filterParams);
                
                if (Array.isArray(filters)) {
                    filters.forEach(filter => {
                        Object.entries(filter).forEach(([key, value]) => {
                            if (key === 'club_id') {
                                query = query.eq('players.club_id', value);
                            } else {
                                query = query.eq(key, value);
                            }
                        });
                    });
                } else {
                    Object.entries(filters).forEach(([key, value]) => {
                        if (key === 'club_id') {
                            query = query.eq('players.club_id', value);
                        } else {
                            query = query.eq(key, value);
                        }
                    });
                }
            } catch (parseError) {
                console.error('API: Error parsing filter parameters:', parseError);
                return NextResponse.json({ error: 'Invalid filter format' }, { status: 400 });
            }
        }
        
        // Apply pagination if provided
        if (page && limit) {
            const offset = (page - 1) * limit;
            query = query.range(offset, offset + limit - 1);
        }
        
        // Execute the optimized single query
        console.log('API: Executing optimized registration query with filters:', filterParams);
        const { data: registrations, error, count } = await query;
        
        if (error) {
            console.error('API: Error fetching registrations:', error);
            return NextResponse.json({ error: 'Failed to fetch registrations' }, { status: 500 });
        }

        if (!registrations || registrations.length === 0) {
            return NextResponse.json({
                success: true,
                data: [],
                count: 0,
                ...(page && limit && { 
                    totalCount: count || 0, 
                    totalPages: Math.ceil((count || 0) / limit),
                    currentPage: page 
                })
            }, { status: 200 });
        }

        // Transform the data to match the original response structure exactly
        const combinedData = registrations.map(registration => {
            return {
                ...registration,
                players: registration.players || null,
                clubs: registration.players?.clubs || null,
                sports: registration.sports || null
            };
        });
        
        console.log(`API: Successfully fetched ${combinedData.length} registrations with optimized query`);
        
        // Return response with pagination info if requested
        const response = {
            success: true,
            data: combinedData,
            count: combinedData.length
        };
        
        // Add pagination metadata if pagination was requested
        if (page && limit) {
            response.totalCount = count || 0;
            response.totalPages = Math.ceil((count || 0) / limit);
            response.currentPage = page;
        }
        
        return NextResponse.json(response, { status: 200 });
        
    } catch (error) {
        console.error('API: Unexpected error in registrations with players endpoint:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
