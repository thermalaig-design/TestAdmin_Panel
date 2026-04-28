import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from './requestCache';

const SHARE_APP_LINKS_TABLE = 'shareApp_links';

function normalizeRow(row = {}) {
  return {
    id: row.id || '',
    trustId: row.trust_id || null,
    playStoreLink: row.play_store_link || '',
    appStoreLink: row.app_store_link || '',
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    raw: row,
  };
}

function toNullableText(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

export async function fetchShareAppLinksByTrust(trustId) {
  if (!trustId) return { data: null, error: null };

  return cachedQuery(`share-app-links:trust:${trustId}`, async () => {
    const { data, error } = await supabase
      .from(SHARE_APP_LINKS_TABLE)
      .select('*')
      .eq('trust_id', trustId)
      .limit(1)
      .maybeSingle();

    return { data: data ? normalizeRow(data) : null, error };
  }, 10000);
}

export async function upsertShareAppLinksByTrust({ trust_id, play_store_link, app_store_link }) {
  if (!trust_id) {
    return { data: null, error: { message: 'trust_id is required for upsert.' } };
  }

  const payload = {
    trust_id,
    play_store_link: toNullableText(play_store_link),
    app_store_link: toNullableText(app_store_link),
  };

  const { data, error } = await supabase
    .from(SHARE_APP_LINKS_TABLE)
    .upsert(payload, { onConflict: 'trust_id' })
    .select('*')
    .single();

  if (!error) invalidateCache('share-app-links:');
  return { data: data ? normalizeRow(data) : null, error };
}

export async function deleteShareAppLinksByTrust(trustId) {
  if (!trustId) return { error: { message: 'trust_id is required for delete.' } };

  const { error } = await supabase
    .from(SHARE_APP_LINKS_TABLE)
    .delete()
    .eq('trust_id', trustId);

  if (!error) invalidateCache('share-app-links:');
  return { error };
}
