// Fetches swap dashboard context for a club
export const getSwapContext = async (clubId) => {
  try {
    if (!clubId) {
      return { success: false, error: 'Club ID is required to load swap data' };
    }

    const response = await fetch(`/api/portal/swaps?club_id=${clubId}`);
    const result = await response.json();

    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Failed to load swap dashboard data' };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error('getSwapContext error:', error);
    return { success: false, error: error.message || 'Failed to load swap data' };
  }
};

// Submits a new swap request
export const submitSwapRequest = async (payload) => {
  try {
    const response = await fetch('/api/portal/swaps', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return { success: false, error: result.error || 'Failed to submit swap request' };
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error('submitSwapRequest error:', error);
    return { success: false, error: error.message || 'Failed to submit swap request' };
  }
};
