import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from './requestCache';
import { normalizeImageDataUrlToJpeg } from '../utils/imageUpload';

const SPONSORS_BUCKET = 'sponsors';

function uniqueId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function dataUrlToBuffer(dataUrl = '') {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i.exec(String(dataUrl || ''));
  if (!match) return null;
  const b64 = match[2];
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }
  return {
    mime: match[1].toLowerCase(),
    buffer: bytes,
  };
}

function extensionFromMime(mime = '') {
  const value = String(mime || '').toLowerCase();
  if (value.includes('png')) return 'png';
  if (value.includes('webp')) return 'webp';
  if (value.includes('gif')) return 'gif';
  return 'jpg';
}

function buildSponsorPhotoPath(trustId, mime = 'image/jpeg') {
  const ext = extensionFromMime(mime);
  const safeTrustId = String(trustId || 'misc').replace(/[^a-zA-Z0-9_-]/g, '') || 'misc';
  return `${safeTrustId}/${Date.now()}-${uniqueId()}.${ext}`;
}

export async function uploadSponsorPhotoDataUrl(dataUrl, { trustId = null } = {}) {
  const normalized = await normalizeImageDataUrlToJpeg(dataUrl);
  if (normalized.error) {
    return { data: null, error: normalized.error };
  }

  const parsed = dataUrlToBuffer(normalized.dataUrl);
  if (!parsed?.buffer?.length) {
    return { data: null, error: { message: 'Invalid sponsor image data.' } };
  }

  const path = buildSponsorPhotoPath(trustId, parsed.mime);
  const { error: uploadError } = await supabase
    .storage
    .from(SPONSORS_BUCKET)
    .upload(path, parsed.buffer, {
      cacheControl: '3600',
      upsert: false,
      contentType: parsed.mime,
    });

  if (uploadError) return { data: null, error: uploadError };

  const { data: publicData } = supabase
    .storage
    .from(SPONSORS_BUCKET)
    .getPublicUrl(path);

  return {
    data: {
      path,
      publicUrl: publicData?.publicUrl || null,
      warning: normalized.warning || '',
    },
    error: null,
  };
}

export async function fetchSponsors(trustId = null) {
  const cacheKey = `sponsors:list:${trustId || 'all'}`;
  return cachedQuery(cacheKey, async () => {
    let query = supabase
      .from('sponsors')
      .select('*')
      .order('company_name', { ascending: true })
      .order('ref_no', { ascending: true });

    if (trustId) query = query.eq('trust_id', trustId);

    const { data, error } = await query;
    return { data, error };
  }, 20000);
}

export async function createSponsor(payload) {
  const { data, error } = await supabase
    .from('sponsors')
    .insert([payload])
    .select('*')
    .single();

  if (!error) invalidateCache('sponsors:');
  return { data, error };
}

export async function updateSponsor(id, updates) {
  const { data, error } = await supabase
    .from('sponsors')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (!error) invalidateCache('sponsors:');
  return { data, error };
}

export async function deleteSponsor(id) {
  const { error } = await supabase
    .from('sponsors')
    .delete()
    .eq('id', id);

  if (!error) invalidateCache('sponsors:');
  return { error };
}

export async function fetchSponsorFlashByTrust(trustId) {
  if (!trustId) return { data: null, error: { message: 'No trust ID provided' } };

  return cachedQuery(`sponsors:flash:${trustId}`, async () => {
    const { data, error } = await supabase
      .from('sponsor_flash')
      .select('*')
      .eq('trust_id', trustId);

    return { data, error };
  }, 12000);
}

export async function createSponsorFlash(payload) {
  const { data, error } = await supabase
    .from('sponsor_flash')
    .insert([payload])
    .select('*')
    .single();

  if (!error) invalidateCache('sponsors:flash:');
  return { data, error };
}

export async function updateSponsorFlash(id, updates) {
  const { data, error } = await supabase
    .from('sponsor_flash')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (!error) invalidateCache('sponsors:flash:');
  return { data, error };
}

export async function deleteSponsorFlash(id) {
  const { error } = await supabase
    .from('sponsor_flash')
    .delete()
    .eq('id', id);

  if (!error) invalidateCache('sponsors:flash:');
  return { error };
}
