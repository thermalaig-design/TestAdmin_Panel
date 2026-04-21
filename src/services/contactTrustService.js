import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from './requestCache';

const TABLE_NAME = 'ContactTrust';
const MAX_FETCH = 100;

function normalizeRow(row = {}) {
  return {
    id: row.id,
    trust_id: row.trust_id || null,
    facility_name: row.facility_name || '',
    contact_number: row.contact_number || '',
    email_id: row.email_id || '',
    contact_person: row.contact_person || '',
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    raw: row,
  };
}

export async function fetchContactTrustByTrust(trustId) {
  if (!trustId) return { data: [], error: null };

  return cachedQuery(
    `contact-trust:list:${trustId}`,
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

export async function createContactTrust(payload = {}) {
  const row = {
    trust_id: payload.trust_id || null,
    facility_name: String(payload.facility_name || '').trim(),
    contact_number: String(payload.contact_number || '').trim() || null,
    email_id: String(payload.email_id || '').trim() || null,
    contact_person: String(payload.contact_person || '').trim() || null,
  };

  const { data, error } = await supabase.from(TABLE_NAME).insert([row]).select('*').single();
  if (!error) invalidateCache('contact-trust:');
  return { data: data ? normalizeRow(data) : null, error };
}

export async function updateContactTrust(contactId, updates = {}, trustId = null) {
  if (!contactId) return { data: null, error: { message: 'No contact id provided.' } };

  const payload = {
    ...(updates.facility_name !== undefined ? { facility_name: String(updates.facility_name || '').trim() } : {}),
    ...(updates.contact_number !== undefined
      ? { contact_number: String(updates.contact_number || '').trim() || null }
      : {}),
    ...(updates.email_id !== undefined
      ? { email_id: String(updates.email_id || '').trim() || null }
      : {}),
    ...(updates.contact_person !== undefined
      ? { contact_person: String(updates.contact_person || '').trim() || null }
      : {}),
    updated_at: new Date().toISOString(),
  };

  let query = supabase.from(TABLE_NAME).update(payload).eq('id', contactId);
  if (trustId) query = query.eq('trust_id', trustId);

  const { data, error } = await query.select('*').single();
  if (!error) invalidateCache('contact-trust:');
  return { data: data ? normalizeRow(data) : null, error };
}

export async function deleteContactTrust(contactId, trustId = null) {
  if (!contactId) return { error: { message: 'No contact id provided.' } };

  let query = supabase.from(TABLE_NAME).delete().eq('id', contactId);
  if (trustId) query = query.eq('trust_id', trustId);

  const { error } = await query;
  if (!error) invalidateCache('contact-trust:');
  return { error };
}
