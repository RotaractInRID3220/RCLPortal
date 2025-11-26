import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request) {
  try {
    const { club_id } = await request.json();

    // Build query based on whether club_id is provided
    let playersQuery = supabase
      .from('players')
      .select('RMIS_ID, status');

    if (club_id) {
      playersQuery = playersQuery.eq('club_id', club_id);
    }

    const { data: players, error: playersError } = await playersQuery;

    if (playersError) {
      console.error('Error fetching players:', playersError);
      return NextResponse.json(
        { error: 'Failed to fetch players' },
        { status: 500 }
      );
    }

    if (!players || players.length === 0) {
      const scope = club_id ? 'this club' : 'the system';
      return NextResponse.json({
        success: true,
        message: `No players found for ${scope}`,
        updatedCount: 0
      });
    }

    // Step 2: Get all RMIS IDs to check
    const rmisIds = players.map(p => p.RMIS_ID).filter(Boolean);

    if (rmisIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No valid RMIS IDs found',
        updatedCount: 0
      });
    }

    // Step 3: Fetch data from RMIS in one query using IN clause
    const placeholders = rmisIds.map(() => '?').join(',');
    const sql = `SELECT membership_id, status, nic_pp FROM club_membership_data WHERE membership_id IN (${placeholders}) AND status IN (1, 3, 5)`;

    const res = await fetch('https://info.rotaract3220.org/api/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.NEXT_PUBLIC_DBMID_API_KEY,
      },
      body: JSON.stringify({
        sql,
        params: rmisIds,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'RMIS API Error');
    }

    const rmisData = data.results || [];

    // Step 4: Create a map for quick lookup and normalize status (3 -> 1)
    const rmisStatusMap = new Map();
    const rmisNicMap = new Map();
    rmisData.forEach(record => {
      const normalizedStatus = record.status === 3 ? 1 : record.status;
      rmisStatusMap.set(record.membership_id, normalizedStatus);
      rmisNicMap.set(record.membership_id, record.nic_pp || null);
    });

    // Step 5: Find players that need updating (status or NIC)
    const playersToUpdate = [];
    players.forEach(player => {
      const rmisStatus = rmisStatusMap.get(player.RMIS_ID);
      const rmisNic = rmisNicMap.get(player.RMIS_ID);
      
      const statusNeedsUpdate = rmisStatus !== undefined && rmisStatus !== player.status;
      const nicNeedsUpdate = rmisNic !== undefined && rmisNic !== player.NIC && rmisNic !== null;
      
      if (statusNeedsUpdate || nicNeedsUpdate) {
        playersToUpdate.push({
          RMIS_ID: player.RMIS_ID,
          oldStatus: player.status,
          newStatus: rmisStatus,
          oldNic: player.NIC,
          newNic: rmisNic,
          updateStatus: statusNeedsUpdate,
          updateNic: nicNeedsUpdate
        });
      }
    });

    if (playersToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All players are already up to date',
        updatedCount: 0
      });
    }

    // Step 6: Batch update players in Supabase
    const updatePromises = playersToUpdate.map(player => {
      const updateData = {};
      
      if (player.updateStatus) {
        updateData.status = player.newStatus;
      }
      
      if (player.updateNic) {
        updateData.NIC = player.newNic;
      }

      let updateQuery = supabase
        .from('players')
        .update(updateData)
        .eq('RMIS_ID', player.RMIS_ID);

      // Only filter by club_id if provided (for club-specific sync)
      if (club_id) {
        updateQuery = updateQuery.eq('club_id', club_id);
      }

      return updateQuery;
    });

    const updateResults = await Promise.all(updatePromises);

    // Check for any errors in the batch update
    const errors = updateResults.filter(result => result.error);
    if (errors.length > 0) {
      console.error('Some updates failed:', errors);
    }

    const successfulUpdates = updateResults.filter(result => !result.error).length;

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${successfulUpdates} player(s)`,
      updatedCount: successfulUpdates,
      updates: playersToUpdate.map(p => ({
        RMIS_ID: p.RMIS_ID,
        changes: {
          ...(p.updateStatus && {
            status: {
              from: p.oldStatus === 1 ? 'General' : p.oldStatus === 5 ? 'Prospective' : 'Unknown',
              to: p.newStatus === 1 ? 'General' : p.newStatus === 5 ? 'Prospective' : 'Unknown'
            }
          }),
          ...(p.updateNic && {
            nic: {
              from: p.oldNic || 'Not set',
              to: p.newNic || 'Not set'
            }
          })
        }
      }))
    });

  } catch (error) {
    console.error('Error syncing with RMIS:', error);
    return NextResponse.json(
      { error: 'Failed to sync with RMIS: ' + error.message },
      { status: 500 }
    );
  }
}
