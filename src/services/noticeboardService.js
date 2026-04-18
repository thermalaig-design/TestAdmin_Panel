import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from './requestCache';

const TABLE_NAME = 'noticeboard';

function normalizeRow(row = {}) {
  return {
    id: row.id,
    trust_id: row.trust_id,
    type: row.type,
    name: row.name || '',
    description: row.description || '',
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    start_date: row.start_date || null,
    end_date: row.end_date || null,
    status: row.status || 'active',
    created_by: row.created_by || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    raw: row,
  };
}

export async function fetchNoticeboardByTrust(trustId) {
  if (!trustId) return { data: [], error: null };

  return cachedQuery(`notice:list:${trustId}`, async () => {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('trust_id', trustId)
      .order('created_at', { ascending: false });

    return { data: (data || []).map(normalizeRow), error };
  }, 12000);
}

export async function fetchNoticeById(trustId, noticeId) {
  if (!trustId || !noticeId) return { data: null, error: { message: 'Missing trust or notice id.' } };

  return cachedQuery(`notice:item:${trustId}:${noticeId}`, async () => {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('trust_id', trustId)
      .eq('id', noticeId)
      .maybeSingle();

    return { data: data ? normalizeRow(data) : null, error };
  }, 12000);
}

export async function createNotice(payload = {}) {
  if (!payload.trust_id) return { data: null, error: { message: 'No trust id provided.' } };

  const row = {
    trust_id: payload.trust_id,
    name: String(payload.name || '').trim(),
    description: String(payload.description || '').trim() || null,
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    start_date: payload.start_date || null,
    end_date: payload.end_date || null,
    created_by: payload.created_by || null,
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([row])
    .select('*')
    .single();

  if (!error) invalidateCache('notice:');
  return { data: data ? normalizeRow(data) : null, error };
}

export async function updateNotice(noticeId, updates = {}, trustId = null) {
  if (!noticeId) return { data: null, error: { message: 'No notice id provided.' } };

  const payload = {
    ...(updates.name !== undefined ? { name: String(updates.name || '').trim() } : {}),
    ...(updates.description !== undefined
      ? { description: String(updates.description || '').trim() || null }
      : {}),
    ...(updates.attachments !== undefined
      ? { attachments: Array.isArray(updates.attachments) ? updates.attachments : [] }
      : {}),
    ...(updates.start_date !== undefined ? { start_date: updates.start_date || null } : {}),
    ...(updates.end_date !== undefined ? { end_date: updates.end_date || null } : {}),
    ...(updates.status !== undefined ? { status: updates.status } : {}),
    ...(updates.type !== undefined ? { type: updates.type } : {}),
    updated_at: new Date().toISOString(),
  };

  let query = supabase
    .from(TABLE_NAME)
    .update(payload)
    .eq('id', noticeId);

  if (trustId) {
    query = query.eq('trust_id', trustId);
  }

  const { data, error } = await query
    .select('*')
    .single();

  if (!error) invalidateCache('notice:');
  return { data: data ? normalizeRow(data) : null, error };
}

export async function deleteNotice(noticeId, trustId = null) {
  if (!noticeId) return { error: { message: 'No notice id provided.' } };

  let query = supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', noticeId);

  if (trustId) {
    query = query.eq('trust_id', trustId);
  }

  const { error } = await query;
  if (!error) invalidateCache('notice:');
  return { error };
}
