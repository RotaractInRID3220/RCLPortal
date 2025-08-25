/**
 * Service for managing clubs data
 * Handles all club-related API operations including fetch, create, and update
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
 * Creates a new club
 * @param {Object} clubData - Club data to create
 * @param {string} clubData.club_id - Unique club identifier
 * @param {string} clubData.club_name - Name of the club
 * @param {string} clubData.category - Category of the club (community/institute)
 * @returns {Promise<Object>} Created club object
 */
export const createClub = async (clubData) => {
  try {
    const { club_id, club_name, category } = clubData;

    // Validate required fields
    if (!club_id || !club_name || !category) {
      throw new Error('Missing required fields: club_id, club_name, category');
    }

    const response = await fetch('/api/clubs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ club_id, club_name, category }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.club;
  } catch (error) {
    console.error('Error creating club:', error);
    throw error;
  }
};

/**
 * Updates an existing club
 * @param {number} id - The database ID of the club to update
 * @param {Object} updateData - Data to update
 * @param {string} [updateData.club_id] - Updated club identifier
 * @param {string} [updateData.club_name] - Updated club name
 * @param {string} [updateData.category] - Updated club category
 * @returns {Promise<Object>} Updated club object
 */
export const updateClub = async (id, updateData) => {
  try {
    if (!id) {
      throw new Error('Club ID is required for update');
    }

    const response = await fetch('/api/clubs', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id, ...updateData }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.club;
  } catch (error) {
    console.error('Error updating club:', error);
    throw error;
  }
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
