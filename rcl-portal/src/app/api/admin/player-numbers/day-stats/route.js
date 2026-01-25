import { supabase } from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';
import { SPORT_DAYS } from '@/config/app.config';

/**
 * Fetches day registration statistics for all sport days
 * Returns counts of registered players vs day-registered players for each sport day
 * 
 * GET /api/admin/player-numbers/day-stats
 */
export async function GET(request) {
  try {
    const sportDays = Object.values(SPORT_DAYS).map(day => day.value);
    
    // Fetch stats for all sport days in parallel
    const statsPromises = sportDays.map(async (sportDay) => {
      // Fetch all registrations for this sport day (handling 1000 row limit)
      let allRegistrations = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: registrations, error: regError } = await supabase
          .from('registrations')
          .select(`
            RMIS_ID,
            events!inner(sport_day)
          `)
          .eq('events.sport_day', sportDay)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (regError) {
          console.error(`Error fetching registrations for ${sportDay}:`, regError);
          throw regError;
        }

        if (registrations && registrations.length > 0) {
          allRegistrations = [...allRegistrations, ...registrations];
          hasMore = registrations.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Fetch all day registrations for this sport day (handling 1000 row limit)
      let allDayRegistrations = [];
      page = 0;
      hasMore = true;

      while (hasMore) {
        const { data: dayRegs, error: dayError } = await supabase
          .from('day_registrations')
          .select('RMIS_ID')
          .eq('sport_day', sportDay)
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (dayError) {
          console.error(`Error fetching day registrations for ${sportDay}:`, dayError);
          throw dayError;
        }

        if (dayRegs && dayRegs.length > 0) {
          allDayRegistrations = [...allDayRegistrations, ...dayRegs];
          hasMore = dayRegs.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Create a set of RMIS_IDs that are day-registered for quick lookup
      const dayRegisteredSet = new Set(allDayRegistrations.map(dr => dr.RMIS_ID));

      // Get unique RMIS_IDs from registrations
      const uniqueRmisIds = [...new Set(allRegistrations.map(r => r.RMIS_ID))];
      
      // Count how many registered players are also day-registered
      const dayRegisteredCount = uniqueRmisIds.filter(rmisId => dayRegisteredSet.has(rmisId)).length;
      const notDayRegisteredCount = uniqueRmisIds.length - dayRegisteredCount;

      // Get sport day label
      const sportDayConfig = Object.values(SPORT_DAYS).find(day => day.value === sportDay);

      return {
        sportDay,
        label: sportDayConfig?.label || sportDay,
        totalRegistrations: allRegistrations.length,
        uniquePlayers: uniqueRmisIds.length,
        dayRegistered: dayRegisteredCount,
        notDayRegistered: notDayRegisteredCount,
        dayRegistrationRate: uniqueRmisIds.length > 0 
          ? Math.round((dayRegisteredCount / uniqueRmisIds.length) * 100) 
          : 0
      };
    });

    const stats = await Promise.all(statsPromises);

    return NextResponse.json({
      success: true,
      data: stats,
      message: 'Day registration stats fetched successfully'
    });

  } catch (error) {
    console.error('Error fetching day registration stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch day registration stats' },
      { status: 500 }
    );
  }
}
