import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from './requestCache';

const TABLE_NAME = 'Donations';
const DONATIONS_BUCKET = String(import.meta?.env?.VITE_DONATIONS_BUCKET || 'donations').trim() || 'donations';
const MAX_FETCH = 200;
const MONEY_RE = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function uniqueId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function extensionFromFile(file) {
  const fromName = String(file?.name || '').split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 8) return fromName;
  const mime = String(file?.type || '').toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('svg')) return 'svg';
  return 'jpg';
}

function sanitizeFileName(fileName = '') {
  const [base = 'image'] = String(fileName).split('.');
  const safe = base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  return safe || 'image';
}

function buildDonationAttachmentPath(trustId, file) {
  const ext = extensionFromFile(file);
  const safeTrustId = String(trustId || 'misc').replace(/[^a-zA-Z0-9_-]/g, '') || 'misc';
  const timestamp = Date.now();
  const unique = uniqueId();
  const safeName = sanitizeFileName(file?.name);
  return `donations/${safeTrustId}/${timestamp}_${safeName}_${unique}.${ext}`;
}

function normalizeRow(row = {}) {
  return {
    id: row.id,
    trust_id: row.trust_id || null,
    name: row.name || '',
    description: row.description || '',
    attachments: normalizeAttachments(row.attachments),
    amount: row.amount ?? null,
    amount_type: row.amount_type || '',
    status: row.status || 'active',
    type: row.type || '',
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    raw: row,
  };
}

function toMoneyValue(rawAmount) {
  if (rawAmount === '' || rawAmount === null || rawAmount === undefined) return { value: null, error: null };
  const normalized = String(rawAmount).trim();
  if (!MONEY_RE.test(normalized)) {
    return { value: null, error: { message: 'Amount must be a valid number (example: 345000.54).' } };
  }
  return { value: Number(normalized), error: null };
}

async function uploadSingleDonationAttachment(file, { trustId = null } = {}) {
  if (!file) return { data: null, error: { message: 'No attachment file provided.' } };
  if (!file.type || !file.type.startsWith('image/')) {
    return { data: null, error: { message: `Only image files are allowed: ${file?.name || 'unknown file'}` } };
  }

  const path = buildDonationAttachmentPath(trustId, file);
  const { error: uploadError } = await supabase
    .storage
    .from(DONATIONS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    if (String(uploadError.message || '').toLowerCase().includes('bucket not found')) {
      return {
        data: null,
        error: {
          ...uploadError,
          message: `Storage bucket "${DONATIONS_BUCKET}" not found. Create this bucket in Supabase Storage or set VITE_DONATIONS_BUCKET.`,
        },
      };
    }
    return { data: null, error: uploadError };
  }

  const { data: publicData } = supabase.storage.from(DONATIONS_BUCKET).getPublicUrl(path);
  return {
    data: {
      path,
      publicUrl: String(publicData?.publicUrl || '').trim(),
    },
    error: null,
  };
}

export async function uploadDonationAttachments(files = [], { trustId = null } = {}) {
  const selectedFiles = Array.from(files || []).filter(Boolean);
  if (!selectedFiles.length) return { data: [], error: null };

  const uploadResults = await Promise.all(
    selectedFiles.map(async (file) => {
      const { data, error } = await uploadSingleDonationAttachment(file, { trustId });
      return { file, data, error };
    })
  );

  const firstError = uploadResults.find((result) => result.error)?.error || null;
  if (firstError) return { data: [], error: firstError };

  return {
    data: uploadResults.map((result) => String(result.data?.publicUrl || '').trim()).filter(Boolean),
    error: null,
  };
}

export async function fetchDonationsByTrust(trustId) {
  if (!trustId) return { data: [], error: null };

  return cachedQuery(
    `donations:list:${trustId}`,
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

export async function createDonation(payload = {}) {
  const name = String(payload.name || '').trim();
  if (!name) return { data: null, error: { message: 'Donation name is required.' } };

  const row = {
    trust_id: payload.trust_id || null,
    name,
    description: String(payload.description || '').trim() || null,
    attachments: normalizeAttachments(payload.attachments),
    amount: null,
    amount_type: String(payload.amount_type || '').trim() || null,
    status: String(payload.status || 'active').trim() || 'active',
    type: String(payload.type || '').trim() || null,
  };

  const { value: parsedAmount, error: amountError } = toMoneyValue(payload.amount);
  if (amountError) return { data: null, error: amountError };
  row.amount = parsedAmount;

  const { data, error } = await supabase.from(TABLE_NAME).insert([row]).select('*').single();
  if (!error) invalidateCache('donations:');
  return { data: data ? normalizeRow(data) : null, error };
}

export async function updateDonation(donationId, updates = {}, trustId = null) {
  if (!donationId) return { data: null, error: { message: 'No donation id provided.' } };

  const payload = {
    ...(updates.name !== undefined ? { name: String(updates.name || '').trim() } : {}),
    ...(updates.description !== undefined
      ? { description: String(updates.description || '').trim() || null }
      : {}),
    ...(updates.attachments !== undefined ? { attachments: normalizeAttachments(updates.attachments) } : {}),
    ...(updates.amount !== undefined ? { amount: null } : {}),
    ...(updates.amount_type !== undefined
      ? { amount_type: String(updates.amount_type || '').trim() || null }
      : {}),
    ...(updates.status !== undefined ? { status: String(updates.status || '').trim() || 'active' } : {}),
    ...(updates.type !== undefined ? { type: String(updates.type || '').trim() || null } : {}),
    updated_at: new Date().toISOString(),
  };

  if (updates.amount !== undefined) {
    const { value: parsedAmount, error: amountError } = toMoneyValue(updates.amount);
    if (amountError) return { data: null, error: amountError };
    payload.amount = parsedAmount;
  }

  let query = supabase.from(TABLE_NAME).update(payload).eq('id', donationId);
  if (trustId) query = query.eq('trust_id', trustId);

  const { data, error } = await query.select('*').single();
  if (!error) invalidateCache('donations:');
  return { data: data ? normalizeRow(data) : null, error };
}

export async function deleteDonation(donationId, trustId = null) {
  if (!donationId) return { error: { message: 'No donation id provided.' } };

  let query = supabase.from(TABLE_NAME).delete().eq('id', donationId);
  if (trustId) query = query.eq('trust_id', trustId);

  const { error } = await query;
  if (!error) invalidateCache('donations:');
  return { error };
}
