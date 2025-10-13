import { supabase } from '../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function GET(request) {
    try {
        // Parse URL search parameters
        const { searchParams } = new URL(request.url);
        
        // Check for filter parameters in the query string
        const filterParams = searchParams.get('filter');
        
        let query = supabase.from('registrations').select('*');
        
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
                            query = query.eq(key, value);
                        });
                    });
                } else {
                    // Handle single filter object
                    Object.entries(filters).forEach(([key, value]) => {
                        query = query.eq(key, value);
                    });
                }
            } catch (parseError) {
                console.error('API: Error parsing filter parameters:', parseError);
                return NextResponse.json({ error: 'Invalid filter format' }, { status: 400 });
            }
        }
        
        // Execute the query
        console.log('API: Executing registration query with filters:', filterParams);
        const { data, error } = await query;
        
        if (error) {
            console.error('API: Error fetching registrations:', error);
            return NextResponse.json({ error: 'Failed to fetch registrations' }, { status: 500 });
        }
        
        console.log(`API: Successfully fetched ${data?.length || 0} registrations`);
        
        return NextResponse.json({ 
            success: true,
            data,
            count: data.length
        }, { status: 200 });
    } catch (err) {
        console.error('API: Exception occurred during GET:', err);
        return NextResponse.json({ error: 'Server error fetching registrations' }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        // Parse URL search parameters
        const { searchParams } = new URL(request.url);
        const RMIS_ID = searchParams.get('RMIS_ID');
        const sport_id = searchParams.get('sport_id');
        
        // Validate required parameters
        if (!RMIS_ID || !sport_id) {
            console.log('API: Missing required parameters for DELETE:', { RMIS_ID, sport_id });
            return NextResponse.json({ error: 'Missing required parameters: RMIS_ID and sport_id are required' }, { status: 400 });
        }
        
        console.log(`API: Attempting to delete registration with RMIS_ID: ${RMIS_ID} and sport_id: ${sport_id}`);
        
        // Delete the matching row
        const { data, error } = await supabase
            .from('registrations')
            .delete()
            .eq('RMIS_ID', RMIS_ID)
            .eq('sport_id', sport_id);
        
        if (error) {
            console.error('API: Error deleting registration:', error);
            return NextResponse.json({ error: 'Failed to delete registration' }, { status: 500 });
        }
        
        console.log('API: Registration deleted successfully');
        return NextResponse.json({ 
            success: true, 
            message: 'Registration deleted successfully' 
        }, { status: 200 });
        
    } catch (err) {
        console.error('API: Exception occurred during DELETE:', err);
        return NextResponse.json({ error: 'Server error deleting registration' }, { status: 500 });
    }
}

export async function POST(request) {
    const requestData = await request.json();
    const { member, sport_id, isMainPlayer } = requestData;

    // Validate input
    if (!member || !sport_id) {
        console.log('API: Missing member or sport_id');
        return NextResponse.json({ error: 'Invalid input: member and sportId are required' }, { status: 400 });
    }

    try {
        // First check if registration already exists - optimized query
        const { data: existingRegistration, error: checkError } = await supabase
            .from('registrations')
            .select('RMIS_ID, sport_id, main_player, club_id')
            .eq('RMIS_ID', member.membership_id)
            .eq('sport_id', sport_id)
            .maybeSingle();
        
        if (checkError) {
            console.error('API: Error checking existing registration:', checkError);
            return NextResponse.json({ error: 'Failed to check registration status' }, { status: 500 });
        }
        
        // If registration already exists, return success with existing data
        if (existingRegistration) {
            console.log('API: Member already registered for this sport');
            return NextResponse.json({ 
                message: 'Member already registered for this sport',
                data: existingRegistration,
                alreadyRegistered: true
            }, { status: 200 });
        }
        
        // If registration doesn't exist yet, insert a new record - optimized insert
        const { data, error } = await supabase
            .from('registrations')
            .insert({ 
                RMIS_ID: member.membership_id,
                sport_id: sport_id,
                main_player: isMainPlayer,
                club_id: member.club_id
            })
            .select('RMIS_ID, sport_id, main_player, club_id');

        if (error) {
            console.error('API: Error registering member:', error);
            return NextResponse.json({ error: 'Failed to register member' }, { status: 500 });
        }

        return NextResponse.json({ message: 'Member registered successfully', data }, { status: 201 });
    } catch (err) {
        console.error('API: Exception occurred:', err);
        return NextResponse.json({ error: 'Server error processing registration' }, { status: 500 });
    }
}


