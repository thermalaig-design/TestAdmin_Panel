import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchTrustDetails, updateTrustDetails } from '../services/authService';
import './TrusteesPage.css';

// ── Helpers ──────────────────────────────────────────────────────────────────
const initials = (name = '') =>
  name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'T';
function normalizeRichContent(content = '') {
  return String(content || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<p>\s*<strong>\s*Heading\s*:?\s*<\/strong>\s*/gi, '<p>')
    .replace(/<p>\s*<strong>\s*Description\s*:?\s*<\/strong>\s*/gi, '<p>')
    .replace(/<strong>\s*Heading\s*:?\s*<\/strong>\s*/gi, '')
    .replace(/<strong>\s*Description\s*:?\s*<\/strong>\s*/gi, '')
    .replace(/(^|>|\n)\s*Heading\s*:\s*/gi, '$1')
    .replace(/(^|>|\n)\s*Description\s*:\s*/gi, '$1')
    .trim();
}

// ── Collapsible rich-text section ────────────────────────────────────────────
function ContentSection({
  title,
  content,
  icon,
  accentColor = '#6366F1',
  isEditing = false,
  draftValue = '',
  onDraftChange,
  onEdit,
  onCancel,
  onSave,
  saving = false,
  error = '',
}) {
  const [expanded, setExpanded] = useState(false);
  const hasContent = content && content.trim().length > 0;

  useEffect(() => {
    if (isEditing) setExpanded(true);
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing && !hasContent) setExpanded(false);
  }, [isEditing, hasContent]);

  return (
    <div className={`tp-content-section ${expanded ? 'expanded' : ''}`}>
      <div className="tp-section-header">
        <button
          className="tp-section-toggle"
          onClick={() => setExpanded(p => !p)}
          style={{ '--accent': accentColor }}
          disabled={!hasContent && !isEditing}
          title={
            hasContent
              ? (expanded ? 'Collapse' : 'Expand')
              : (isEditing ? 'Editing' : 'No content added yet')
          }
          type="button"
        >
          <div
            className="tp-section-icon"
            style={{ background: accentColor + '18', color: accentColor }}
          >
            {icon}
          </div>
          <span className="tp-section-title">{title}</span>
          {hasContent && (
            <span
              className="tp-section-badge"
              style={{
                background: accentColor + '20',
                color: accentColor,
              }}
            >
              Available
            </span>
          )}
          {hasContent && (
            <svg
              className={`tp-chevron ${expanded ? 'open' : ''}`}
              width="18" height="18" viewBox="0 0 24 24" fill="none"
            >
              <path d="M6 9l6 6 6-6" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        <div className="tp-section-actions">
          {isEditing ? (
            <>
              <button className="tp-edit-btn ghost" type="button" onClick={onCancel}>
                Cancel
              </button>
              <button
                className="tp-edit-btn primary"
                type="button"
                onClick={onSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <button className="tp-edit-btn" type="button" onClick={onEdit}>
              Edit
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="tp-section-body">
          {isEditing ? (
            <>
              <textarea
                className="tp-content-input"
                rows={8}
                value={draftValue}
                onChange={(e) => onDraftChange?.(e.target.value)}
                placeholder={`Enter ${title}...`}
              />
              {error && <div className="tp-save-error">{error}</div>}
            </>
          ) : (
            hasContent ? (
              <div className="tp-rich-content">
                <div
                  className="tp-rich-text"
                  dangerouslySetInnerHTML={{ __html: normalizeRichContent(content) }}
                />
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function TrusteesPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { userName = 'Admin', trust: trustFromState = null } = location.state || {};
  const trustId = trustFromState?.id || null;

  // Redirect safety
  useEffect(() => {
    if (!trustId) navigate('/dashboard', { replace: true });
  }, [trustId, navigate]);

  if (!trustId) return null;

  const [collapsed,     setCollapsed]     = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [trust,         setTrust]         = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [editMode,      setEditMode]      = useState({ name: false, legal: false, remark: false, logo: false });
  const [draft,         setDraft]         = useState({ name: '', legal_name: '', remark: '', icon_url: '' });
  const [savingField,   setSavingField]   = useState('');
  const [saveError,     setSaveError]     = useState('');
  const [dragOver,      setDragOver]      = useState(false);
  const [editingContent, setEditingContent] = useState(null);
  const [contentDraft,   setContentDraft]   = useState({ terms_content: '', privacy_content: '' });
  const [contentSaving,  setContentSaving]  = useState(false);
  const [contentError,   setContentError]   = useState('');


  // ── Fetch full trust details ─────────────────────────────────────────────
  const loadTrust = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await fetchTrustDetails(trustId);
    if (err) {
      setError(err.message || 'Unable to load trust details.');
      setTrust(null);
    } else {
      setTrust(data || null);
    }
    setLoading(false);
  }, [trustId]);

  useEffect(() => { loadTrust(); }, [loadTrust]);

  const trustName = trust?.name || trustFromState?.name || 'Trust';
  const userInitials = initials(userName);

  const startEdit = (field) => {
    setSaveError('');
    setEditMode({ name: false, legal: false, remark: false, logo: false, [field]: true });
    setDraft({
      name: trust?.name || '',
      legal_name: trust?.legal_name || '',
      remark: trust?.remark || '',
      icon_url: trust?.icon_url || '',
    });
  };

  const cancelEdit = () => {
    setEditMode({ name: false, legal: false, remark: false, logo: false });
    setSaveError('');
    setDragOver(false);
  };

  const handleLogoFile = (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      setSaveError('Please select a valid image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDraft(prev => ({ ...prev, icon_url: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const saveField = async (field) => {
    if (!trustId) return;
    setSavingField(field);
    setSaveError('');

    const updates = {};
    if (field === 'name') updates.name = draft.name.trim();
    if (field === 'legal') updates.legal_name = draft.legal_name.trim();
    if (field === 'remark') updates.remark = draft.remark.trim();
    if (field === 'logo') updates.icon_url = draft.icon_url || '';

    const { data, error: err } = await updateTrustDetails(trustId, updates);
    if (err) {
      setSaveError(err.message || 'Unable to save changes.');
    } else {
      setTrust(data || null);
      cancelEdit();
    }
    setSavingField('');
  };

  const startContentEdit = (field) => {
    setContentError('');
    setEditingContent(field);
    setContentDraft(prev => ({
      ...prev,
      [field]: trust?.[field] || '',
    }));
  };

  const cancelContentEdit = () => {
    setEditingContent(null);
    setContentError('');
  };

  const saveContent = async (field) => {
    if (!trustId) return;
    setContentSaving(true);
    setContentError('');

    const updates = {
      [field]: contentDraft[field] || '',
    };

    const { data, error: err } = await updateTrustDetails(trustId, updates);
    if (err) {
      setContentError(err.message || 'Unable to save content.');
    } else {
      setTrust(data || null);
      setEditingContent(null);
    }
    setContentSaving(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={`tp-root ${collapsed ? 'sidebar-collapsed' : ''}`}>

      {/* ═════════════ SIDEBAR ═════════════ */}
      <aside className="sidebar">

        <div className="sidebar-brand">
          <div className="brand-logo">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L29 9V23L16 30L3 23V9L16 2Z" fill="url(#tpGrad)"/>
              <path d="M16 8L12 18H20L16 24" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="tpGrad" x1="3" y1="2" x2="29" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366F1"/><stop offset="1" stopColor="#8B5CF6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          {!collapsed && (
            <div className="brand-text">
              <span className="brand-name" title={trustName}>{trustName}</span>
              <span className="brand-sub">Admin Panel</span>
            </div>
          )}
        </div>

        <button
          className="collapse-btn"
          onClick={() => setCollapsed(p => !p)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            {collapsed
              ? <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              : <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            }
          </svg>
        </button>

        {!collapsed && <div className="sidebar-section-label">NAVIGATION</div>}

        <nav className="sidebar-nav">
          {/* Dashboard */}
          <button
            className="nav-item active"
            onClick={() => navigate('/dashboard', { state: { userName, trust: trustFromState } })}
            title={collapsed ? 'Dashboard' : ''}
          >
            <span className="nav-icon-wrap">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
                <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
              </svg>
            </span>
            {!collapsed && <span className="nav-label">Dashboard</span>}
            {!collapsed && <span className="nav-indicator"/>}
          </button>
        </nav>

        <div className="sidebar-bottom">
          <button
            id="logout-btn"
            className="sidebar-logout"
            onClick={() => navigate('/login')}
            title={collapsed ? 'Logout' : ''}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ═════════════ MAIN ═════════════ */}
      <main className="dash-main">

        {/* Topbar */}
        <header className="dash-topbar">
          <div className="topbar-left">
            <button
              className="tp-back-btn"
              onClick={() => navigate('/dashboard', { state: { userName, trust: trustFromState } })}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back
            </button>
            <div>
              <h1 className="page-title">Trust Details</h1>
              <p className="page-subtitle">View and manage your trust information</p>
            </div>
          </div>

          <div className="topbar-right">
            <div className={`search-box ${searchFocused ? 'focused' : ''}`}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M11 11l2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                placeholder="Search..."
                className="search-input"
                id="tp-search"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
            </div>
            <div className="avatar-wrap">
              <div className="avatar-btn">{userInitials}</div>
              <div className="avatar-online"/>
            </div>
          </div>
        </header>

        {/* ─── Content ─── */}
        <div className="dash-content">

          {/* ── Loading ── */}
          {loading && (
            <div className="tp-full-skeleton">
              <div className="tp-skel-hero"/>
              <div className="tp-skel-row">
                <div className="tp-skel-card"/>
                <div className="tp-skel-card"/>
              </div>
              <div className="tp-skel-section"/>
              <div className="tp-skel-section"/>
            </div>
          )}

          {/* ── Error ── */}
          {!loading && error && (
            <div className="tp-error">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>{error}</span>
              <button onClick={loadTrust}>Retry</button>
            </div>
          )}

          {/* ── Trust Details ── */}
          {!loading && !error && trust && (
            <>
              {/* ── HERO CARD ── */}
              <div className="tp-hero-card">
                {/* Background orbs */}
                <div className="tp-hero-orb tp-hero-orb-1"/>
                <div className="tp-hero-orb tp-hero-orb-2"/>

                {/* Logo / Icon */}
                <div className="tp-hero-left">
                  <div className="tp-logo-wrap">
                    {trust.icon_url ? (
                      <img
                        src={trust.icon_url}
                        alt={trust.name}
                        className="tp-logo-img"
                        onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="tp-logo-initials">{initials(trust.name)}</span>
                    )}
                  </div>

                  <div className="tp-hero-info">
                    <h2 className="tp-hero-name">{trust.name}</h2>
                    {trust.remark && (
                      <p className="tp-hero-remark">{trust.remark}</p>
                    )}
                  </div>
                </div>

              </div>

              {/* ── INFO GRID ── */}
              <div className="tp-info-grid">
                <section className="tp-info-group">
                  <div className="tp-info-group-head">
                    <h3>App Design</h3>
                    <p>App name, subheading and logo/icon settings</p>
                  </div>
                  <div className="tp-info-group-cards">
                    {/* App Name */}
                    <div className="tp-info-card tp-info-card-remark">
                  <div className="tp-info-icon" style={{ background: '#EEF2FF', color: '#6366F1' }}>
                    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                      <path d="M16 2L29 9V23L16 30L3 23V9L16 2Z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round"/>
                      <path d="M16 9L13 17H19L16 23" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="tp-info-body">
                    <span className="tp-info-label">App Name</span>
                    {!editMode.name ? (
                      <span className="tp-info-value">{trust.name || '—'}</span>
                    ) : (
                      <input
                        className="tp-edit-input"
                        value={draft.name}
                        onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
                        placeholder="Enter app name"
                      />
                    )}
                  </div>
                  <div className="tp-info-actions">
                    {!editMode.name ? (
                      <button className="tp-edit-btn" onClick={() => startEdit('name')}>Edit</button>
                    ) : (
                      <div className="tp-edit-actions">
                        <button className="tp-edit-btn ghost" onClick={cancelEdit}>Cancel</button>
                        <button
                          className="tp-edit-btn primary"
                          onClick={() => saveField('name')}
                          disabled={savingField === 'name'}
                        >
                          {savingField === 'name' ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    )}
                  </div>
                    </div>

                    {/* Subheading / Remark */}
                    <div className="tp-info-card">
                  <div className="tp-info-icon" style={{ background: '#ECFDF5', color: '#059669' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <line x1="17" y1="10" x2="3" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      <line x1="21" y1="6" x2="3" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      <line x1="21" y1="14" x2="3" y2="14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      <line x1="17" y1="18" x2="3" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="tp-info-body">
                    <span className="tp-info-label">Subheading / Remark</span>
                    {!editMode.remark ? (
                      <span className="tp-info-value tp-remark-value">{trust.remark || '—'}</span>
                    ) : (
                      <textarea
                        className="tp-edit-textarea"
                        rows={2}
                        value={draft.remark}
                        onChange={e => setDraft(p => ({ ...p, remark: e.target.value }))}
                        placeholder="Enter remark"
                      />
                    )}
                  </div>
                  <div className="tp-info-actions">
                    {!editMode.remark ? (
                      <button className="tp-edit-btn" onClick={() => startEdit('remark')}>Edit</button>
                    ) : (
                      <div className="tp-edit-actions">
                        <button className="tp-edit-btn ghost" onClick={cancelEdit}>Cancel</button>
                        <button
                          className="tp-edit-btn primary"
                          onClick={() => saveField('remark')}
                          disabled={savingField === 'remark'}
                        >
                          {savingField === 'remark' ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    )}
                  </div>
                    </div>

                    {/* Icon */}
                    <div className="tp-info-card">
                  <div className="tp-info-icon" style={{ background: '#FFF7ED', color: '#EA580C' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8"/>
                      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                      <polyline points="21 15 16 10 5 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="tp-info-body">
                    <span className="tp-info-label">Logo / Icon</span>
                    {!editMode.logo ? (
                      <div className="tp-logo-preview">
                        {trust.icon_url ? (
                          <img
                            src={trust.icon_url}
                            alt="Trust Logo"
                            className="tp-logo-preview-img"
                            onError={e => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <span className="tp-logo-fallback">{initials(trust.name)}</span>
                        )}
                      </div>
                    ) : (
                      <div className="tp-logo-edit">
                        <label
                          className={`tp-logo-drop ${dragOver ? 'drag' : ''}`}
                          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={e => { e.preventDefault(); setDragOver(false); handleLogoFile(e.dataTransfer.files[0]); }}
                        >
                          <input
                            className="tp-logo-input"
                            type="file"
                            accept="image/*"
                            onChange={e => handleLogoFile(e.target.files?.[0])}
                          />
                          <div className="tp-logo-drop-inner">
                            <span>Drag & drop logo here</span>
                            <span className="tp-logo-drop-sub">or click to upload</span>
                          </div>
                        </label>
                        {draft.icon_url && (
                          <div className="tp-logo-preview sm">
                            <img src={draft.icon_url} alt="Preview" className="tp-logo-preview-img" />
                            <button
                              type="button"
                              className="tp-logo-clear"
                              onClick={() => setDraft(p => ({ ...p, icon_url: '' }))}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="tp-info-actions">
                    {!editMode.logo ? (
                      <button className="tp-edit-btn" onClick={() => startEdit('logo')}>Edit</button>
                    ) : (
                      <div className="tp-edit-actions">
                        <button className="tp-edit-btn ghost" onClick={cancelEdit}>Cancel</button>
                        <button
                          className="tp-edit-btn primary"
                          onClick={() => saveField('logo')}
                          disabled={savingField === 'logo'}
                        >
                          {savingField === 'logo' ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    )}
                  </div>
                    </div>
                  </div>
                </section>

                <section className="tp-info-group">
                  <div className="tp-info-group-head">
                    <h3>Company Details</h3>
                    <p>Manage legal and business related details</p>
                  </div>
                  <div className="tp-info-group-cards">
                    {/* Legal Name */}
                    <div className="tp-info-card tp-info-card-legal">
                      <div className="tp-info-icon" style={{ background: '#FDF4FF', color: '#9333EA' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                          <line x1="8" y1="17" x2="14" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <div className="tp-info-body">
                        <span className="tp-info-label">Legal Name</span>
                        {!editMode.legal ? (
                          <span className="tp-info-value tp-legal-value">{trust.legal_name || '—'}</span>
                        ) : (
                          <input
                            className="tp-edit-input"
                            value={draft.legal_name}
                            onChange={e => setDraft(p => ({ ...p, legal_name: e.target.value }))}
                            placeholder="Enter legal name"
                          />
                        )}
                      </div>
                      <div className="tp-info-actions">
                        {!editMode.legal ? (
                          <button className="tp-edit-btn" onClick={() => startEdit('legal')}>Edit</button>
                        ) : (
                          <div className="tp-edit-actions">
                            <button className="tp-edit-btn ghost" onClick={cancelEdit}>Cancel</button>
                            <button
                              className="tp-edit-btn primary"
                              onClick={() => saveField('legal')}
                              disabled={savingField === 'legal'}
                            >
                              {savingField === 'legal' ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {saveError && (
                  <div className="tp-save-error">{saveError}</div>
                )}
              </div>

              {/* ── CONTENT SECTIONS (Terms & Privacy) ── */}
              <div className="tp-sections-wrap">
                <ContentSection
                  title="Terms & Conditions"
                  content={trust.terms_content}
                  accentColor="#6366F1"
                  isEditing={editingContent === 'terms_content'}
                  draftValue={contentDraft.terms_content}
                  onDraftChange={(value) =>
                    setContentDraft(prev => ({ ...prev, terms_content: value }))
                  }
                  onEdit={() => startContentEdit('terms_content')}
                  onCancel={cancelContentEdit}
                  onSave={() => saveContent('terms_content')}
                  saving={contentSaving && editingContent === 'terms_content'}
                  error={editingContent === 'terms_content' ? contentError : ''}
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  }
                />

                <ContentSection
                  title="Privacy Policy"
                  content={trust.privacy_content}
                  accentColor="#8B5CF6"
                  isEditing={editingContent === 'privacy_content'}
                  draftValue={contentDraft.privacy_content}
                  onDraftChange={(value) =>
                    setContentDraft(prev => ({ ...prev, privacy_content: value }))
                  }
                  onEdit={() => startContentEdit('privacy_content')}
                  onCancel={cancelContentEdit}
                  onSave={() => saveContent('privacy_content')}
                  saving={contentSaving && editingContent === 'privacy_content'}
                  error={editingContent === 'privacy_content' ? contentError : ''}
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  }
                />
              </div>
            </>
          )}

          {/* ── No data ── */}
          {!loading && !error && !trust && (
            <div className="tp-error">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>Trust details not found.</span>
              <button onClick={loadTrust}>Retry</button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}



