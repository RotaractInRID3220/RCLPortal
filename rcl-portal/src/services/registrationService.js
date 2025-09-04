export const registerPlayer = async (member, sport_id, isMainPlayer) => {
    try {
        console.log(member);
        const response = await fetch('/api/players', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                member
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to register player');
        }

        const response2 = await fetch('/api/registrations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                member,
                sport_id,
                isMainPlayer
            }),
        });

        if (!response2.ok) {
            throw new Error('Failed to register player');
        }

        const data = await response2.json();
        return data;
    } catch (error) {
        console.error('Error registering player:', error);
        throw error;
    }
}

/**
 * Fetches registration data with optional filtering
 * @param {Object|Array|null} filters - Optional filter parameters
 * @returns {Promise<Object>} The registration data
 * 
 * Examples:
 * // Get all registrations
 * getRegistrations();
 * 
 * // Filter by one parameter
 * getRegistrations({ club_id: 116 });
 * 
 * // Filter by multiple parameters
 * getRegistrations({ club_id: 116, sport_id: 2 });
 * 
 * // Advanced filtering with multiple conditions
 * getRegistrations([{ club_id: 116 }, { sport_id: 2 }]);
 */
export const getRegistrations = async (filters = null) => {
    try {
        let url = '/api/registrations';
        
        // Add filters as query parameters if provided
        if (filters) {
            const params = new URLSearchParams({
                filter: JSON.stringify(filters)
            });
            url = `${url}?${params.toString()}`;
        }
        
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch registrations');
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching registrations:', error);
        throw error;
    }
}

/**
 * Deletes a registration based on RMIS_ID and sport_id
 * @param {string} RMIS_ID - The RMIS_ID of the player to unregister
 * @param {number|string} sport_id - The sport ID to unregister from
 * @returns {Promise<Object>} The result of the deletion operation
 * 
 * Example:
 * deleteRegistration('CMTP12345', 2);
 */
export const deleteRegistration = async (RMIS_ID, sport_id) => {
    try {
        if (!RMIS_ID || !sport_id) {
            throw new Error('RMIS_ID and sport_id are required for deletion');
        }
        
        // Build URL with query parameters
        const url = `/api/registrations?RMIS_ID=${encodeURIComponent(RMIS_ID)}&sport_id=${encodeURIComponent(sport_id)}`;
        
        const response = await fetch(url, {
            method: 'DELETE',
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete registration');
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error deleting registration:', error);
        throw error;
    }
}


