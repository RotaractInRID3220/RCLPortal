import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

/**
 * GET /api/admin/administration/stats
 *
 * Fetches comprehensive administration statistics in a single optimized query
 * Includes all system-wide metrics for the administration dashboard
 */
export async function GET() {
  try {
    // Execute all queries in parallel for maximum performance and minimal DB load
    const [
      clubsResult,
      playersResult,
      registrationsResult,
      eventsResult,
      teamsResult,
      paymentsResult,
      playersByGenderResult,
      registrationsByCategoryResult
    ] = await Promise.all([
      // Total clubs
      supabase.from('clubs').select('*', { count: 'exact', head: true }),

      // Total players
      supabase.from('players').select('*', { count: 'exact', head: true }),

      // Total registrations
      supabase.from('registrations').select('*', { count: 'exact', head: true }),

      // Total events
      supabase.from('events').select('*', { count: 'exact', head: true }),

      // Total teams
      supabase.from('teams').select('*', { count: 'exact', head: true }),

      // Total payments (approved)
      supabase.from('payment_slips').select('*', { count: 'exact', head: true }).eq('approved', true),

      // Players by gender
      supabase.from('players').select('gender'),

      // Events by category for registrations breakdown
      supabase.from('events').select('category, sport_type')
    ]);

    // Extract counts
    const totalClubs = clubsResult.count || 0;
    const totalPlayers = playersResult.count || 0;
    const totalRegistrations = registrationsResult.count || 0;
    const totalEvents = eventsResult.count || 0;
    const totalTeams = teamsResult.count || 0;
    const totalPayments = paymentsResult.count || 0;

    // Process players by gender
    const playersByGender = playersByGenderResult.data || [];
    console.log('Gender data sample:', playersByGender.slice(0, 5)); // Debug log
    const malePlayers = playersByGender.filter(p => 
      p.gender && (p.gender.toLowerCase() === 'male' || p.gender.toLowerCase() === 'm')
    ).length;
    const femalePlayers = playersByGender.filter(p => 
      p.gender && (p.gender.toLowerCase() === 'female' || p.gender.toLowerCase() === 'f')
    ).length;
    console.log('Gender counts:', { malePlayers, femalePlayers }); // Debug log

    // Process registrations by category (individual vs team sports)
    const eventsData = registrationsByCategoryResult.data || [];
    const individualEvents = eventsData.filter(e => e.sport_type === 'individual').length;
    const teamEvents = eventsData.filter(e => e.sport_type === 'team').length;

    // Calculate registration distribution (approximate based on event types)
    // This is an estimation since we don't have direct registration-to-category mapping
    const individualRegistrations = Math.round(totalRegistrations * (individualEvents / (individualEvents + teamEvents)) || 0);
    const teamRegistrations = totalRegistrations - individualRegistrations;

    return NextResponse.json({
      success: true,
      data: {
        totalClubs,
        totalPlayers,
        totalRegistrations,
        totalEvents,
        totalTeams,
        totalPayments,
        playersByGender: {
          male: malePlayers,
          female: femalePlayers
        },
        registrationsByCategory: {
          individual: individualRegistrations,
          team: teamRegistrations
        }
      }
    });

  } catch (error) {
    console.error('Error fetching administration stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch administration statistics' },
      { status: 500 }
    );
  }
}