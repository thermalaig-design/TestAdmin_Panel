import { supabase } from '../lib/supabase';
import { cachedQuery } from './requestCache';

const NOTIFICATIONS_TABLE = 'notifications';

function pickFirst(row = {}, keys = []) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return null;
}

function normalizeNotificationRow(row = {}) {
  return {
    id: pickFirst(row, ['id']),
    trust_id: pickFirst(row, ['trust_id']),
    title: pickFirst(row, ['title']) || '',
    message: pickFirst(row, ['message']) || '',
    type: pickFirst(row, ['type']) || 'general',
    target_audience: pickFirst(row, ['target_audience']) || 'all',
    is_read: pickFirst(row, ['is_read']) === true,
    sent_by: pickFirst(row, ['sent_by']),
    created_at: pickFirst(row, ['created_at']),
    updated_at: pickFirst(row, ['updated_at']),
  };
}

export async function fetchNotificationsByTrustId(trustId) {
  if (!trustId) return { data: [], error: null };
  const cacheKey = `notifications:trust:${trustId}`;

  return cachedQuery(cacheKey, async () => {
    const { data, error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .select('*')
      .eq('trust_id', trustId)
      .order('created_at', { ascending: false, nullsFirst: false });

    if (error) return { data: [], error };
    return { data: (data || []).map(normalizeNotificationRow), error: null };
  }, 10000);
}
