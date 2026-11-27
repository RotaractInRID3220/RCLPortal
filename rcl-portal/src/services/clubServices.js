/**
 * Service for managing clubs data
 * Club reads, and the admin sync from RMIS (clubs are never typed in here)
 */

/**
 * Fetches all clubs from the API
 * @returns {Promise<Array>} Array of clubs
 */
export const fetchClubs = async () => {
  try {
    const response = await fetch('/api/clubs');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.clubs || [];
  } catch (error) {
    console.error('Error fetching clubs:', error);
    throw error;
  }
};

/**
 * Clubs are not created or edited here: they come from RMIS. Admin: pull the latest club list now
 * (the worker also does this hourly).
 */
export const syncClubsFromRmis = async () => {
  const response = await fetch('/api/clubs', { method: 'POST' });
  const body = await response.json();
  if (!body.success) throw new Error(body.error || 'Could not sync clubs from RMIS');
  return body.data;
};

/** Admin: every club including closed ones. */
export const fetchAllClubsAdmin = async () => {
  const response = await fetch('/api/clubs?include_inactive=1', { cache: 'no-store' });
  const body = await response.json();
  if (!body.success) throw new Error(body.error || 'Failed to fetch clubs');
  return body.data || [];
};

/**
 * Gets a club by its club_id (not database ID)
 * @param {string} clubId - The club_id to search for
 * @returns {Promise<Object|null>} Club object or null if not found
 */
export const getClubByClubId = async (clubId) => {
  try {
    const clubs = await fetchClubs();
    return clubs.find(club => club.club_id === clubId) || null;
  } catch (error) {
    console.error('Error getting club by club_id:', error);
    throw error;
  }
};

/**
 * Gets clubs by category
 * @param {string} category - The category to filter by ('community' or 'institute')
 * @returns {Promise<Array>} Array of clubs in the specified category
 */
export const getClubsByCategory = async (category) => {
  try {
    const clubs = await fetchClubs();
    return clubs.filter(club => club.category === category);
  } catch (error) {
    console.error('Error getting clubs by category:', error);
    throw error;
  }
};

/**
 * Validates club data
 * @param {Object} clubData - Club data to validate
 * @returns {Object} Validation result with isValid boolean and errors array
 */
export const validateClubData = (clubData) => {
  const errors = [];
  
  if (!clubData.club_id || clubData.club_id.trim() === '') {
    errors.push('Club ID is required');
  }
  
  if (!clubData.club_name || clubData.club_name.trim() === '') {
    errors.push('Club name is required');
  }
  
  if (!clubData.category || clubData.category.trim() === '') {
    errors.push('Category is required');
  } else if (!['community', 'institute'].includes(clubData.category)) {
    errors.push('Category must be either "community" or "institute"');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Club categories enum for consistency
 */
export const CLUB_CATEGORIES = {
  COMMUNITY: 'community',
  INSTITUTE: 'institute'
};

/**
 * Helper function to format club data for display
 * @param {Object} club - Club object
 * @returns {Object} Formatted club data
 */
export const formatClubData = (club) => {
  return {
    ...club,
    categoryDisplay: club.category === CLUB_CATEGORIES.COMMUNITY 
      ? 'Community Based' 
      : 'Institute Based',
    fullName: `${club.club_name} (${club.club_id})`
  };
};
