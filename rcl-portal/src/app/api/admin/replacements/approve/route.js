import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

// Approves a replacement request, creates player record if needed, and updates registration
export async function POST(request) {
  try {
    const requestData = await request.json();
    const { request_id, approved_by } = requestData;

    if (!request_id || !approved_by) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: request_id and approved_by',
        },
        { status: 400 }
      );
    }

    // Fetch the replacement request with all necessary data
    const { data: replacementRequest, error: fetchError } = await supabase
      .from('replacement_requests')
      .select(
        `
        *,
        replacement_players:replacement_id (replacement_id, name, status, ri_number, gender, nic, birthdate),
        registrations:registrations_id (id, RMIS_ID, sport_id, club_id, main_player)
      `
      )
      .eq('id', request_id)
      .single();

    if (fetchError || !replacementRequest) {
      console.error('Error fetching replacement request:', fetchError);
      return NextResponse.json({ success: false, error: 'Replacement request not found' }, { status: 404 });
    }

    // Check if already processed
    if (replacementRequest.status !== null) {
      return NextResponse.json(
        { success: false, error: 'This request has already been processed' },
        { status: 400 }
      );
    }

    const newPlayerRMIS = replacementRequest.replacement_id;
    const replacementPlayerData = replacementRequest.replacement_players;
    const registrationData = replacementRequest.registrations;

    // Step 1: Check if the new player already exists in the players table
    const { data: existingPlayer, error: playerCheckError } = await supabase
      .from('players')
      .select('RMIS_ID')
      .eq('RMIS_ID', newPlayerRMIS)
      .maybeSingle();

    if (playerCheckError) {
      console.error('Error checking player existence:', playerCheckError);
      return NextResponse.json({ success: false, error: 'Failed to verify player record' }, { status: 500 });
    }

    // Step 2: If player doesn't exist, create a new record
    if (!existingPlayer) {
      const { error: insertPlayerError } = await supabase.from('players').insert({
        RMIS_ID: newPlayerRMIS,
        name: replacementPlayerData.name,
        club_id: replacementRequest.club_id,
        RI_ID: replacementPlayerData.ri_number || null,
        NIC: replacementPlayerData.nic || null,
        birthdate: replacementPlayerData.birthdate || null,
        gender: replacementPlayerData.gender,
        status: replacementPlayerData.status,
        registered_at: new Date().toISOString(),
      });

      if (insertPlayerError) {
        console.error('Error creating player record:', insertPlayerError);
        return NextResponse.json({ success: false, error: 'Failed to create player record' }, { status: 500 });
      }
    }

    // Step 3: Update the registration record with the new player RMIS_ID
    const { error: updateRegistrationError } = await supabase
      .from('registrations')
      .update({
        RMIS_ID: newPlayerRMIS,
      })
      .eq('id', registrationData.id);

    if (updateRegistrationError) {
      console.error('Error updating registration:', updateRegistrationError);
      return NextResponse.json({ success: false, error: 'Failed to update registration' }, { status: 500 });
    }

    // Step 4: Update the replacement request to approved
    const { data: updatedRequest, error: updateError } = await supabase
      .from('replacement_requests')
      .update({
        status: true,
        approved_at: new Date().toISOString(),
        approved_by: approved_by,
      })
      .eq('id', request_id)
      .select();

    if (updateError) {
      console.error('Error approving replacement request:', updateError);
      return NextResponse.json({ success: false, error: 'Failed to approve replacement request' }, { status: 500 });
    }

    if (!updatedRequest || updatedRequest.length === 0) {
      return NextResponse.json({ success: false, error: 'Replacement request not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      request: updatedRequest[0],
      message: 'Replacement request approved successfully',
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
