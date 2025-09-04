import { toast } from 'sonner';

/**
 * Creates a new sport event
 * @param {Object} eventData - The event data
 * @param {string} eventData.name - Event name
 * @param {string} eventData.day - Event day (D-00, D-01, D-02, D-03)
 * @param {string} eventData.type - Event type (individual, team)
 * @param {string} eventData.gender - Gender type (boys, girls, mixed)
 * @param {number} eventData.minPlayers - Minimum player count
 * @param {number} eventData.maxPlayers - Maximum player count
 * @param {number} eventData.reservePlayers - Reserve player count
 * @param {Date} eventData.regClose - Registration close date
 * @param {string} eventData.category - Event category (community, institute, both)
 * 
 * @example
 * // Create single event
 * const result = await createEvent({
 *   name: "Football",
 *   day: "D-01",
 *   type: "team",
 *   gender: "boys",
 *   minPlayers: 11,
 *   maxPlayers: 15,
 *   reservePlayers: 3,
 *   regClose: new Date(),
 *   category: "community"
 * });
 * 
 * @example
 * // Create for both categories
 * const result = await createEvent({...eventData, category: "both"});
 * // Returns: { community: {...}, institute: {...} }
 * 
 * @returns {Promise<Object>} Success response with event data
 */
export const createEvent = async (eventData) => {
    if (!eventData || typeof eventData !== 'object') {
        throw new Error('Invalid event data provided');
    }

    try {
        if (eventData.category === 'both') {
            // Make two API calls for both categories
            const comBasedData = { ...eventData, category: 'community' };
            const instBasedData = { ...eventData, category: 'institute' };
            
            const [comBasedResponse, instBasedResponse] = await Promise.all([
                fetch('/api/events', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(comBasedData),
                }).then(response => response.json()),
                fetch('/api/events', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(instBasedData),
                }).then(response => response.json())
            ]);
            
            // Check if both responses are successful
            if (comBasedResponse.success && instBasedResponse.success) {
                toast.success('Events created successfully for both categories!');
            } else {
                toast.error('Failed to create events for one or both categories');
            }
            
            return {
                community: comBasedResponse,
                institute: instBasedResponse
            };
        } else {
            const response = await fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData),
            });
            
            const result = await response.json();
            
            if (result.success || response.ok) {
                toast.success('Event created successfully!');
            } else {
                toast.error(result.error || 'Failed to create event');
            }
            
            return result;
        }
    } catch (error) {
        toast.error('Network error: Failed to create event');
        throw error;
    }
};

/**
 * Fetches all sport events with optional filtering
 * @param {Object} [filters={}] - Optional filters
 * @param {string} [filters.category] - Filter by category (community, institute, both)
 * @param {string} [filters.day] - Filter by event day (D-00, D-01, D-02, D-03)
 * @param {string|string[]} [filters.type] - Filter by event type (individual, team) - can be single string or array
 * @param {string} [filters.gender] - Filter by gender (boys, girls, mixed)
 * 
 * @example
 * // Get all events
 * const allEvents = await getAllEvents();
 * // Returns: { success: true, data: [...], count: 10 }
 * 
 * @example
 * // Get community events only
 * const communityEvents = await getAllEvents({ category: "community" });
 * 
 * @example
 * // Get single type events
 * const teamEvents = await getAllEvents({ type: "team", gender: "boys" });
 * 
 * @example
 * // Get multiple types events (NEW!)
 * const multipleTypes = await getAllEvents({ type: ["team", "individual"] });
 * 
 * @example
 * // Multiple filters with array of types
 * const filtered = await getAllEvents({ 
 *   category: "institute", 
 *   day: "D-01", 
 *   type: ["team", "individual"],
 *   gender: "boys"
 * });
 * 
 * @returns {Promise<Object>} Response object with success, data array, and count
 */
export const getAllEvents = async (filters = {}) => {
    try {
        // Build query parameters if filters are provided
        const params = new URLSearchParams();
        
        if (filters.category) {
            params.append('category', filters.category);
        }
        if (filters.day) {
            params.append('day', filters.day);
        }
        if (filters.type) {
            // Handle both single type and array of types
            if (Array.isArray(filters.type)) {
                // For multiple types, send as comma-separated string
                params.append('type', filters.type.join(','));
            } else {
                // Single type as before
                params.append('type', filters.type);
            }
        }
        if (filters.gender) {
            params.append('gender', filters.gender);
        }

        // Build the URL with or without parameters
        const url = params.toString() ? `/api/events?${params.toString()}` : '/api/events';
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
            return result; // Returns { success: true, data: [...], count: number }
        } else {
            toast.error(result.error || 'Failed to fetch events');
            throw new Error(result.error || 'Failed to fetch events');
        }

    } catch (error) {
        console.error('Error fetching events:', error);
        toast.error('Network error: Failed to fetch events');
        throw error;
    }
};


