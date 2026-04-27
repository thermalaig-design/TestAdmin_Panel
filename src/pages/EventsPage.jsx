import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import {
  createEvent,
  deleteEvent,
  fetchEventsByTrust,
  updateEvent,
  uploadEventAttachment,
} from '../services/eventsService';
import { parseAttachmentItem } from '../utils/attachmentUtils';
import { isImageFileLike } from '../utils/imageUpload';
import './EventsPage.css';

const EVENT_TYPES = ['general', 'vip'];
const EVENT_STATUSES = ['active', 'paused'];
const DEFAULT_START_TIME = '07:00';
const DEFAULT_END_TIME = '20:00';
const MAX_EVENT_IMAGE_ATTACHMENTS = 3;
const MAX_EVENT_IMAGE_SIZE_BYTES = 20 * 1024;

function toUiStatus(value) {
  return String(value || '').toLowerCase() === 'active' ? 'active' : 'paused';
}

function toDbStatus(value) {
  return String(value || '').toLowerCase() === 'active' ? 'active' : 'inactive';
}

function toUiType(value) {
  return String(value || '').toLowerCase() === 'vip' ? 'vip' : 'general';
}

function formatTypeLabel(value) {
  return String(value || '').toLowerCase() === 'vip' ? 'VIP' : 'general';
}

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

function isImageAttachment(item = {}) {
  const value = String(item?.value || '').toLowerCase();
  const name = String(item?.name || '').toLowerCase();
  if (value.startsWith('data:image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/.test(name);
}

function isImageFile(file) {
  return isImageFileLike(file);
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
  if ((file?.size || 0) <= maxBytes) return { file };

  const image = await loadImageFromFile(file);
  const baseWidth = Math.max(1, image.naturalWidth || image.width || 1);
  const baseHeight = Math.max(1, image.naturalHeight || image.height || 1);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;

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
        return { file: blob };
      }
    }
  }

  return null;
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

function parseDateValue(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return { year, month, day };
}

function parseTimeValue(value, fallback = '00:00') {
  const raw = String(value || fallback).trim().slice(0, 5);
  const match = raw.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return { hour, minute };
}

function toTimestamp(dateValue, timeValue, fallbackTime) {
  const datePart = parseDateValue(dateValue);
  const timePart = parseTimeValue(timeValue, fallbackTime);
  if (!datePart || !timePart) return null;
  return new Date(
    datePart.year,
    datePart.month,
    datePart.day,
    timePart.hour,
    timePart.minute,
    0,
    0
  ).getTime();
}

