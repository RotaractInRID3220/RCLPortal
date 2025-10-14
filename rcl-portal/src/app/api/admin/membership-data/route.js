import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get all clubs
    const { data: clubs, error: clubsError } = await supabase
      .from('clubs')
      .select('club_id, club_name')
      .order('club_name', { ascending: true });

    if (clubsError) {
      console.error('Error fetching clubs:', clubsError);
      return NextResponse.json(
        { error: 'Failed to fetch clubs' },
        { status: 500 }
      );
    }

    if (!clubs || clubs.length === 0) {
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    // Get membership data for each club
    const membershipData = [];

    for (const club of clubs) {
      // Get all players for this club
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('RMIS_ID, status')
        .eq('club_id', club.club_id);

      if (playersError) {
        console.error(`Error fetching players for club ${club.club_id}:`, playersError);
        continue;
      }

      // Count general members (status = 1) and prospective members (status = 5)
      const generalMembers = players.filter(player => player.status === 1).length;
      const prospectiveMembers = players.filter(player => player.status === 5).length;
      const totalPlayers = players.length;

      // Calculate percentage
      const generalMemberPercentage = totalPlayers > 0 ? (generalMembers / totalPlayers) * 100 : 0;

      membershipData.push({
        club_id: club.club_id,
        club_name: club.club_name,
        general_members_count: generalMembers,
        prospective_members_count: prospectiveMembers,
        total_players_count: totalPlayers,
        general_member_percentage: generalMemberPercentage
      });
    }

    return NextResponse.json({
      success: true,
      data: membershipData
    });

  } catch (error) {
    console.error('Error fetching membership data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}