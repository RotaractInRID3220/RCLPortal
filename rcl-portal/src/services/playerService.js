/**
 * Service for player-related operations
 * Handles player search and retrieval operations
 */

/**
 * Searches for players by name, NIC, or RMIS_ID
 * @param {string} name - The name to search for
 * @param {string} nic - The NIC to search for
 * @param {string} rmisId - The RMIS_ID to search for
 * @param {number} page - Page number for pagination (default: 1)
 * @param {number} limit - Number of results per page (default: 10)
 * @returns {Promise<Object>} Search results with players array and pagination info
 */
export const searchPlayers = async (name = '', nic = '', rmisId = '', page = 1, limit = 10) => {
  try {
    // Check if at least one search field has a value
    if (!name.trim() && !nic.trim() && !rmisId.trim()) {
      return { players: [], total: 0, page, limit };
    }

    const params = new URLSearchParams();
    if (name.trim()) params.append('name', name.trim());
    if (nic.trim()) params.append('nic', nic.trim());
    if (rmisId.trim()) params.append('rmisId', rmisId.trim());
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    const response = await fetch(`/api/players/search?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to search players');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error searching players:', error);
    throw error;
  }
};

/**
 * Fetches a single player by RMIS_ID
 * @param {string} rmisId - The RMIS_ID of the player
 * @returns {Promise<Object>} Player details including name, club, NIC, etc.
 */
export const getPlayerByRMISId = async (rmisId) => {
  try {
    if (!rmisId) {
      throw new Error('RMIS_ID is required');
    }

    const response = await fetch(`/api/players/${rmisId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch player');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error fetching player:', error);
    throw error;
  }
};

/**
 * Fetches all players for a specific club
 * @param {number} clubId - The club ID to fetch players for
 * @returns {Promise<Array>} Array of player objects
 */
export const getPlayersByClub = async (clubId) => {
  try {
    if (!clubId) {
      throw new Error('Club ID is required');
    }

    const response = await fetch(`/api/players?club_id=${clubId}&list=true`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch players');
    }
    
    return result.players || [];
  } catch (error) {
    console.error('Error fetching players by club:', error);
    throw error;
  }
};

/**
 * Fetches player's registered sports for a specific sport day
 * @param {string} rmisId - The RMIS_ID of the player
 * @param {string} sportDay - The sport day identifier (e.g., 'D-01')
 * @returns {Promise<Array>} Array of sport registrations
 */
export const getPlayerSportsForDay = async (rmisId, sportDay) => {
  try {
    if (!rmisId) {
      throw new Error('RMIS_ID is required');
    }

    if (!sportDay) {
      throw new Error('Sport day is required');
    }

    const response = await fetch(`/api/players/${rmisId}/sports?sportDay=${sportDay}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch sports');
    }
    
    return result.data || [];
  } catch (error) {
    console.error('Error fetching player sports:', error);
    throw error;
  }
};

/**
 * OPTIMIZED: Fetches all player verification data in a single API call
 * Combines player details, sports for day, and registration status
 * 
 * @param {string} rmisId - The RMIS_ID of the player
 * @param {string} sportDay - The sport day identifier (e.g., 'D-01')
 * @returns {Promise<Object>} Object containing player, sports, and registration data
 * 
 * Performance: Reduces 3 API calls to 1 (67% reduction)
 * 
 * Returns:
 * {
 *   player: { RMIS_ID, name, NIC, clubs: {...} },
 *   sports: [...],
 *   registration: { isRegistered: boolean, registration: {...} }
 * }
 */
export const getPlayerVerificationData = async (rmisId, sportDay) => {
  try {
    if (!rmisId) {
      throw new Error('RMIS_ID is required');
    }

    if (!sportDay) {
      throw new Error('Sport day is required');
    }

    const response = await fetch(`/api/players/${rmisId}/verification?sportDay=${sportDay}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch player verification data');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error fetching player verification data:', error);
    throw error;
  }
};
