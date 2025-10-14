/**
 * Service for membership management operations
 * Handles membership data retrieval and rule application
 */

/**
 * Fetches membership data for all clubs including member counts and percentages
 * @returns {Promise<Array>} Array of club membership data
 */
export const getMembershipData = async () => {
  try {
    const response = await fetch('/api/admin/membership-data');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch membership data');
    }

    return result.data;
  } catch (error) {
    console.error('Error fetching membership data:', error);
    throw error;
  }
};

/**
 * Applies membership rules by deducting points from clubs based on their general member percentages
 * @returns {Promise<Object>} Result of the rule application including deductions applied
 */
export const applyMembershipRules = async () => {
  try {
    const response = await fetch('/api/admin/apply-membership-rules', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to apply membership rules');
    }

    return result;
  } catch (error) {
    console.error('Error applying membership rules:', error);
    throw error;
  }
};