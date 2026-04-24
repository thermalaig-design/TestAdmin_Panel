import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import {
  createNotification,
  deleteNotification,
  fetchNotificationsByTrustId,
  updateNotification,
} from '../services/notificationsService';
import './NotificationPage.css';

const EMPTY_FORM = {
  title: '',
  message: '',
  type: 'general',
  target_audience: 'all',
  is_read: false,
};

const TYPE_OPTIONS = ['general', 'alert', 'update'];
const AUDIENCE_OPTIONS = ['all', 'members', 'donors', 'admins'];

function formatDate(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'home-page';
  const trustId = trust?.id || null;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!trustId) {
      navigate('/dashboard', { replace: true, state: { userName, trust, sidebarNavKey: 'home-page' } });
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      const { data, error: fetchError } = await fetchNotificationsByTrustId(trustId);
      if (fetchError) {
        setError(fetchError.message || 'Unable to load notifications.');
        setList([]);
        setLoading(false);
        return;
      }
      setList(data || []);
      setLoading(false);
    };

    load();
  }, [navigate, trustId, userName, trust]);

  const filtered = useMemo(() => {
    const query = String(search || '').trim().toLowerCase();
    if (!query) return list;
    return list.filter((item) => {
      const title = String(item.title || '').toLowerCase();
      const message = String(item.message || '').toLowerCase();
      const type = String(item.type || '').toLowerCase();
      const audience = String(item.target_audience || '').toLowerCase();
      return (
        title.includes(query) ||
        message.includes(query) ||
        type.includes(query) ||
        audience.includes(query)
      );
    });
  }, [list, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSaveError('');
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      message: item.message || '',
      type: item.type || 'general',
      target_audience: item.target_audience || 'all',
      is_read: item.is_read === true,
    });
    setSaveError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSaveError('');
  };

  const handleSave = async () => {
    const title = String(form.title || '').trim();
    const message = String(form.message || '').trim();
    if (!title) {
      setSaveError('Title is required.');
      return;
    }
    if (!message) {
      setSaveError('Message is required.');
      return;
    }

    const payload = {
      title,
      message,
      type: String(form.type || 'general').trim() || 'general',
      target_audience: String(form.target_audience || 'all').trim() || 'all',
      is_read: form.is_read === true,
    };

    setSaving(true);
    setSaveError('');

    if (editingId) {
      const { data, error: updateError } = await updateNotification(editingId, payload, trustId);
      if (updateError) {
        setSaveError(updateError.message || 'Unable to update notification.');
      } else if (data) {
        setList((prev) => prev.map((entry) => (entry.id === data.id ? data : entry)));
        closeForm();
      }
    } else {
      const { data, error: createError } = await createNotification({ trust_id: trustId, ...payload });
      if (createError) {
        setSaveError(createError.message || 'Unable to create notification.');
      } else if (data) {
        setList((prev) => [data, ...prev]);
        closeForm();
      }
    }

    setSaving(false);
  };

  const handleDelete = async (item) => {
    if (!item?.id) return;
    const ok = window.confirm('Remove this notification? This action cannot be undone.');
    if (!ok) return;

    setDeletingId(item.id);
    setError('');
    const { error: deleteError } = await deleteNotification(item.id, trustId);
    if (deleteError) {
      setError(deleteError.message || 'Unable to remove notification.');
    } else {
      setList((prev) => prev.filter((entry) => entry.id !== item.id));
      if (editingId === item.id) {
        closeForm();
      }
    }
    setDeletingId(null);
  };

  return (
    <div className="np-root">
      <Sidebar
        trustName={trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
        onLogout={() => navigate('/login')}
      />

      <main className="np-main">
        <PageHeader
          title="Notification"
          subtitle="Manage records from notifications table"
          onBack={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: 'home-page' } })}
          right={(
            <button className="np-create-btn" type="button" onClick={openCreate}>
              Create Notification
            </button>
          )}
        />

        <section className="np-content">
          {error && <div className="np-error">{error}</div>}

          <div className="np-toolbar">
            <div className="np-count">Total Notifications: {filtered.length}</div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, message, type..."
              className="np-search"
            />
          </div>

          {loading && (
            <div className="np-empty-card">
              <h3>Loading...</h3>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="np-empty-card">
              <h3>No Data</h3>
              <p>No notifications data available.</p>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="np-list">
              {filtered.map((item) => (
                <article key={item.id} className="np-item">
                  <div className="np-item-head">
                    <h4>{item.title || 'Untitled Notification'}</h4>
                    <div className="np-item-head-actions">
                      <span className={`np-read-badge ${item.is_read ? 'is-read' : 'is-unread'}`}>
                        {item.is_read ? 'Read' : 'Unread'}
                      </span>
                      <button
                        className="np-action-btn np-edit-btn"
                        type="button"
                        onClick={() => openEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        className="np-action-btn np-remove-btn"
                        type="button"
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  </div>
                  <p className="np-message">{item.message || '-'}</p>
                  <div className="np-meta">
                    <span>Type: {item.type || 'general'}</span>
                    <span>Audience: {item.target_audience || 'all'}</span>
                    <span>Created: {formatDate(item.created_at)}</span>
                    <span>Updated: {formatDate(item.updated_at)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {showForm && (
          <div className="np-modal-overlay" onClick={closeForm}>
            <div className="np-modal" onClick={(event) => event.stopPropagation()}>
              <div className="np-modal-head">
                <h3>{editingId ? 'Edit Notification' : 'Create Notification'}</h3>
                <button className="np-close-btn" type="button" onClick={closeForm}>x</button>
              </div>

              <div className="np-form">
                <label className="np-field">
                  <span>Title *</span>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Enter notification title"
                  />
                </label>

                <label className="np-field">
                  <span>Message *</span>
                  <textarea
                    rows="5"
                    value={form.message}
                    onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                    placeholder="Enter notification message"
                  />
                </label>

                <div className="np-field-grid">
                  <label className="np-field">
                    <span>Type</span>
                    <select
                      value={form.type}
                      onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                    >
                      {TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>

                  <label className="np-field">
                    <span>Audience</span>
                    <select
                      value={form.target_audience}
                      onChange={(event) => setForm((prev) => ({ ...prev, target_audience: event.target.value }))}
                    >
                      {AUDIENCE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="np-checkbox-field">
                  <input
                    type="checkbox"
                    checked={form.is_read}
                    onChange={(event) => setForm((prev) => ({ ...prev, is_read: event.target.checked }))}
                  />
                  <span>Mark as read</span>
                </label>

                {saveError && <div className="np-error">{saveError}</div>}

                <div className="np-form-actions">
                  <button className="np-cancel-btn" type="button" onClick={closeForm}>Cancel</button>
                  <button className="np-save-btn" type="button" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Notification'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
