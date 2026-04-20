import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import {
  createMarqueeUpdate,
  deleteMarqueeUpdate,
  fetchMarqueeUpdatesByTrust,
  getCachedMarqueeUpdatesByTrust,
  updateMarqueeUpdate,
} from '../services/marqueeService';
import './MarqueePage.css';

const EMPTY_FORM = {
  message: '',
  is_active: true,
  priority: 0,
};
const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
];

function formatDateTime(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MarqueePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'dashboard';
  const trustId = trust?.id || null;
  const initialCached = getCachedMarqueeUpdatesByTrust(trustId);
  const [updates, setUpdates] = useState(initialCached?.data || []);
  const [loading, setLoading] = useState(!initialCached);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!trustId) {
      navigate('/dashboard', { replace: true, state: { userName, trust } });
      return;
    }

    const load = async () => {
      const cached = getCachedMarqueeUpdatesByTrust(trustId);
      if (cached?.data) {
        setUpdates(cached.data);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError('');
      const { data, error: fetchError } = await fetchMarqueeUpdatesByTrust(trustId);
      if (fetchError) setError(fetchError.message || 'Unable to load marquee updates.');
      setUpdates(data || []);
      setLoading(false);
    };

    load();
  }, [trustId, trust, userName, navigate]);

  const activeCount = useMemo(
    () => updates.filter((item) => item.is_active).length,
    [updates]
  );
  const inactiveCount = useMemo(
    () => updates.filter((item) => !item.is_active).length,
    [updates]
  );
  const filteredUpdates = useMemo(() => {
    if (statusFilter === 'active') return updates.filter((item) => item.is_active);
    if (statusFilter === 'inactive') return updates.filter((item) => !item.is_active);
    return updates;
  }, [updates, statusFilter]);
  const countByFilter = useMemo(() => ({
    all: updates.length,
    active: activeCount,
    inactive: inactiveCount,
  }), [updates.length, activeCount, inactiveCount]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSaveError('');
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({
      message: item.message || '',
      is_active: item.is_active !== false,
      priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : 0,
    });
    setSaveError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    const message = String(form.message || '').trim();
    if (!message) {
      setSaveError('Message is required.');
      return;
    }

    const payload = {
      message,
      is_active: !!form.is_active,
      priority: Number.isFinite(Number(form.priority)) ? Number(form.priority) : 0,
    };

    setSaving(true);
    setSaveError('');

    if (editingId) {
      const { data, error: updateError } = await updateMarqueeUpdate(editingId, payload);
      if (updateError) {
        setSaveError(updateError.message || 'Unable to update marquee message.');
      } else if (data) {
        setUpdates((prev) => prev.map((item) => (item.id === data.id ? data : item)));
        setShowForm(false);
      }
    } else {
      const { data, error: createError } = await createMarqueeUpdate({
        trust_id: trustId,
        ...payload,
      });
      if (createError) {
        setSaveError(createError.message || 'Unable to create marquee message.');
      } else if (data) {
        setUpdates((prev) => [data, ...prev]);
        setShowForm(false);
      }
    }

    setSaving(false);
  };

  const handleToggleStatus = async (item) => {
    if (!item?.id) return;
    setTogglingId(item.id);
    setError('');
    const { data, error: toggleError } = await updateMarqueeUpdate(item.id, {
      is_active: !item.is_active,
    });
    if (toggleError) {
      setError(toggleError.message || 'Unable to update status.');
    } else if (data) {
      setUpdates((prev) => prev.map((entry) => (entry.id === data.id ? data : entry)));
    }
    setTogglingId(null);
  };

  const handleDelete = async (item) => {
    if (!item?.id) return;
    const ok = window.confirm('Delete this marquee announcement? This action cannot be undone.');
    if (!ok) return;

    setDeletingId(item.id);
    setError('');
    const { error: deleteError } = await deleteMarqueeUpdate(item.id);
    if (deleteError) {
      setError(deleteError.message || 'Unable to delete marquee announcement.');
    } else {
      setUpdates((prev) => prev.filter((entry) => entry.id !== item.id));
      if (editingId === item.id) {
        setShowForm(false);
        setEditingId(null);
      }
    }
    setDeletingId(null);
  };

  if (!trustId) return null;

  return (
    <div className="marquee-root">
      <Sidebar
        trustName={trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
        onLogout={() => navigate('/login')}
      />
      <main className="marquee-main">
        <PageHeader
          title="Marquee"
          subtitle="Manage scrolling marquee announcements"
          onBack={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
          right={<button className="marquee-add-btn" onClick={openCreate}>Create Marquee</button>}
        />

        <div className="marquee-content">
          {error && <div className="marquee-error">{error}</div>}

          <section className="marquee-hero">
            <div className="marquee-hero-copy">
              <span className="marquee-kicker">Live Banner Feed</span>
              <h2>Marquee updates for {trust?.name || 'this trust'}</h2>
            </div>
            <div className="marquee-hero-side">
              <div className="marquee-stats">
              <div className="marquee-stat-card">
                <span>Total Updates</span>
                <strong>{updates.length}</strong>
              </div>
              <div className="marquee-stat-card">
                <span>Active</span>
                <strong>{activeCount}</strong>
              </div>
            </div>
            </div>
          </section>

          <section className="marquee-toolbar">
            <div className="marquee-filter-group" role="tablist" aria-label="Filter marquee updates">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  className={`marquee-filter-btn ${statusFilter === option.key ? 'active' : ''}`}
                  type="button"
                  onClick={() => setStatusFilter(option.key)}
                >
                  {option.label} <span>{countByFilter[option.key]}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="marquee-list">
            {loading && <div className="marquee-loading">Loading marquee updates...</div>}

            {!loading && filteredUpdates.length === 0 && (
              <div className="marquee-empty">
                <h3>No marquee announcements found</h3>
                <p>Create an announcement with message, status, and priority.</p>
                <button className="marquee-add-btn" onClick={openCreate}>Create Marquee</button>
              </div>
            )}

            {!loading && filteredUpdates.length > 0 && filteredUpdates.map((item) => (
              <article key={item.id} className="marquee-card">
                <div className="marquee-card-head">
                  <span className={`marquee-status ${item.is_active ? 'active' : 'inactive'}`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="marquee-priority">Priority: {item.priority}</span>
                </div>
                <p className="marquee-message">{item.message}</p>
                <div className="marquee-meta">
                  <span>Created: {formatDateTime(item.created_at)}</span>
                  <span>Updated: {formatDateTime(item.updated_at || item.created_at)}</span>
                </div>
                <div className="marquee-actions">
                  <button
                    className="marquee-secondary-btn"
                    type="button"
                    onClick={() => handleToggleStatus(item)}
                    disabled={togglingId === item.id}
                  >
                    {togglingId === item.id ? 'Updating...' : item.is_active ? 'Set Inactive' : 'Set Active'}
                  </button>
                  <button
                    className="marquee-primary-btn"
                    type="button"
                    onClick={() => openEdit(item)}
                  >
                    Edit
                  </button>
                  <button
                    className="marquee-danger-btn"
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </article>
            ))}
          </section>
        </div>

        {showForm && (
          <div className="marquee-modal-overlay" onClick={() => setShowForm(false)}>
            <div className="marquee-modal" onClick={(event) => event.stopPropagation()}>
              <div className="marquee-modal-head">
                <h3>{editingId ? 'Edit Marquee Announcement' : 'Create Marquee Announcement'}</h3>
                <button className="marquee-close-btn" type="button" onClick={() => setShowForm(false)}>x</button>
              </div>

              <div className="marquee-form">
                <label className="marquee-field">
                  <span>Message *</span>
                  <textarea
                    rows="5"
                    value={form.message}
                    onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
                    placeholder="Enter marquee message..."
                  />
                </label>

                <label className="marquee-field">
                  <span>Status</span>
                  <select
                    value={form.is_active ? 'active' : 'inactive'}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, is_active: event.target.value === 'active' }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>

                <label className="marquee-field">
                  <span>Priority</span>
                  <input
                    type="number"
                    value={form.priority}
                    onChange={(event) => setForm((prev) => ({ ...prev, priority: Number(event.target.value) }))}
                  />
                </label>

                {saveError && <div className="marquee-error">{saveError}</div>}

                <div className="marquee-form-actions">
                  <button className="marquee-secondary-btn" type="button" onClick={() => setShowForm(false)}>Cancel</button>
                  <button className="marquee-primary-btn" type="button" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Marquee'}
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
