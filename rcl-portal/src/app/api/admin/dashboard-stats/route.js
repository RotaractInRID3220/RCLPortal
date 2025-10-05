import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// Fetches comprehensive dashboard statistics for admin overview
export async function GET() {
  try {
    // Fetch total clubs count
    const { count: totalClubs, error: clubsError } = await supabase
      .from('clubs')
      .select('*', { count: 'exact', head: true });

    if (clubsError) {
      console.error('Error fetching clubs count:', clubsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch clubs data' },
        { status: 500 }
      );
    }

    // Fetch clubs by category
    const { data: clubCategories, error: categoriesError } = await supabase
      .from('clubs')
      .select('category');

    if (categoriesError) {
      console.error('Error fetching club categories:', categoriesError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch club categories' },
        { status: 500 }
      );
    }

    // Count community and institute based clubs
    const communityClubs = clubCategories?.filter(club => club.category === 'community').length || 0;
    const instituteClubs = clubCategories?.filter(club => club.category === 'institute').length || 0;

    // Fetch total players count
    const { count: totalPlayers, error: playersError } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });

    if (playersError) {
      console.error('Error fetching players count:', playersError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch players data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        totalClubs: totalClubs || 0,
        totalPlayers: totalPlayers || 0,
        communityClubs,
        instituteClubs
      }
    });

  } catch (error) {
    console.error('Unexpected error in dashboard stats:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}