import { toast } from 'sonner';

/**
 * Service for handling team-related API calls
 */
class TeamService {
  /**
   * Creates teams for all sports or a specific sport
   * @param {number|null} sportId - Sport ID to create teams for, or null for all sports
   * @returns {Promise<Object>} Response with created teams information
   */
  static async createTeams(sportId = null) {
    try {
      const body = sportId ? { sport_id: sportId } : {};
      
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create teams');
      }

      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Error creating teams:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Fetches teams for a specific sport with registration counts
   * @param {number} sportId - Sport ID to fetch teams for
   * @param {string} searchTerm - Optional search term to filter clubs
   * @returns {Promise<Object>} Response with teams data
   */
  static async getTeamsForSport(sportId, searchTerm = '') {
    try {
      const searchParams = new URLSearchParams({
        sport_id: sportId.toString(),
        ...(searchTerm && { search: searchTerm })
      });
      
      const response = await fetch(`/api/teams?${searchParams}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch teams');
      }

      return {
        success: true,
        teams: result.teams || [],
        sportName: result.sport_name || 'Unknown Sport'
      };
    } catch (error) {
      console.error('Error fetching teams:', error);
      return {
        success: false,
        error: error.message,
        teams: [],
        sportName: 'Unknown Sport'
      };
    }
  }

  /**
   * Fetches all teams across all sports
   * @returns {Promise<Object>} Response with all teams data
   */
  static async getAllTeams() {
    try {
      const response = await fetch('/api/teams');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch teams');
      }

      return {
        success: true,
        teams: result.teams || []
      };
    } catch (error) {
      console.error('Error fetching all teams:', error);
      return {
        success: false,
        error: error.message,
        teams: []
      };
    }
  }

  /**
   * Deletes a specific team
   * @param {number} teamId - Team ID to delete
   * @returns {Promise<Object>} Response indicating success/failure
   */
  static async deleteTeam(teamId) {
    try {
      const response = await fetch(`/api/teams?team_id=${teamId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete team');
      }

      return {
        success: true,
        message: result.message
      };
    } catch (error) {
      console.error('Error deleting team:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Gets team statistics for a sport
   * @param {number} sportId - Sport ID to get stats for
   * @returns {Promise<Object>} Team statistics
   */
  static async getTeamStats(sportId) {
    try {
      const teamsResult = await this.getTeamsForSport(sportId);
      
      if (!teamsResult.success) {
        throw new Error(teamsResult.error);
      }

      const teams = teamsResult.teams;
      const totalTeams = teams.length;
      const totalPlayers = teams.reduce((sum, team) => sum + team.player_count, 0);
      const averagePlayersPerTeam = totalTeams > 0 ? Math.round(totalPlayers / totalTeams) : 0;

      // Get club distribution
      const clubsWithTeams = teams.map(team => team.clubs.club_name).sort();

      return {
        success: true,
        stats: {
          totalTeams,
          totalPlayers,
          averagePlayersPerTeam,
          clubsWithTeams,
          sportName: teamsResult.sportName
        }
      };
    } catch (error) {
      console.error('Error getting team stats:', error);
      return {
        success: false,
        error: error.message,
        stats: {
          totalTeams: 0,
          totalPlayers: 0,
          averagePlayersPerTeam: 0,
          clubsWithTeams: [],
          sportName: 'Unknown Sport'
        }
      };
    }
  }

  /**
   * Creates teams with user feedback via toast notifications
   * @param {number|null} sportId - Sport ID or null for all sports
   * @param {string} sportName - Name of the sport for feedback messages
   * @returns {Promise<boolean>} True if successful
   */
  static async createTeamsWithFeedback(sportId = null, sportName = '') {
    const loadingToast = toast.loading(
      sportId ? `Creating teams for ${sportName}...` : 'Creating teams for all sports...'
    );

    try {
      const result = await this.createTeams(sportId);

      toast.dismiss(loadingToast);

      if (result.success) {
        const data = result.data;
        
        if (sportId) {
          // Single sport feedback
          const sportResult = data.results[0];
          if (sportResult && sportResult.created > 0) {
            toast.success(`Created ${sportResult.created} new teams for ${sportName}`);
          } else {
            toast.info(`No new teams created for ${sportName}. ${sportResult?.message || 'All eligible teams already exist.'}`);
          }
        } else {
          // All sports feedback
          if (data.total_created > 0) {
            toast.success(`Teams created successfully! Created ${data.total_created} new teams, skipped ${data.total_skipped} existing teams.`);
          } else {
            toast.info(`No new teams created. All eligible teams already exist.`);
          }
        }
        
        return true;
      } else {
        toast.error(result.error || 'Failed to create teams');
        return false;
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to create teams. Please try again.');
      console.error('Error in createTeamsWithFeedback:', error);
      return false;
    }
  }

  /**
   * Deletes a team with user feedback via toast notifications
   * @param {number} teamId - Team ID to delete
   * @param {string} clubName - Club name for feedback messages
   * @returns {Promise<boolean>} True if successful
   */
  static async deleteTeamWithFeedback(teamId, clubName) {
    const loadingToast = toast.loading(`Deleting team from ${clubName}...`);

    try {
      const result = await this.deleteTeam(teamId);

      toast.dismiss(loadingToast);

      if (result.success) {
        toast.success(`Team from ${clubName} deleted successfully`);
        return true;
      } else {
        toast.error(result.error || 'Failed to delete team');
        return false;
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to delete team. Please try again.');
      console.error('Error in deleteTeamWithFeedback:', error);
      return false;
    }
  }
}

export default TeamService;