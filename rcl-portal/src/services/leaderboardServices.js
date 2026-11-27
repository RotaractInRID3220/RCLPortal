/**
 * Optimized Leaderboard Services
 * Provides cached, efficient data fetching for leaderboard components
 */

/**
 * Public leaderboard from the server snapshot. No client cache and no cache-busting query:
 * `cache: 'no-cache'` makes the browser revalidate with the ETag on every call (a 304 costs almost
 * nothing, a changed leaderboard is returned at once).
 * @param {{category?: 'community'|'institute', limit?: number, offset?: number}} options
 */
export const fetchLeaderboardData = async (options = {}) => {
  try {
    const { category, limit, offset = 0 } = options;
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (limit) params.append('limit', String(limit));
    if (offset) params.append('offset', String(offset));

    const response = await fetch(`/api/leaderboard/aggregated?${params}`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch leaderboard data`);
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Failed to fetch leaderboard data');

    return {
      success: true,
      data: result.data,
      total: result.total,
      pagination: result.pagination,
      version: result.version,
      generatedAt: result.generated_at
    };
  } catch (error) {
    console.error('Error fetching leaderboard data:', error);
    return { success: false, error: error.message, data: [] };
  }
};

/**
 * Detailed points breakdown of one club (from the snapshot).
 * @param {string|number} clubId
 */
export const fetchClubDetails = async (clubId) => {
  try {
    if (!clubId) throw new Error('Club ID is required');
    const response = await fetch(`/api/leaderboard/club-details/${clubId}`, { cache: 'no-cache' });
    if (!response.ok) {
      if (response.status === 404) throw new Error('Club not found');
      throw new Error(`HTTP ${response.status}: Failed to fetch club details`);
    }
    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Failed to fetch club details');
    return { success: true, data: result.data, version: result.version, generatedAt: result.generated_at };
  } catch (error) {
    console.error('Error fetching club details:', error);
    return { success: false, error: error.message, data: null };
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

    const response = await fetch(`/api/club-points?${params}`, { cache: 'no-store' });
    
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
 * Add a manual club points entry (admin). Points: any non-zero whole number (negative = deduction).
 * @param {{clubId: number|string, sportId?: number|string|null, points: number|string, place?: number|string, note?: string}} pointData
 */
export const addClubPoints = async (pointData) => {
  try {
    const { clubId, sportId, points, place, note } = pointData;
    const pointsNum = parseInt(points, 10);
    if (!clubId || !Number.isInteger(pointsNum) || pointsNum === 0) {
      throw new Error('Club and a non-zero points value are required');
    }

    const response = await fetch('/api/club-points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        club_id: Number(clubId),
        sport_id: sportId ? Number(sportId) : null,
        points: pointsNum,
        place: place ? parseInt(place, 10) : null,
        note: note || null
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      throw new Error(result.error || `HTTP ${response.status}: Failed to add points`);
    }
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error adding club points:', error);
    return { success: false, error: error.message };
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