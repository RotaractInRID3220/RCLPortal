import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

/**
 * Helper function to check if portal is open
 */
async function isPortalOpen() {
  try {
    const { data, error } = await supabase
      .from('portal_settings')
      .select('is_enabled')
      .eq('setting_key', 'registration_portal_open')
      .single();

    if (error) {
      // If no record exists, default to closed for security
      if (error.code === 'PGRST116') {
        return false;
      }
      console.error('Error checking portal status:', error);
      return false;
    }

    return data?.is_enabled === true;
  } catch (error) {
    console.error('Error checking portal status:', error);
    return false;
  }
}

/**
 * Registers a player for a specific sport day
 * POST /api/day-registrations
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { RMIS_ID, sport_day } = body;

    if (!RMIS_ID || !sport_day) {
      return NextResponse.json(
        { success: false, error: 'RMIS_ID and sport_day are required' },
        { status: 400 }
      );
    }

    // SECURITY CHECK: Verify portal is open before allowing registration
    const portalOpen = await isPortalOpen();
    if (!portalOpen) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Registration portal is currently closed',
          portalClosed: true 
        },
        { status: 403 }
      );
    }

    // Check if player already registered for this sport day
    const { data: existingRegistration, error: checkError } = await supabase
      .from('day_registrations')
      .select('id')
      .eq('RMIS_ID', RMIS_ID)
      .eq('sport_day', sport_day)
      .single();

    if (existingRegistration) {
      return NextResponse.json(
        { success: false, error: 'Player already registered for this sport day', alreadyRegistered: true },
        { status: 409 }
      );
    }

    // Insert new registration
    const { data, error } = await supabase
      .from('day_registrations')
      .insert({ RMIS_ID, sport_day })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Player registered successfully'
    });

  } catch (error) {
    console.error('Error registering player:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Checks if a player is registered for a specific sport day
 * GET /api/day-registrations?rmisId=xxx&sportDay=xxx
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const rmisId = searchParams.get('rmisId');
    const sportDay = searchParams.get('sportDay');

    if (!rmisId || !sportDay) {
      return NextResponse.json(
        { success: false, error: 'rmisId and sportDay are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('day_registrations')
      .select('*')
      .eq('RMIS_ID', rmisId)
      .eq('sport_day', sportDay)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        isRegistered: !!data,
        registration: data || null
      },
      message: data ? 'Player is registered' : 'Player is not registered'
    });

  } catch (error) {
    console.error('Error checking registration:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
