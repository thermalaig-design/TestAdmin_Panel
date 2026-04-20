import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from './requestCache';

const FOLDERS_TABLE = 'gallery_folders';
const PHOTOS_TABLE = 'gallery_photos';

function normalizeFolderRow(row = {}, index = 0) {
  const id = row.id || `${index}`;
  const name = row.name || 'Untitled';
  return { id, name, description: row.description || null, raw: row };
}

function normalizePhotoRow(row = {}, index = 0) {
  const id = row.id || `${index}`;
  const url = row.public_url || row.storage_path || '';
  const folderId = row.folder_id || null;
  const createdAt = row.created_at || null;
  return { id, url, folderId, createdAt, raw: row };
}

export async function fetchGalleryFolders(trustId) {
  if (!trustId) return { data: [], error: null };

  return cachedQuery(`gallery:folders:${trustId}`, async () => {
    const { data, error } = await supabase
      .from(FOLDERS_TABLE)
      .select('*')
      .eq('trust_id', trustId)
      .order('created_at', { ascending: true });

    return { data: (data || []).map(normalizeFolderRow), error };
  }, 12000);
}

export async function fetchGalleryPhotos(folderIds = []) {
  if (!folderIds.length) return { data: [], error: null };
  const key = [...folderIds].map(String).sort().join(',');

  return cachedQuery(`gallery:photos:${key}`, async () => {
    const { data, error } = await supabase
      .from(PHOTOS_TABLE)
      .select('*')
      .in('folder_id', folderIds)
      .order('created_at', { ascending: false });

    return { data: (data || []).map(normalizePhotoRow), error };
  }, 10000);
}

export async function createGalleryFolder(name, trustId) {
  if (!trustId) return { data: null, error: { message: 'No trust id provided.' } };

  const payload = { trust_id: trustId, name };
  const { data, error } = await supabase
    .from(FOLDERS_TABLE)
    .insert([payload])
    .select('*')
    .single();

  if (!error) invalidateCache('gallery:');
  return { data: data ? normalizeFolderRow(data, 0) : null, error };
}

export async function updateGalleryFolder(folderId, updates) {
  if (!folderId) return { data: null, error: { message: 'No folder id provided.' } };

  const payload = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(FOLDERS_TABLE)
    .update(payload)
    .eq('id', folderId)
    .select('*')
    .single();

  if (!error) invalidateCache('gallery:');
  return { data: data ? normalizeFolderRow(data, 0) : null, error };
}

export async function createGalleryPhoto(payload) {
  const row = {
    storage_path: payload.imageUrl,
    public_url: payload.imageUrl,
    folder_id: payload.folderId || null,
    uploaded_by: payload.uploadedBy || null,
  };

  const { data, error } = await supabase
    .from(PHOTOS_TABLE)
    .insert([row])
    .select('*')
    .single();

  if (!error) invalidateCache('gallery:photos:');
  return { data: data ? normalizePhotoRow(data, 0) : null, error };
}

export async function deleteGalleryPhoto(photoId) {
  if (!photoId) return { error: { message: 'No photo id provided.' } };

  const { error } = await supabase
    .from(PHOTOS_TABLE)
    .delete()
    .eq('id', photoId);

  if (!error) invalidateCache('gallery:');
  return { error };
}

export async function deleteGalleryFolder(folderId) {
  if (!folderId) return { error: { message: 'No folder id provided.' } };

  const { error } = await supabase
    .from(FOLDERS_TABLE)
    .delete()
    .eq('id', folderId);

  if (!error) invalidateCache('gallery:');
  return { error };
}
