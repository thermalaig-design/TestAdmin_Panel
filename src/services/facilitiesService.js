import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from './requestCache';

const TABLE_NAME = 'facilities';
const FACILITIES_BUCKET = 'facilities';
const MAX_FETCH = 50;

function uniqueId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function extensionFromFile(file) {
  const fromName = String(file?.name || '').split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  const mime = String(file?.type || '').toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'jpg';
}

function buildAttachmentPath(trustId, file) {
  const ext = extensionFromFile(file);
  const safeTrustId = String(trustId || 'misc').replace(/[^a-zA-Z0-9_-]/g, '') || 'misc';
  return `${safeTrustId}/${Date.now()}-${uniqueId()}.${ext}`;
}

function normalizeRow(row = {}) {
  return {
    id: row.id,
    trust_id: row.trust_id,
    type: row.type,
    name: row.name || '',
    description: row.description || '',
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    status: row.status || 'active',
    created_by: row.created_by || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    raw: row,
  };
}

export async function fetchFacilitiesByTrust(trustId) {
  if (!trustId) return { data: [], error: null };

  return cachedQuery(
    `facilities:list:${trustId}`,
    async () => {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('trust_id', trustId)
        .order('created_at', { ascending: false })
        .range(0, MAX_FETCH - 1);

      return { data: (data || []).map(normalizeRow), error };
    },
    12000
  );
}

export async function uploadFacilitiesAttachment(file, { trustId = null } = {}) {
  if (!file) return { data: null, error: { message: 'No attachment file provided.' } };
  if (!file.type || !file.type.startsWith('image/')) {
    return { data: null, error: { message: 'Please select a valid image file.' } };
  }

  const path = buildAttachmentPath(trustId, file);
  const { error: uploadError } = await supabase.storage.from(FACILITIES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });

  if (uploadError) return { data: null, error: uploadError };

  const { data: publicData } = supabase.storage.from(FACILITIES_BUCKET).getPublicUrl(path);
  return {
    data: {
      path,
      publicUrl: publicData?.publicUrl || null,
    },
    error: null,
  };
}

export async function createFacility(payload = {}) {
  if (!payload.trust_id) return { data: null, error: { message: 'No trust id provided.' } };

  const row = {
    trust_id: payload.trust_id,
    type: payload.type || 'gen',
    name: String(payload.name || '').trim(),
    description: String(payload.description || '').trim() || null,
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    status: payload.status || 'active',
    created_by: payload.created_by || null,
  };

  const { data, error } = await supabase.from(TABLE_NAME).insert([row]).select('*').single();
  if (!error) invalidateCache('facilities:');
  return { data: data ? normalizeRow(data) : null, error };
}

export async function updateFacility(facilityId, updates = {}, trustId = null) {
  if (!facilityId) return { data: null, error: { message: 'No facility id provided.' } };

  const payload = {
    ...(updates.name !== undefined ? { name: String(updates.name || '').trim() } : {}),
    ...(updates.description !== undefined
      ? { description: String(updates.description || '').trim() || null }
      : {}),
    ...(updates.attachments !== undefined
      ? { attachments: Array.isArray(updates.attachments) ? updates.attachments : [] }
      : {}),
    ...(updates.status !== undefined ? { status: updates.status } : {}),
    ...(updates.type !== undefined ? { type: updates.type } : {}),
    updated_at: new Date().toISOString(),
  };

  let query = supabase.from(TABLE_NAME).update(payload).eq('id', facilityId);
  if (trustId) query = query.eq('trust_id', trustId);

  const { data, error } = await query.select('*').single();
  if (!error) invalidateCache('facilities:');
  return { data: data ? normalizeRow(data) : null, error };
}

export async function deleteFacility(facilityId, trustId = null) {
  if (!facilityId) return { error: { message: 'No facility id provided.' } };

  let query = supabase.from(TABLE_NAME).delete().eq('id', facilityId);
  if (trustId) query = query.eq('trust_id', trustId);

  const { error } = await query;
  if (!error) invalidateCache('facilities:');
  return { error };
}
