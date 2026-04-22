import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from './requestCache';

const TABLE_NAME = 'Donations';
const MAX_FETCH = 200;
const MONEY_RE = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
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
