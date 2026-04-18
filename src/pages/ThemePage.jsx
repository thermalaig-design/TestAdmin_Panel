import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import { fetchTrustDetails, updateTrustInfo } from '../services/trustService';
import { assignTemplateToTrust, createTemplate, fetchTemplates, updateTemplate } from '../services/themeService';
import './ThemePage.css';

const EMPTY_FORM = {
  name: '',
  description: '',
  template_key: 'mahila',
  primary_color: '#C0241A',
  secondary_color: '#2B2F7E',
  accent_color: '#FDECEA',
  accent_bg: '#EAEBF8',
  navbar_bg: 'rgba(234,235,248,0.88)',
  page_bg: 'linear-gradient(160deg,#fff5f5 0%,#ffffff 50%,#f0f1fb 100%)',
  home_layout: '["gallery","quickActions","sponsors"]',
  animations: '{"cards":"fadeUp","navbar":"fadeSlideDown","gallery":"zoomIn"}',
  custom_css: '',
  is_active: true,
};

const pretty = (value, fallback) => JSON.stringify(value ?? fallback, null, 2);
const parseJson = (value, fallback) => (!String(value || '').trim() ? fallback : JSON.parse(value));
const previewBg = (theme) => `linear-gradient(135deg, ${theme.primary_color || '#C0241A'} 0%, ${theme.secondary_color || '#2B2F7E'} 100%)`;
const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const HOME_LAYOUT_OPTIONS = [
  { key: 'gallery', label: 'Gallery' },
  { key: 'quickActions', label: 'Quick Actions' },
  { key: 'sponsors', label: 'Sponsors' },
  { key: 'marquee', label: 'Marquee' },
  { key: 'trustList', label: 'Trust List' },
];
const normalizePickerColor = (value, fallback) => (HEX_COLOR_RE.test(String(value || '').trim()) ? String(value).trim() : fallback);
const normalizePreviewPaint = (value, fallback) => {
  const trimmed = String(value || '').trim();
  return trimmed || fallback;
};
const createLayoutOrderMap = (layout = []) => {
  const parsedLayout = Array.isArray(layout) ? layout : [];
  const nextMap = {};
  HOME_LAYOUT_OPTIONS.forEach((item) => {
    const index = parsedLayout.findIndex((entry) => String(entry || '').trim() === item.key);
    nextMap[item.key] = index >= 0 ? index + 1 : '';
  });
  return nextMap;
};

