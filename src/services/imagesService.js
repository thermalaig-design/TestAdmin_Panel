import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from './requestCache';

const IMAGES_TABLE = 'Images';

function normalizeImageRow(row = {}) {
  const linkedPhoto = row.gallery_photo || null;
  const previewUrl = linkedPhoto?.public_url || linkedPhoto?.storage_path || null;
  return {
    id: row.id || '',
    galleryPhotoId: row.gallery_photo_id || null,
    previewUrl,
    title: row.Title || '',
    hashtags: row.Hashtags || '',
    description: row.Description || '',
    aspectRatio: row.aspectRatio || '',
    intent: row.Intent || '',
    approved: row.Approved || '',
    createdBy: row.created_by || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    raw: row,
  };
}

export async function fetchImages({ limit = 30 } = {}) {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(100, Number(limit))) : 30;
  const cacheKey = `images:list:${safeLimit}`;

  return cachedQuery(cacheKey, async () => {
    const { data, error } = await supabase
      .from(IMAGES_TABLE)
      .select('id, gallery_photo_id, Title, Hashtags, Description, aspectRatio, Intent, Approved, created_by, created_at, updated_at, gallery_photo:gallery_photos(public_url, storage_path)')
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    return {
      data: (data || []).map(normalizeImageRow),
      error,
    };
  }, 15000);
}

export async function fetchImagesCount() {
  return cachedQuery('images:count', async () => {
    const { count, error } = await supabase
      .from(IMAGES_TABLE)
      .select('id', { count: 'exact', head: true });

    return { count: count || 0, error };
  }, 15000);
}

export async function createImage(payload) {
  const { data, error } = await supabase
    .from(IMAGES_TABLE)
    .insert([payload])
    .select('id, gallery_photo_id, Title, Hashtags, Description, aspectRatio, Intent, Approved, created_by, created_at, updated_at')
    .single();

  if (!error) invalidateCache('images:');
  return { data: data ? normalizeImageRow(data) : null, error };
}

export async function updateImage(id, updates) {
  if (!id) return { data: null, error: { message: 'Image id is required.' } };

  const { data, error } = await supabase
    .from(IMAGES_TABLE)
    .update(updates)
    .eq('id', id)
    .select('id, gallery_photo_id, Title, Hashtags, Description, aspectRatio, Intent, Approved, created_by, created_at, updated_at')
    .single();

  if (!error) invalidateCache('images:');
  return { data: data ? normalizeImageRow(data) : null, error };
}
