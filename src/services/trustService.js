import { supabase } from '../lib/supabase';

const TRUST_COLUMNS = 'id, name, icon_url, remark, created_at, terms_content, privacy_content, template_id, legal_name, superuser_id';

/**
 * Create a new trust
 */
export async function createTrust(superuserId, { name, legalName, iconUrl, remark, templateId = null }) {
  if (!superuserId) return { data: null, error: { message: 'No superuser ID provided' } };
  if (!name?.trim()) return { data: null, error: { message: 'Trust name is required' } };

  const { data, error } = await supabase
    .from('Trust')
    .insert([
      {
        name: name.trim(),
        legal_name: legalName?.trim() || null,
        icon_url: iconUrl?.trim() || null,
        remark: remark?.trim() || null,
        template_id: templateId,
        superuser_id: superuserId,
      },
    ])
    .select(TRUST_COLUMNS)
    .single();

  return { data, error };
}

/**
 * Fetch trust details by ID
 */
export async function fetchTrustDetails(trustId) {
  if (!trustId) return { data: null, error: { message: 'No trust ID provided' } };

  const { data, error } = await supabase
    .from('Trust')
    .select(TRUST_COLUMNS)
    .eq('id', trustId)
    .single();

  return { data, error };
}

/**
 * Update trust terms_content and privacy_content
 */
export async function updateTrustContent(trustId, { termsContent, privacyContent }) {
  if (!trustId) return { data: null, error: { message: 'No trust ID provided' } };

  const { data, error } = await supabase
    .from('Trust')
    .update({
      terms_content: termsContent,
      privacy_content: privacyContent,
    })
    .eq('id', trustId)
    .select(TRUST_COLUMNS)
    .single();

  return { data, error };
}

/**
 * Update trust basic info
 */
export async function updateTrustInfo(trustId, updates) {
  if (!trustId) return { data: null, error: { message: 'No trust ID provided' } };

  const { data, error } = await supabase
    .from('Trust')
    .update(updates)
    .eq('id', trustId)
    .select(TRUST_COLUMNS)
    .single();

  return { data, error };
}
