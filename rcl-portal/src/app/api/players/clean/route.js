import { supabase } from '../../../../lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const requestData = await request.json();
        const { club_id } = requestData;

        // Build query based on whether club_id is provided
        let playersQuery = supabase
            .from('players')
            .select('RMIS_ID, club_id');

        if (club_id) {
            playersQuery = playersQuery.eq('club_id', club_id);
        }

        const { data: players, error: playersError } = await playersQuery;

        if (playersError) {
            console.error('Error fetching players:', playersError);
            return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
        }

        if (!players || players.length === 0) {
            const scope = club_id ? 'this club' : 'the system';
            return NextResponse.json({ 
                success: true, 
                deletedCount: 0,
                message: `No players found for ${scope}` 
            });
        }

        // Get all player IDs for this club
        const playerIds = players.map(p => p.RMIS_ID);

        // Check which players have registrations
        const { data: registrations, error: regError } = await supabase
            .from('registrations')
            .select('RMIS_ID')
            .in('RMIS_ID', playerIds);

        if (regError) {
            console.error('Error fetching registrations:', regError);
            return NextResponse.json({ error: 'Failed to fetch registrations' }, { status: 500 });
        }

        // Get player IDs that have registrations
        const playersWithRegistrations = new Set(
            registrations?.map(r => r.RMIS_ID) || []
        );

        // Find players without registrations
        const playersToDelete = playerIds.filter(
            playerId => !playersWithRegistrations.has(playerId)
        );

        if (playersToDelete.length === 0) {
            return NextResponse.json({ 
                success: true, 
                deletedCount: 0,
                message: 'All players have registrations - no players removed' 
            });
        }

        // Delete players without registrations
        const { error: deleteError } = await supabase
            .from('players')
            .delete()
            .in('RMIS_ID', playersToDelete);

        if (deleteError) {
            console.error('Error deleting players:', deleteError);
            return NextResponse.json({ error: 'Failed to delete players' }, { status: 500 });
        }

        const scope = club_id ? 'from this club' : 'globally';
        return NextResponse.json({ 
            success: true, 
            deletedCount: playersToDelete.length,
            message: `Successfully removed ${playersToDelete.length} players without registrations ${scope}`
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}