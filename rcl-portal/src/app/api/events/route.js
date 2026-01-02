import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

/**
 * Creates a new sport event in the database
 * @param {Request} request - HTTP request object containing event data
 * 
 * @example
 * // Request body:
 * {
 *   "name": "Football",
 *   "day": "D-01", 
 *   "type": "team",
 *   "gender": "boys",
 *   "minPlayers": 11,
 *   "maxPlayers": 15,
 *   "reservePlayers": 3,
 *   "regClose": "2025-08-25T00:00:00.000Z",
 *   "category": "community"
 * }
 * 
 * @example
 * // Success response:
 * {
 *   "success": true,
 *   "message": "Event created successfully",
 *   "data": { id: 1, sport_name: "Football", ... }
 * }
 * 
 * @example
 * // Error response:
 * {
 *   "success": false,
 *   "error": "Event name is required"
 * }
 * 
 * @returns {Promise<NextResponse>} JSON response with success status and data/error
 */
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

/**
 * Fetches sport events from the database with optional filtering
 * @param {Request} request - HTTP request object with optional query parameters
 * 
 * @example
 * // Get all events:
 * GET /api/events
 * 
 * @example
 * // Filter by category:
 * GET /api/events?category=community
 * GET /api/events?category=institute
 * 
 * @example
 * // Filter by single type:
 * GET /api/events?type=team
 * 
 * @example
 * // Filter by multiple types (NEW!):
 * GET /api/events?type=team,individual
 * 
 * @example
 * // Filter by multiple parameters with multiple types:
 * GET /api/events?category=community&type=team,individual&gender=boys&day=D-01
 * 
 * @example
 * // Success response:
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": 1,
 *       "sport_name": "Football",
 *       "sport_day": "D-01",
 *       "sport_type": "team",
 *       "gender_type": "boys",
 *       "category": "community",
 *       "min_count": 11,
 *       "max_count": 15,
 *       "reserve_count": 3,
 *       "registration_close": "2025-08-25T00:00:00.000Z",
 *       "created_at": "2025-08-18T10:30:00.000Z"
 *     }
 *   ],
 *   "count": 1
 * }
 * 
 * @example
 * // Error response:
 * {
 *   "success": false,
 *   "error": "Failed to fetch events"
 * }
 * 
 * @returns {Promise<NextResponse>} JSON response with success status and events data/error
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category');
        const sportDay = searchParams.get('day');
        const sportType = searchParams.get('type');
        const genderType = searchParams.get('gender');
        const limit = parseInt(searchParams.get('limit')) || 50;
        const offset = parseInt(searchParams.get('offset')) || 0;

        // Build query based on parameters
        let query = supabase
            .from('events')
            .select('*', { count: 'exact' });

        // Add filters if parameters are provided
        if (category) {
            query = query.eq('category', category);
        }

        if (sportDay) {
            query = query.eq('sport_day', sportDay);
        }

        if (sportType) {
            // Check if it's comma-separated (multiple types)
            if (sportType.includes(',')) {
                const types = sportType.split(',').map(type => type.trim());
                query = query.in('sport_type', types); // Using Supabase's .in() method for multiple values
            } else {
                query = query.eq('sport_type', sportType); // Single type
            }
        }

        if (genderType) {
            query = query.eq('gender_type', genderType);
        }

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            console.error('Database error:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to fetch events' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: data,
            count: data.length,
            totalCount: count || 0,
            limit,
            offset,
            totalPages: limit ? Math.ceil((count || 0) / limit) : 1
        });

    } catch (error) {
        console.error('Server error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

