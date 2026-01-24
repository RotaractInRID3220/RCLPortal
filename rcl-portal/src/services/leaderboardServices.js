/**
 * Optimized Leaderboard Services
 * Provides cached, efficient data fetching for leaderboard components
 */

/**
 * Fetch aggregated leaderboard data with caching
 * @param {Object} options - Query options
 * @param {string} options.category - Club category filter ('community' or 'institute')
 * @param {number} options.limit - Number of results to return
 * @param {number} options.offset - Pagination offset
 * @returns {Promise<Object>} Leaderboard data with pagination info
 */
export const fetchLeaderboardData = async (options = {}) => {
  try {
    const { category, limit, offset = 0, _t } = options;
    
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    // Add cache-busting timestamp to prevent browser/CDN caching
    params.append('_t', _t || Date.now().toString());

    const response = await fetch(`/api/leaderboard/aggregated?${params}`, {
      cache: 'no-store', // Prevent browser caching
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch leaderboard data`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch leaderboard data');
    }

    return {
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
      usedFallback: result.usedFallback || false
    };
  } catch (error) {
    console.error('Error fetching leaderboard data:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
};

/**
 * Fetch detailed club information with points breakdown
 * @param {string|number} clubId - Club ID
 * @param {number} _t - Cache-busting timestamp (optional)
 * @returns {Promise<Object>} Club details with points breakdown
 */
export const fetchClubDetails = async (clubId, _t) => {
  try {
    if (!clubId) {
      throw new Error('Club ID is required');
    }

    // Add cache-busting timestamp
    const params = new URLSearchParams();
    params.append('_t', _t || Date.now().toString());

    const response = await fetch(`/api/leaderboard/club-details/${clubId}?${params}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Club not found');
      }
      throw new Error(`HTTP ${response.status}: Failed to fetch club details`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch club details');
    }

    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('Error fetching club details:', error);
    return {
      success: false,
      error: error.message,
      data: null
    };
  }
};

/**
 * Fetch club points for admin leaderboard with optimized filtering
 * @param {Object} options - Query options
 * @param {string|number} options.sportId - Sport ID filter
 * @param {string} options.category - Club category filter
 * @param {number} options.limit - Number of results
 * @param {number} options.offset - Pagination offset
 * @returns {Promise<Object>} Club points data
 */
export const fetchClubPoints = async (options = {}) => {
  try {
    const { sportId, category, limit, offset = 0 } = options;
    
    const params = new URLSearchParams();
    if (sportId) params.append('sport_id', sportId.toString());
    if (category) params.append('category', category);
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());

    const response = await fetch(`/api/club-points?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch club points`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch club points');
    }

    return {
      success: true,
      data: result.data,
      pagination: result.pagination
    };
  } catch (error) {
    console.error('Error fetching club points:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
};

/**
 * Add club points entry
 * @param {Object} pointData - Points data to add
 * @param {string|number} pointData.clubId - Club ID
 * @param {string|number} pointData.sportId - Sport ID
 * @param {number} pointData.points - Points value
 * @param {number} pointData.place - Place/rank
 * @returns {Promise<Object>} Result of the operation
 */
export const addClubPoints = async (pointData) => {
  try {
    const { clubId, sportId, points, place } = pointData;

    if (!clubId || !sportId || !points || !place) {
      throw new Error('All fields are required: clubId, sportId, points, place');
    }

    const response = await fetch('/api/club-points', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        club_id: clubId,
        sport_id: sportId,
        points: parseInt(points),
        place: parseInt(place)
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}: Failed to add points`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to add points');
    }

    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('Error adding club points:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Delete club points entry
 * @param {string|number} pointId - Point entry ID to delete
 * @returns {Promise<Object>} Result of the operation
 */
export const deleteClubPoints = async (pointId) => {
  try {
    if (!pointId) {
      throw new Error('Point ID is required');
    }

    const response = await fetch(`/api/club-points?point_id=${pointId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}: Failed to delete points`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete points');
    }

    return {
      success: true,
      message: result.message
    };
  } catch (error) {
    console.error('Error deleting club points:', error);
    return {
      success: false,
      error: error.message
    };
  }
};