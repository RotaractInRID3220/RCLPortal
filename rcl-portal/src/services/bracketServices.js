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
        throw new Error(result.error || 'Failed to fetch bracket data');
      }

      return result.data;
    } catch (error) {
      console.error('Error fetching bracket data:', error);
      throw error;
    }
  }

  static async updateMatchResult(match_id, team1_score, team2_score) {
    try {
      const response = await fetch('/api/brackets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          match_id,
          team1_score,
          team2_score,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update match');
      }

      return result.data;
    } catch (error) {
      console.error('Error updating match result:', error);
      throw error;
    }
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

  // Transform match data to bracket format (moved from API)
  static transformToBracketFormat(matches) {
    const roundMap = {
      0: '1st Round',
      1: '2nd Round',
      2: 'Quarter Finals',
      3: 'Semi Finals',
      4: 'Consolation Finals',
      5: 'Finals',
    };

    const groupedByRound = matches.reduce((acc, match) => {
      const roundName = roundMap[match.round_id] || `Round ${match.round_id}`;
      
      if (!acc[roundName]) {
        acc[roundName] = [];
      }
      
      acc[roundName].push({
        id: match.match_id,
        date: new Date().toDateString(),
        teams: [
          { 
            name: match.team1?.club?.club_name || 'TBD',
            id: match.team1_id,
            seed: match.team1?.seed_number
          },
          { 
            name: match.team2?.club?.club_name || 'TBD',
            id: match.team2_id,
            seed: match.team2?.seed_number
          }
        ],
        score: [match.team1_score || 0, match.team2_score || 0],
        status: (match.team1_score > 0 || match.team2_score > 0) ? 'completed' : 'scheduled',
        round_id: match.round_id,
        match_order: match.match_order
      });
      
      return acc;
    }, {});

    const sortedRounds = Object.entries(groupedByRound)
      .sort(([, seedsA], [, seedsB]) => {
        const roundA = seedsA[0]?.round_id || 0;
        const roundB = seedsB[0]?.round_id || 0;
        return roundA - roundB;
      })
      .map(([title, seeds]) => ({
        title,
        seeds: seeds.sort((a, b) => a.match_order - b.match_order)
      }));

    return sortedRounds;
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
        if (seed.status === 'completed' || (seed.score[0] > 0 || seed.score[1] > 0)) {
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
        seed.status !== 'completed' && seed.score[0] === 0 && seed.score[1] === 0
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
