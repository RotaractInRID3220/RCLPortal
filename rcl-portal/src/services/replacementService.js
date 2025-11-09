// Fetches replacement dashboard context for a club
export const getReplacementContext = async (clubId) => {
  try {
    if (!clubId) {
      return { success: false, error: 'Club ID is required to load replacement data' };
    }

    const response = await fetch(`/api/portal/replacements?club_id=${clubId}`);
    const result = await response.json();

    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Failed to load replacement dashboard data' };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to load replacement data' };
  }
};

// Submits a new replacement request
export const submitReplacementRequest = async (payload) => {
  try {
    const response = await fetch('/api/portal/replacements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Failed to submit replacement request' };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to submit replacement request' };
  }
};
