import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import { createNotice, deleteNotice, fetchNoticeboardByTrust, updateNotice } from '../services/noticeboardService';
import { parseAttachmentItem, readFileAsDataUrl, serializeAttachmentItem } from '../utils/attachmentUtils';
import './NoticeboardPage.css';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isImageFile(file) {
  return String(file?.type || '').toLowerCase().startsWith('image/');
}

function isImageAttachment(item = {}) {
  const value = String(item?.value || '').toLowerCase();
  const name = String(item?.name || '').toLowerCase();
  if (value.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/.test(name);
}

function buildAttachmentMeta(rawItems = []) {
  const parsed = (rawItems || [])
    .map((item, index) => parseAttachmentItem(item, index))
    .filter(Boolean);
  const imageCount = parsed.filter(isImageAttachment).length;
  const firstImageUrl = parsed.find(isImageAttachment)?.value || '';
  return {
    count: parsed.length,
    imageCount,
    hasImage: imageCount > 0,
    firstName: parsed[0]?.name || '',
    firstImageUrl,
  };
}

function toLocalDateKey(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDateKey(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return toLocalDateKey(date);
}

function isPassedNotice(notice) {
  const endKey = getDateKey(notice?.end_date);
  if (!endKey) return false;
  return endKey < toLocalDateKey(new Date());
}

export default function NoticeboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'dashboard';
  const trustId = trust?.id || null;

  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [previewNotice, setPreviewNotice] = useState(null);
  const [editingNoticeId, setEditingNoticeId] = useState(null);
  const [activeNoticeMenuId, setActiveNoticeMenuId] = useState(null);
  const [updatingNoticeId, setUpdatingNoticeId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentDragOver, setAttachmentDragOver] = useState(false);
  const [attachmentWarning, setAttachmentWarning] = useState('');
  const [selectedNoticeId, setSelectedNoticeId] = useState('');
  const [statusTab, setStatusTab] = useState('active');
  const [listSearch, setListSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [currentPage, setCurrentPage] = useState(1);
  const [formError, setFormError] = useState('');
  const warningTimerRef = useRef(null);
  const deferredListSearch = useDeferredValue(listSearch);
  const NOTICE_PAGE_SIZE = 8;
  const [form, setForm] = useState({
    name: '',
    description: '',
    attachments: [],
    start_date: '',
    end_date: '',
  });

  const resetNoticeForm = () => {
    setForm({ name: '', description: '', attachments: [], start_date: '', end_date: '' });
    setFormError('');
    setAttachmentWarning('');
    setEditingNoticeId(null);
  };

  useEffect(() => {
    if (!trustId) {
      navigate('/dashboard', { replace: true, state: { userName, trust } });
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      const { data, error: fetchError } = await fetchNoticeboardByTrust(trustId);
      if (fetchError) {
        setError(fetchError.message || 'Unable to load noticeboard data.');
      }
      setNotices(data || []);
      setLoading(false);
    };

    load();
  }, [navigate, trustId, userName, trust]);

  useEffect(() => {
    const closeMenu = () => setActiveNoticeMenuId(null);
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
    if (!previewNotice) return undefined;
    const onEsc = (event) => {
      if (event.key === 'Escape') setPreviewNotice(null);
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [previewNotice]);

  const activeNotices = useMemo(
    () => notices.filter((notice) => !isPassedNotice(notice)),
    [notices]
  );

  const passedNotices = useMemo(
    () => notices.filter((notice) => isPassedNotice(notice)),
    [notices]
  );

  const scopedNotices = useMemo(
    () => (statusTab === 'passed' ? passedNotices : activeNotices),
    [statusTab, passedNotices, activeNotices]
  );

  const filteredNotices = useMemo(() => {
    const term = deferredListSearch.trim().toLowerCase();
    let list = [...scopedNotices];
    if (term) {
      list = list.filter((notice) => {
        const name = String(notice?.name || '').toLowerCase();
        const description = String(notice?.description || '').toLowerCase();
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
  }, [scopedNotices, deferredListSearch, sortBy]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredNotices.length / NOTICE_PAGE_SIZE)),
    [filteredNotices.length]
  );

  const paginatedNotices = useMemo(() => {
    const start = (currentPage - 1) * NOTICE_PAGE_SIZE;
    return filteredNotices.slice(start, start + NOTICE_PAGE_SIZE);
  }, [filteredNotices, currentPage, NOTICE_PAGE_SIZE]);

  const selectedNotice = useMemo(
    () => filteredNotices.find((item) => item.id === selectedNoticeId) || null,
    [filteredNotices, selectedNoticeId]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [statusTab, sortBy, listSearch]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (loading || showForm) return;
    if (!filteredNotices.length) {
      setSelectedNoticeId('');
      return;
    }
    const exists = filteredNotices.some((notice) => notice.id === selectedNoticeId);
    if (!exists) {
      setSelectedNoticeId(filteredNotices[0].id);
    }
  }, [filteredNotices, selectedNoticeId, loading, showForm]);

  const handleCreate = async () => {
    setFormError('');
    if (!form.name.trim()) {
      setFormError('Notice name is required.');
      return;
    }
    if (form.start_date && form.end_date && form.start_date > form.end_date) {
      setFormError('End date must be greater than or equal to start date.');
      return;
    }

    setSaving(true);
    const payload = {
      trust_id: trustId,
      name: form.name,
      description: form.description,
      attachments: form.attachments.map(serializeAttachmentItem).filter(Boolean),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    };

    if (editingNoticeId) {
      const { data, error: updateError } = await updateNotice(editingNoticeId, payload, trustId);
      if (updateError) {
        setFormError(updateError.message || 'Unable to update notice.');
        setSaving(false);
        return;
      }
      setNotices((prev) => prev.map((item) => (item.id === editingNoticeId ? data : item)));
    } else {
      const { data, error: createError } = await createNotice(payload);
      if (createError) {
        setFormError(createError.message || 'Unable to create notice.');
        setSaving(false);
        return;
      }
      setNotices((prev) => [data, ...prev]);
    }

    resetNoticeForm();
    setShowForm(false);
    setSaving(false);
  };

  const handleAttachmentFile = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    setFormError('');
    setAttachmentWarning('');

    const existingImageCount = form.attachments.filter(isImageAttachment).length;
    const incomingImageCount = files.filter(isImageFile).length;
    if (incomingImageCount > 1 || existingImageCount + incomingImageCount > 1) {
      setAttachmentWarning('Only one image is allowed. Second image cannot be added.');
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
      warningTimerRef.current = setTimeout(() => {
        setAttachmentWarning('');
      }, 2500);
      return;
    }

    setUploadingAttachment(true);
    try {
      const uploaded = await Promise.all(files.map(readFileAsDataUrl));
      setForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...uploaded] }));
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

  const handleDeleteNotice = async (notice) => {
    const shouldDelete = window.confirm(`Delete notice "${notice?.name || 'this notice'}"?`);
    if (!shouldDelete) {
      setActiveNoticeMenuId(null);
      return;
    }

    setUpdatingNoticeId(notice.id);
    const { error: deleteError } = await deleteNotice(notice.id, trustId);
    if (deleteError) {
      setError(deleteError.message || 'Unable to delete notice.');
    } else {
      setNotices((prev) => prev.filter((item) => item.id !== notice.id));
    }
    setUpdatingNoticeId(null);
    setActiveNoticeMenuId(null);
  };

  const handleToggleStatus = async (notice) => {
    const nextStatus = String(notice?.status || '').toLowerCase() === 'active' ? 'inactive' : 'active';
    setUpdatingNoticeId(notice.id);
    const { data, error: updateError } = await updateNotice(
      notice.id,
      { status: nextStatus },
      trustId
    );
    if (updateError) {
      setError(updateError.message || 'Unable to update notice status.');
    } else if (data) {
      setNotices((prev) => prev.map((item) => (item.id === notice.id ? data : item)));
    }
    setUpdatingNoticeId(null);
    setActiveNoticeMenuId(null);
  };

  const handleEditNoticeDetails = (notice) => {
    const parsedAttachments = (notice.attachments || [])
      .map((item, index) => parseAttachmentItem(item, index))
      .filter(Boolean);

    setForm({
      name: notice.name || '',
      description: notice.description || '',
      attachments: parsedAttachments,
      start_date: notice.start_date || '',
      end_date: notice.end_date || '',
    });
    setEditingNoticeId(notice.id);
    setFormError('');
    setAttachmentWarning('');
    setShowForm(true);
    setActiveNoticeMenuId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleNoticeForm = () => {
    setShowForm((prev) => {
      const next = !prev;
      if (!next) {
        resetNoticeForm();
      } else if (!editingNoticeId) {
        setFormError('');
        setAttachmentWarning('');
      }
      return next;
    });
  };

  if (!trustId) return null;
  const previewAttachments = (previewNotice?.attachments || [])
    .map((item, index) => parseAttachmentItem(item, index))
    .filter(Boolean);
  const previewMeta = previewNotice ? buildAttachmentMeta(previewNotice.attachments) : null;

  return (
    <div className="nb-root">
      <Sidebar
        trustName={trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
        onLogout={() => navigate('/login')}
      />

      <main className="nb-main">
        <PageHeader
          title="Noticeboard"
          subtitle="Data is now fetched and inserted from the noticeboard table"
          onBack={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
        />

        <section className="nb-content">
          {error && <div className="nb-error">{error}</div>}

          {showForm && (
            <div className="nb-form-card">
              <h3>{editingNoticeId ? 'Edit Notice' : 'Create Notice'}</h3>
              <div className="nb-form-grid">
                <label>
                  <span>Name *</span>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter notice title"
                  />
                </label>
                <label>
                  <span>Start Date</span>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
                    onFocus={(e) => e.target.showPicker?.()}
                    onClick={(e) => e.target.showPicker?.()}
                  />
                </label>
                <label>
                  <span>End Date</span>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
                    onFocus={(e) => e.target.showPicker?.()}
                    onClick={(e) => e.target.showPicker?.()}
                  />
                </label>
                <label className="nb-span-2">
                  <span>Description</span>
                  <textarea
                    rows="4"
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter notice description"
                  />
                </label>
                <div className="nb-span-2">
                  <span>Attachments (upload PDF, docs, photos, etc.)</span>
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
              {formError && <div className="nb-error">{formError}</div>}
              <div className="nb-form-actions">
                <button
                  className="nb-secondary-btn"
                  onClick={() => {
                    setShowForm(false);
                    resetNoticeForm();
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button className="nb-add-btn" onClick={handleCreate} disabled={saving} type="button">
                  {saving ? 'Saving...' : editingNoticeId ? 'Update Notice' : 'Save Notice'}
                </button>
              </div>
            </div>
          )}

          {loading && <div className="nb-empty">Loading notices...</div>}

          {!loading && notices.length === 0 && (
            <div className="nb-empty">
              <button className="nb-add-btn nb-list-add-btn" type="button" onClick={toggleNoticeForm}>
                {showForm ? 'Close Form' : 'Add Notice'}
              </button>
              <div>No notice found for this trust. Create your first notice.</div>
            </div>
          )}

          {!loading && notices.length > 0 && (
            <section className="nb-profile-layout">
              <aside className="nb-left-panel">
                <div className="nb-left-head">
                  <h3>All Notices</h3>
                  <span className="nb-left-count">{notices.length}</span>
                </div>

                <div className="nb-tabs">
                  <button
                    type="button"
                    className={`nb-tab ${statusTab === 'active' ? 'active' : ''}`}
                    onClick={() => setStatusTab('active')}
                  >
                    <span>Active</span>
                    <b>{activeNotices.length}</b>
                  </button>
                  <button
                    type="button"
                    className={`nb-tab ${statusTab === 'passed' ? 'active' : ''}`}
                    onClick={() => setStatusTab('passed')}
                  >
                    <span>Passed</span>
                    <b>{passedNotices.length}</b>
                  </button>
                </div>

                <input
                  className="nb-left-search"
                  placeholder="Search notice..."
                  value={listSearch}
                  onChange={(event) => setListSearch(event.target.value)}
                />
                <button className="nb-add-btn nb-list-add-btn" type="button" onClick={toggleNoticeForm}>
                  {showForm ? 'Close Form' : 'Add Notice'}
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
                  {filteredNotices.length === 0 && (
                    <div className="nb-empty">No notice matched your filters.</div>
                  )}
                  {paginatedNotices.map((notice) => (
                    <button
                      key={notice.id}
                      className={`nb-left-item ${selectedNoticeId === notice.id ? 'active' : ''}`}
                      onClick={() => setSelectedNoticeId(notice.id)}
                      type="button"
                    >
                      <div className="nb-left-avatar">
                        {String(notice?.name || 'N').trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="nb-left-item-body">
                        <div className="nb-left-item-title">{notice.name}</div>
                        <div className="nb-left-item-sub">{formatDate(notice.created_at)}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {filteredNotices.length > 0 && (
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
                {!selectedNotice && (
                  <div className="nb-empty">Select a notice to view details.</div>
                )}

                {selectedNotice && (
                  <>
                    <div className="nb-profile-hero">
                      <div className="nb-profile-hero-left">
                        <div className="nb-profile-avatar">
                          {String(selectedNotice?.name || 'N').trim().charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3>{selectedNotice.name}</h3>
                          <div className="nb-profile-hero-actions">
                            <span className={`nb-chip ${String(selectedNotice.status || '').toLowerCase() === 'inactive' ? 'inactive' : ''}`}>
                              {selectedNotice.status}
                            </span>
                            <button
                              className="nb-secondary-btn"
                              type="button"
                              onClick={() => setPreviewNotice(selectedNotice)}
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
                            setActiveNoticeMenuId((prev) => (prev === selectedNotice.id ? null : selectedNotice.id));
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {activeNoticeMenuId === selectedNotice.id && (
                          <div className="nb-card-menu">
                            <button
                              type="button"
                              onClick={() => handleEditNoticeDetails(selectedNotice)}
                              disabled={updatingNoticeId === selectedNotice.id}
                            >
                              Edit Details
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(selectedNotice)}
                              disabled={updatingNoticeId === selectedNotice.id}
                            >
                              {String(selectedNotice.status || '').toLowerCase() === 'active'
                                ? 'Set Inactive'
                                : 'Set Active'}
                            </button>
                            <button
                              type="button"
                              className="danger"
                              onClick={() => handleDeleteNotice(selectedNotice)}
                              disabled={updatingNoticeId === selectedNotice.id}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="nb-profile-details">
                      <div className="nb-profile-details-head">
                        <h3>Notice Details</h3>
                      </div>
                      <div className="nb-profile-detail-grid">
                        <div><span>Name</span><strong>{selectedNotice.name || '-'}</strong></div>
                        <div><span>Status</span><strong>{selectedNotice.status || '-'}</strong></div>
                        <div><span>Created Date</span><strong>{formatDate(selectedNotice.created_at)}</strong></div>
                        <div><span>Date Range</span><strong>{formatDate(selectedNotice.start_date)} to {formatDate(selectedNotice.end_date)}</strong></div>
                        <div className="nb-detail-span-2"><span>Description</span><strong>{selectedNotice.description || 'No description added.'}</strong></div>
                      </div>
                    </div>

                    {(() => {
                      const attachmentMeta = buildAttachmentMeta(selectedNotice.attachments);
                      return (
                        <div className="nb-profile-details">
                          <div className="nb-profile-details-head">
                            <h3>Attachment Summary</h3>
                          </div>
                          <div className="nb-profile-detail-grid">
                            <div><span>Total Attachments</span><strong>{attachmentMeta.count}</strong></div>
                            <div className="nb-detail-span-2">
                              <span>Image Preview</span>
                              {attachmentMeta.firstImageUrl ? (
                                <div className="nb-attachment-preview">
                                  <img
                                    src={attachmentMeta.firstImageUrl}
                                    alt={selectedNotice.name || 'Notice attachment preview'}
                                    className="nb-attachment-preview-thumb"
                                  />
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

          {previewNotice && (
            <div className="nb-preview-backdrop" onClick={() => setPreviewNotice(null)}>
              <article
                className="nb-preview-modal"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <button
                  type="button"
                  className="nb-preview-close"
                  onClick={() => setPreviewNotice(null)}
                >
                  Close
                </button>
                {previewMeta?.firstImageUrl && (
                  <div className="nb-preview-banner">
                    <img src={previewMeta.firstImageUrl} alt={previewNotice.name || 'Notice attachment'} />
                  </div>
                )}
                <div className="nb-card-top">
                  <span className={`nb-chip ${String(previewNotice.status || '').toLowerCase() === 'inactive' ? 'inactive' : ''}`}>
                    {previewNotice.status}
                  </span>
                  <span className="nb-date">{formatDate(previewNotice.created_at)}</span>
                </div>
                <h3 className="nb-detail-title">{previewNotice.name}</h3>
                <p className="nb-detail-message">{previewNotice.description || 'No description added.'}</p>
                <div className="nb-detail-footer">
                  {formatDate(previewNotice.start_date)} to {formatDate(previewNotice.end_date)}
                </div>
                {previewAttachments.length > 0 && (
                  <div className="nb-attachment-list">
                    {previewAttachments.map((item, index) => (
                      <a
                        key={`${item.value}-${index}`}
                        href={item.value}
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
        </section>
      </main>
    </div>
  );
}
