// src/services/configService.js
import { supabase } from '@/lib/supabaseClient';

export const getConfig = async () => {
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value, type');

  if (error) throw error;

  const config = {};
  data.forEach(item => {
    if (item.type === 'number') {
      config[item.key] = parseFloat(item.value);
    } else if (item.type === 'boolean') {
      config[item.key] = item.value === 'true';
    } else {
      config[item.key] = item.value;
    }
  });

  return config;
};

export const updateConfig = async (updates) => {
  const updatesArray = Object.entries(updates).map(([key, value]) => ({
    key,
    value: String(value),
    type: typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string',
    updated_at: new Date().toISOString(),
  }));

  for (const update of updatesArray) {
    const { error } = await supabase
      .from('app_config')
      .upsert(update, { onConflict: 'key' });

    if (error) throw error;
  }

  return { success: true };
};

// ============================================================================
// PORTAL STATUS MANAGEMENT (Real-time enabled)
// ============================================================================

/**
 * Fetches the current registration portal status
 * @returns {Promise<{isOpen: boolean, updatedBy: string|null, updatedAt: string|null}>}
 */
export const getPortalStatus = async () => {
  try {
    const response = await fetch('/api/config/portal-status');
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch portal status');
    }
    
    return result.data;
  } catch (error) {
    console.error('Error fetching portal status:', error);
    // Default to closed for security
    return { isOpen: false, updatedBy: null, updatedAt: null };
  }
};

/**
 * Updates the registration portal status (super_admin only)
 * @param {boolean} isOpen - Whether the portal should be open
 * @param {string} updatedBy - RMIS_ID of the user making the change
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const updatePortalStatus = async (isOpen, updatedBy) => {
  try {
    const response = await fetch('/api/config/portal-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isOpen, updatedBy })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to update portal status');
    }
    
    return { success: true, data: result.data };
  } catch (error) {
    console.error('Error updating portal status:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Subscribes to real-time portal status changes
 * Uses Supabase Realtime for instant updates across all clients
 * @param {function} callback - Function to call when status changes
 * @returns {function} Unsubscribe function
 */
export const subscribeToPortalStatus = (callback) => {
  const channel = supabase
    .channel('portal_settings_changes')
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'portal_settings',
        filter: 'setting_key=eq.registration_portal_open'
      },
      (payload) => {
        // Handle the realtime update
        if (payload.new) {
          callback({
            isOpen: payload.new.is_enabled,
            updatedBy: payload.new.updated_by,
            updatedAt: payload.new.updated_at
          });
        } else if (payload.eventType === 'DELETE') {
          // If deleted, treat as closed
          callback({
            isOpen: false,
            updatedBy: null,
            updatedAt: null
          });
        }
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Gets portal status directly from Supabase (for SSR or direct access)
 * @returns {Promise<{isOpen: boolean, updatedBy: string|null, updatedAt: string|null}>}
 */
export const getPortalStatusDirect = async () => {
  try {
    const { data, error } = await supabase
      .from('portal_settings')
      .select('*')
      .eq('setting_key', 'registration_portal_open')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No record found - default to closed
        return { isOpen: false, updatedBy: null, updatedAt: null };
      }
      throw error;
    }

    return {
      isOpen: data.is_enabled,
      updatedBy: data.updated_by,
      updatedAt: data.updated_at
    };
  } catch (error) {
    console.error('Error fetching portal status directly:', error);
    return { isOpen: false, updatedBy: null, updatedAt: null };
  }
};