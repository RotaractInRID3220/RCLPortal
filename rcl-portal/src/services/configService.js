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