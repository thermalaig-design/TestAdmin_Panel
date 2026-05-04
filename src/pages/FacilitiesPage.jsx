import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import {
  createFacility,
  deleteFacility,
  fetchFacilitiesByTrust,
  resolveFacilitiesAttachmentUrl,
  updateFacility,
  uploadFacilitiesAttachment,
} from '../services/facilitiesService';
import { parseAttachmentItem } from '../utils/attachmentUtils';
import { isImageFileLike } from '../utils/imageUpload';
import './NoticeboardPage.css';

const MAX_FACILITY_IMAGE_ATTACHMENTS = 3;
const MAX_FACILITY_IMAGE_SIZE_BYTES = 20 * 1024;
const FACILITY_TYPE_OPTIONS = ['general', 'vip'];
const FACILITY_STATUS_OPTIONS = ['active', 'paused'];

function toUiFormType(value) {
  return String(value || '').toLowerCase() === 'vip' ? 'vip' : 'general';
}

function toDbType(value) {
  return String(value || '').toLowerCase() === 'vip' ? 'vip' : 'gen';
}

function toUiFormStatus(value) {
  return isPausedStatus(value) ? 'paused' : 'active';
}

function toDbStatus(value) {
  return String(value || '').toLowerCase() === 'paused' ? 'inactive' : 'active';
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isImageFile(file) {
  return isImageFileLike(file);
}

function isImageAttachment(item = {}) {
  const value = String(item?.value || '').toLowerCase();
  const name = String(item?.name || '').toLowerCase();
  if (value.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|jfif|gif|webp|bmp|svg)(\?.*)?$/.test(name);
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to process selected image.'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function compressImageToLimit(file, maxBytes) {
  const image = await loadImageFromFile(file);
  const baseWidth = Math.max(1, image.naturalWidth || image.width || 1);
  const baseHeight = Math.max(1, image.naturalHeight || image.height || 1);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;
  const baseName = String(file?.name || 'attachment')
    .replace(/\.[^/.]+$/, '')
    .trim();
  const outputName = `${baseName || 'attachment'}.jpg`;

  for (let scaleStep = 0; scaleStep < 9; scaleStep += 1) {
    const scale = Math.pow(0.82, scaleStep);
    const targetWidth = Math.max(160, Math.round(baseWidth * scale));
    const targetHeight = Math.max(160, Math.round(baseHeight * scale));
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.clearRect(0, 0, targetWidth, targetHeight);
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    for (let quality = 0.82; quality >= 0.2; quality -= 0.08) {
      const blob = await canvasToBlob(canvas, 'image/jpeg', Number(quality.toFixed(2)));
      if (blob && blob.size <= maxBytes) {
        const normalizedFile = new File([blob], outputName, { type: 'image/jpeg' });
        return { file: normalizedFile };
      }
    }
  }

  return null;
}

function buildAttachmentMeta(rawItems = []) {
  const parsed = (rawItems || [])
    .map((item, index) => parseAttachmentItem(item, index))
    .filter(Boolean);
  const imageItems = parsed.filter(isImageAttachment);
  const imageCount = imageItems.length;
  const imageUrls = imageItems.map((item) => item.value).filter(Boolean);
  const firstImageUrl = imageUrls[0] || '';
  return {
    count: parsed.length,
    imageCount,
    imageUrls,
    hasImage: imageCount > 0,
    firstName: parsed[0]?.name || '',
    firstImageUrl,
  };
}

function toUiType(value) {
  return String(value || '').toLowerCase() === 'vip' ? 'vip' : 'general';
}

function isPausedStatus(value) {
  const normalized = String(value || '').toLowerCase();
  return normalized === 'inactive' || normalized === 'paused' || normalized === 'archived';
}

function formatStatusLabel(value) {
  if (String(value || '').toLowerCase() === 'archived') return 'archived';
  return isPausedStatus(value) ? 'paused' : 'active';
}

function formatTypeLabel(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'vip') return 'VIP';
  if (normalized === 'gen' || normalized === 'general') return 'general';
  return normalized || '-';
}

