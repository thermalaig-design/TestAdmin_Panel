import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from './requestCache';

const TRUST_COLUMNS = 'id, name, icon_url, remark, created_at, terms_content, privacy_content, template_id, legal_name, superuser_id';
const TRUST_ICON_BUCKET = 'trust-icons';

function extensionFromFile(file) {
  const fromName = String(file?.name || '').split('.').pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  const mime = String(file?.type || '').toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'jpg';
}

function uniqueId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildTrustIconPath(ownerId, file) {
  const ext = extensionFromFile(file);
  const safeOwner = String(ownerId || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '');
  return `${safeOwner}/${Date.now()}-${uniqueId()}.${ext}`;
}

export async function uploadTrustIcon(file, { ownerId = null } = {}) {
  if (!file) return { data: null, error: { message: 'No icon file provided.' } };
  if (!file.type || !file.type.startsWith('image/')) {
    return { data: null, error: { message: 'Please select a valid image file.' } };
  }

  const path = buildTrustIconPath(ownerId, file);
  const { error: uploadError } = await supabase
    .storage
    .from(TRUST_ICON_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) return { data: null, error: uploadError };

  const { data: publicData } = supabase
    .storage
    .from(TRUST_ICON_BUCKET)
    .getPublicUrl(path);

  return {
    data: {
      path,
      publicUrl: publicData?.publicUrl || null,
    },
    error: null,
  };
}

/**
 * Create a new trust
 */
export async function createTrust(superuserId, { name, legalName, iconUrl, iconFile = null, remark, templateId = null }) {
  if (!superuserId) return { data: null, error: { message: 'No superuser ID provided' } };
  if (!name?.trim()) return { data: null, error: { message: 'Trust name is required' } };
  let finalIconUrl = iconUrl?.trim() || null;

  if (iconFile) {
    const { data: uploadData, error: uploadError } = await uploadTrustIcon(iconFile, { ownerId: superuserId });
    if (uploadError) {
      return { data: null, error: { message: uploadError.message || 'Unable to upload trust icon.' } };
    }
    finalIconUrl = uploadData?.publicUrl || null;
  }

  const { data, error } = await supabase
    .from('Trust')
    .insert([
      {
        name: name.trim(),
        legal_name: legalName?.trim() || null,
        icon_url: finalIconUrl,
        remark: remark?.trim() || null,
        template_id: templateId,
        superuser_id: superuserId,
      },
    ])
    .select(TRUST_COLUMNS)
    .single();

  if (!error) invalidateCache('trust:');
  return { data, error };
}

/**
 * Fetch trust details by ID
 */
export async function fetchTrustDetails(trustId) {
  if (!trustId) return { data: null, error: { message: 'No trust ID provided' } };

  return cachedQuery(`trust:details:${trustId}`, async () => {
    const { data, error } = await supabase
      .from('Trust')
      .select(TRUST_COLUMNS)
      .eq('id', trustId)
      .single();

    return { data, error };
  }, 20000);
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

  if (!error) invalidateCache(`trust:details:${trustId}`);
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

  if (!error) invalidateCache(`trust:details:${trustId}`);
  return { data, error };
}
