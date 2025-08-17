import { toast } from 'sonner';

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