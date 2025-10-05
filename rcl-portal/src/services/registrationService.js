import { getAllEvents } from "./sportServices";

export const registerPlayer = async (member, sport_id, isMainPlayer, selectedSport) => {
    try {
        // First, run constraint checks
        const constraintResults = await playerConstraintChecks(member, selectedSport);
        
        // If constraints are not passed, return error response with the reason
        if (!constraintResults.allowed) {
            console.log('Player constraint check failed:', constraintResults.reason);
            return {
                success: false,
                error: constraintResults.reason || 'Player does not meet registration constraints',
                data: constraintResults.counts
            };
        }
        
        // If constraints pass, proceed with registration
        console.log('Player constraint checks passed, proceeding with registration');
        
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
            return {
                success: false,
                error: 'Failed to register player',
                statusCode: response.status
            };
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
            return {
                success: false,
                error: 'Failed to register player',
                statusCode: response2.status
            };
        }

        const data = await response2.json();
        return {
            success: true,
            data
        };
    } catch (error) {
        console.error('Error registering player:', error);
        return {
            success: false,
            error: error.message || 'An unexpected error occurred',
            isException: true
        };
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

/**
 * Gets player registrations and merges them with relevant sport details
 * @param {string} RMIS_ID - The player's RMIS ID 
 * @returns {Promise<Object>} Registrations with merged sport details
 * 
 * Example:
 * const playerSports = await getPlayerRegistrationsWithSportDetails('CMTP12345');
 */
export const getPlayerRegistrationsWithSportDetails = async (RMIS_ID) => {
    try {
        if (!RMIS_ID) {
            throw new Error('RMIS_ID is required');
        }
        
        // Get player registrations
        const registrationsResponse = await getRegistrations({ RMIS_ID });
        if (!registrationsResponse.success || !Array.isArray(registrationsResponse.data)) {
            throw new Error('Failed to fetch registrations');
        }
        
        // Get all sports data
        const sportsResponse = await getAllEvents();
        if (!sportsResponse.success || !Array.isArray(sportsResponse.data)) {
            throw new Error('Failed to fetch sports data');
        }
        
        // Merge registrations with their corresponding sport details
        const registrationsWithSportDetails = registrationsResponse.data.map(registration => {
            const matchingSport = sportsResponse.data.find(sport => 
                sport.sport_id === registration.sport_id
            );
            
            return {
                ...registration,
                sportDetails: matchingSport ? {
                    sport_id: matchingSport.sport_id,
                    sport_name: matchingSport.sport_name,
                    sport_type: matchingSport.sport_type,
                    gender_type: matchingSport.gender_type,
                    max_count: matchingSport.max_count,
                    reserve_count: matchingSport.reserve_count,
                    sport_day: matchingSport.sport_day,
                } : null
            };
        }).filter(reg => reg.sportDetails !== null); // Filter out registrations with no matching sport
        
        return {
            success: true,
            data: registrationsWithSportDetails,
            count: registrationsWithSportDetails.length
        };
    } catch (error) {
        console.error('Error fetching player registrations with sport details:', error);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
}

/**
 * Check player constraints for registrations
 * @param {Object} member - The player's member information
 * @param {Object} selectedSport - The sport to be registered for
 * @returns {Object} Constraint check results with success flag and counts
 */
export const playerConstraintChecks = async (member, selectedSport) => {
    // Use the new utility function to get registrations with sport details
    const result = await getPlayerRegistrationsWithSportDetails(member.membership_id);
    const registrationsWithSportDetails = result.success ? result.data : [];
    
    // Now registrationsWithSportDetails contains all registrations with relevant sport info
    console.log('Player registrations with sport details:', registrationsWithSportDetails);

    // Get the selected sport day
    const selectedSportDay = selectedSport.sport_day;
    
    // Group registrations by sport type and day
    const registrationCounts = {
        // Track event counts by day
        trackIndividual: {},
        team: {},
        individual: {},
        // Combined team and individual counts per day (non-track events)
        combinedNonTrackByDay: {},
        // Total counts
        totalTrackIndividual: 0,
        totalTeam: 0,
        totalIndividual: 0
    };
    
    // Count registrations by sport type and day
    registrationsWithSportDetails.forEach(registration => {
        const sportType = registration.sportDetails.sport_type;
        const sportDay = registration.sportDetails.sport_day;
        
        // Initialize day counter if not exists
        if (sportType === 'trackIndividual') {
            registrationCounts.trackIndividual[sportDay] = (registrationCounts.trackIndividual[sportDay] || 0) + 1;
            registrationCounts.totalTrackIndividual++;
        } else if (sportType === 'team') {
            registrationCounts.team[sportDay] = (registrationCounts.team[sportDay] || 0) + 1;
            registrationCounts.totalTeam++;
            // Track combined non-track events (team + individual)
            registrationCounts.combinedNonTrackByDay[sportDay] = (registrationCounts.combinedNonTrackByDay[sportDay] || 0) + 1;
        } else if (sportType === 'individual') {
            registrationCounts.individual[sportDay] = (registrationCounts.individual[sportDay] || 0) + 1;
            registrationCounts.totalIndividual++;
            // Track combined non-track events (team + individual)
            registrationCounts.combinedNonTrackByDay[sportDay] = (registrationCounts.combinedNonTrackByDay[sportDay] || 0) + 1;
        }
    });
    
    // Log the counts for debugging
    console.log('Registration counts:', registrationCounts);
    
    // Check constraints based on sport type
    if (selectedSport.sport_type === 'trackIndividual') {
        // Get count for selected day
        const currentDayCount = registrationCounts.trackIndividual[selectedSportDay] || 0;
        
        // Maximum 2 trackIndividual events per day
        if (currentDayCount >= 2) {
            return {
                allowed: false,
                reason: `Player already has ${currentDayCount} track individual events on day ${selectedSportDay}. Maximum is 2.`,
                counts: registrationCounts
            };
        }
    } else if (selectedSport.sport_type === 'team' || selectedSport.sport_type === 'individual') {
        // Check combined constraint for team and individual events
        const combinedCount = registrationCounts.combinedNonTrackByDay[selectedSportDay] || 0;
        
        // Maximum 1 non-track event (team OR individual) per day
        if (combinedCount >= 1) {
            return {
                allowed: false,
                reason: `Player already has a team or individual event on day ${selectedSportDay}. Only one allowed per day.`,
                counts: registrationCounts
            };
        }
    }
    
    // All constraints passed
    return {
        allowed: true,
        counts: registrationCounts
    };
}

/**
 * Get registrations with player and club data for admin view
 * @param {Object} filters - Filters to apply (sport_id, club_id, etc.)
 * @param {Object} pagination - Pagination options (page, limit, search) - optional for backward compatibility
 * @returns {Promise<Object>} Combined registration and player data
 */
export const getRegistrationsWithPlayerData = async (filters = null, pagination = null) => {
    try {
        let url = '/api/registrations/with-players';
        const params = new URLSearchParams();
        
        // Add filters as query parameters if provided
        if (filters) {
            params.append('filter', JSON.stringify(filters));
        }
        
        // Add pagination parameters if provided
        if (pagination) {
            if (pagination.page) {
                params.append('page', pagination.page.toString());
            }
            if (pagination.limit) {
                params.append('limit', pagination.limit.toString());
            }
            if (pagination.search && pagination.search.trim()) {
                params.append('search', pagination.search.trim());
            }
        }
        
        if (params.toString()) {
            url = `${url}?${params.toString()}`;
        }
        
        const response = await fetch(url, {
            // Add cache headers for better performance on repeated requests
            headers: {
                'Cache-Control': 'public, max-age=30', // 30 seconds cache for frequently accessed data
            }
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch registrations with player data');
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching registrations with player data:', error);
        throw error;
    }
}