function FacilityAttachmentImage({ src, alt, className }) {
  const [resolvedSrc, setResolvedSrc] = useState(src);
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    setResolvedSrc(src);
    setRetried(false);
  }, [src]);

  const handleError = async () => {
    if (retried) return;
    setRetried(true);
    const { data } = await resolveFacilitiesAttachmentUrl(resolvedSrc || src);
    const nextUrl = String(data?.signedUrl || '').trim();
    if (nextUrl) setResolvedSrc(nextUrl);
  };

  if (!resolvedSrc) return null;
  return <img src={resolvedSrc} alt={alt} className={className} onError={handleError} />;
}

export default function FacilitiesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'dashboard';
  const trustId = trust?.id || null;
  const isCreateRoute = location.pathname === '/facilities/create_facility';
  const isEditRoute = location.pathname === '/facilities/edit_details';
  const isFormRoute = isCreateRoute || isEditRoute;
  const routeEditFacilityId =
    location.state?.editFacilityId || new URLSearchParams(location.search).get('id') || '';

  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewFacility, setPreviewFacility] = useState(null);
  const [editingFacilityId, setEditingFacilityId] = useState(null);
  const [activeFacilityMenuId, setActiveFacilityMenuId] = useState(null);
  const [updatingFacilityId, setUpdatingFacilityId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentDragOver, setAttachmentDragOver] = useState(false);
  const [attachmentWarning, setAttachmentWarning] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [statusTab, setStatusTab] = useState('all');
  const [typeFilter, setTypeFilter] = useState('general');
  const [listSearch, setListSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [currentPage, setCurrentPage] = useState(1);
  const [formError, setFormError] = useState('');
  const warningTimerRef = useRef(null);
  const deferredListSearch = useDeferredValue(listSearch);
  const FACILITY_PAGE_SIZE = 10;
  const [form, setForm] = useState({
    name: '',
    type: 'general',
    status: 'active',
    description: '',
    attachments: [],
  });

  const resetFacilityForm = () => {
    setForm({
      name: '',
      type: 'general',
      status: 'active',
      description: '',
      attachments: [],
    });
    setFormError('');
    setAttachmentWarning('');
    setEditingFacilityId(null);
  };

  const goToFacilitiesList = () => {
    navigate('/facilities', { replace: true, state: { userName, trust, sidebarNavKey: currentSidebarNavKey } });
  };

  useEffect(() => {
    if (!trustId) {
      navigate('/dashboard', { replace: true, state: { userName, trust, sidebarNavKey: currentSidebarNavKey } });
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      const { data, error: fetchError } = await fetchFacilitiesByTrust(trustId);
      if (fetchError) {
        setError(fetchError.message || 'Unable to load Facilities data.');
      }
      setFacilities(data || []);
      setLoading(false);
    };

    load();
  }, [navigate, trustId, userName, trust, currentSidebarNavKey]);

  useEffect(() => {
    const closeMenu = () => setActiveFacilityMenuId(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    return () => {
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!previewFacility && !previewImage) return undefined;
    const onEsc = (event) => {
      if (event.key !== 'Escape') return;
      if (previewImage) {
        setPreviewImage(null);
        return;
      }
      setPreviewFacility(null);
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [previewFacility, previewImage]);

  const activeFacilities = useMemo(
    () => facilities.filter((facility) => !isPausedStatus(facility?.status)),
    [facilities]
  );

  const pausedFacilities = useMemo(
    () => facilities.filter((facility) => isPausedStatus(facility?.status)),
    [facilities]
  );

  const scopedfacilities = useMemo(() => {
    if (statusTab === 'active') return activeFacilities;
    if (statusTab === 'paused') return pausedFacilities;
    return facilities;
  }, [statusTab, activeFacilities, pausedFacilities, facilities]);

  const filteredfacilities = useMemo(() => {
    const term = deferredListSearch.trim().toLowerCase();
    let list = [...scopedfacilities];

    list = list.filter((Facility) => toUiType(Facility?.type) === typeFilter);

    if (term) {
      list = list.filter((Facility) => {
        const name = String(Facility?.name || '').toLowerCase();
        const description = String(Facility?.description || '').toLowerCase();
        return name.includes(term) || description.includes(term);
      });
    }
    if (sortBy === 'name') {
      list.sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || '')));
    } else if (sortBy === 'date_oldest') {
      list.sort((left, right) =>
        String(left?.created_at || '').localeCompare(String(right?.created_at || ''))
      );
    } else {
      list.sort((left, right) =>
        String(right?.created_at || '').localeCompare(String(left?.created_at || ''))
      );
    }
    return list;
  }, [scopedfacilities, deferredListSearch, sortBy, typeFilter]);

  const scopedTypeCounts = useMemo(
    () =>
      scopedfacilities.reduce(
        (acc, Facility) => {
          if (toUiType(Facility?.type) === 'vip') acc.vip += 1;
          else acc.general += 1;
          return acc;
        },
        { general: 0, vip: 0 }
      ),
    [scopedfacilities]
  );

  const filteredStatusCounts = useMemo(
    () =>
      filteredfacilities.reduce(
        (acc, Facility) => {
          if (isPausedStatus(Facility?.status)) acc.paused += 1;
          else acc.active += 1;
          return acc;
        },
        { active: 0, paused: 0 }
      ),
    [filteredfacilities]
  );

  const selectedFacility = useMemo(
    () => filteredfacilities.find((item) => item.id === selectedFacilityId) || null,
    [filteredfacilities, selectedFacilityId]
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredfacilities.length / FACILITY_PAGE_SIZE)),
    [filteredfacilities.length]
  );

  const paginatedfacilities = useMemo(() => {
    const start = (currentPage - 1) * FACILITY_PAGE_SIZE;
    return filteredfacilities.slice(start, start + FACILITY_PAGE_SIZE);
  }, [currentPage, filteredfacilities]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusTab, sortBy, listSearch, typeFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (loading || isFormRoute) return;
    if (!filteredfacilities.length) {
      setSelectedFacilityId('');
      return;
    }
    const exists = filteredfacilities.some((Facility) => Facility.id === selectedFacilityId);
    if (!exists) {
      setSelectedFacilityId(filteredfacilities[0].id);
    }
  }, [filteredfacilities, selectedFacilityId, loading, isFormRoute]);

  useEffect(() => {
    if (!isFormRoute) return;

    if (isCreateRoute) {
      resetFacilityForm();
      return;
    }

    if (!isEditRoute) return;
    const targetId = String(routeEditFacilityId || selectedFacilityId || '');
    if (!targetId) return;
    const Facility = facilities.find((item) => String(item.id) === targetId);
    if (!Facility) return;

    const parsedAttachments = (Facility.attachments || [])
      .map((item, index) => parseAttachmentItem(item, index))
      .filter(Boolean);

    setForm({
      name: Facility.name || '',
      type: toUiFormType(Facility.type),
      status: toUiFormStatus(Facility.status),
      description: Facility.description || '',
      attachments: parsedAttachments,
    });
    setEditingFacilityId(Facility.id);
    setFormError('');
    setAttachmentWarning('');
  }, [
    isFormRoute,
    isCreateRoute,
    isEditRoute,
    routeEditFacilityId,
    selectedFacilityId,
    facilities,
  ]);

  const handleCreate = async () => {
    setFormError('');
    if (!form.name.trim()) {
      setFormError('Facility name is required.');
      return;
    }
    setSaving(true);
    const payload = {
      trust_id: trustId,
      name: form.name,
      type: toDbType(form.type),
      status: toDbStatus(form.status),
      description: form.description,
      attachments: form.attachments.map((item) => String(item?.value || '').trim()).filter(Boolean),
    };

    if (editingFacilityId) {
      const { data, error: updateError } = await updateFacility(editingFacilityId, payload, trustId);
      if (updateError) {
        setFormError(updateError.message || 'Unable to update Facility.');
        setSaving(false);
        return;
      }
      setFacilities((prev) => prev.map((item) => (item.id === editingFacilityId ? data : item)));
    } else {
      const { data, error: createError } = await createFacility(payload);
      if (createError) {
        setFormError(createError.message || 'Unable to create Facility.');
        setSaving(false);
        return;
      }
      setFacilities((prev) => [data, ...prev]);
    }

    resetFacilityForm();
    if (isFormRoute) {
      setSaving(false);
      goToFacilitiesList();
      return;
    }
    setSaving(false);
  };

  const handleAttachmentFile = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    setFormError('');
    setAttachmentWarning('');

    const existingImageCount = form.attachments.filter(isImageAttachment).length;
    const acceptedFiles = [];
    const warningMessages = [];
    let nextImageCount = existingImageCount;

    files.forEach((file) => {
      if (!isImageFile(file)) {
        warningMessages.push(`"${file.name}" skipped: image should be JPG/JPEG/PNG.`);
        return;
      }

      if (nextImageCount >= MAX_FACILITY_IMAGE_ATTACHMENTS) {
        warningMessages.push(`"${file.name}" skipped: max ${MAX_FACILITY_IMAGE_ATTACHMENTS} images allowed.`);
        return;
      }

      acceptedFiles.push(file);
      nextImageCount += 1;
    });

    if (warningMessages.length) {
      setAttachmentWarning(warningMessages.join(' '));
    }

    if (!acceptedFiles.length) return;

    setUploadingAttachment(true);
    try {
      const uploadedItems = [];
      for (const file of acceptedFiles) {
        const processed = await compressImageToLimit(file, MAX_FACILITY_IMAGE_SIZE_BYTES);
        if (!processed?.file) {
          warningMessages.push(
            `"${file.name}" skipped: image could not be compressed to ${Math.floor(MAX_FACILITY_IMAGE_SIZE_BYTES / 1024)}KB.`
          );
          continue;
        }

        const { data: uploadData, error: uploadError } = await uploadFacilitiesAttachment(processed.file, { trustId });
        if (uploadError || !uploadData?.publicUrl) {
          const reason = uploadError?.message ? `: ${uploadError.message}` : '';
          warningMessages.push(`"${file.name}" failed to upload${reason}.`);
          continue;
        }
        if (uploadData?.warning) warningMessages.push(uploadData.warning);

        uploadedItems.push({
          name: file?.name || 'Attachment',
          value: uploadData.publicUrl,
          isDataUrl: false,
        });
      }

      if (uploadedItems.length) {
        setForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...uploadedItems] }));
      }

      if (warningMessages.length) {
        setAttachmentWarning(warningMessages.join(' '));
      }
    } catch (error) {
      setFormError(error.message || 'Unable to upload attachment.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleAttachmentInputChange = (event) => {
    handleAttachmentFile(event.target.files);
    event.target.value = '';
  };

  const removeAttachment = (index) => {
    setForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleOpenAttachment = async (event, rawUrl) => {
    const value = String(rawUrl || '').trim();
    if (!value) return;

    event.preventDefault();
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    const { data } = await resolveFacilitiesAttachmentUrl(value);
    const nextUrl = String(data?.signedUrl || value).trim();

    if (popup) {
      popup.location.href = nextUrl;
      return;
    }

    window.open(nextUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDeleteFacility = async (Facility) => {
    const shouldDelete = window.confirm(`Delete Facility "${Facility?.name || 'this Facility'}"?`);
    if (!shouldDelete) {
      setActiveFacilityMenuId(null);
      return;
    }

    setUpdatingFacilityId(Facility.id);
    const { error: deleteError } = await deleteFacility(Facility.id, trustId);
    if (deleteError) {
      setError(deleteError.message || 'Unable to delete Facility.');
    } else {
      setFacilities((prev) => prev.filter((item) => item.id !== Facility.id));
    }
    setUpdatingFacilityId(null);
    setActiveFacilityMenuId(null);
  };

  const handleToggleStatus = async (Facility) => {
    const nextStatus = isPausedStatus(Facility?.status) ? 'active' : 'inactive';
    setUpdatingFacilityId(Facility.id);
    const { data, error: updateError } = await updateFacility(
      Facility.id,
      { status: nextStatus },
      trustId
    );
    if (updateError) {
      setError(updateError.message || 'Unable to update Facility status.');
    } else if (data) {
      setFacilities((prev) => prev.map((item) => (item.id === Facility.id ? data : item)));
    }
    setUpdatingFacilityId(null);
    setActiveFacilityMenuId(null);
  };

  const handleEditFacilityDetails = (Facility) => {
    const parsedAttachments = (Facility.attachments || [])
      .map((item, index) => parseAttachmentItem(item, index))
      .filter(Boolean);

    setForm({
      name: Facility.name || '',
      type: toUiFormType(Facility.type),
      status: toUiFormStatus(Facility.status),
      description: Facility.description || '',
      attachments: parsedAttachments,
    });
    setEditingFacilityId(Facility.id);
    setFormError('');
    setAttachmentWarning('');
    setActiveFacilityMenuId(null);
    navigate(`/facilities/edit_details?id=${Facility.id}`, {
      state: { userName, trust, editFacilityId: Facility.id, sidebarNavKey: currentSidebarNavKey },
    });
  };

  if (!trustId) return null;
  const previewAttachments = (previewFacility?.attachments || [])
    .map((item, index) => parseAttachmentItem(item, index))
    .filter(Boolean);
  const previewMeta = previewFacility ? buildAttachmentMeta(previewFacility.attachments) : null;

  return (
    <div className="nb-root">
      <Sidebar
        trustName={trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
        onLogout={() => navigate('/login')}
      />

      <main className="nb-main">
        <PageHeader
          title="Facilities"
          subtitle="Data is now fetched and inserted from the Facilities table"
          onBack={() => {
            if (isFormRoute) {
              goToFacilitiesList();
              return;
            }
            navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } });
          }}
        />

        <section className="nb-content">
          {error && <div className="nb-error">{error}</div>}

          {isFormRoute && (
            <div className="nb-form-card">
              <h3>{editingFacilityId ? 'Edit Facility' : 'Create Facility'}</h3>
              <div className="nb-form-layout">
                <section className="nb-form-section">
                  <h4 className="nb-section-title">Basic Info</h4>
                  <div className="nb-form-grid nb-form-grid-2">
                    <label>
                      <span>Name *</span>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter Facility title"
                      />
                    </label>
                    <div>
                      <span>Type</span>
                      <div className="dn-choice-row" role="radiogroup" aria-label="Facility Type">
                        {FACILITY_TYPE_OPTIONS.map((typeValue) => (
                          <button
                            key={typeValue}
                            type="button"
                            role="radio"
                            aria-checked={form.type === typeValue}
                            className={`dn-choice-btn ${form.type === typeValue ? 'active' : ''}`}
                            onClick={() => setForm((prev) => ({ ...prev, type: typeValue }))}
                          >
                            <span className="dn-choice-dot" aria-hidden="true" />
                            <span className="dn-choice-label">{typeValue === 'vip' ? 'VIP' : 'general'}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <label>
                      <span>Status</span>
                      <select
                        value={form.status}
                        onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                      >
                        {FACILITY_STATUS_OPTIONS.map((statusValue) => (
                          <option key={statusValue} value={statusValue}>
                            {statusValue}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>

                <section className="nb-form-section">
                  <h4 className="nb-section-title">Description</h4>
                  <div className="nb-form-grid nb-form-grid-2">
                    <label className="nb-span-full">
                      <span>Description</span>
                      <textarea
                        rows="4"
                        value={form.description}
                        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter Facility description"
                      />
                    </label>
                  </div>
                </section>

                <section className="nb-form-section">
                  <h4 className="nb-section-title">Attachments</h4>
                  <div className="nb-form-grid nb-form-grid-2">
                    <div className="nb-span-full">
                      <span>Upload image attachments</span>
                      <p className="nb-attachment-limit-note">
                        Important: You can upload up to {MAX_FACILITY_IMAGE_ATTACHMENTS} images. Each image must be{' '}
                        {Math.floor(MAX_FACILITY_IMAGE_SIZE_BYTES / 1024)}KB or smaller.
                      </p>
                      <label
                        className={`nb-attachment-dropzone ${attachmentDragOver ? 'drag' : ''}`}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setAttachmentDragOver(true);
                        }}
                        onDragLeave={() => setAttachmentDragOver(false)}
                        onDrop={(event) => {
                          event.preventDefault();
                          setAttachmentDragOver(false);
                          handleAttachmentFile(event.dataTransfer.files);
                        }}
                      >
                        <input
                          type="file"
                          multiple
                          onChange={handleAttachmentInputChange}
                        />
                        <div className="nb-attachment-drop-inner">
                          <span>{uploadingAttachment ? 'Uploading...' : 'Drag & drop files here'}</span>
                          <span className="nb-attachment-drop-sub">or click to choose files</span>
                        </div>
                      </label>
                      {attachmentWarning && <div className="nb-warning-inline">{attachmentWarning}</div>}
                      {form.attachments.length > 0 && (
                        <div className="nb-attachment-pill-list">
                          {form.attachments.map((item, index) => (
                            <div key={`${item.name}-${index}`} className="nb-attachment-pill">
                              <span className="nb-attachment-pill-name">{item.name}</span>
                              <button type="button" onClick={() => removeAttachment(index)}>Remove</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
              {formError && <div className="nb-error">{formError}</div>}
              <div className="nb-form-actions">
                <button
                  className="nb-secondary-btn"
                  onClick={() => {
                    resetFacilityForm();
                    goToFacilitiesList();
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button className="nb-add-btn" onClick={handleCreate} disabled={saving} type="button">
                  {saving ? 'Saving...' : editingFacilityId ? 'Update Facility' : 'Save Facility'}
                </button>
              </div>
            </div>
          )}

          {!isFormRoute && loading && <div className="nb-empty">Loading facilities...</div>}

          {!isFormRoute && !loading && facilities.length === 0 && (
            <div className="nb-empty">
              <button
                className="nb-add-btn nb-list-add-btn"
                type="button"
                onClick={() => navigate('/facilities/create_facility', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
              >
                Add Facility
              </button>
              <div>No Facility found for this trust. Create your first Facility.</div>
            </div>
          )}

          {!isFormRoute && !loading && facilities.length > 0 && (
            <section className="nb-profile-layout">
              <aside className="nb-left-panel">
                <div className="nb-left-head">
                  <h3>All facilities</h3>
                  <span className="nb-left-count">{facilities.length}</span>
                </div>

                <div className="nb-tabs">
                  <button
                    type="button"
                    className={`nb-tab ${statusTab === 'all' ? 'active' : ''}`}
                    onClick={() => setStatusTab('all')}
                  >
                    <span>All</span>
                    <b>{facilities.length}</b>
                  </button>
                  <button
                    type="button"
                    className={`nb-tab ${statusTab === 'active' ? 'active' : ''}`}
                    onClick={() => setStatusTab('active')}
                  >
                    <span>Active</span>
                    <b>{activeFacilities.length}</b>
                  </button>
                  <button
                    type="button"
                    className={`nb-tab ${statusTab === 'paused' ? 'active' : ''}`}
                    onClick={() => setStatusTab('paused')}
                  >
                    <span>Paused</span>
                    <b>{pausedFacilities.length}</b>
                  </button>
                </div>

                <input
                  className="nb-left-search"
                  placeholder="Search Facility..."
                  value={listSearch}
                  onChange={(event) => setListSearch(event.target.value)}
                />
                <div className="nb-type-tabs">
                  <button
                    type="button"
                    className={`nb-type-tab ${typeFilter === 'general' ? 'active' : ''}`}
                    onClick={() => setTypeFilter('general')}
                  >
                    <span>General</span>
                    <b>{scopedTypeCounts.general}</b>
                  </button>
                  <button
                    type="button"
                    className={`nb-type-tab ${typeFilter === 'vip' ? 'active' : ''}`}
                    onClick={() => setTypeFilter('vip')}
                  >
                    <span>VIP</span>
                    <b>{scopedTypeCounts.vip}</b>
                  </button>
                </div>
                <div className="nb-status-summary">
                  <div className="nb-status-summary-item active">
                    <span>Active</span>
                    <b>{filteredStatusCounts.active}</b>
                  </div>
                  <div className="nb-status-summary-item paused">
                    <span>Paused</span>
                    <b>{filteredStatusCounts.paused}</b>
                  </div>
                </div>
                <button
                  className="nb-add-btn nb-list-add-btn"
                  type="button"
                  onClick={() => navigate('/facilities/create_facility', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
                >
                  Add Facility
                </button>

                <div className="nb-filter-row">
                  <label className="nb-inline-field">
                    <span>Sort By</span>
                    <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                      <option value="name">Name A-Z</option>
                      <option value="date">Date (Newest)</option>
                      <option value="date_oldest">Date (Oldest)</option>
                    </select>
                  </label>
                </div>

                <div className="nb-left-list">
                  {filteredfacilities.length === 0 && (
                    <div className="nb-empty">No Facility matched your filters.</div>
                  )}
                  {paginatedfacilities.map((Facility) => (
                    <button
                      key={Facility.id}
                      className={`nb-left-item ${selectedFacilityId === Facility.id ? 'active' : ''}`}
                      onClick={() => setSelectedFacilityId(Facility.id)}
                      type="button"
                    >
                      <div className="nb-left-avatar">
                        {String(Facility?.name || 'N').trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="nb-left-item-body">
                        <div className="nb-left-item-title">{Facility.name}</div>
                        <div className="nb-left-item-sub">{formatDate(Facility.created_at)}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {filteredfacilities.length > 0 && (
                  <div className="nb-left-pagination">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Prev
                    </button>
                    <span>Page {currentPage} / {totalPages}</span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                )}

              </aside>

              <section className="nb-right-panel">
                {!selectedFacility && (
                  <div className="nb-empty">Select a Facility to view details.</div>
                )}

                {selectedFacility && (
                  <>
                    <div className="nb-profile-hero">
                      <div className="nb-profile-hero-left">
                        <div className="nb-profile-avatar">
                          {String(selectedFacility?.name || 'N').trim().charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3>{selectedFacility.name}</h3>
                          <div className="nb-profile-hero-actions">
                            <span className={`nb-chip ${isPausedStatus(selectedFacility.status) ? 'inactive' : ''}`}>
                              {formatStatusLabel(selectedFacility.status)}
                            </span>
                            <button
                              className="nb-secondary-btn"
                              type="button"
                              onClick={() => setPreviewFacility(selectedFacility)}
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="nb-card-menu-wrap">
                        <button
                          type="button"
                          className="nb-card-menu-btn"
                          title="Edit"
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveFacilityMenuId((prev) => (prev === selectedFacility.id ? null : selectedFacility.id));
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {activeFacilityMenuId === selectedFacility.id && (
                          <div className="nb-card-menu">
                            <button
                              type="button"
                              onClick={() => handleEditFacilityDetails(selectedFacility)}
                              disabled={updatingFacilityId === selectedFacility.id}
                            >
                              Edit Details
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(selectedFacility)}
                              disabled={updatingFacilityId === selectedFacility.id}
                            >
                              {isPausedStatus(selectedFacility.status)
                                ? 'Set Active'
                                : 'Set Paused'}
                            </button>
                            <button
                              type="button"
                              className="danger"
                              onClick={() => handleDeleteFacility(selectedFacility)}
                              disabled={updatingFacilityId === selectedFacility.id}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="nb-profile-details">
                      <div className="nb-profile-details-head">
                        <h3>Facility Details</h3>
                      </div>
                      <div className="nb-profile-detail-grid">
                        <div><span>Name</span><strong>{selectedFacility.name || '-'}</strong></div>
                        <div><span>Status</span><strong>{formatStatusLabel(selectedFacility.status)}</strong></div>
                        <div><span>Type</span><strong>{formatTypeLabel(selectedFacility.type)}</strong></div>
                        <div><span>Created Date</span><strong>{formatDate(selectedFacility.created_at)}</strong></div>
                        <div className="nb-detail-span-2"><span>Description</span><strong>{selectedFacility.description || 'No description added.'}</strong></div>
                      </div>
                    </div>

                    {(() => {
                      const attachmentMeta = buildAttachmentMeta(selectedFacility.attachments);
                      return (
                        <div className="nb-profile-details">
                          <div className="nb-profile-details-head">
                            <h3>Attachment Summary</h3>
                          </div>
                          <div className="nb-profile-detail-grid">
                            <div><span>Total Attachments</span><strong>{attachmentMeta.count}</strong></div>
                            <div className="nb-detail-span-2">
                              <span>Image Preview</span>
                              {attachmentMeta.imageUrls.length > 0 ? (
                                <div className="nb-attachment-preview-list">
                                  {attachmentMeta.imageUrls.map((imageUrl, index) => (
                                    <div key={`${imageUrl}-${index}`} className="nb-attachment-preview">
                                      <button
                                        type="button"
                                        className="nb-attachment-preview-btn"
                                        onClick={() =>
                                          setPreviewImage({
                                            src: imageUrl,
                                            alt: `${selectedFacility.name || 'Facility'} attachment ${index + 1}`,
                                          })
                                        }
                                      >
                                        <FacilityAttachmentImage
                                          src={imageUrl}
                                          alt={`${selectedFacility.name || 'Facility'} attachment ${index + 1}`}
                                          className="nb-attachment-preview-thumb"
                                        />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <strong>-</strong>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </section>
            </section>
          )}

          {previewFacility && (
            <div className="nb-preview-backdrop" onClick={() => setPreviewFacility(null)}>
              <article
                className="nb-preview-modal"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <button
                  type="button"
                  className="nb-preview-close"
                  onClick={() => setPreviewFacility(null)}
                >
                  Close
                </button>
                {previewMeta?.firstImageUrl && (
                  <div className="nb-preview-banner">
                    <FacilityAttachmentImage
                      src={previewMeta.firstImageUrl}
                      alt={previewFacility.name || 'Facility attachment'}
                    />
                  </div>
                )}
                <div className="nb-card-top">
                  <span className={`nb-chip ${isPausedStatus(previewFacility.status) ? 'inactive' : ''}`}>
                    {formatStatusLabel(previewFacility.status)}
                  </span>
                  <span className="nb-date">{formatDate(previewFacility.created_at)}</span>
                </div>
                <h3 className="nb-detail-title">{previewFacility.name}</h3>
                <p className="nb-detail-message">{previewFacility.description || 'No description added.'}</p>
                {previewAttachments.length > 0 && (
                  <div className="nb-attachment-list">
                    {previewAttachments.map((item, index) => (
                      <a
                        key={`${item.value}-${index}`}
                        href={item.value}
                        onClick={(event) => {
                          if (item.isDataUrl) return;
                          handleOpenAttachment(event, item.value);
                        }}
                        target={item.isDataUrl ? undefined : '_blank'}
                        rel={item.isDataUrl ? undefined : 'noreferrer'}
                        download={item.name}
                        className="nb-attachment-link"
                      >
                        {item.name}
                      </a>
                    ))}
                  </div>
                )}
              </article>
            </div>
          )}

          {previewImage && (
            <div className="nb-preview-backdrop" onClick={() => setPreviewImage(null)}>
              <article
                className="nb-image-lightbox"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Image preview"
              >
                <button
                  type="button"
                  className="nb-preview-close"
                  onClick={() => setPreviewImage(null)}
                >
                  Close
                </button>
                <FacilityAttachmentImage
                  src={previewImage.src}
                  alt={previewImage.alt || 'Facility attachment preview'}
                  className="nb-image-lightbox-img"
                />
              </article>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
