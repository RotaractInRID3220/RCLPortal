/**
 * Service for managing club points operations
 * Handles fetching matches and awarding tournament points
 */

/**
 * Fetches all matches for a specific sport
 * @param {number} sportId - The sport ID
 * @returns {Promise<Object>} Match data with success status
 */
export const fetchSportMatches = async (sportId) => {
  try {
    const response = await fetch(`/api/brackets?sport_id=${sportId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch matches');
    }
    
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('Error fetching sport matches:', error);
    throw error;
  }
};

/**
 * Awards tournament points to teams based on their placement
 * @param {number} sportId - The sport ID
 * @param {Array} standings - Array of {club_id, place, points}
 * @returns {Promise<Object>} Result with success status
 */
export const awardTournamentPoints = async (sportId, standings) => {
  try {
    const response = await fetch('/api/club-points/award', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sport_id: sportId,
        standings
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to award points');
    }
    
    return result;
  } catch (error) {
    console.error('Error awarding tournament points:', error);
    throw error;
  }
};

/**
 * Fetches club points for a specific sport
 * @param {number} sportId - The sport ID
 * @returns {Promise<Object>} Club points data
 */
export const fetchClubPointsBySport = async (sportId) => {
  try {
    const response = await fetch(`/api/club-points?sport_id=${sportId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch club points');
    }
    
    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('Error fetching club points:', error);
    throw error;
  }
};
