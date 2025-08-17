import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

// POST - Create a new event
export async function POST(request) {
    try {
        const eventData = await request.json();
        
        // Validate required fields (add more validation as needed)
        if (!eventData.name) {
            return NextResponse.json(
                { success: false, error: 'Event name is required' },
                { status: 400 }
            );
        }

        // Sample insert query - replace with your actual table structure
        const { data, error } = await supabase
            .from('events') // Replace 'events' with your actual table name
            .insert([
                {
                    sport_name: eventData.name, // Sample field - add more fields as needed
                    sport_day: eventData.day,
                    sport_type: eventData.type,
                    gender_type: eventData.gender,
                    min_count: eventData.minPlayers,
                    max_count: eventData.maxPlayers,
                    reserve_count: eventData.reservePlayers,
                    registration_close: eventData.regClose,
                    category: eventData.category,
                }
            ])
            .select();

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to create event' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Event created successfully',
            data: data[0]
        });

    } catch (error) {
        console.error('Server error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET - Fetch events (for future use)
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        
        // Build query based on parameters
        let query = supabase.from('events').select('*');
        
        if (category) {
            query = query.eq('category', category);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('Database error:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to fetch events' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('Server error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// PUT - Update event (for future use)
export async function PUT(request) {
    try {
        const { id, ...updateData } = await request.json();
        
        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Event ID is required' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('events')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to update event' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Event updated successfully',
            data: data[0]
        });

    } catch (error) {
        console.error('Server error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// DELETE - Delete event (for future use)
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        
        if (!id) {
            return NextResponse.json(
                { success: false, error: 'Event ID is required' },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to delete event' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Event deleted successfully'
        });

    } catch (error) {
        console.error('Server error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
