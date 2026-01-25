/**
 * Service for day registration operations
 * Handles player registration for sport days
 */

/**
 * Registers a player for a specific sport day
 * @param {string} rmisId - The RMIS_ID of the player
 * @param {string} sportDay - The sport day identifier (e.g., 'D-01')
 * @returns {Promise<Object>} Registration result
 */
export const registerPlayerForDay = async (rmisId, sportDay) => {
  try {
    const response = await fetch('/api/day-registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        RMIS_ID: rmisId,
        sport_day: sportDay
      })
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to register player');
    }

    return result.data;
  } catch (error) {
    console.error('Error registering player:', error);
    throw error;
  }
};

/**
 * Checks if a player is registered for a specific sport day
 * @param {string} rmisId - The RMIS_ID of the player
 * @param {string} sportDay - The sport day identifier (e.g., 'D-01')
 * @returns {Promise<Object>} Registration status { isRegistered, registration }
 */
export const checkPlayerRegistration = async (rmisId, sportDay) => {
  try {
    const response = await fetch(`/api/day-registrations?rmisId=${rmisId}&sportDay=${sportDay}`);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to check registration');
    }

    return result.data;
  } catch (error) {
    console.error('Error checking registration:', error);
    throw error;
  }
};

/**
 * Fetches day registrations grouped by event
 * @param {string} sportDay - Optional sport day filter (e.g., 'D-01')
 * @param {number} sportId - Optional sport/event ID filter
 * @returns {Promise<Object>} Event-wise registrations data
 */
export const fetchDayRegistrationsByEvent = async (sportDay = null, sportId = null) => {
  try {
    const params = new URLSearchParams();
    if (sportDay) params.append('sportDay', sportDay);
    if (sportId) params.append('sportId', sportId);

    const queryString = params.toString();
    const url = `/api/admin/day-registrations${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url);
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch day registrations');
    }

    return result.data;
  } catch (error) {
    console.error('Error fetching day registrations:', error);
    throw error;
  }
};
