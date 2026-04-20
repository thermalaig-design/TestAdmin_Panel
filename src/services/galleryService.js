import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from './requestCache';

const FOLDERS_TABLE = 'gallery_folders';
const PHOTOS_TABLE = 'gallery_photos';
const GALLERY_BUCKET = 'gallery';

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

function buildGalleryStoragePath(folderId, file) {
  const ext = extensionFromFile(file);
  const safeFolderId = String(folderId || 'misc').replace(/[^a-zA-Z0-9_-]/g, '') || 'misc';
  return `${safeFolderId}/${Date.now()}-${uniqueId()}.${ext}`;
}

function formatSizeToKb(bytes) {
  if (!Number.isFinite(Number(bytes))) return null;
  return `${(Number(bytes) / 1024).toFixed(2)} KB`;
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
  const size = row.size || null;
  return { id, url, folderId, createdAt, size, raw: row };
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
  }, 300000);
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
  }, 300000);
}

export async function fetchGalleryPhotosByFolder(folderId, options = {}) {
  if (!folderId) return { data: [], count: 0, error: null };
  const offset = Number.isFinite(options.offset) ? Math.max(0, options.offset) : 0;
  const limit = Number.isFinite(options.limit) ? Math.max(1, options.limit) : 20;
  const key = `gallery:photos:folder:${folderId}:${offset}:${limit}`;

  return cachedQuery(key, async () => {
    const { data, count, error } = await supabase
      .from(PHOTOS_TABLE)
      .select('*', { count: 'exact' })
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return { data: (data || []).map(normalizePhotoRow), count: count || 0, error };
  }, 300000);
}

export async function fetchGalleryPhotosCount(folderIds = []) {
  if (!folderIds.length) return { count: 0, error: null };
  const key = [...folderIds].map(String).sort().join(',');

  return cachedQuery(`gallery:photos:count:${key}`, async () => {
    const { count, error } = await supabase
      .from(PHOTOS_TABLE)
      .select('id', { count: 'exact', head: true })
      .in('folder_id', folderIds);

    return { count: count || 0, error };
  }, 300000);
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
  let storagePath = payload.storagePath || null;
  let publicUrl = payload.imageUrl || null;
  let size = payload.size || null;

  if (payload.file) {
    const path = buildGalleryStoragePath(payload.folderId, payload.file);
    const { error: uploadError } = await supabase
      .storage
      .from(GALLERY_BUCKET)
      .upload(path, payload.file, {
        cacheControl: '3600',
        upsert: false,
        contentType: payload.file.type || undefined,
      });
    if (uploadError) return { data: null, error: uploadError };

    const { data: publicData } = supabase
      .storage
      .from(GALLERY_BUCKET)
      .getPublicUrl(path);

    storagePath = path;
    publicUrl = publicData?.publicUrl || null;
    if (!size) size = formatSizeToKb(payload.file.size);
  } else if (typeof payload.imageUrl === 'string' && payload.imageUrl.startsWith('data:image/')) {
    const parsed = dataUrlToBuffer(payload.imageUrl);
    if (!parsed?.buffer?.length) {
      return { data: null, error: { message: 'Invalid image data URL.' } };
    }
    const ext = parsed.mime.includes('png') ? 'png' : parsed.mime.includes('webp') ? 'webp' : 'jpg';
    const safeFolderId = String(payload.folderId || 'misc').replace(/[^a-zA-Z0-9_-]/g, '') || 'misc';
    const path = `${safeFolderId}/${Date.now()}-${uniqueId()}.${ext}`;
    const { error: uploadError } = await supabase
      .storage
      .from(GALLERY_BUCKET)
      .upload(path, parsed.buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: parsed.mime,
      });
    if (uploadError) return { data: null, error: uploadError };

    const { data: publicData } = supabase
      .storage
      .from(GALLERY_BUCKET)
      .getPublicUrl(path);
    storagePath = path;
    publicUrl = publicData?.publicUrl || null;
    if (!size) size = formatSizeToKb(parsed.buffer.length);
  }

  if (!storagePath && !publicUrl) {
    return { data: null, error: { message: 'No file or image URL provided.' } };
  }

  const row = {
    storage_path: storagePath || publicUrl,
    public_url: publicUrl,
    folder_id: payload.folderId || null,
    uploaded_by: payload.uploadedBy || null,
    size: size || null,
  };

  const { data, error } = await supabase
    .from(PHOTOS_TABLE)
    .insert([row])
    .select('*')
    .single();

  if (!error) invalidateCache('gallery:');
  return { data: data ? normalizePhotoRow(data, 0) : null, error };
}

export async function deleteGalleryPhoto(photoId) {
  if (!photoId) return { error: { message: 'No photo id provided.' } };

  const { data: existing, error: fetchError } = await supabase
    .from(PHOTOS_TABLE)
    .select('storage_path')
    .eq('id', photoId)
    .maybeSingle();
  if (fetchError) return { error: fetchError };

  const storagePath = String(existing?.storage_path || '');
  if (storagePath && !storagePath.startsWith('http') && !storagePath.startsWith('data:')) {
    await supabase.storage.from(GALLERY_BUCKET).remove([storagePath]);
  }

  const { error } = await supabase
    .from(PHOTOS_TABLE)
    .delete()
    .eq('id', photoId);

  if (!error) invalidateCache('gallery:');
  return { error };
}

export async function fetchGalleryBucketFilesWithRecords({ folderId = null, limit = 200 } = {}) {
  const prefix = folderId ? String(folderId) : '';
  const key = `gallery:bucket-records:${prefix}:${limit}`;

  return cachedQuery(key, async () => {
    const { data: files, error: fileError } = await supabase
      .storage
      .from(GALLERY_BUCKET)
      .list(prefix, {
        limit: Math.max(1, Number(limit) || 200),
        sortBy: { column: 'created_at', order: 'desc' },
      });
    if (fileError) return { data: { files: [], records: [] }, error: fileError };

    let query = supabase
      .from(PHOTOS_TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.max(1, Number(limit) || 200));
    if (folderId) query = query.eq('folder_id', folderId);
    const { data: rows, error: dbError } = await query;
    if (dbError) return { data: { files: [], records: [] }, error: dbError };

    const records = (rows || []).map(normalizePhotoRow);
    const byPath = new Map(records.map((item) => [String(item.raw?.storage_path || ''), item]));
    const mappedFiles = (files || [])
      .filter((item) => item?.name)
      .map((item) => {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        return {
          path,
          name: item.name,
          created_at: item.created_at || null,
          updated_at: item.updated_at || null,
          db_record: byPath.get(path) || null,
        };
      });

    return { data: { files: mappedFiles, records }, error: null };
  }, 20000);
}

export async function fetchGalleryAssetsByFolder(folderId, options = {}) {
  if (!folderId) return { data: { files: [], records: [] }, error: null };
  return fetchGalleryBucketFilesWithRecords({ folderId, limit: options.limit || 200 });
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