export default function ThemePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'dashboard';
  const trustId = trust?.id || null;
  const [currentTrust, setCurrentTrust] = useState(trust);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [assigningId, setAssigningId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [homeLayoutOrder, setHomeLayoutOrder] = useState(createLayoutOrderMap(['gallery', 'quickActions', 'sponsors']));

  useEffect(() => {
    if (!trustId) navigate('/dashboard', { replace: true, state: { userName, trust } });
  }, [trustId, userName, trust, navigate]);

  useEffect(() => {
    const load = async () => {
      if (!trustId) return;
      setLoading(true);
      setError('');
      const [{ data: templateData, error: templateErr }, { data: trustData, error: trustErr }] = await Promise.all([
        fetchTemplates(),
        fetchTrustDetails(trustId),
      ]);
      if (templateErr) setError(templateErr.message || 'Unable to load templates.');
      if (trustErr) setError(trustErr.message || 'Unable to load trust theme.');
      setTemplates(templateData || []);
      setCurrentTrust(trustData || trust);
      setLoading(false);
    };
    load();
  }, [trustId, trust]);



  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return templates;
    return templates.filter((item) =>
      [item.name, item.description, item.template_key].some((v) => String(v || '').toLowerCase().includes(term))
    );
  }, [templates, searchTerm]);

  const myTemplates = useMemo(() => filtered.filter((item) => item.trust_id === trustId), [filtered, trustId]);
  const otherTemplates = useMemo(() => filtered.filter((item) => item.trust_id !== trustId), [filtered, trustId]);
  const activeTemplateId = currentTrust?.template_id || null;
  const selectedTemplate = useMemo(() => templates.find((item) => item.id === selectedId) || null, [templates, selectedId]);
  const detailTemplate = useMemo(() => templates.find((item) => item.id === detailId) || null, [templates, detailId]);
  const canEdit = (item) => item?.trust_id === trustId;
  useEffect(() => {
    if (!selectedTemplate) {
      setForm(EMPTY_FORM);
      setHomeLayoutOrder(createLayoutOrderMap(['gallery', 'quickActions', 'sponsors']));
      return;
    }
    const nextHomeLayout = Array.isArray(selectedTemplate.home_layout)
      ? selectedTemplate.home_layout
      : ['gallery', 'quickActions', 'sponsors'];
    setForm({
      name: selectedTemplate.name || '',
      description: selectedTemplate.description || '',
      template_key: selectedTemplate.template_key || 'mahila',
      primary_color: selectedTemplate.primary_color || '#C0241A',
      secondary_color: selectedTemplate.secondary_color || '#2B2F7E',
      accent_color: selectedTemplate.accent_color || '#FDECEA',
      accent_bg: selectedTemplate.accent_bg || '#EAEBF8',
      navbar_bg: selectedTemplate.navbar_bg || 'rgba(234,235,248,0.88)',
      page_bg: selectedTemplate.page_bg || 'linear-gradient(160deg,#fff5f5 0%,#ffffff 50%,#f0f1fb 100%)',
      home_layout: pretty(nextHomeLayout, ['gallery', 'quickActions', 'sponsors']),
      animations: pretty(selectedTemplate.animations, { cards: 'fadeUp', navbar: 'fadeSlideDown', gallery: 'zoomIn' }),
      custom_css: selectedTemplate.custom_css || '',
      is_active: selectedTemplate.is_active !== false,
    });
    setHomeLayoutOrder(createLayoutOrderMap(nextHomeLayout));
  }, [selectedTemplate]);

  const openCreate = () => {
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setHomeLayoutOrder(createLayoutOrderMap(['gallery', 'quickActions', 'sponsors']));
    setSaveError('');
    setShowForm(true);
    setShowPicker(false);
  };

  const openEdit = (id) => {
    setSelectedId(id);
    setSaveError('');
    setShowForm(true);
    setShowPicker(false);
    setShowDetail(false);
  };

  const openDetail = (id) => {
    setDetailId(id);
    setShowDetail(true);
  };

  const handleAssign = async (template) => {
    if (!template?.id || !trustId) return;
    setSaveError('');
    setAssigningId(template.id);
    const overrides = currentTrust?.theme_overrides && typeof currentTrust.theme_overrides === 'object'
      ? currentTrust.theme_overrides
      : {};
    const { data, error: assignErr } = await assignTemplateToTrust(trustId, template.id, overrides);
    if (assignErr) {
      setSaveError(assignErr.message || 'Unable to apply template.');
    } else {
      setCurrentTrust((prev) => ({ ...(prev || {}), ...(data || {}), template_id: template.id, theme_overrides: overrides }));
      setShowPicker(false);
      setShowDetail(false);
    }
    setAssigningId(null);
  };



  const handleSave = async () => {
    setSaveError('');
    if (!form.name.trim()) {
      setSaveError('Theme name is required.');
      return;
    }
    let homeLayout;
    let animations;
    homeLayout = HOME_LAYOUT_OPTIONS
      .map((item) => ({
        key: item.key,
        order: Number(homeLayoutOrder[item.key]) || 0,
      }))
      .filter((item) => item.order > 0)
      .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
      .map((item) => item.key);
    if (!homeLayout.length) {
      setSaveError('Home layout mein kam se kam ek section order dena zaroori hai.');
      return;
    }
    try { animations = parseJson(form.animations, { cards: 'fadeUp', navbar: 'fadeSlideDown', gallery: 'zoomIn' }); }
    catch { setSaveError('Animations must be valid JSON.'); return; }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      template_key: form.template_key.trim() || 'mahila',
      primary_color: form.primary_color.trim() || '#C0241A',
      secondary_color: form.secondary_color.trim() || '#2B2F7E',
      accent_color: form.accent_color.trim() || '#FDECEA',
      accent_bg: form.accent_bg.trim() || '#EAEBF8',
      navbar_bg: form.navbar_bg.trim() || 'rgba(234,235,248,0.88)',
      page_bg: form.page_bg.trim() || 'linear-gradient(160deg,#fff5f5 0%,#ffffff 50%,#f0f1fb 100%)',
      home_layout: homeLayout,
      animations,
      custom_css: form.custom_css || '',
      is_active: !!form.is_active,
      trust_id: trustId,
    };

    setSaving(true);
    if (selectedId) {
      if (!canEdit(selectedTemplate)) {
        setSaveError('You can only edit themes linked to your trust.');
        setSaving(false);
        return;
      }
      const { data, error: updateErr } = await updateTemplate(selectedId, payload);
      if (updateErr) setSaveError(updateErr.message || 'Unable to update theme.');
      else if (data) {
        setTemplates((prev) => prev.map((item) => item.id === selectedId ? data : item));
        setShowForm(false);
      }
    } else {
      const { data, error: createErr } = await createTemplate(payload);
      if (createErr) setSaveError(createErr.message || 'Unable to create theme.');
      else if (data) {
        setTemplates((prev) => [data, ...prev]);
        setSelectedId(data.id);
        setShowForm(false);
        setShowPicker(true);
      }
    }
    setSaving(false);
  };

  const renderColorField = (key, label, fallback) => (
    <label className="theme-field theme-color-field" key={key}>
      <span>{label}</span>
      <div className="theme-color-input-shell">
        <input
          className="theme-color-text"
          value={form[key]}
          onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
        />
        <input
          className="theme-color-native"
          id={`theme-color-picker-${key}`}
          type="color"
          aria-label={`${label} picker`}
          value={normalizePickerColor(form[key], fallback)}
          onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
        />
      </div>
    </label>
  );

  const renderPaintField = (key, label, pickerFallback) => (
    <label className="theme-field theme-color-field" key={key}>
      <span>{label}</span>
      <div className="theme-color-input-shell">
        <input
          className="theme-color-text"
          value={form[key]}
          onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
        />
        <input
          className="theme-color-native"
          id={`theme-color-picker-${key}`}
          type="color"
          aria-label={`${label} picker`}
          value={normalizePickerColor(form[key], pickerFallback)}
          onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
        />
      </div>
    </label>
  );

  const openColorPicker = (key) => {
    const picker = document.getElementById(`theme-color-picker-${key}`);
    if (picker) picker.click();
  };

  const renderHomeLayoutField = () => (
    <div className="theme-field theme-span-2" key="home_layout_order">
      <span>Home Layout Order</span>
      <div className="theme-layout-order-card">
        <div className="theme-layout-order-list">
          {HOME_LAYOUT_OPTIONS.map((item) => (
            <label className="theme-layout-order-row" key={item.key}>
              <div className="theme-layout-order-copy">
                <strong>{item.label}</strong>
                <small>{item.key}</small>
              </div>
              <input
                type="number"
                min="0"
                placeholder="-"
                value={homeLayoutOrder[item.key]}
                onChange={(e) => {
                  const rawValue = e.target.value;
                  setHomeLayoutOrder((prev) => ({ ...prev, [item.key]: rawValue === '' ? '' : Math.max(0, Number(rawValue) || 0) }));
                }}
              />
            </label>
          ))}
        </div>
        <label className="theme-field">
          <span>Generated Home Layout JSON</span>
          <textarea rows="4" value={form.home_layout} readOnly />
        </label>
      </div>
    </div>
  );

  useEffect(() => {
    const generatedLayout = HOME_LAYOUT_OPTIONS
      .map((item) => ({
        key: item.key,
        order: Number(homeLayoutOrder[item.key]) || 0,
      }))
      .filter((item) => item.order > 0)
      .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
      .map((item) => item.key);
    setForm((prev) => {
      const nextHomeLayout = pretty(generatedLayout, []);
      if (prev.home_layout === nextHomeLayout) return prev;
      return { ...prev, home_layout: nextHomeLayout };
    });
  }, [homeLayoutOrder]);

  if (!trustId) return null;

  return (
    <div className="theme-root">
      <Sidebar
        trustName={currentTrust?.name || trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust: currentTrust || trust, sidebarNavKey: currentSidebarNavKey } })}
        onLogout={() => navigate('/login')}
      />
      <main className="theme-main">
        <PageHeader
          title="Theme"
          subtitle="Manage templates and trust theme selection"
          onBack={() => navigate('/dashboard', { state: { userName, trust: currentTrust || trust, sidebarNavKey: currentSidebarNavKey } })}
          right={<button className="theme-add-btn" onClick={() => setShowPicker(true)}>Select Theme</button>}
        />

        {error && <div className="theme-error">{error}</div>}
        {saveError && <div className="theme-error">{saveError}</div>}

        <div className={`theme-content ${showForm ? 'form-only' : ''}`}>
          {!showForm && (
            <>
          <section className="theme-hero">
            <div className="theme-hero-copy">
              <span className="theme-kicker">Theme manager</span>
              <h2>Create templates and assign a live theme to this trust.</h2>
              <p>
                This module follows the sponsor flow: list, pick, inspect, create, edit, and apply.
                Use it to manage `app_templates` and connect one to {currentTrust?.name || trust?.name || 'your trust'}.
              </p>
            </div>
            <div className="theme-hero-stats">
              <div className="theme-stat-card"><span>Templates</span><strong>{templates.length}</strong></div>
              <div className="theme-stat-card"><span>Active template</span><strong>{activeTemplateId ? 'Assigned' : 'None'}</strong></div>

            </div>
          </section>

          <section className="theme-list">
            {loading && <div className="theme-loading">Loading themes...</div>}
            {!loading && templates.filter((item) => item.is_active !== false).length === 0 && (
              <div className="theme-empty">
                <div className="theme-empty-icon">T</div>
                <h3>No themes yet</h3>
                <p>Create your first theme template to get started.</p>
                <button className="theme-add-btn" onClick={openCreate}>Create Theme</button>
              </div>
            )}
            {!loading && templates.filter((item) => item.is_active !== false).map((theme) => (
              <div key={theme.id} className={`theme-card ${activeTemplateId === theme.id ? 'active' : ''} ${canEdit(theme) ? 'my' : 'other'}`} onClick={() => openDetail(theme.id)}>
                <div className="theme-card-preview" style={{ background: previewBg(theme) }}>
                  <div className="theme-preview-glass">
                    <div className="theme-preview-dot-row"><span /><span /><span /></div>
                    <div className="theme-preview-strip" />
                    <div className="theme-preview-strip short" />
                  </div>
                </div>
                <div className="theme-card-body">
                  <div className="theme-card-title-row">
                    <div className="theme-card-title">{theme.name}</div>
                    <span className={`theme-card-badge ${canEdit(theme) ? 'my' : 'other'}`}>{canEdit(theme) ? 'My' : 'Other'}</span>
                  </div>
                  <div className="theme-card-sub">{theme.template_key || 'template'}</div>
                  {theme.description && <div className="theme-card-tag">{theme.description}</div>}
                </div>
                <div className="theme-card-actions">
                  <button className={`theme-status-btn ${activeTemplateId === theme.id ? 'active' : 'inactive'}`} type="button" onClick={(e) => { e.stopPropagation(); handleAssign(theme); }}>
                    {assigningId === theme.id ? 'Applying...' : activeTemplateId === theme.id ? 'Applied' : 'Apply'}
                  </button>
                  {canEdit(theme) && <button className="theme-icon-btn" type="button" onClick={(e) => { e.stopPropagation(); openEdit(theme.id); }}>Edit</button>}
                </div>
              </div>
            ))}
          </section>
            </>
          )}

          {showForm && (
            <section className="theme-form">
              <div className="theme-form-card">
                <div className="theme-form-title">{selectedId ? 'Edit Theme' : 'Create Theme'}</div>
                <div className="theme-grid">
                  <label className="theme-field"><span>Name *</span><input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></label>
                  <label className="theme-field"><span>Template Key</span><input value={form.template_key} onChange={(e) => setForm((p) => ({ ...p, template_key: e.target.value }))} /></label>
                  <label className="theme-field theme-span-2"><span>Description</span><textarea rows="3" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></label>
                  {renderColorField('primary_color', 'Primary Color Shade', '#C0241A')}
                  {renderColorField('secondary_color', 'Secondary Color Shade', '#2B2F7E')}
                  {renderColorField('accent_color', 'Accent Color Shade', '#FDECEA')}
                  {renderColorField('accent_bg', 'Accent Background Shade', '#EAEBF8')}
                  <div className="theme-span-2 theme-palette-preview-card">
                    <div className="theme-palette-preview-top">
                      <div>
                        <span className="theme-palette-preview-label">Live Palette</span>
                        <strong>Modern color preview</strong>
                      </div>
                      <div className="theme-palette-preview-chips">
                        {[
                          { key: 'primary_color', label: 'Primary', fallback: '#C0241A' },
                          { key: 'secondary_color', label: 'Secondary', fallback: '#2B2F7E' },
                          { key: 'accent_color', label: 'Accent', fallback: '#FDECEA' },
                          { key: 'accent_bg', label: 'Accent Bg', fallback: '#EAEBF8' },
                        ].map((item) => (
                          <button
                            key={item.key}
                            className="theme-palette-preview-chip"
                            type="button"
                            onClick={() => openColorPicker(item.key)}
                          >
                            <span
                              className="theme-palette-preview-chip-sample"
                              style={{ background: normalizePickerColor(form[item.key], item.fallback) }}
                              aria-hidden="true"
                            />
                            <span className="theme-palette-preview-chip-copy">
                              <strong>{item.label}</strong>
                              <small>{form[item.key] || item.fallback}</small>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div
                      className="theme-palette-preview-hero"
                      style={{ background: `linear-gradient(135deg, ${form.primary_color || '#C0241A'} 0%, ${form.secondary_color || '#2B2F7E'} 100%)` }}
                    >
                      <div className="theme-palette-preview-badge" style={{ background: form.accent_bg || '#EAEBF8', color: form.secondary_color || '#2B2F7E' }}>
                        Accent surface
                      </div>
                      <div className="theme-palette-preview-line" />
                      <div className="theme-palette-preview-line short" />
                      <button
                        className="theme-palette-preview-button"
                        type="button"
                        style={{ background: form.accent_color || '#FDECEA', color: form.primary_color || '#C0241A' }}
                      >
                        Preview CTA
                      </button>
                    </div>
                  </div>
                  {renderPaintField('navbar_bg', 'Navbar Background Shade', '#EAEBF8')}
                  <div className="theme-span-2 theme-navbar-preview-card">
                    <span className="theme-navbar-preview-label">Navbar Preview</span>
                    <div className="theme-navbar-preview-shell" style={{ background: normalizePreviewPaint(form.navbar_bg, 'rgba(234,235,248,0.88)') }}>
                      <div className="theme-navbar-preview-brand" style={{ color: form.secondary_color || '#2B2F7E' }}>Trust Admin</div>
                      <div className="theme-navbar-preview-links">
                        <span style={{ color: form.primary_color || '#C0241A' }}>Home</span>
                        <span style={{ color: form.secondary_color || '#2B2F7E' }}>Events</span>
                        <span style={{ color: form.secondary_color || '#2B2F7E' }}>Gallery</span>
                      </div>
                      <button
                        type="button"
                        className="theme-navbar-preview-cta"
                        style={{ background: form.accent_color || '#FDECEA', color: form.primary_color || '#C0241A' }}
                      >
                        Action
                      </button>
                    </div>
                  </div>
                  {renderPaintField('page_bg', 'Page Background Shade', '#FFF5F5')}
                  {renderHomeLayoutField()}
                  <label className="theme-field theme-span-2"><span>Animations JSON</span><textarea rows="4" value={form.animations} onChange={(e) => setForm((p) => ({ ...p, animations: e.target.value }))} /></label>
                  <label className="theme-field theme-span-2"><span>Custom CSS</span><textarea rows="5" value={form.custom_css} onChange={(e) => setForm((p) => ({ ...p, custom_css: e.target.value }))} /></label>
                  <label className="theme-check"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} /><span>Template is active</span></label>
                </div>
                <div className="theme-form-actions">
                  <button className="theme-secondary-btn" type="button" onClick={() => { setShowForm(false); setSelectedId(null); setSaveError(''); }}>Close</button>
                  <button className="theme-primary-btn" type="button" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Theme'}</button>
                </div>
              </div>
            </section>
          )}

          {showPicker && (
            <div className="theme-modal-overlay" onClick={() => setShowPicker(false)}>
              <div className="theme-modal" onClick={(e) => e.stopPropagation()}>
                <div className="theme-modal-head">
                  <div><h3>Select Theme</h3><p>Search by name, description, or template key.</p></div>
                  <button className="theme-modal-close" onClick={() => setShowPicker(false)} type="button">x</button>
                </div>
                <div className="theme-modal-search">
                  <input placeholder="Search themes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  <button className="theme-add-btn" onClick={openCreate} type="button">Create Theme</button>
                </div>
                <div className="theme-modal-list">
                  {myTemplates.length > 0 && <div className="theme-modal-section my"><div className="theme-modal-section-title">My Themes</div>{myTemplates.map((item) => (
                    <div key={item.id} className="theme-modal-item" onClick={() => openDetail(item.id)}>
                      <div><div className="theme-modal-title-row"><div className="theme-modal-title">{item.name}</div><span className="theme-modal-badge my">My</span></div><div className="theme-modal-sub">{item.template_key || 'template'}</div><div className="theme-modal-sub">{item.description || 'No description'}</div></div>
                      <div className="theme-modal-actions"><button className="theme-icon-btn" type="button" onClick={(e) => { e.stopPropagation(); handleAssign(item); }}>{activeTemplateId === item.id ? 'Applied' : 'Apply'}</button><button className="theme-icon-btn" type="button" onClick={(e) => { e.stopPropagation(); openEdit(item.id); }}>Edit</button></div>
                    </div>
                  ))}</div>}
                  {otherTemplates.length > 0 && <div className="theme-modal-section other"><div className="theme-modal-section-title">Other Themes</div>{otherTemplates.map((item) => (
                    <div key={item.id} className="theme-modal-item" onClick={() => openDetail(item.id)}>
                      <div><div className="theme-modal-title-row"><div className="theme-modal-title">{item.name}</div><span className="theme-modal-badge other">Other</span></div><div className="theme-modal-sub">{item.template_key || 'template'}</div><div className="theme-modal-sub">{item.description || 'No description'}</div></div>
                      <div className="theme-modal-actions"><button className="theme-icon-btn" type="button" onClick={(e) => { e.stopPropagation(); handleAssign(item); }}>{activeTemplateId === item.id ? 'Applied' : 'Apply'}</button></div>
                    </div>
                  ))}</div>}
                  {filtered.length === 0 && <div className="theme-modal-empty">No themes found.</div>}
                </div>
              </div>
            </div>
          )}

          {showDetail && detailTemplate && (
            <div className="theme-modal-overlay" onClick={() => setShowDetail(false)}>
              <div className="theme-modal theme-detail-modal" onClick={(e) => e.stopPropagation()}>
                <div className="theme-modal-head">
                  <div><h3>{detailTemplate.name}</h3><p>{detailTemplate.description || detailTemplate.template_key || 'Theme template'}</p></div>
                  <button className="theme-modal-close" onClick={() => setShowDetail(false)} type="button">x</button>
                </div>
                <div className="theme-detail-preview" style={{ background: previewBg(detailTemplate) }}>
                  <div className="theme-detail-chip-row"><span /><span /><span /></div>
                  <div className="theme-detail-panel" />
                  <div className="theme-detail-grid"><div /><div /><div /></div>
                </div>
                <div className="theme-detail-info">
                  <div><strong>Template key:</strong> {detailTemplate.template_key || '-'}</div>
                  <div><strong>Assigned:</strong> {activeTemplateId === detailTemplate.id ? 'Yes' : 'No'}</div>
                </div>
                <div className="theme-detail-actions">
                  <button className="theme-icon-btn" type="button" onClick={() => handleAssign(detailTemplate)}>{activeTemplateId === detailTemplate.id ? 'Applied' : 'Apply Theme'}</button>
                  {canEdit(detailTemplate) && <button className="theme-icon-btn" type="button" onClick={() => openEdit(detailTemplate.id)}>Edit Theme</button>}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
