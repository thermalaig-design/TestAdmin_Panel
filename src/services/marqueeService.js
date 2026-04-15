import { supabase } from '../lib/supabase';

const TABLE_NAME = 'marquee_updates';

function normalizeMarqueeRow(row = {}, index = 0) {
  return {
    id: row.id || `${index}`,
    trust_id: row.trust_id || null,
    message: row.message || '',
    is_active: row.is_active !== false,
    priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : 0,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    created_by: row.created_by || null,
    updated_by: row.updated_by || null,
    raw: row,
  };
}

export async function fetchMarqueeUpdatesByTrust(trustId) {
  if (!trustId) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('trust_id', trustId)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  return { data: (data || []).map(normalizeMarqueeRow), error };
}

export async function createMarqueeUpdate(payload = {}) {
  if (!payload.trust_id) return { data: null, error: { message: 'No trust id provided.' } };

  const row = {
    trust_id: payload.trust_id,
    message: String(payload.message || '').trim(),
    is_active: payload.is_active !== false,
    priority: Number.isFinite(Number(payload.priority)) ? Number(payload.priority) : 0,
    created_by: payload.created_by || null,
    updated_by: payload.updated_by || null,
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([row])
    .select('*')
    .single();

  return { data: data ? normalizeMarqueeRow(data, 0) : null, error };
}

export async function updateMarqueeUpdate(id, updates = {}) {
  if (!id) return { data: null, error: { message: 'No marquee id provided.' } };

  const payload = {
    ...(updates.message !== undefined ? { message: String(updates.message || '').trim() } : {}),
    ...(updates.is_active !== undefined ? { is_active: !!updates.is_active } : {}),
    ...(updates.priority !== undefined
      ? { priority: Number.isFinite(Number(updates.priority)) ? Number(updates.priority) : 0 }
      : {}),
    ...(updates.updated_by !== undefined ? { updated_by: updates.updated_by || null } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  return { data: data ? normalizeMarqueeRow(data, 0) : null, error };
}

export async function deleteMarqueeUpdate(id) {
  if (!id) return { error: { message: 'No marquee id provided.' } };

  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id);

  return { error };
}
