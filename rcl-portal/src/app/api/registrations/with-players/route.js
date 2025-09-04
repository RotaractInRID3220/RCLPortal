import { supabase } from '../../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        // Parse URL search parameters
        const { searchParams } = new URL(request.url);
        
        // Check for filter parameters in the query string
        const filterParams = searchParams.get('filter');
        
        let registrationQuery = supabase.from('registrations').select('*');
        
        // Apply filters if they exist
        if (filterParams) {
            try {
                // Parse the JSON filter parameters
                const filters = JSON.parse(filterParams);
                
                // Apply each filter
                if (Array.isArray(filters)) {
                    // Handle array of filter objects
                    filters.forEach(filter => {
                        Object.entries(filter).forEach(([key, value]) => {
                            registrationQuery = registrationQuery.eq(key, value);
                        });
                    });
                } else {
                    // Handle single filter object
                    Object.entries(filters).forEach(([key, value]) => {
                        registrationQuery = registrationQuery.eq(key, value);
                    });
                }
            } catch (parseError) {
                console.error('API: Error parsing filter parameters:', parseError);
                return NextResponse.json({ error: 'Invalid filter format' }, { status: 400 });
            }
        }
        
        // Execute the registration query
        console.log('API: Executing registration query with filters:', filterParams);
        const { data: registrations, error: regError } = await registrationQuery;
        
        if (regError) {
            console.error('API: Error fetching registrations:', regError);
            return NextResponse.json({ error: 'Failed to fetch registrations' }, { status: 500 });
        }

        if (!registrations || registrations.length === 0) {
            return NextResponse.json({
                success: true,
                data: [],
                count: 0
            }, { status: 200 });
        }

        // Get unique RMIS_IDs to fetch player data
        const rmisIds = [...new Set(registrations.map(reg => reg.RMIS_ID))];
        
        // Fetch player data
        const { data: players, error: playerError } = await supabase
            .from('players')
            .select('*')
            .in('RMIS_ID', rmisIds);
            
        if (playerError) {
            console.error('API: Error fetching players:', playerError);
            return NextResponse.json({ error: 'Failed to fetch player data' }, { status: 500 });
        }

        // Get unique club_ids to fetch club data
        const clubIds = [...new Set(players?.map(player => player.club_id) || [])];
        
        // Fetch club data
        const { data: clubs, error: clubError } = await supabase
            .from('clubs')
            .select('*')
            .in('club_id', clubIds);
            
        if (clubError) {
            console.error('API: Error fetching clubs:', clubError);
            return NextResponse.json({ error: 'Failed to fetch club data' }, { status: 500 });
        }

        // Get unique sport_ids to fetch sport data
        const sportIds = [...new Set(registrations.map(reg => reg.sport_id))];
        
        // Fetch sport data
        const { data: sports, error: sportError } = await supabase
            .from('events')
            .select('*')
            .in('sport_id', sportIds);
            
        if (sportError) {
            console.error('API: Error fetching sports:', sportError);
            return NextResponse.json({ error: 'Failed to fetch sport data' }, { status: 500 });
        }

        // Create lookup maps for efficient joining
        const playerMap = {};
        players?.forEach(player => {
            playerMap[player.RMIS_ID] = player;
        });

        const clubMap = {};
        clubs?.forEach(club => {
            clubMap[club.club_id] = club;
        });

        const sportMap = {};
        sports?.forEach(sport => {
            sportMap[sport.sport_id] = sport;
        });

        // Combine the data
        const combinedData = registrations.map(registration => {
            const player = playerMap[registration.RMIS_ID];
            const club = player ? clubMap[player.club_id] : null;
            const sport = sportMap[registration.sport_id];

            return {
                ...registration,
                players: player || null,
                clubs: club || null,
                sports: sport || null
            };
        });

        // If club_id filter was applied, filter the combined data
        if (filterParams) {
            const filters = JSON.parse(filterParams);
            if (filters.club_id) {
                const filteredData = combinedData.filter(item => 
                    item.players && item.players.club_id == filters.club_id
                );
                
                console.log(`API: Successfully fetched ${filteredData.length} registrations with player data after club filtering`);
                return NextResponse.json({
                    success: true,
                    data: filteredData,
                    count: filteredData.length
                }, { status: 200 });
            }
        }
        
        console.log(`API: Successfully fetched ${combinedData.length} registrations with player data`);
        
        return NextResponse.json({
            success: true,
            data: combinedData,
            count: combinedData.length
        }, { status: 200 });
        
    } catch (error) {
        console.error('API: Unexpected error in registrations with players endpoint:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
