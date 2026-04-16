import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  fetchSponsors,
  createSponsor,
  updateSponsor,
  fetchSponsorFlashByTrust,
  createSponsorFlash,
  updateSponsorFlash,
  deleteSponsorFlash,
} from '../services/sponsorsService';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import './SponsorsPage.css';

const EMPTY_FORM = {
  name: '',
  position: '',
  about: '',
  photo_url: '',
  company_name: '',
  phone: '',
  email_id: '',
  address: '',
  city: '',
  state: '',
  whatsapp_number: '',
  website_url: '',
  catalog_url: '',
  badge_label: 'OFFICIAL SPONSOR',
};

const initials = (value = '') =>
  value.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'S';

function isFlashActive(flash) {
  if (!flash) return false;
  if (!flash.start_date && !flash.end_date) return false;
  const todayStr = toLocalDateString(new Date());
  if (flash.start_date && todayStr < flash.start_date) return false;
  if (flash.end_date && todayStr > flash.end_date) return false;
  return true;
}

function toLocalDateString(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function SponsorsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const trustId = trust?.id || null;
  const isCreateRoute = location.pathname === '/sponsor/create_sponsor';

  const [sponsors, setSponsors] = useState([]);
  const [flashMap, setFlashMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hiddenIds, setHiddenIds] = useState(new Set());

  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFlashModal, setShowFlashModal] = useState(false);
  const [flashSponsorId, setFlashSponsorId] = useState(null);
  const [showFlashInfoModal, setShowFlashInfoModal] = useState(false);
  const [flashInfoSponsorId, setFlashInfoSponsorId] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailSponsorId, setDetailSponsorId] = useState(null);
  const [flashForm, setFlashForm] = useState({
    start_date: '',
    end_date: '',
    duration_seconds: '5',
    priority: '',
  });
  const [flashError, setFlashError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!trustId) navigate('/dashboard', { replace: true, state: { userName, trust } });
  }, [trustId, navigate, userName, trust]);

  const selectedSponsor = useMemo(
    () => sponsors.find(s => s.id === selectedId) || null,
    [sponsors, selectedId]
  );

  const filteredSponsorChoices = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return sponsors;
    return sponsors.filter((s) => {
      const name = (s.name || '').toLowerCase();
      const company = (s.company_name || '').toLowerCase();
      const phone = String(s.phone || '').toLowerCase();
      return name.includes(term) || company.includes(term) || phone.includes(term);
    });
  }, [sponsors, searchTerm]);

  const mySponsorChoices = useMemo(
    () => filteredSponsorChoices.filter(s => s.trust_id === trustId),
    [filteredSponsorChoices, trustId]
  );

  const otherSponsorChoices = useMemo(
    () => filteredSponsorChoices.filter(s => s.trust_id !== trustId),
    [filteredSponsorChoices, trustId]
  );

  const visibleSponsors = useMemo(() => {
    const flashIds = new Set(Object.keys(flashMap));
    return sponsors.filter((s) => flashIds.has(String(s.id)) && !hiddenIds.has(s.id));
  }, [sponsors, flashMap, hiddenIds]);

  const detailSponsor = useMemo(
    () => sponsors.find((s) => s.id === detailSponsorId) || null,
    [sponsors, detailSponsorId]
  );

  const canEditSponsorId = (sponsorId) => {
    const sponsor = sponsors.find((s) => s.id === sponsorId);
    return sponsor?.trust_id && trustId && sponsor.trust_id === trustId;
  };

  const flashInfo = useMemo(
    () => (flashInfoSponsorId ? flashMap[flashInfoSponsorId] : null),
    [flashInfoSponsorId, flashMap]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      const [{ data: sponsorsData, error: sponsorsErr }, { data: flashData, error: flashErr }] =
        await Promise.all([
          fetchSponsors(),
          fetchSponsorFlashByTrust(trustId),
        ]);

      if (sponsorsErr) setError(sponsorsErr.message || 'Unable to load sponsors.');
      if (flashErr) setError(flashErr.message || 'Unable to load sponsor flash data.');

      setSponsors(sponsorsData || []);
      const flashBySponsor = {};
      (flashData || []).forEach((row) => {
        flashBySponsor[row.sponsor_id] = row;
      });
      setFlashMap(flashBySponsor);
      setLoading(false);
    };
    if (trustId) load();
  }, [trustId]);

  useEffect(() => {
    if (selectedSponsor) {
      setForm({
        name: selectedSponsor.name || '',
        position: selectedSponsor.position || '',
        about: selectedSponsor.about || '',
        photo_url: selectedSponsor.photo_url || '',
        company_name: selectedSponsor.company_name || '',
        phone: selectedSponsor.phone || '',
        email_id: selectedSponsor.email_id || '',
        address: selectedSponsor.address || '',
        city: selectedSponsor.city || '',
        state: selectedSponsor.state || '',
        whatsapp_number: selectedSponsor.whatsapp_number != null ? String(selectedSponsor.whatsapp_number) : '',
        website_url: selectedSponsor.website_url || '',
        catalog_url: selectedSponsor.catalog_url || '',
        badge_label: selectedSponsor.badge_label || 'OFFICIAL SPONSOR',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [selectedSponsor, flashMap]);

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      setSaveError('Please select a valid image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({ ...prev, photo_url: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const startAdd = () => {
    navigate('/sponsor/create_sponsor', { state: { userName, trust } });
  };


  const openPicker = () => {
    setSearchTerm('');
    setShowPicker(true);
  };

  const openAdvertisementForSponsor = (sponsorId) => {
    openFlashEditor(sponsorId);
    setShowPicker(false);
  };

  const openDetail = (sponsorId) => {
    setDetailSponsorId(sponsorId);
    setShowDetailModal(true);
  };

  const openFlashEditor = (sponsorId) => {
    const existing = flashMap[sponsorId];
    setFlashSponsorId(sponsorId);
    setFlashForm({
      start_date: existing?.start_date || '',
      end_date: existing?.end_date || '',
      duration_seconds: existing?.duration_seconds != null ? String(existing.duration_seconds) : '5',
      priority: existing?.priority != null ? String(existing.priority) : '',
    });
    setFlashError('');
    setShowFlashModal(true);
  };

  const openFlashInfo = (sponsorId) => {
    setFlashInfoSponsorId(sponsorId);
    setShowFlashInfoModal(true);
  };

  const handleSaveFlash = async () => {
    if (!flashSponsorId) return;
    setFlashError('');
    const duration = Number(flashForm.duration_seconds);
    if (Number.isNaN(duration) || duration <= 0) {
      setFlashError('Duration (sec) must be a positive number.');
      return;
    }
    const startDate = flashForm.start_date || null;
    const endDate = flashForm.end_date || null;
    if (startDate && endDate && startDate > endDate) {
      setFlashError('Start date must be before or equal to end date.');
      return;
    }
    const payload = {
      trust_id: trustId,
      sponsor_id: flashSponsorId,
      start_date: startDate,
      end_date: endDate,
      duration_seconds: duration,
      priority: flashForm.priority ? Number(flashForm.priority) : null,
    };
    const existing = flashMap[flashSponsorId];
    const action = existing?.id
      ? updateSponsorFlash(existing.id, payload)
      : createSponsorFlash(payload);
    const { data, error: err } = await action;
    if (err) {
      setFlashError(err.message || 'Unable to update status.');
      return;
    }
    if (data) {
      setFlashMap((prev) => ({ ...prev, [flashSponsorId]: data }));
      setHiddenIds((prev) => {
        const next = new Set(prev);
        next.delete(flashSponsorId);
        return next;
      });
      setShowFlashModal(false);
    }
  };

  const handleRemoveFromView = async (id) => {
    const ok = window.confirm('Remove this sponsor from sponsor flash? This will keep sponsor master data intact.');
    if (!ok) return;
    const flash = flashMap[id];
    if (!flash?.id) {
      setHiddenIds((prev) => new Set([...prev, id]));
      if (selectedId === id) setSelectedId(null);
      return;
    }

    const { error: err } = await deleteSponsorFlash(flash.id);
    if (err) {
      setError(err.message || 'Unable to remove sponsor from sponsor flash.');
      return;
    }

    setFlashMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (selectedId === id) setSelectedId(null);
  };

  const handleSave = async () => {
    setSaveError('');
    if (!form.name.trim()) {
      setSaveError('Name is required.');
      return;
    }
    if (!form.company_name.trim()) {
      setSaveError('Company name is required.');
      return;
    }
    if (selectedId && !canEditSponsorId(selectedId)) {
      setSaveError('You can only edit sponsors linked to your trust.');
      return;
    }
    const payload = {
      name: form.name.trim(),
      position: form.position.trim() || null,
      about: form.about.trim() || null,
      photo_url: form.photo_url || null,
      company_name: form.company_name.trim(),
      trust_id: trustId,
      ref_no: selectedSponsor?.ref_no ?? (Math.max(0, ...sponsors.map(s => Number(s.ref_no) || 0)) + 1),
      phone: form.phone.trim() || null,
      email_id: form.email_id.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      whatsapp_number: form.whatsapp_number ? Number(form.whatsapp_number) : null,
      website_url: form.website_url.trim() || null,
      catalog_url: form.catalog_url.trim() || null,
      badge_label: form.badge_label.trim() || 'OFFICIAL SPONSOR',
    };

    setSaving(true);
    if (selectedId) {
      const { data, error: err } = await updateSponsor(selectedId, payload);
      if (err) {
        setSaveError(err.message || 'Unable to update sponsor.');
      } else if (data) {
        setSponsors(prev => prev.map(s => (s.id === selectedId ? data : s)));
        setShowForm(false);
      }
    } else {
      const { data, error: err } = await createSponsor(payload);
      if (err) {
        setSaveError(err.message || 'Unable to create sponsor.');
      } else if (data) {
        setSponsors(prev => [data, ...prev]);
        if (isCreateRoute) {
          navigate('/sponsor', { state: { userName, trust } });
        } else {
          setSelectedId(data.id);
          setShowForm(false);
          setShowPicker(true);
          setSearchTerm(data.name || '');
        }
      }
    }
    setSaving(false);
  };

  return (
    <div className="sp-root">
      <Sidebar
        trustName={trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust } })}
        onLogout={() => navigate('/login')}
      />

      <main className="sp-main">
        <PageHeader
          title="Sponsors"
          subtitle="Manage sponsor profiles and details"
          onBack={() => {
            if (isCreateRoute) {
              navigate('/sponsor', { state: { userName, trust } });
              return;
            }
            navigate('/dashboard', { state: { userName, trust } });
          }}
          right={<button className="sp-add-btn" onClick={openPicker}>Add a Sponsor</button>}
        />

        {error && <div className="sp-error">{error}</div>}

        <div className={`sp-content ${isCreateRoute || showForm ? 'form-only' : ''}`}>
          {!isCreateRoute && !showForm && (
            <section className="sp-list">
            {loading && <div className="sp-loading">Loading sponsors...</div>}

            {!loading && visibleSponsors.length === 0 && (
              <div className="sp-empty">
                <div className="sp-empty-icon">+</div>
                <h3>No sponsors yet</h3>
                <p>Add your first sponsor to get started.</p>
                <button className="sp-add-btn" onClick={openPicker}>Add a Sponsor</button>
              </div>
            )}

            {!loading && visibleSponsors.map((s) => (
              <div
                key={s.id}
                className={`sp-card ${selectedId === s.id ? 'active' : ''} ${canEditSponsorId(s.id) ? 'my' : 'other'}`}
                onClick={() => { setSelectedId(s.id); openDetail(s.id); }}
              >
                <div className="sp-card-avatar">
                  {s.photo_url
                    ? <img src={s.photo_url} alt={s.name} />
                    : <span>{initials(s.name)}</span>
                  }
                </div>
                <div className="sp-card-body">
                  <div className="sp-card-title-row">
                    <div className="sp-card-title">{s.name}</div>
                    <span className={`sp-card-badge ${canEditSponsorId(s.id) ? 'my' : 'other'}`}>
                      {canEditSponsorId(s.id) ? 'My' : 'Other'}
                    </span>
                  </div>
                  <div className="sp-card-sub">{s.company_name}</div>
                  {s.position && <div className="sp-card-tag">{s.position}</div>}
                </div>
                <div className="sp-card-actions">
                  <button
                    className={`sp-status-btn ${isFlashActive(flashMap[s.id]) ? 'active' : 'inactive'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isFlashActive(flashMap[s.id])) openFlashInfo(s.id);
                      else openFlashEditor(s.id);
                    }}
                    title={isFlashActive(flashMap[s.id]) ? 'Set inactive' : 'Set active'}
                  >
                    {isFlashActive(flashMap[s.id]) ? 'Active' : 'Inactive'}
                  </button>
                  {canEditSponsorId(s.id) && (
                    <button
                      className="sp-icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(s.id);
                        setShowForm(true);
                      }}
                      title="Edit"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    className="sp-icon-btn danger"
                    onClick={(e) => { e.stopPropagation(); handleRemoveFromView(s.id); }}
                    title="Remove"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            </section>
          )}

          {(isCreateRoute || showForm) && (
            <section className="sp-form">
              <div className="sp-form-card">
              <div className="sp-form-title">
                {selectedId ? 'Edit Sponsor' : 'Add Sponsor'}
              </div>

              <div className="sp-grid">
                <label className="sp-field">
                  <span>Name *</span>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </label>
                <label className="sp-field">
                  <span>Position</span>
                  <input value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} />
                </label>
                <label className="sp-field sp-span-2">
                  <span>About</span>
                  <textarea rows="3" value={form.about} onChange={e => setForm(p => ({ ...p, about: e.target.value }))} />
                </label>

                <div className="sp-field sp-span-2">
                  <span>Photo URL (drag & drop)</span>
                  <label
                    className={`sp-drop ${dragOver ? 'drag' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleFile(e.target.files?.[0])}
                    />
                    <div className="sp-drop-inner">
                      <span>Drag & drop image here</span>
                      <span className="sp-drop-sub">or click to upload</span>
                    </div>
                  </label>
                  {form.photo_url && (
                    <div className="sp-photo-preview">
                      <img src={form.photo_url} alt="Preview" />
                      <button className="sp-link" type="button" onClick={() => setForm(p => ({ ...p, photo_url: '' }))}>
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <label className="sp-field">
                  <span>Company Name *</span>
                  <input value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} />
                </label>
                <label className="sp-field">
                  <span>Phone No</span>
                  <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </label>
                <label className="sp-field">
                  <span>Email ID</span>
                  <input value={form.email_id} onChange={e => setForm(p => ({ ...p, email_id: e.target.value }))} />
                </label>
                <label className="sp-field sp-span-2">
                  <span>Address</span>
                  <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
                </label>
                <label className="sp-field">
                  <span>City</span>
                  <input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
                </label>
                <label className="sp-field">
                  <span>State</span>
                  <input value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} />
                </label>
                <label className="sp-field">
                  <span>WhatsApp No</span>
                  <input type="number" value={form.whatsapp_number} onChange={e => setForm(p => ({ ...p, whatsapp_number: e.target.value }))} />
                </label>
                <label className="sp-field">
                  <span>Website URL</span>
                  <input value={form.website_url} onChange={e => setForm(p => ({ ...p, website_url: e.target.value }))} />
                </label>
                <label className="sp-field">
                  <span>Catalog URL</span>
                  <input value={form.catalog_url} onChange={e => setForm(p => ({ ...p, catalog_url: e.target.value }))} />
                </label>
                <label className="sp-field">
                  <span>Badge Label</span>
                  <input value={form.badge_label} onChange={e => setForm(p => ({ ...p, badge_label: e.target.value }))} />
                </label>
              </div>

              {saveError && <div className="sp-error">{saveError}</div>}

              <div className="sp-form-actions">
                <button
                  className="sp-secondary"
                  onClick={() => {
                    if (isCreateRoute) {
                      navigate('/sponsor', { state: { userName, trust } });
                      return;
                    }
                    setShowForm(false);
                    setSelectedId(null);
                    setSaveError('');
                  }}
                  type="button"
                >
                  Close
                </button>
                <button className="sp-primary" onClick={handleSave} disabled={saving} type="button">
                  {saving ? 'Saving...' : 'Save Sponsor'}
                </button>
              </div>
              </div>
            </section>
          )}
        </div>

        {showPicker && (
          <div className="sp-modal-overlay" onClick={() => setShowPicker(false)}>
            <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sp-modal-head">
                <div>
                  <h3>Select Sponsor</h3>
                  <p>Search by name, company, or mobile.</p>
                </div>
                <button className="sp-modal-close" onClick={() => setShowPicker(false)}>×</button>
              </div>
              <div className="sp-modal-search">
                <input
                  placeholder="Search sponsors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button className="sp-add-btn" onClick={() => { setShowPicker(false); startAdd(); }}>
                  Create New Sponsor
                </button>
              </div>
              <div className="sp-modal-list">
                {mySponsorChoices.length > 0 && (
                  <div className="sp-modal-section my">
                    <div className="sp-modal-section-title">My Sponsors</div>
                    {mySponsorChoices.map((s) => {
                      const alreadyAdded = !!flashMap[s.id];
                      const flash = flashMap[s.id];
                      return (
                        <div
                          key={s.id}
                          className="sp-modal-item"
                          onClick={() => openDetail(s.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openDetail(s.id);
                            }
                          }}
                        >
                          <div>
                            <div className="sp-modal-title-row">
                              <div className="sp-modal-title">{s.name}</div>
                              <span className="sp-modal-badge my">My</span>
                            </div>
                            <div className="sp-modal-sub">{s.company_name || 'No company'}</div>
                            <div className="sp-modal-sub">{s.phone || ''}</div>
                            {alreadyAdded && (
                              <div className="sp-modal-meta">
                                <span>Start: {flash?.start_date || 'Not set'}</span>
                                <span>End: {flash?.end_date || 'Not set'}</span>
                                <span>Duration: {flash?.duration_seconds ?? 5}s</span>
                                <span>Priority: {flash?.priority ?? '-'}</span>
                              </div>
                            )}
                          </div>
                          <div className="sp-modal-actions">
                            <button
                              className="sp-icon-btn"
                              onClick={(e) => { e.stopPropagation(); openAdvertisementForSponsor(s.id); }}
                            >
                              {alreadyAdded ? 'Edit Launching' : 'Launch Advertisement'}
                            </button>
                            {canEditSponsorId(s.id) && (
                              <button
                                className="sp-icon-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowPicker(false);
                                  setSelectedId(s.id);
                                  setShowForm(true);
                                }}
                                title="Edit"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {otherSponsorChoices.length > 0 && (
                  <div className="sp-modal-section other">
                    <div className="sp-modal-section-title">Other Sponsors</div>
                    {otherSponsorChoices.map((s) => {
                      const alreadyAdded = !!flashMap[s.id];
                      const flash = flashMap[s.id];
                      return (
                        <div
                          key={s.id}
                          className="sp-modal-item"
                          onClick={() => openDetail(s.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openDetail(s.id);
                            }
                          }}
                        >
                          <div>
                            <div className="sp-modal-title-row">
                              <div className="sp-modal-title">{s.name}</div>
                              <span className="sp-modal-badge other">Other</span>
                            </div>
                            <div className="sp-modal-sub">{s.company_name || 'No company'}</div>
                            <div className="sp-modal-sub">{s.phone || ''}</div>
                            {alreadyAdded && (
                              <div className="sp-modal-meta">
                                <span>Start: {flash?.start_date || 'Not set'}</span>
                                <span>End: {flash?.end_date || 'Not set'}</span>
                                <span>Duration: {flash?.duration_seconds ?? 5}s</span>
                                <span>Priority: {flash?.priority ?? '-'}</span>
                              </div>
                            )}
                          </div>
                          <div className="sp-modal-actions">
                            <button
                              className="sp-icon-btn"
                              onClick={(e) => { e.stopPropagation(); openAdvertisementForSponsor(s.id); }}
                            >
                              {alreadyAdded ? 'Edit Launching' : 'Launch Advertisement'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {filteredSponsorChoices.length === 0 && (
                  <div className="sp-modal-empty">No sponsors found.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {showFlashModal && (
          <div className="sp-modal-overlay" onClick={() => setShowFlashModal(false)}>
            <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sp-modal-head">
                <div>
                  <h3>Activate Sponsor</h3>
                  <p>Set schedule and priority.</p>
                </div>
                <button className="sp-modal-close" onClick={() => setShowFlashModal(false)}>×</button>
              </div>
              <div className="sp-modal-form">
                <label>
                  <span>Start Date</span>
                  <input
                    type="date"
                    value={flashForm.start_date}
                    onChange={(e) => setFlashForm((p) => ({ ...p, start_date: e.target.value }))}
                    onFocus={(e) => e.target.showPicker?.()}
                    onClick={(e) => e.target.showPicker?.()}
                  />
                </label>
                <label>
                  <span>End Date</span>
                  <input
                    type="date"
                    value={flashForm.end_date}
                    onChange={(e) => setFlashForm((p) => ({ ...p, end_date: e.target.value }))}
                    onFocus={(e) => e.target.showPicker?.()}
                    onClick={(e) => e.target.showPicker?.()}
                  />
                </label>
                <label>
                  <span>Duration (sec)</span>
                  <input type="number" min="1" value={flashForm.duration_seconds} onChange={(e) => setFlashForm((p) => ({ ...p, duration_seconds: e.target.value }))} />
                </label>
                <label>
                  <span>Priority</span>
                  <input type="number" value={flashForm.priority} onChange={(e) => setFlashForm((p) => ({ ...p, priority: e.target.value }))} />
                </label>
                {flashError && <div className="sp-error">{flashError}</div>}
                <div className="sp-form-actions">
                  <button className="sp-secondary" onClick={() => setShowFlashModal(false)} type="button">Cancel</button>
                  <button className="sp-primary" onClick={handleSaveFlash} type="button">Save</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showFlashInfoModal && (
          <div className="sp-modal-overlay" onClick={() => setShowFlashInfoModal(false)}>
            <div className="sp-modal sp-detail-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sp-modal-head">
                <div>
                  <h3>Advertisement Details</h3>
                  <p>{flashInfoSponsorId ? sponsors.find(s => s.id === flashInfoSponsorId)?.name : ''}</p>
                </div>
                <button className="sp-modal-close" onClick={() => setShowFlashInfoModal(false)}>×</button>
              </div>
              <div className="sp-detail-info">
                <div><strong>Start Date:</strong> {flashInfo?.start_date || 'Not set'}</div>
                <div><strong>End Date:</strong> {flashInfo?.end_date || 'Not set'}</div>
                <div><strong>Duration:</strong> {(flashInfo?.duration_seconds ?? 5)}s</div>
                <div><strong>Priority:</strong> {flashInfo?.priority ?? '-'}</div>
              </div>
              <div className="sp-detail-actions">
                <button
                  className="sp-icon-btn"
                  onClick={() => {
                    setShowFlashInfoModal(false);
                    if (flashInfoSponsorId) openFlashEditor(flashInfoSponsorId);
                  }}
                >
                  Edit Launching
                </button>
              </div>
            </div>
          </div>
        )}

        {showDetailModal && detailSponsor && (
          <div className="sp-modal-overlay" onClick={() => setShowDetailModal(false)}>
            <div className="sp-modal sp-detail-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sp-modal-head">
                <div>
                  <h3>{detailSponsor.name || 'Sponsor'}</h3>
                  <p>{detailSponsor.company_name || 'No company'}</p>
                </div>
                <button className="sp-modal-close" onClick={() => setShowDetailModal(false)}>×</button>
              </div>
              <div className="sp-detail-body">
                <div className="sp-detail-avatar">
                  {detailSponsor.photo_url
                    ? <img src={detailSponsor.photo_url} alt={detailSponsor.name} />
                    : <span>{initials(detailSponsor.name)}</span>
                  }
                </div>
                <div className="sp-detail-info">
                  {detailSponsor.position && <div><strong>Position:</strong> {detailSponsor.position}</div>}
                  {detailSponsor.phone && <div><strong>Phone:</strong> {detailSponsor.phone}</div>}
                  {detailSponsor.email_id && <div><strong>Email:</strong> {detailSponsor.email_id}</div>}
                  {detailSponsor.badge_label && <div><strong>Badge:</strong> {detailSponsor.badge_label}</div>}
                  <div><strong>Status:</strong> {isFlashActive(flashMap[detailSponsor.id]) ? 'Active' : 'Inactive'}</div>
                </div>
              </div>
              <div className="sp-detail-actions">
                <button className="sp-icon-btn" onClick={() => { setShowDetailModal(false); openAdvertisementForSponsor(detailSponsor.id); }}>
                  {flashMap[detailSponsor.id] ? 'Edit Launching' : 'Launch Advertisement'}
                </button>
                {canEditSponsorId(detailSponsor.id) && (
                  <button
                    className="sp-icon-btn"
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedId(detailSponsor.id);
                      setShowForm(true);
                    }}
                  >
                    Edit Details
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
