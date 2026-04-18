import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import { createEvent, deleteEvent, fetchEventsByTrust, updateEvent } from '../services/eventsService';
import { getCachedQueryValue } from '../services/requestCache';
import { parseAttachmentItem, readFileAsDataUrl, serializeAttachmentItem } from '../utils/attachmentUtils';
import './EventsPage.css';

const EVENT_TYPES = ['general', 'social', 'religious', 'health', 'education'];
const EVENT_STATUSES = ['active', 'inactive', 'cancelled', 'completed'];

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(value) {
  if (!value) return '-';
  return String(value).slice(0, 5);
}

function getDateSortValue(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getTimeSortValue(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(raw)) return raw.slice(0, 8);
  return raw;
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
  const firstImageUrl = parsed.find(isImageAttachment)?.value || '';
  return {
    count: parsed.length,
    firstImageUrl,
  };
}

function isPausedEvent(event) {
  return String(event?.status || '').toLowerCase() !== 'active';
}

export default function EventsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'dashboard';
  const trustId = trust?.id || null;
  const eventsCacheKey = trustId ? `events:list:${trustId}` : '';
  const cachedEventsPayload = eventsCacheKey ? getCachedQueryValue(eventsCacheKey) : null;
  const seededEvents = Array.isArray(cachedEventsPayload?.data) ? cachedEventsPayload.data : [];
  const seededFromCacheRef = useRef(seededEvents.length > 0);

  const [events, setEvents] = useState(seededEvents);
  const [loading, setLoading] = useState(!seededFromCacheRef.current);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [previewEvent, setPreviewEvent] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);
  const [activeEventMenuId, setActiveEventMenuId] = useState(null);
  const [updatingEventId, setUpdatingEventId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentDragOver, setAttachmentDragOver] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [statusTab, setStatusTab] = useState('active');
  const [listSearch, setListSearch] = useState('');
  const [sortBy, setSortBy] = useState('start_date');
  const [currentPage, setCurrentPage] = useState(1);
  const [formError, setFormError] = useState('');
  const deferredListSearch = useDeferredValue(listSearch);
  const warningTimerRef = useRef(null);
  const EVENT_PAGE_SIZE = 8;

  const [form, setForm] = useState({
    title: '',
    description: '',
    attachments: [],
    location: '',
    startEventDate: '',
    start_time: '',
    end_time: '',
    endEventDate: '',
    type: 'general',
    status: 'active',
    is_registration_required: false,
  });

  const resetEventForm = () => {
    setForm({
      title: '',
      description: '',
      attachments: [],
      location: '',
      startEventDate: '',
      start_time: '',
      end_time: '',
      endEventDate: '',
      type: 'general',
      status: 'active',
      is_registration_required: false,
    });
    setFormError('');
    setEditingEventId(null);
  };

  useEffect(() => {
    if (!trustId) {
      navigate('/dashboard', { replace: true, state: { userName, trust } });
      return;
    }

    const load = async () => {
      if (!seededFromCacheRef.current) setLoading(true);
      setError('');
      const { data, error: fetchError } = await fetchEventsByTrust(trustId);
      if (fetchError) {
        setError(fetchError.message || 'Unable to load events data.');
      }
      setEvents(data || []);
      setLoading(false);
      seededFromCacheRef.current = false;
    };

    load();
  }, [navigate, trustId, userName, trust]);

  useEffect(() => {
    const closeMenu = () => setActiveEventMenuId(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => () => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!previewEvent) return undefined;
    const onEsc = (event) => {
      if (event.key === 'Escape') setPreviewEvent(null);
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [previewEvent]);

  const optimizedEvents = useMemo(
    () =>
      events.map((event) => ({
        ...event,
        _searchText: `${event?.title || ''} ${event?.description || ''} ${event?.location || ''}`.toLowerCase(),
        _sortStartDate: getDateSortValue(event?.startEventDate),
        _sortEndDate: getDateSortValue(event?.endEventDate),
      })),
    [events]
  );

  const activeEvents = useMemo(
    () => optimizedEvents.filter((event) => !isPausedEvent(event)),
    [optimizedEvents]
  );

  const pausedEvents = useMemo(
    () => optimizedEvents.filter((event) => isPausedEvent(event)),
    [optimizedEvents]
  );

  const scopedEvents = useMemo(
    () => (statusTab === 'paused' ? pausedEvents : activeEvents),
    [statusTab, pausedEvents, activeEvents]
  );

  const filteredEvents = useMemo(() => {
    const term = deferredListSearch.trim().toLowerCase();
    let list = [...scopedEvents];

    if (term) {
      list = list.filter((event) => {
        return String(event?._searchText || '').includes(term);
      });
    }

    if (sortBy === 'name') {
      list.sort((left, right) => String(left?.title || '').localeCompare(String(right?.title || '')));
    } else if (sortBy === 'end_date') {
      list.sort((left, right) => String(left?._sortEndDate || '').localeCompare(String(right?._sortEndDate || '')));
    } else {
      list.sort((left, right) => String(left?._sortStartDate || '').localeCompare(String(right?._sortStartDate || '')));
    }

    return list;
  }, [deferredListSearch, scopedEvents, sortBy]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredEvents.length / EVENT_PAGE_SIZE)),
    [filteredEvents.length]
  );

  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * EVENT_PAGE_SIZE;
    return filteredEvents.slice(start, start + EVENT_PAGE_SIZE);
  }, [filteredEvents, currentPage, EVENT_PAGE_SIZE]);

  const selectedEvent = useMemo(
    () => filteredEvents.find((item) => item.id === selectedEventId) || null,
    [filteredEvents, selectedEventId]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [statusTab, sortBy, listSearch]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (loading || showForm) return;
    if (!filteredEvents.length) {
      setSelectedEventId('');
      return;
    }
    const exists = filteredEvents.some((event) => event.id === selectedEventId);
    if (!exists) {
      setSelectedEventId(filteredEvents[0].id);
    }
  }, [filteredEvents, selectedEventId, loading, showForm]);

  const handleCreate = async () => {
    setFormError('');

    if (!form.title.trim()) {
      setFormError('Event name is required.');
      return;
    }

    if (!form.startEventDate) {
      setFormError('Start date is required.');
      return;
    }

    setSaving(true);

    const payload = {
      trust_id: trustId,
      title: form.title,
      description: form.description,
      attachments: form.attachments.map(serializeAttachmentItem).filter(Boolean),
      location: form.location,
      startEventDate: form.startEventDate,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      endEventDate: form.endEventDate || null,
      type: form.type,
      status: form.status,
      is_registration_required: form.is_registration_required,
    };

    if (editingEventId) {
      const { data, error: updateError } = await updateEvent(editingEventId, payload, trustId);
      if (updateError) {
        setFormError(updateError.message || 'Unable to update event.');
        setSaving(false);
        return;
      }
      setEvents((prev) => prev.map((item) => (item.id === editingEventId ? data : item)));
    } else {
      const { data, error: createError } = await createEvent(payload);
      if (createError) {
        setFormError(createError.message || 'Unable to create event.');
        setSaving(false);
        return;
      }
      setEvents((prev) => [data, ...prev]);
    }

    resetEventForm();
    setShowForm(false);
    setSaving(false);
  };

  const handleAttachmentFile = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    setFormError('');
    setUploadingAttachment(true);

    try {
      const uploaded = await Promise.all(files.map(readFileAsDataUrl));
      setForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...uploaded] }));
    } catch (uploadError) {
      setFormError(uploadError.message || 'Unable to upload attachment.');
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

  const handleDeleteEvent = async (event) => {
    const shouldDelete = window.confirm(`Delete event "${event?.title || 'this event'}"?`);
    if (!shouldDelete) {
      setActiveEventMenuId(null);
      return;
    }

    setUpdatingEventId(event.id);
    const { error: deleteError } = await deleteEvent(event.id, trustId);
    if (deleteError) {
      setError(deleteError.message || 'Unable to delete event.');
    } else {
      setEvents((prev) => prev.filter((item) => item.id !== event.id));
    }
    setUpdatingEventId(null);
    setActiveEventMenuId(null);
  };

  const handleToggleStatus = async (event) => {
    const nextStatus = String(event?.status || '').toLowerCase() === 'active' ? 'inactive' : 'active';
    setUpdatingEventId(event.id);
    const { data, error: updateError } = await updateEvent(event.id, { status: nextStatus }, trustId);
    if (updateError) {
      setError(updateError.message || 'Unable to update event status.');
    } else if (data) {
      setEvents((prev) => prev.map((item) => (item.id === event.id ? data : item)));
    }
    setUpdatingEventId(null);
    setActiveEventMenuId(null);
  };

  const handleEditEventDetails = (event) => {
    const parsedAttachments = (event.attachments || [])
      .map((item, index) => parseAttachmentItem(item, index))
      .filter(Boolean);

    setForm({
      title: event.title || '',
      description: event.description || '',
      attachments: parsedAttachments,
      location: event.location || '',
      startEventDate: event.startEventDate || '',
      start_time: event.start_time || '',
      end_time: event.end_time || event.raw?.end_time || '',
      endEventDate: event.endEventDate || '',
      type: event.type || 'general',
      status: event.status || 'active',
      is_registration_required: !!event.is_registration_required,
    });
    setEditingEventId(event.id);
    setFormError('');
    setShowForm(true);
    setActiveEventMenuId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleEventForm = () => {
    setShowForm((prev) => {
      const next = !prev;
      if (!next) {
        resetEventForm();
      } else if (!editingEventId) {
        setFormError('');
      }
      return next;
    });
  };

  if (!trustId) return null;

  const previewAttachments = (previewEvent?.attachments || [])
    .map((item, index) => parseAttachmentItem(item, index))
    .filter(Boolean);

  return (
    <div className="ev-root">
      <Sidebar
        trustName={trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
        onLogout={() => navigate('/login')}
      />

      <main className="ev-main">
        <PageHeader
          title="Events"
          subtitle="Data is now fetched and inserted from the events table"
          onBack={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
        />

        <section className="ev-content">
          {error && <div className="ev-error">{error}</div>}

          {showForm && (
            <div className="ev-form-card">
              <h3>{editingEventId ? 'Edit Event' : 'Create Event'}</h3>
              <div className="ev-form-grid">
                <label>
                  <span>Event Name *</span>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter event title"
                  />
                </label>
                <div className="ev-date-field">
                  <span>Start Date</span>
                  <input
                    type="date"
                    value={form.startEventDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, startEventDate: e.target.value }))}
                    onClick={(e) => e.target.showPicker?.()}
                  />
                </div>
                <div className="ev-date-field">
                  <span>End Date</span>
                  <input
                    type="date"
                    value={form.endEventDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, endEventDate: e.target.value }))}
                    onClick={(e) => e.target.showPicker?.()}
                  />
                </div>
                <div className="ev-time-pair ev-span-2">
                  <div className="ev-time-field">
                    <span>Start Time</span>
                    <input
                      type="time"
                      value={form.start_time}
                      onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))}
                      onClick={(e) => e.target.showPicker?.()}
                    />
                  </div>
                  <div className="ev-time-field">
                    <span>End Time</span>
                    <input
                      type="time"
                      value={form.end_time}
                      onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))}
                      onClick={(e) => e.target.showPicker?.()}
                    />
                  </div>
                </div>
                <label>
                  <span>Location</span>
                  <input
                    value={form.location}
                    onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="Venue / address"
                  />
                </label>
                <label>
                  <span>Type</span>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                  >
                    {EVENT_TYPES.map((typeValue) => (
                      <option key={typeValue} value={typeValue}>
                        {typeValue}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    {EVENT_STATUSES.map((statusValue) => (
                      <option key={statusValue} value={statusValue}>
                        {statusValue}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ev-checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.is_registration_required}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        is_registration_required: e.target.checked,
                      }))
                    }
                  />
                  <span>Registration Required</span>
                </label>
                <label className="ev-span-2">
                  <span>Description</span>
                  <textarea
                    rows="4"
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter event description"
                  />
                </label>
                <div className="ev-span-2">
                  <span>Attachments (upload PDF, docs, photos, etc.)</span>
                  <label
                    className={`ev-attachment-dropzone ${attachmentDragOver ? 'drag' : ''}`}
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
                    <div className="ev-attachment-drop-inner">
                      <span>{uploadingAttachment ? 'Uploading...' : 'Drag & drop files here'}</span>
                      <span className="ev-attachment-drop-sub">or click to choose files</span>
                    </div>
                  </label>
                  {form.attachments.length > 0 && (
                    <div className="ev-attachment-pill-list">
                      {form.attachments.map((item, index) => (
                        <div key={`${item.name}-${index}`} className="ev-attachment-pill">
                          <span className="ev-attachment-pill-name">{item.name}</span>
                          <button type="button" onClick={() => removeAttachment(index)}>Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {formError && <div className="ev-error">{formError}</div>}

              <div className="ev-form-actions">
                <button
                  className="ev-secondary-btn"
                  onClick={() => {
                    setShowForm(false);
                    resetEventForm();
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button className="ev-add-btn" onClick={handleCreate} disabled={saving} type="button">
                  {saving ? 'Saving...' : editingEventId ? 'Update Event' : 'Save Event'}
                </button>
              </div>
            </div>
          )}

          {loading && <div className="ev-empty">Loading events...</div>}

          {!loading && events.length === 0 && (
            <div className="ev-empty">
              <button className="ev-add-btn ev-list-add-btn" type="button" onClick={toggleEventForm}>
                {showForm ? 'Close Form' : 'Add Event'}
              </button>
              <div>No event found for this trust. Create your first event.</div>
            </div>
          )}

          {!loading && events.length > 0 && (
            <section className="ev-profile-layout">
              <aside className="ev-left-panel">
                <div className="ev-left-head">
                  <h3>All Events</h3>
                  <span className="ev-left-count">{events.length}</span>
                </div>

                <div className="ev-tabs">
                  <button
                    type="button"
                    className={`ev-tab ${statusTab === 'active' ? 'active' : ''}`}
                    onClick={() => setStatusTab('active')}
                  >
                    <span>Active</span>
                    <b>{activeEvents.length}</b>
                  </button>
                  <button
                    type="button"
                    className={`ev-tab ${statusTab === 'paused' ? 'active' : ''}`}
                    onClick={() => setStatusTab('paused')}
                  >
                    <span>Paused</span>
                    <b>{pausedEvents.length}</b>
                  </button>
                </div>

                <input
                  className="ev-left-search"
                  placeholder="Search event..."
                  value={listSearch}
                  onChange={(event) => setListSearch(event.target.value)}
                />
                <button className="ev-add-btn ev-list-add-btn" type="button" onClick={toggleEventForm}>
                  {showForm ? 'Close Form' : 'Add Event'}
                </button>

                <div className="ev-filter-row">
                  <label className="ev-inline-field">
                    <span>Sort By</span>
                    <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                      <option value="start_date">Start Date</option>
                      <option value="end_date">End Date</option>
                      <option value="name">Name A-Z</option>
                    </select>
                  </label>
                </div>

                <div className="ev-left-list">
                  {filteredEvents.length === 0 && (
                    <div className="ev-empty">No event matched your filters.</div>
                  )}
                  {paginatedEvents.map((event) => (
                    <button
                      key={event.id}
                      className={`ev-left-item ${selectedEventId === event.id ? 'active' : ''}`}
                      onClick={() => setSelectedEventId(event.id)}
                      type="button"
                    >
                      <div className="ev-left-avatar">
                        {String(event?.title || 'E').trim().charAt(0).toUpperCase()}
                      </div>
                      <div className="ev-left-item-body">
                        <div className="ev-left-item-title">{event.title}</div>
                        <div className="ev-left-item-sub">{formatDate(event.startEventDate)}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {filteredEvents.length > 0 && (
                  <div className="ev-left-pagination">
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

              <section className="ev-right-panel">
                {!selectedEvent && (
                  <div className="ev-empty">Select an event to view details.</div>
                )}

                {selectedEvent && (
                  <>
                    <div className="ev-profile-hero">
                      <div className="ev-profile-hero-left">
                        <div className="ev-profile-avatar">
                          {String(selectedEvent?.title || 'E').trim().charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3>{selectedEvent.title}</h3>
                          <div className="ev-profile-hero-actions">
                            <span className={`ev-chip ${String(selectedEvent.status || '').toLowerCase() === 'inactive' ? 'inactive' : ''}`}>
                              {selectedEvent.status}
                            </span>
                            <button
                              className="ev-secondary-btn"
                              type="button"
                              onClick={() => setPreviewEvent(selectedEvent)}
                            >
                              View Details
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="ev-card-menu-wrap">
                        <button
                          type="button"
                          className="ev-card-menu-btn"
                          title="Edit"
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveEventMenuId((prev) => (prev === selectedEvent.id ? null : selectedEvent.id));
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {activeEventMenuId === selectedEvent.id && (
                          <div className="ev-card-menu">
                            <button
                              type="button"
                              onClick={() => handleEditEventDetails(selectedEvent)}
                              disabled={updatingEventId === selectedEvent.id}
                            >
                              Edit Details
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(selectedEvent)}
                              disabled={updatingEventId === selectedEvent.id}
                            >
                              {String(selectedEvent.status || '').toLowerCase() === 'active'
                                ? 'Set Inactive'
                                : 'Set Active'}
                            </button>
                            <button
                              type="button"
                              className="danger"
                              onClick={() => handleDeleteEvent(selectedEvent)}
                              disabled={updatingEventId === selectedEvent.id}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="ev-profile-details">
                      <div className="ev-profile-details-head">
                        <h3>Event Details</h3>
                      </div>
                      <div className="ev-profile-detail-grid">
                        <div><span>Name</span><strong>{selectedEvent.title || '-'}</strong></div>
                        <div><span>Status</span><strong>{selectedEvent.status || '-'}</strong></div>
                        <div><span>Type</span><strong>{selectedEvent.type || '-'}</strong></div>
                        <div><span>Start Date</span><strong>{formatDate(selectedEvent.startEventDate)}</strong></div>
                        <div><span>Start Time</span><strong>{formatTime(selectedEvent.start_time)}</strong></div>
                        <div><span>End Time</span><strong>{formatTime(selectedEvent.end_time || selectedEvent.raw?.end_time)}</strong></div>
                        <div><span>End Date</span><strong>{formatDate(selectedEvent.endEventDate)}</strong></div>
                        <div><span>Location</span><strong>{selectedEvent.location || '-'}</strong></div>
                        <div>
                          <span>Registration</span>
                          <strong>{selectedEvent.is_registration_required ? 'Required' : 'Not Required'}</strong>
                        </div>
                        <div className="ev-detail-span-2">
                          <span>Description</span>
                          <strong>{selectedEvent.description || 'No description added.'}</strong>
                        </div>
                      </div>
                    </div>

                    {(() => {
                      const attachmentMeta = buildAttachmentMeta(selectedEvent.attachments);
                      return (
                        <div className="ev-profile-details">
                          <div className="ev-profile-details-head">
                            <h3>Attachment Summary</h3>
                          </div>
                          <div className="ev-profile-detail-grid">
                            <div><span>Total Attachments</span><strong>{attachmentMeta.count}</strong></div>
                            <div className="ev-detail-span-2">
                              <span>Image Preview</span>
                              {attachmentMeta.firstImageUrl ? (
                                <div className="ev-attachment-preview">
                                  <img
                                    src={attachmentMeta.firstImageUrl}
                                    alt={selectedEvent.title || 'Event attachment preview'}
                                    className="ev-attachment-preview-thumb"
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

          {previewEvent && (
            <div className="ev-preview-backdrop" onClick={() => setPreviewEvent(null)}>
              <article
                className="ev-preview-modal"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
              >
                <button
                  type="button"
                  className="ev-preview-close"
                  onClick={() => setPreviewEvent(null)}
                >
                  Close
                </button>
                <div className="ev-card-top">
                  <span className={`ev-chip ${String(previewEvent.status || '').toLowerCase() === 'inactive' ? 'inactive' : ''}`}>
                    {previewEvent.status}
                  </span>
                  <span className="ev-date">{formatDate(previewEvent.startEventDate)}</span>
                </div>
                <h3 className="ev-detail-title">{previewEvent.title}</h3>
                <p className="ev-detail-message">{previewEvent.description || 'No description added.'}</p>
                <div className="ev-detail-footer">
                  {previewEvent.location || '-'}
                </div>
                <div className="ev-detail-meta">
                  <div>Start Date: {formatDate(previewEvent.startEventDate)}</div>
                  <div>End Date: {formatDate(previewEvent.endEventDate)}</div>
                  <div>Start Time: {formatTime(previewEvent.start_time)}</div>
                  <div>End Time: {formatTime(previewEvent.end_time || previewEvent.raw?.end_time)}</div>
                  <div>Registration: {previewEvent.is_registration_required ? 'Required' : 'Not Required'}</div>
                </div>
                {previewAttachments.length > 0 && (
                  <div className="ev-attachment-list">
                    {previewAttachments.map((item, index) => (
                      <a
                        key={`${item.value}-${index}`}
                        href={item.value}
                        target={item.isDataUrl ? undefined : '_blank'}
                        rel={item.isDataUrl ? undefined : 'noreferrer'}
                        download={item.name}
                        className="ev-attachment-link"
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
