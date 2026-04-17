import { supabase } from '../lib/supabase';

const TABLE_NAME = 'events';

function normalizeRow(row = {}) {
  return {
    id: row.id,
    trust_id: row.trust_id,
    type: row.type,
    title: row.title || '',
    description: row.description || '',
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    location: row.location || '',
    startEventDate: row.startEventDate || null,
    start_time: row.start_time || null,
    endEventDate: row.endEventDate || null,
    is_registration_required: !!row.is_registration_required,
    status: row.status || 'active',
    created_by: row.created_by || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    raw: row,
  };
}

export async function fetchEventsByTrust(trustId) {
  if (!trustId) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('trust_id', trustId)
    .order('startEventDate', { ascending: true })
    .order('endEventDate', { ascending: true })
    .order('title', { ascending: true });

  return { data: (data || []).map(normalizeRow), error };
}

export async function fetchEventById(trustId, eventId) {
  if (!trustId || !eventId) return { data: null, error: { message: 'Missing trust or event id.' } };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('trust_id', trustId)
    .eq('id', eventId)
    .maybeSingle();

  return { data: data ? normalizeRow(data) : null, error };
}

export async function createEvent(payload = {}) {
  if (!payload.trust_id) return { data: null, error: { message: 'No trust id provided.' } };

  const row = {
    trust_id: payload.trust_id,
    title: String(payload.title || '').trim(),
    description: String(payload.description || '').trim() || null,
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    location: String(payload.location || '').trim() || null,
    startEventDate: payload.startEventDate || null,
    start_time: payload.start_time || null,
    endEventDate: payload.endEventDate || null,
    type: payload.type || 'general',
    status: payload.status || 'active',
    is_registration_required: !!payload.is_registration_required,
    created_by: payload.created_by || null,
  };

  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert([row])
    .select('*')
    .single();

  return { data: data ? normalizeRow(data) : null, error };
}

export async function updateEvent(eventId, updates = {}, trustId = null) {
  if (!eventId) return { data: null, error: { message: 'No event id provided.' } };

  const payload = {
    ...(updates.title !== undefined ? { title: String(updates.title || '').trim() } : {}),
    ...(updates.description !== undefined
      ? { description: String(updates.description || '').trim() || null }
      : {}),
    ...(updates.attachments !== undefined
      ? { attachments: Array.isArray(updates.attachments) ? updates.attachments : [] }
      : {}),
    ...(updates.location !== undefined
      ? { location: String(updates.location || '').trim() || null }
      : {}),
    ...(updates.startEventDate !== undefined ? { startEventDate: updates.startEventDate || null } : {}),
    ...(updates.start_time !== undefined ? { start_time: updates.start_time || null } : {}),
    ...(updates.endEventDate !== undefined ? { endEventDate: updates.endEventDate || null } : {}),
    ...(updates.is_registration_required !== undefined
      ? { is_registration_required: !!updates.is_registration_required }
      : {}),
    ...(updates.status !== undefined ? { status: updates.status } : {}),
    ...(updates.type !== undefined ? { type: updates.type } : {}),
    updated_at: new Date().toISOString(),
  };

  let query = supabase
    .from(TABLE_NAME)
    .update(payload)
    .eq('id', eventId);

  if (trustId) {
    query = query.eq('trust_id', trustId);
  }

  const { data, error } = await query
    .select('*')
    .single();

  return { data: data ? normalizeRow(data) : null, error };
}

export async function deleteEvent(eventId, trustId = null) {
  if (!eventId) return { error: { message: 'No event id provided.' } };

  let query = supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', eventId);

  if (trustId) {
    query = query.eq('trust_id', trustId);
  }

  const { error } = await query;
  return { error };
}
