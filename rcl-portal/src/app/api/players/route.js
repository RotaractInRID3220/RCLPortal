import { supabase } from '../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const club_id = searchParams.get('club_id');
    const listMode = searchParams.get('list') === 'true';

    if (!club_id) {
        return NextResponse.json({ error: 'club_id is required' }, { status: 400 });
    }

    try {
        if (listMode) {
            // Return all players for the club (no pagination)
            const { data, error } = await supabase
                .from('players')
                .select('*')
                .eq('club_id', club_id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching players:', error);
                return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                players: data || [],
                count: data?.length || 0
            });
        } else {
            // Get count of players for the club
            const { count, error } = await supabase
                .from('players')
                .select('*', { count: 'exact', head: true })
                .eq('club_id', club_id);

            if (error) {
                console.error('Error counting players:', error);
                return NextResponse.json({ error: 'Failed to count players' }, { status: 500 });
            }

            return NextResponse.json({ 
                success: true, 
                count: count || 0 
            });
        }
    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request) {
    const requestData = await request.json();
    const { member } = requestData;

    // Validate input
    if (!member) {
        console.log('API: Missing member data');
        return NextResponse.json({ error: 'Invalid input: member and sportId are required' }, { status: 400 });
    }

    try {
        // First check if player already exists with this membership_id
        const { data: existingPlayer, error: checkError } = await supabase
            .from('players')
            .select()
            .eq('RMIS_ID', member.membership_id)
            .single();
            
        // console.log('API: Existing player check result:', existingPlayer);
        // console.log('API: Existing player check error:', checkError);

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            console.log('API: Error checking player registration status:', checkError);
            return NextResponse.json({ error: 'Failed to check player registration status' }, { status: 500 });
        }

        // If player doesn't exist yet, insert a new record
        if (!existingPlayer) {
            const { data, error: insertError } = await supabase
                .from('players')
                .insert([{ 
                    RMIS_ID: member.membership_id,
                    RI_ID : member.ri_number || null,
                    name : member.full_name,
                    club_id : member.club_id,
                    NIC : member.nic_pp,
                    birthdate : member.dob,
                    gender : member.gender,
                    status : member.status,
                }])
                .select();

            if (insertError) {
                console.log('API: Error inserting player:', insertError);
                return NextResponse.json({ error: 'Failed to register player', details: insertError }, { status: 500 });
            }
            console.log('API: Player inserted successfully');
            return NextResponse.json({ 
                message: 'Player registered successfully',
                player: data?.[0] || null
            }, { status: 200 });
        }

        // Return success if player was already registered
        return NextResponse.json({ 
            message: 'Player already registered',
            player: existingPlayer
        }, { status: 200 });

    } catch (err) {
        console.error('Error registering player:', err);
        console.log('API: Exception stack trace:', err.stack);
        return NextResponse.json({ error: 'Server error processing registration' }, { status: 500 });
    }
}