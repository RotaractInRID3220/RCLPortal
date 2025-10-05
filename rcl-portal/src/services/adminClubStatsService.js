// adminClubStatsService.js
// Returns registered/total clubs for each category
import { supabase } from '@/lib/supabaseClient';

export async function getRegisteredClubStats() {
  // Get all clubs
  const { data: clubs, error: clubsError } = await supabase
    .from('clubs')
    .select('club_id, category');
  if (clubsError) throw clubsError;

  // Get all players
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('club_id');
  if (playersError) throw playersError;

  // Map club_id to registered status
  const registeredClubIds = new Set(players.map(p => p.club_id));
  const stats = {
    community: { registered: 0, total: 0 },
    institute: { registered: 0, total: 0 }
  };
  clubs.forEach(club => {
    if (club.category === 'community' || club.category === 'institute') {
      stats[club.category].total++;
      if (registeredClubIds.has(club.club_id)) {
        stats[club.category].registered++;
      }
    }
  });
  return stats;
}
