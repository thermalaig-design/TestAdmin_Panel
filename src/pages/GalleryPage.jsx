import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import {
  fetchGalleryFolders,
  fetchGalleryPhotos,
  createGalleryFolder,
  createGalleryPhoto,
  deleteGalleryPhoto,
  deleteGalleryFolder,
  updateGalleryFolder,
} from '../services/galleryService';
import './GalleryPage.css';

export default function GalleryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { folderId: routeFolderId = '' } = useParams();
  const { userName = 'Admin', trust = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'dashboard';
  const trustId = trust?.id || null;

  const [folders, setFolders] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [activeFolderMenuId, setActiveFolderMenuId] = useState(null);
  const [folderSearch, setFolderSearch] = useState('');
  const [folderSort, setFolderSort] = useState('name_asc');
  const [folderPage, setFolderPage] = useState(1);
  const deferredFolderSearch = useDeferredValue(folderSearch);
  const FOLDER_PAGE_SIZE = 8;

  useEffect(() => {
    if (!trustId) navigate('/dashboard', { replace: true, state: { userName, trust } });
  }, [trustId, userName, navigate, trust]);

  useEffect(() => {
    const load = async () => {
      if (!trustId) return;
      setLoading(true);
      setError('');
      const { data: folderData, error: folderErr } = await fetchGalleryFolders(trustId);
      if (folderErr) setError(folderErr.message || 'Unable to load folders.');

      const trustFolders = folderData || [];
      setFolders(trustFolders);

      const folderIds = trustFolders.map((f) => f.id).filter(Boolean);
      const { data: photoData, error: photoErr } = await fetchGalleryPhotos(folderIds);
      if (photoErr) setError(photoErr.message || 'Unable to load photos.');
      setPhotos(photoData || []);
      const hasRouteFolder = trustFolders.some((folder) => String(folder.id) === String(routeFolderId));
      if (hasRouteFolder) {
        setSelectedFolderId(routeFolderId);
      } else {
        setSelectedFolderId((prev) => {
          if (prev && trustFolders.some((folder) => String(folder.id) === String(prev))) return prev;
          return trustFolders[0]?.id || '';
        });
      }
      setLoading(false);
    };
    load();
  }, [trustId, routeFolderId]);

  useEffect(() => {
    if (routeFolderId) {
      setSelectedFolderId(routeFolderId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [routeFolderId]);

  const folderNameById = useMemo(() => {
    const map = new Map();
    folders.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [folders]);

  const photoCountByFolderId = useMemo(() => {
    const map = new Map();
    photos.forEach((photo) => {
      const key = photo.folderId;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [photos]);

  const coverPhotoByFolderId = useMemo(() => {
    const map = new Map();
    photos.forEach((photo) => {
      if (!map.has(photo.folderId)) {
        map.set(photo.folderId, photo.url);
      }
    });
    return map;
  }, [photos]);
  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) || null,
    [folders, selectedFolderId]
  );

  const showFolderDetail = Boolean(routeFolderId && selectedFolder);

  const handleHeaderBack = () => {
    if (routeFolderId) {
      navigate('/gallery', { state: { userName, trust } });
      return;
    }
    navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } });
  };

  const filteredFolders = useMemo(() => {
    const term = deferredFolderSearch.trim().toLowerCase();
    let list = folders;
    if (term) {
      list = list.filter((folder) => String(folder.name || '').toLowerCase().includes(term));
    }
    const sorted = [...list].sort((left, right) =>
      String(left.name || '').localeCompare(String(right.name || ''))
    );
    if (folderSort === 'name_desc') sorted.reverse();
    return sorted;
  }, [folders, deferredFolderSearch, folderSort]);

  const folderTotalPages = Math.max(1, Math.ceil(filteredFolders.length / FOLDER_PAGE_SIZE));

  const paginatedFolders = useMemo(() => {
    const start = (folderPage - 1) * FOLDER_PAGE_SIZE;
    return filteredFolders.slice(start, start + FOLDER_PAGE_SIZE);
  }, [filteredFolders, folderPage]);

  useEffect(() => {
    setFolderPage(1);
  }, [folderSearch, folderSort]);

  useEffect(() => {
    if (folderPage > folderTotalPages) setFolderPage(folderTotalPages);
  }, [folderPage, folderTotalPages]);

  const filteredPhotos = useMemo(() => {
    if (!selectedFolderId) return [];
    return photos.filter((p) => p.folderId === selectedFolderId);
  }, [photos, selectedFolderId]);

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read selected image.'));
      reader.readAsDataURL(file);
    });

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (!selectedFolderId) {
      setError('Please select a folder before uploading.');
      return;
    }

    const imageFiles = files.filter((file) => file?.type && file.type.startsWith('image/'));
    if (!imageFiles.length) {
      setError('Please select a valid image file.');
      return;
    }

    setUploading(true);
    setError('');

    const uploaded = [];
    let failed = 0;

    for (const file of imageFiles) {
      try {
        const imageUrl = await readFileAsDataUrl(file);
        const { data, error: createErr } = await createGalleryPhoto({
          imageUrl,
          folderId: selectedFolderId,
        });
        if (createErr) {
          failed += 1;
        } else if (data) {
          uploaded.push(data);
        }
      } catch {
        failed += 1;
      }
    }

    if (uploaded.length > 0) {
      setPhotos((prev) => [...uploaded, ...prev]);
    }

    if (failed > 0) {
      setError(`Uploaded ${uploaded.length}/${imageFiles.length} image(s). ${failed} failed.`);
    } else if (files.length !== imageFiles.length) {
      setError(`Uploaded ${uploaded.length} image(s). Non-image files were skipped.`);
    } else {
      setError('');
    }

    setUploading(false);
  };

  const handleAddFolder = async () => {
    const name = window.prompt('Enter new folder name');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = folders.find((f) => (f.name || '').toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      setSelectedFolderId(existing.id);
      navigate(`/gallery/${existing.id}`, { state: { userName, trust } });
      return;
    }

    const { data, error: createErr } = await createGalleryFolder(trimmed, trustId);
    if (createErr) {
      setError(createErr.message || 'Unable to create folder.');
      return;
    }

    const newFolder = data || { id: `local-${trimmed}`, name: trimmed };
    setFolders((prev) => [newFolder, ...prev]);
    setSelectedFolderId(newFolder.id || trimmed);
    navigate(`/gallery/${newFolder.id || trimmed}`, { state: { userName, trust } });
  };

  const handleDeletePhoto = async (photoId) => {
    if (!photoId) return;
    const shouldDelete = window.confirm('Are you sure you want to permanently delete this photo?');
    if (!shouldDelete) return;

    const { error: deleteErr } = await deleteGalleryPhoto(photoId);
    if (deleteErr) {
      setError(deleteErr.message || 'Unable to delete photo.');
      return;
    }

    setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
    setError('');
  };

  const handleDeleteFolder = async (folder) => {
    if (!folder?.id) return;

    const photoCount = photoCountByFolderId.get(folder.id) || 0;
    const shouldDelete = window.confirm(
      `Are you sure you want to delete the folder "${folder.name}"?\nThis folder currently contains ${photoCount} photo${photoCount === 1 ? '' : 's'}.`
    );
    if (!shouldDelete) return;

    const { error: deleteErr } = await deleteGalleryFolder(folder.id);
    if (deleteErr) {
      setError(deleteErr.message || 'Unable to delete folder.');
      return;
    }

    setFolders((prev) => prev.filter((item) => item.id !== folder.id));
    setPhotos((prev) => prev.filter((photo) => photo.folderId !== folder.id));
    setError('');

    if (selectedFolderId === folder.id || routeFolderId === folder.id) {
      navigate('/gallery', { state: { userName, trust } });
    }
  };

  const handleRenameFolder = async (folder) => {
    if (!folder?.id) return;

    const nextName = window.prompt('Enter a new folder name', folder.name || '');
    if (!nextName) {
      setActiveFolderMenuId(null);
      return;
    }

    const trimmed = nextName.trim();
    if (!trimmed || trimmed === folder.name) {
      setActiveFolderMenuId(null);
      return;
    }

    const duplicate = folders.find(
      (item) => item.id !== folder.id && String(item.name || '').toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setError('A folder with this name already exists.');
      setActiveFolderMenuId(null);
      return;
    }

    const { data, error: updateErr } = await updateGalleryFolder(folder.id, { name: trimmed });
    if (updateErr) {
      setError(updateErr.message || 'Unable to rename folder.');
    } else if (data) {
      setFolders((prev) => prev.map((item) => (item.id === folder.id ? data : item)));
      setError('');
    }
    setActiveFolderMenuId(null);
  };

  const handleSelectFolder = async (folder) => {
    if (!folder?.id) return;
    setSelectedFolderId(folder.id);
    navigate(`/gallery/${folder.id}`, { state: { userName, trust } });
  };

  return (
    <div className="gallery-root">
      <Sidebar
        trustName={trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
        onLogout={() => navigate('/login')}
      />
      <main className="gallery-main">
        <PageHeader
          title="Gallery"
          subtitle="Upload and manage photo albums"
          onBack={handleHeaderBack}
        />
        <div className="gallery-content">
          {error && <div className="gallery-error">{error}</div>}
          <div className="gallery-shell">
            {!routeFolderId && (
              <>
                <section className="gallery-hero">
                  <div className="gallery-hero-copy">
                    <span className="gallery-kicker">Visual archive</span>
                    <h2>Build a gallery that feels curated, not cluttered.</h2>
                    <p>
                      Organize albums, spotlight event memories, and upload fresh images into
                      beautifully grouped cards for {trust?.name || 'your trust'}.
                    </p>
                  </div>
                  <div className="gallery-hero-side">
                    <div className="gallery-stats">
                    <div className="gallery-stat-card">
                      <span className="gallery-stat-label">Albums</span>
                      <strong>{folders.length}</strong>
                    </div>
                    <div className="gallery-stat-card">
                      <span className="gallery-stat-label">Photos</span>
                      <strong>{photos.length}</strong>
                    </div>
                    <div className="gallery-stat-card">
                      <span className="gallery-stat-label">Selected</span>
                      <strong>{selectedFolder ? (photoCountByFolderId.get(selectedFolder.id) || 0) : 0}</strong>
                    </div>
                  </div>
                  </div>
                </section>

                <section className="gallery-folders">
                  <div className="gallery-folders-head">
                    <div>
                      <span className="gallery-section-title">Album cards</span>
                      <div className="gallery-section-sub">Only folders for the selected trust are shown here.</div>
                    </div>
                    <button className="gallery-add-folder" onClick={handleAddFolder} title="Create folder">+ New</button>
                  </div>
                  <div className="gallery-folder-controls">
                    <input
                      type="search"
                      className="gallery-folder-search"
                      placeholder="Search folder..."
                      value={folderSearch}
                      onChange={(e) => setFolderSearch(e.target.value)}
                    />
                    <label className="gallery-folder-sort">
                      <span>Sort By</span>
                      <select
                        value={folderSort}
                        onChange={(e) => setFolderSort(e.target.value)}
                      >
                        <option value="name_asc">Folder Name A-Z</option>
                        <option value="name_desc">Folder Name Z-A</option>
                      </select>
                    </label>
                  </div>
                  {folders.length === 0 ? (
                    <div className="gallery-empty">
                      No gallery folders are available for this trust. Click `+ New` to create one.
                    </div>
                  ) : filteredFolders.length === 0 ? (
                    <div className="gallery-empty">
                      No folder found for "{folderSearch}".
                    </div>
                  ) : (
                    <>
                    <div className="gallery-folder-list">
                      {paginatedFolders.map((folder, index) => (
                        <div
                          key={folder.id || folder.name}
                          className={`gallery-folder-item ${selectedFolderId === folder.id ? 'active' : ''}`}
                          style={{ ['--accent']: `var(--folder-${(((folderPage - 1) * FOLDER_PAGE_SIZE + index) % 6) + 1})` }}
                        >
                          <div className="gallery-folder-menu-wrap">
                            <button
                              type="button"
                              className="gallery-folder-menu-btn"
                              aria-label={`Edit ${folder.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveFolderMenuId((prev) => (prev === folder.id ? null : folder.id));
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              </svg>
                            </button>
                            {activeFolderMenuId === folder.id && (
                              <div className="gallery-folder-menu">
                                <div className="gallery-folder-menu-row">
                                  <button
                                    type="button"
                                    className="gallery-folder-menu-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRenameFolder(folder);
                                    }}
                                  >
                                    Rename folder
                                  </button>
                                  <button
                                    type="button"
                                    className="gallery-folder-menu-close"
                                    aria-label="Close folder menu"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveFolderMenuId(null);
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  className="gallery-folder-menu-item delete"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteFolder(folder);
                                    setActiveFolderMenuId(null);
                                  }}
                                >
                                  Delete folder
                                </button>
                              </div>
                            )}
                          </div>
                          <button
                            className="gallery-folder-card-btn"
                            onClick={() => handleSelectFolder(folder)}
                            type="button"
                          >
                            <div className="gallery-folder-preview">
                              {coverPhotoByFolderId.get(folder.id) ? (
                                <img src={coverPhotoByFolderId.get(folder.id)} alt={folder.name} />
                              ) : (
                                <div className="gallery-folder-art">
                                  <div className="gallery-folder-dot" />
                                  <div className="gallery-folder-art-line" />
                                  <div className="gallery-folder-art-line short" />
                                </div>
                              )}
                            </div>
                            <div className="gallery-folder-meta">
                              <div className="gallery-folder-name">{folder.name}</div>
                              <div className="gallery-folder-count">
                                {photoCountByFolderId.get(folder.id) || 0} photos
                              </div>
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                    {filteredFolders.length > FOLDER_PAGE_SIZE && (
                      <div className="gallery-folder-pagination">
                        <button
                          type="button"
                          onClick={() => setFolderPage((prev) => Math.max(1, prev - 1))}
                          disabled={folderPage === 1}
                        >
                          Prev
                        </button>
                        <span>Page {folderPage} / {folderTotalPages}</span>
                        <button
                          type="button"
                          onClick={() => setFolderPage((prev) => Math.min(folderTotalPages, prev + 1))}
                          disabled={folderPage === folderTotalPages}
                        >
                          Next
                        </button>
                      </div>
                    )}
                    </>
                  )}
                </section>
              </>
            )}

            {showFolderDetail && (
              <section className="gallery-board">
                <div className="gallery-detail-head">
                  <div>
                    <div className="gallery-detail-title">
                      {folderNameById.get(selectedFolderId) || 'Folder'}
                    </div>
                    <div className="gallery-detail-sub">A focused card board for this album</div>
                  </div>
                  <div className="gallery-detail-actions">
                    {isEditingFolder && selectedFolder && (
                      <>
                        <button
                          className="gallery-rename-folder"
                          onClick={() => handleRenameFolder(selectedFolder)}
                          type="button"
                        >
                          Rename Folder
                        </button>
                        <button
                          className="gallery-delete-folder"
                          onClick={() => handleDeleteFolder(selectedFolder)}
                          type="button"
                        >
                          Delete Folder
                        </button>
                      </>
                    )}
                    <button
                      className={`gallery-edit-folder ${isEditingFolder ? 'active' : ''}`}
                      onClick={() => setIsEditingFolder((prev) => !prev)}
                      type="button"
                    >
                      {isEditingFolder ? 'Done' : 'Edit Folder'}
                    </button>
                  </div>
                </div>

                <div className="gallery-detail-grid">
                  <div className="gallery-spotlight">
                    <div className="gallery-spotlight-top">
                      <span className="gallery-kicker">Selected album</span>
                      <span className="gallery-spotlight-badge">
                        {photoCountByFolderId.get(selectedFolderId) || 0} photos
                      </span>
                    </div>
                    <h3>{folderNameById.get(selectedFolderId)}</h3>
                    <p>
                      Keep uploads, event coverage, and visual storytelling for this folder in one
                      clear place.
                    </p>
                    <div className="gallery-spotlight-preview">
                      {coverPhotoByFolderId.get(selectedFolderId) ? (
                        <img
                          src={coverPhotoByFolderId.get(selectedFolderId)}
                          alt={folderNameById.get(selectedFolderId)}
                        />
                      ) : (
                        <div className="gallery-spotlight-empty">
                          No cover image yet. Upload the first photo to bring this card to life.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="gallery-upload">
                    <div className="gallery-upload-title">Add Photos</div>
                    <label
                      className={`gallery-drop ${dragOver ? 'drag' : ''}`}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          handleFiles(e.target.files);
                          e.target.value = '';
                        }}
                        disabled={uploading}
                      />
                      <div className="gallery-drop-inner">
                        <span>{uploading ? 'Uploading...' : 'Drag & drop images here'}</span>
                        <span className="gallery-drop-sub">or click to upload multiple images</span>
                      </div>
                    </label>
                    <div className="gallery-upload-note">
                      Uploads go to {folderNameById.get(selectedFolderId)}.
                    </div>
                  </div>
                </div>

                <div className="gallery-photos">
                  <div className="gallery-photos-head">
                    <div>
                      <div className="gallery-photos-title">Photo cards</div>
                      <div className="gallery-photos-sub">
                        {selectedFolderId
                          ? `Folder: ${folderNameById.get(selectedFolderId)}`
                          : 'Select a folder'}
                      </div>
                    </div>
                    <div className="gallery-photos-head-right">
                      <div className="gallery-photos-count">{filteredPhotos.length}</div>
                    </div>
                  </div>

                  {loading && <div className="gallery-loading">Loading photos...</div>}

                  {!loading && filteredPhotos.length === 0 && (
                    <div className="gallery-empty">
                      No photos yet. Drop your first image to get started.
                    </div>
                  )}

                  {!loading && filteredPhotos.length > 0 && (
                    <div className="gallery-grid">
                      {filteredPhotos.map((photo, index) => (
                        <div key={photo.id} className="gallery-photo">
                          <img src={photo.url} alt="Gallery" />
                          <div className="gallery-photo-overlay">
                            <div className="gallery-photo-index">
                              {String(index + 1).padStart(2, '0')}
                            </div>
                            {photo.folderId && (
                              <div className="gallery-photo-tag">{folderNameById.get(photo.folderId)}</div>
                            )}
                          </div>
                          {isEditingFolder && (
                            <button
                              type="button"
                              className="gallery-photo-remove"
                              onClick={() => handleDeletePhoto(photo.id)}
                            >
                              Delete photo
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
