import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import {
  deleteShareAppLinksByTrust,
  fetchShareAppLinksByTrust,
  upsertShareAppLinksByTrust,
} from '../services/shareAppLinksService';
import './SimplePage.css';

function formatDateTime(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export default function ShareAppPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null, superuserId = null } = location.state || {};
  const trustName = trust?.name || 'Trust';

  const [playStoreLink, setPlayStoreLink] = useState('');
  const [appStoreLink, setAppStoreLink] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [lastSaved, setLastSaved] = useState({ playStoreLink: '', appStoreLink: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const playInputRef = useRef(null);

  const loadLinks = useCallback(async () => {
    if (!trust?.id) return;
    setLoading(true);
    setError('');

    const { data, error: fetchError } = await fetchShareAppLinksByTrust(trust.id);
    if (fetchError) {
      setError(fetchError.message || 'Unable to load app links.');
      setLoading(false);
      return;
    }

    setPlayStoreLink(data?.playStoreLink || '');
    setAppStoreLink(data?.appStoreLink || '');
    setCreatedAt(data?.createdAt || '');
    setUpdatedAt(data?.updatedAt || '');
    setLastSaved({
      playStoreLink: data?.playStoreLink || '',
      appStoreLink: data?.appStoreLink || '',
    });
    setIsEditing(!data);
    setLoading(false);
  }, [trust?.id]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const handleSave = async (event) => {
    event.preventDefault();
    if (!trust?.id) {
      setError('Trust not found. Please re-open from dashboard.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    const { data, error: upsertError } = await upsertShareAppLinksByTrust({
      trust_id: trust.id,
      play_store_link: playStoreLink,
      app_store_link: appStoreLink,
    });

    if (upsertError) {
      setError(upsertError.message || 'Unable to save app links.');
      setSaving(false);
      return;
    }

    setPlayStoreLink(data?.playStoreLink || '');
    setAppStoreLink(data?.appStoreLink || '');
    setCreatedAt(data?.createdAt || '');
    setUpdatedAt(data?.updatedAt || '');
    setLastSaved({
      playStoreLink: data?.playStoreLink || '',
      appStoreLink: data?.appStoreLink || '',
    });
    setIsEditing(false);
    setSuccess('Share app links saved successfully.');
    setSaving(false);
  };

  const handleEdit = () => {
    setError('');
    setSuccess('');
    setIsEditing(true);
    window.setTimeout(() => {
      playInputRef.current?.focus();
      playInputRef.current?.setSelectionRange?.(
        String(playInputRef.current?.value || '').length,
        String(playInputRef.current?.value || '').length
      );
    }, 0);
  };

  const handleCancel = () => {
    setPlayStoreLink(lastSaved.playStoreLink || '');
    setAppStoreLink(lastSaved.appStoreLink || '');
    setError('');
    setSuccess('');
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!trust?.id) {
      setError('Trust not found. Please re-open from dashboard.');
      return;
    }

    const confirmed = window.confirm('Are you sure you want to delete both app links for this trust?');
    if (!confirmed) return;

    setDeleting(true);
    setError('');
    setSuccess('');

    const { error: deleteError } = await deleteShareAppLinksByTrust(trust.id);
    if (deleteError) {
      setError(deleteError.message || 'Unable to delete app links.');
      setDeleting(false);
      return;
    }

    setPlayStoreLink('');
    setAppStoreLink('');
    setCreatedAt('');
    setUpdatedAt('');
    setLastSaved({ playStoreLink: '', appStoreLink: '' });
    setIsEditing(true);
    setSuccess('Share app links deleted successfully.');
    setDeleting(false);
  };

  return (
    <div className="simple-root">
      <Sidebar
        trustName={trustName}
        onDashboard={() =>
          navigate('/dashboard', {
            state: {
              userName,
              trust,
              superuserId,
              sidebarNavKey: 'dashboard',
            },
          })
        }
        onLogout={() => navigate('/login')}
      />

      <main className="simple-main">
        <PageHeader
          title="Share App"
          subtitle="Data is now fetched and inserted from the share app links table"
          onBack={() =>
            navigate('/dashboard', {
              state: {
                userName,
                trust,
                superuserId,
                sidebarNavKey: 'dashboard',
              },
            })
          }
        />
        <div className="simple-content">
          <div className="simple-card">
            <div className="simple-head">
              <div>
                <h2 className="simple-title">Share App</h2>
                <p className="simple-subtitle">Manage app listing links for your trust.</p>
              </div>
              <div className="simple-head-badge">Trust Setup</div>
            </div>

            {error && <div className="simple-msg simple-msg-error">{error}</div>}
            {success && <div className="simple-msg simple-msg-success">{success}</div>}

            {loading ? (
              <p style={{ margin: 0 }}>Loading app links...</p>
            ) : (
              <form className="simple-form" onSubmit={handleSave}>
                <label className="simple-field">
                  <span>Play Store Link</span>
                  <div className="simple-input-wrap">
                    <div className="simple-prefix simple-prefix-play">Play</div>
                    <input
                      ref={playInputRef}
                      type="url"
                      value={playStoreLink}
                      onChange={(e) => setPlayStoreLink(e.target.value)}
                      placeholder="https://play.google.com/store/apps/details?id=..."
                      disabled={!isEditing}
                      aria-disabled={!isEditing}
                    />
                  </div>
                </label>

                <label className="simple-field">
                  <span>App Store Link</span>
                  <div className="simple-input-wrap">
                    <div className="simple-prefix simple-prefix-apple">App</div>
                    <input
                      type="url"
                      value={appStoreLink}
                      onChange={(e) => setAppStoreLink(e.target.value)}
                      placeholder="https://apps.apple.com/..."
                      disabled={!isEditing}
                      aria-disabled={!isEditing}
                    />
                  </div>
                </label>

                {(createdAt || updatedAt) && (
                  <div className="simple-meta">
                    {createdAt && <div><strong>Created At:</strong> {formatDateTime(createdAt)}</div>}
                    {updatedAt && <div><strong>Updated At:</strong> {formatDateTime(updatedAt)}</div>}
                  </div>
                )}

                <div className="simple-actions">
                  {!isEditing ? (
                    <>
                      <button type="button" className="simple-btn-secondary" onClick={handleEdit}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="simple-btn-danger"
                        onClick={handleDelete}
                        disabled={deleting}
                      >
                        {deleting ? 'Deleting...' : 'Delete'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="submit" disabled={saving}>
                        {saving ? 'Saving...' : 'Save Links'}
                      </button>
                      <button
                        type="button"
                        className="simple-btn-muted"
                        onClick={handleCancel}
                        disabled={saving || deleting}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
