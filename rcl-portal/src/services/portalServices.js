/**
 * Service for portal dashboard operations
 * Handles portal user-specific API operations including club statistics and overview data
 */

/**
 * Fetches portal dashboard statistics for the logged-in user's club
 * @param {number} clubId - The club ID from userDeets
 * @returns {Promise<Object>} Dashboard statistics for the user's club
 */
export const getPortalDashboardStats = async (clubId) => {
  try {
    if (!clubId) {
      throw new Error('Club ID is required');
    }

    const response = await fetch('/api/portal/dashboard-stats', { cache: 'no-store' })  // the club comes from the session;
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch dashboard stats');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error fetching portal dashboard stats:', error);
    throw error;
  }
};

/**
 * Fetches optimized portal dashboard data including stats and leaderboard
 * @param {number} clubId - The club ID from userDeets
 * @param {string} leaderboardCategory - Category for leaderboard filtering
 * @param {number} leaderboardLimit - Number of leaderboard entries to fetch
 * @returns {Promise<Object>} Complete dashboard data for portal user
 */
export const getOptimizedPortalDashboardData = async (clubId, leaderboardCategory = 'community', leaderboardLimit = 10) => {
  try {
    if (!clubId) {
      throw new Error('Club ID is required');
    }

    const params = new URLSearchParams();
    if (leaderboardCategory) params.append('leaderboard_category', leaderboardCategory);
    if (leaderboardLimit) params.append('leaderboard_limit', leaderboardLimit.toString());

    const response = await fetch(`/api/portal/dashboard?${params}`, { cache: 'no-store' });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Portal dashboard API error:', response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      console.error('Portal dashboard data error:', result.error);
      throw new Error(result.error || 'Failed to fetch dashboard data');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error fetching optimized portal dashboard data:', error);
    throw error;
  }
};

/**
 * Fetches club rank within category for the user's club
 * @param {number} clubId - The club ID from userDeets
 * @returns {Promise<Object>} Club rank information including position and category
 */
export const getClubRank = async (clubId) => {
  try {
    if (!clubId) {
      throw new Error('Club ID is required');
    }

    const response = await fetch(`/api/portal/club-rank?club_id=${clubId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch club rank');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error fetching club rank:', error);
    throw error;
  }
};