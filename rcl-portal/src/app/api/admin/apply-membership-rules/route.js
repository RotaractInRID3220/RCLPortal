
import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';

// Calculate deduction points based on general member percentage
const calculateDeductionPoints = (percentage, totalPlayers) => {
  // Don't apply deductions to clubs with fewer than 5 players
  if (totalPlayers < 5) return 0;

  if (percentage >= 67 && percentage < 70) return -25;
  if (percentage >= 62 && percentage < 67) return -50;
  if (percentage < 62) return -80;
  return 0;
};

export async function POST() {
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
        message: 'No clubs found to process',
        deductionsApplied: 0
      });
    }

    const deductionsApplied = [];
    let totalDeductions = 0;

    // Process each club
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

      // Count general members (status = 1)
      const generalMembers = players.filter(player => player.status === 1).length;
      const totalPlayers = players.length;

      // Calculate percentage
      const generalMemberPercentage = totalPlayers > 0 ? (generalMembers / totalPlayers) * 100 : 0;

      // Calculate deduction points
      const deductionPoints = calculateDeductionPoints(generalMemberPercentage, totalPlayers);

      if (deductionPoints !== 0) {
        // Insert deduction record into club_points table
        const { data: deductionRecord, error: deductionError } = await supabase
          .from('club_points')
          .insert([{
            club_id: club.club_id,
            points: deductionPoints,
            created_at: new Date().toISOString()
            // sport_id and place are null for penalty points
          }])
          .select();

        if (deductionError) {
          console.error(`Error applying deduction for club ${club.club_id}:`, deductionError);
          continue;
        }

        deductionsApplied.push({
          club_id: club.club_id,
          club_name: club.club_name,
          general_member_percentage: generalMemberPercentage,
          deduction_points: deductionPoints
        });

        totalDeductions++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully applied membership rules. ${totalDeductions} clubs received penalty points.`,
      deductionsApplied,
      totalDeductions
    });

  } catch (error) {
    console.error('Error applying membership rules:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}