export default function EventsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'dashboard';
  const trustId = trust?.id || null;
  const isCreateRoute = location.pathname === '/events/create_event';
  const isEditRoute = location.pathname === '/events/edit_details';
  const isFormRoute = isCreateRoute || isEditRoute;
  const routeEditEventId =
    location.state?.editEventId || new URLSearchParams(location.search).get('id') || '';

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewEvent, setPreviewEvent] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);
  const [activeEventMenuId, setActiveEventMenuId] = useState(null);
  const [updatingEventId, setUpdatingEventId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentDragOver, setAttachmentDragOver] = useState(false);
  const [attachmentWarning, setAttachmentWarning] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [statusTab, setStatusTab] = useState('current');
  const [typeFilter, setTypeFilter] = useState('general');
  const [statusFilter, setStatusFilter] = useState('all');
  const [listSearch, setListSearch] = useState('');
  const [sortBy, setSortBy] = useState('start_date');
  const [currentPage, setCurrentPage] = useState(1);
  const [formError, setFormError] = useState('');
  const deferredListSearch = useDeferredValue(listSearch);
  const warningTimerRef = useRef(null);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());
  const EVENT_PAGE_SIZE = 10;

  const [form, setForm] = useState({
    title: '',
    description: '',
    attachments: [],
    location: '',
    startEventDate: '',
    startTime: DEFAULT_START_TIME,
    endTime: DEFAULT_END_TIME,
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
      startTime: DEFAULT_START_TIME,
      endTime: DEFAULT_END_TIME,
      endEventDate: '',
      type: 'general',
      status: 'active',
      is_registration_required: false,
    });
    setFormError('');
    setAttachmentWarning('');
    setEditingEventId(null);
  };

  const goToEventsList = () => {
    navigate('/events', { replace: true, state: { userName, trust, sidebarNavKey: currentSidebarNavKey } });
  };

  useEffect(() => {
    if (!trustId) {
      navigate('/dashboard', { replace: true, state: { userName, trust, sidebarNavKey: currentSidebarNavKey } });
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      const { data, error: fetchError } = await fetchEventsByTrust(trustId);
      if (fetchError) {
        setError(fetchError.message || 'Unable to load events data.');
      }
      setEvents(data || []);
      setLoading(false);
    };

    load();
  }, [navigate, trustId, userName, trust, currentSidebarNavKey]);

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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTimestamp(Date.now());
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const optimizedEvents = useMemo(
    () =>
      events.map((event) => ({
        ...event,
        _searchText: `${event?.title || ''} ${event?.description || ''} ${event?.location || ''}`.toLowerCase(),
        _sortStartDate: getDateSortValue(event?.startEventDate),
        _sortEndDate: getDateSortValue(event?.endEventDate),
        _startAt: toTimestamp(event?.startEventDate, event?.startTime, '00:00'),
        _endAt: toTimestamp(
          event?.endEventDate || event?.startEventDate,
          event?.endTime,
          '23:59'
        ),
      })),
    [events]
  );

  const pastEvents = useMemo(
    () =>
      optimizedEvents.filter((event) => {
        if (event._endAt === null) return false;
        return event._endAt < nowTimestamp;
      }),
    [optimizedEvents, nowTimestamp]
  );

  const currentEvents = useMemo(
    () =>
      optimizedEvents.filter((event) => {
        if (event._startAt === null || event._endAt === null) return false;
        return event._startAt <= nowTimestamp && event._endAt >= nowTimestamp;
      }),
    [optimizedEvents, nowTimestamp]
  );

  const upcomingEvents = useMemo(
    () =>
      optimizedEvents.filter((event) => {
        if (event._startAt === null) return false;
        return event._startAt > nowTimestamp;
      }),
    [optimizedEvents, nowTimestamp]
  );

  const scopedEvents = useMemo(
    () => {
      if (statusTab === 'past') return pastEvents;
      if (statusTab === 'upcoming') return upcomingEvents;
      return currentEvents;
    },
    [statusTab, pastEvents, currentEvents, upcomingEvents]
  );

  const baseFilteredEvents = useMemo(() => {
    const term = deferredListSearch.trim().toLowerCase();
    let list = [...scopedEvents];

    list = list.filter((event) => toUiType(event?.type) === typeFilter);

    if (term) {
      list = list.filter((event) => {
        return String(event?._searchText || '').includes(term);
      });
    }

    if (sortBy === 'name') {
      list.sort((left, right) => String(left?.title || '').localeCompare(String(right?.title || '')));
    } else if (sortBy === 'end_date') {
      list.sort((left, right) => getDateSortValue(left?.endEventDate).localeCompare(getDateSortValue(right?.endEventDate)));
    } else {
      list.sort((left, right) => String(left?._sortStartDate || '').localeCompare(String(right?._sortStartDate || '')));
    }

    return list;
  }, [deferredListSearch, scopedEvents, sortBy, typeFilter]);

  const scopedTypeCounts = useMemo(
    () =>
      scopedEvents.reduce(
        (acc, event) => {
          if (toUiType(event?.type) === 'vip') acc.vip += 1;
          else acc.general += 1;
          return acc;
        },
        { general: 0, vip: 0 }
      ),
    [scopedEvents]
  );

  const filteredStatusCounts = useMemo(
    () =>
      baseFilteredEvents.reduce(
        (acc, event) => {
          if (toUiStatus(event?.status) === 'active') acc.active += 1;
          else acc.paused += 1;
          return acc;
        },
        { active: 0, paused: 0 }
      ),
    [baseFilteredEvents]
  );

  const filteredEvents = useMemo(() => {
    if (statusFilter === 'all') return baseFilteredEvents;
    return baseFilteredEvents.filter((event) => toUiStatus(event?.status) === statusFilter);
  }, [baseFilteredEvents, statusFilter]);

  const selectedEvent = useMemo(
    () => filteredEvents.find((item) => item.id === selectedEventId) || null,
    [filteredEvents, selectedEventId]
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredEvents.length / EVENT_PAGE_SIZE)),
    [filteredEvents.length]
  );

  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * EVENT_PAGE_SIZE;
    return filteredEvents.slice(start, start + EVENT_PAGE_SIZE);
  }, [currentPage, filteredEvents]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusTab, sortBy, listSearch, typeFilter, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (loading || isFormRoute) return;
    if (!filteredEvents.length) {
      setSelectedEventId('');
      return;
    }
    const exists = filteredEvents.some((event) => event.id === selectedEventId);
    if (!exists) {
      setSelectedEventId(filteredEvents[0].id);
    }
  }, [filteredEvents, selectedEventId, loading, isFormRoute]);

  useEffect(() => {
    if (!isFormRoute) return;

    if (isCreateRoute) {
      resetEventForm();
      return;
    }

    if (!isEditRoute) return;
    const targetId = String(routeEditEventId || selectedEventId || '');
    if (!targetId) return;
    const event = events.find((item) => String(item.id) === targetId);
    if (!event) return;

    const parsedAttachments = (event.attachments || [])
      .map((item, index) => parseAttachmentItem(item, index))
      .filter(Boolean);

    setForm({
      title: event.title || '',
      description: event.description || '',
      attachments: parsedAttachments,
      location: event.location || '',
      startEventDate: event.startEventDate || '',
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      endEventDate: event.endEventDate || '',
      type: toUiType(event.type),
      status: toUiStatus(event.status),
      is_registration_required: !!event.is_registration_required,
    });
    setEditingEventId(event.id);
    setFormError('');
  }, [
    isFormRoute,
    isCreateRoute,
    isEditRoute,
    routeEditEventId,
    selectedEventId,
    events,
  ]);

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
      attachments: form.attachments.map((item) => String(item?.value || '').trim()).filter(Boolean),
      location: form.location,
      startEventDate: form.startEventDate,
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      endEventDate: form.endEventDate || null,
      type: form.type,
      status: toDbStatus(form.status),
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
    if (isFormRoute) {
      setSaving(false);
      goToEventsList();
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

      if (nextImageCount >= MAX_EVENT_IMAGE_ATTACHMENTS) {
        warningMessages.push(`"${file.name}" skipped: max ${MAX_EVENT_IMAGE_ATTACHMENTS} images allowed.`);
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
        const processed = await compressImageToLimit(file, MAX_EVENT_IMAGE_SIZE_BYTES);
        if (!processed?.file) {
          warningMessages.push(
            `"${file.name}" skipped: image could not be compressed to ${Math.floor(MAX_EVENT_IMAGE_SIZE_BYTES / 1024)}KB.`
          );
          continue;
        }

        const { data: uploadData, error: uploadError } = await uploadEventAttachment(processed.file, { trustId });
        if (uploadError || !uploadData?.publicUrl) {
          warningMessages.push(`"${file.name}" failed to upload.`);
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
    setActiveEventMenuId(null);
    navigate(`/events/edit_details?id=${event.id}`, {
      state: { userName, trust, editEventId: event.id, sidebarNavKey: currentSidebarNavKey },
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
          onBack={() => {
            if (isFormRoute) {
              goToEventsList();
              return;
            }
            navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } });
          }}
        />

        <section className="ev-content">
          {error && <div className="ev-error">{error}</div>}

          {isFormRoute && (
            <div className="ev-form-card">
              <h3>{editingEventId ? 'Edit Event' : 'Create Event'}</h3>
              <div className="ev-form-layout">
                <section className="ev-form-section">
                  <h4 className="ev-section-title">Basic Info</h4>
                  <div className="ev-form-grid ev-form-grid-2">
                    <label>
                      <span>Event Name *</span>
                      <input
                        value={form.title}
                        onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter event title"
                      />
                    </label>
                    <label>
                      <span>Location</span>
                      <input
                        value={form.location}
                        onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                        placeholder="Venue / address"
                      />
                    </label>
                    <div>
                      <span>Type</span>
                      <div className="ev-choice-row" role="radiogroup" aria-label="Event Type">
                        {EVENT_TYPES.map((typeValue) => (
                          <button
                            key={typeValue}
                            type="button"
                            role="radio"
                            aria-checked={form.type === typeValue}
                            className={`ev-choice-btn ${form.type === typeValue ? 'active' : ''}`}
                            onClick={() => setForm((prev) => ({ ...prev, type: typeValue }))}
                          >
                            <span className="ev-choice-dot" aria-hidden="true" />
                            <span className="ev-choice-label">{formatTypeLabel(typeValue)}</span>
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
                        {EVENT_STATUSES.map((statusValue) => (
                          <option key={statusValue} value={statusValue}>
                            {statusValue}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>

                <section className="ev-form-section">
                  <h4 className="ev-section-title">Schedule</h4>
                  <div className="ev-form-grid ev-form-grid-2">
                    <label>
                      <span>Start Date *</span>
                      <input
                        type="date"
                        value={form.startEventDate}
                        onChange={(e) => setForm((prev) => ({ ...prev, startEventDate: e.target.value }))}
                        onFocus={(e) => e.target.showPicker?.()}
                        onClick={(e) => e.target.showPicker?.()}
                      />
                    </label>
                    <label>
                      <span>End Date</span>
                      <input
                        type="date"
                        value={form.endEventDate}
                        onChange={(e) => setForm((prev) => ({ ...prev, endEventDate: e.target.value }))}
                        onFocus={(e) => e.target.showPicker?.()}
                        onClick={(e) => e.target.showPicker?.()}
                      />
                    </label>
                    <label>
                      <span>Start Time</span>
                      <input
                        type="time"
                        value={form.startTime}
                        onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                        onFocus={(e) => e.target.showPicker?.()}
                        onClick={(e) => e.target.showPicker?.()}
                      />
                    </label>
                    <label>
                      <span>End Time</span>
                      <input
                        type="time"
                        value={form.endTime}
                        onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                        onFocus={(e) => e.target.showPicker?.()}
                        onClick={(e) => e.target.showPicker?.()}
                      />
                    </label>
                  </div>
                </section>

                <section className="ev-form-section">
                  <h4 className="ev-section-title">Description</h4>
                  <div className="ev-form-grid ev-form-grid-2">
                    <label className="ev-span-full">
                      <span>Description</span>
                      <textarea
                        rows="4"
                        value={form.description}
                        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter event description"
                      />
                    </label>
                  </div>
                </section>

                <section className="ev-form-section">
                  <h4 className="ev-section-title">Attachments</h4>
                  <div className="ev-form-grid ev-form-grid-2">
                    <div className="ev-span-full">
                      <span>Upload image attachments</span>
                      <p className="ev-attachment-limit-note">
                        Important: You can upload up to {MAX_EVENT_IMAGE_ATTACHMENTS} images. Each image must be{' '}
                        {Math.floor(MAX_EVENT_IMAGE_SIZE_BYTES / 1024)}KB or smaller.
                      </p>
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
                      {attachmentWarning && <div className="ev-warning-inline">{attachmentWarning}</div>}
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
                </section>
              </div>

              {formError && <div className="ev-error">{formError}</div>}

              <div className="ev-form-actions">
                <button
                  className="ev-secondary-btn"
                  onClick={() => {
                    resetEventForm();
                    goToEventsList();
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

          {!isFormRoute && loading && <div className="ev-empty">Loading events...</div>}

          {!isFormRoute && !loading && events.length === 0 && (
            <div className="ev-empty">
              <button
                className="ev-add-btn ev-list-add-btn"
                type="button"
                onClick={() => navigate('/events/create_event', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
              >
                Add Event
              </button>
              <div>No event found for this trust. Create your first event.</div>
            </div>
          )}

          {!isFormRoute && !loading && events.length > 0 && (
            <section className="ev-profile-layout">
              <aside className="ev-left-panel">
                <div className="ev-left-head">
                  <h3>All Events</h3>
                  <span className="ev-left-count">{events.length}</span>
                </div>

                <div className="ev-tabs">
                  <button
                    type="button"
                    className={`ev-tab ${statusTab === 'past' ? 'active' : ''}`}
                    onClick={() => setStatusTab('past')}
                  >
                    <span>Past</span>
                    <b>{pastEvents.length}</b>
                  </button>
                  <button
                    type="button"
                    className={`ev-tab ${statusTab === 'current' ? 'active' : ''}`}
                    onClick={() => setStatusTab('current')}
                  >
                    <span>Current</span>
                    <b>{currentEvents.length}</b>
                  </button>
                  <button
                    type="button"
                    className={`ev-tab ${statusTab === 'upcoming' ? 'active' : ''}`}
                    onClick={() => setStatusTab('upcoming')}
                  >
                    <span>Upcoming</span>
                    <b>{upcomingEvents.length}</b>
                  </button>
                </div>

                <input
                  className="ev-left-search"
                  placeholder="Search event..."
                  value={listSearch}
                  onChange={(event) => setListSearch(event.target.value)}
                />
                <div className="ev-type-tabs">
                  <button
                    type="button"
                    className={`ev-type-tab ${typeFilter === 'general' ? 'active' : ''}`}
                    onClick={() => setTypeFilter('general')}
                  >
                    <span>General</span>
                    <b>{scopedTypeCounts.general}</b>
                  </button>
                  <button
                    type="button"
                    className={`ev-type-tab ${typeFilter === 'vip' ? 'active' : ''}`}
                    onClick={() => setTypeFilter('vip')}
                  >
                    <span>VIP</span>
                    <b>{scopedTypeCounts.vip}</b>
                  </button>
                </div>
                <div className="ev-status-summary">
                  <button
                    type="button"
                    className={`ev-status-summary-item active ${statusFilter === 'active' ? 'selected' : ''}`}
                    onClick={() => setStatusFilter((prev) => (prev === 'active' ? 'all' : 'active'))}
                  >
                    <span>Active</span>
                    <b>{filteredStatusCounts.active}</b>
                  </button>
                  <button
                    type="button"
                    className={`ev-status-summary-item paused ${statusFilter === 'paused' ? 'selected' : ''}`}
                    onClick={() => setStatusFilter((prev) => (prev === 'paused' ? 'all' : 'paused'))}
                  >
                    <span>Paused</span>
                    <b>{filteredStatusCounts.paused}</b>
                  </button>
                </div>
                <button
                  className="ev-add-btn ev-list-add-btn"
                  type="button"
                  onClick={() => navigate('/events/create_event', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
                >
                  Add Event
                </button>

                <div className="ev-filter-row">
                  <label className="ev-inline-field">
                    <span>Sort By</span>
                    <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                      <option value="start_date">Start Date</option>
                      <option value="end_date">End Date</option>
                      <option value="name">Name</option>
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
                            <span className={`ev-chip ${toUiStatus(selectedEvent.status) === 'paused' ? 'inactive' : ''}`}>
                              {toUiStatus(selectedEvent.status)}
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
                                ? 'Set Paused'
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
                        <div><span>Status</span><strong>{toUiStatus(selectedEvent.status)}</strong></div>
                        <div><span>Type</span><strong>{formatTypeLabel(selectedEvent.type)}</strong></div>
                        <div><span>Start Date</span><strong>{formatDate(selectedEvent.startEventDate)}</strong></div>
                        <div><span>Start Time</span><strong>{formatTime(selectedEvent.startTime)}</strong></div>
                        <div><span>End Time</span><strong>{formatTime(selectedEvent.endTime)}</strong></div>
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
                  <span className={`ev-chip ${toUiStatus(previewEvent.status) === 'paused' ? 'inactive' : ''}`}>
                    {toUiStatus(previewEvent.status)}
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
                  <div>Start Time: {formatTime(previewEvent.startTime)}</div>
                  <div>End Time: {formatTime(previewEvent.endTime)}</div>
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
