/**
 * Service for admin dashboard operations
 * Handles all admin-specific API operations including statistics and overview data
 */

/**
 * Fetches all admin dashboard data in a single optimized API call
 * @param {string} leaderboardCategory - Category for leaderboard filtering
 * @param {number} leaderboardLimit - Number of leaderboard entries to fetch
 * @returns {Promise<Object>} Complete dashboard data including stats, leaderboard, and pending requests
 */
export const getOptimizedDashboardData = async (leaderboardCategory = 'community', leaderboardLimit = 10) => {
  try {
    const params = new URLSearchParams();
    if (leaderboardCategory) params.append('leaderboard_category', leaderboardCategory);
    if (leaderboardLimit) params.append('leaderboard_limit', leaderboardLimit.toString());

    const response = await fetch(`/api/admin/dashboard/optimized?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch dashboard data');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error fetching optimized dashboard data:', error);
    throw error;
  }
};

/**
 * Fetches admin dashboard statistics (legacy - kept for backward compatibility)
 * @returns {Promise<Object>} Dashboard statistics including clubs, players, and other metrics
 */
export const getAdminDashboardStats = async () => {
  try {
    const response = await fetch('/api/admin/dashboard-stats');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return result.data;
  } catch (error) {
    console.error('Error fetching admin dashboard stats:', error);
    throw error;
  }
};

/**
 * Fetches pending replacement requests count (legacy - kept for backward compatibility)
 * @returns {Promise<number>} Number of pending replacement requests
 */
export const getPendingReplacementRequests = async () => {
  try {
    const response = await fetch('/api/admin/pending-requests');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return result.data.pendingCount;
  } catch (error) {
    console.error('Error fetching pending replacement requests:', error);
    throw error;
  }
};

/**
 * Fetches leaderboard data for admin dashboard preview
 * @param {string} category - Filter by club category ('community', 'institute', or null for all)
 * @returns {Promise<Array>} Array of top clubs with points
 */
export const getLeaderboardPreview = async (category = null) => {
  try {
    let url = '/api/leaderboard/aggregated?limit=10'; // Get more clubs for filtering
    if (category) {
      url += `&category=${category}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return result.data;
  } catch (error) {
    console.error('Error fetching leaderboard preview:', error);
    throw error;
  }
};