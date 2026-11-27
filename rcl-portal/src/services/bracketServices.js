// Service for handling bracket-related API calls
class BracketService {
  static async getBracketData(sport_id = 1) {
    try {
      const response = await fetch(`/api/brackets?sport_id=${sport_id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Ensure fresh data
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || result.error || 'Failed to fetch bracket data');
      }

      return result.data;
    } catch (error) {
      console.error('Error fetching bracket data:', error);
      throw error;
    }
  }

  // POST /api/brackets: one server transaction saves the score and advances the winner.
  static async post(payload, fallback) {
    const response = await fetch('/api/brackets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(payload),
    });
    let result = null;
    try { result = await response.json(); } catch { /* not JSON */ }
    if (!response.ok || !result?.success) {
      throw new Error(result?.error?.message || result?.error || fallback);
    }
    return result;
  }

  static async updateMatchResult(match_id, team1_score, team2_score) {
    const result = await BracketService.post({ match_id, team1_score, team2_score }, 'Failed to update match');
    return result.data;
  }

  static async clearMatchResult(match_id) {
    const result = await BracketService.post({ action: 'clear', match_id }, 'Failed to clear the result');
    return result.data;
  }

  static async generateBracket(sport_id, { replace = false, force = false } = {}) {
    return BracketService.post({ action: 'generate', sport_id, replace, force }, 'Failed to create the bracket');
  }

  // Raw matches (with team1/team2 clubs) for the mobile admin list.
  static async getRawMatches(sport_id) {
    const response = await fetch(`/api/brackets?sport_id=${sport_id}&raw=1`, { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error?.message || result.error || 'Failed to fetch matches');
    return result.matches || [];
  }

  static async getSportsEvents() {
    try {
      const response = await fetch('/api/events', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching sports events:', error);
      throw error;
    }
  }

  // Helper method to calculate tournament statistics
  static calculateTournamentStats(rounds) {
    if (!rounds || rounds.length === 0) {
      return {
        totalTeams: 0,
        matchesPlayed: 0,
        totalMatches: 0,
        currentRound: 'No matches'
      };
    }

    let totalMatches = 0;
    let matchesPlayed = 0;
    let totalTeams = 0;

    // Calculate total matches and played matches
    rounds.forEach(round => {
      totalMatches += round.seeds.length;
      
      round.seeds.forEach(seed => {
        if (seed.status === 'completed') {
          matchesPlayed++;
        }
      });
    });

    // Calculate total teams from the last round (which should have the most teams)
    const lastRound = rounds[rounds.length - 1];
    if (lastRound && lastRound.seeds.length > 0) {
      totalTeams = lastRound.seeds.length * 2; // Each seed has 2 teams
    }

    // Find current round (first round with unplayed matches)
    let currentRound = rounds[0]?.title || 'Tournament Complete';
    for (let i = rounds.length - 1; i >= 0; i--) {
      const round = rounds[i];
      const hasUnplayedMatches = round.seeds.some(seed => 
        seed.status !== 'completed'
      );
      
      if (hasUnplayedMatches) {
        currentRound = round.title;
        break;
      }
    }

    return {
      totalTeams,
      matchesPlayed,
      totalMatches,
      currentRound
    };
  }
}

export default BracketService;
