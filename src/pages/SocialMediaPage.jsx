import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import { createImage, fetchImages, fetchImagesCount } from '../services/imagesService';
import {
  fetchSocialMediaAccountByTrust,
  upsertSocialMediaAccountByTrust,
} from '../services/socialMediaAccountsService';
import './SocialMediaPage.css';

function toTitleCase(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function gcd(a, b) {
  let x = Math.abs(Number(a) || 0);
  let y = Math.abs(Number(b) || 0);
  while (y) {
    const temp = y;
    y = x % y;
    x = temp;
  }
  return x || 1;
}

function toAspectRatioText(width, height) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const divisor = gcd(safeWidth, safeHeight);
  return `${Math.round(safeWidth / divisor)}:${Math.round(safeHeight / divisor)}`;
}

function getInitialForm() {
  return {
    title: '',
    hashtags: '',
    description: '',
    aspectRatio: '4:5',
  };
}

function getInitialAccountForm() {
  return {
    blotatoApi: '',
    instagram: '',
    fbAccount: '',
    fbPage: '',
    youtube: '',
    x: '',
    threads: '',
    keywords: '',
    region: '',
    timeForAutoInput: '',
    uploadPostApi: '',
  };
}

function toNullableText(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function toNullableBigint(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

export default function SocialMediaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null, superuserId = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'dashboard';
  const currentMemberId = location.state?.selectedMemberId || null;
  const isCreateRoute = location.pathname === '/social-media/create';
  const isAccountsDetailsRoute = location.pathname === '/social-media/accounts-details';
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const selectedPlatform = toTitleCase(searchParams.get('platform')) || '';
  const selectedPhotoId = searchParams.get('photoId') || '';
  const selectedPhotoUrl = searchParams.get('photoUrl') || '';
  const selectedFolder = searchParams.get('folder') || '';

  const [activeSection, setActiveSection] = useState(() => {
    if (isAccountsDetailsRoute) return 'accounts-details';
    if (isCreateRoute) return '';
    return 'media-details';
  });
  const [mediaRows, setMediaRows] = useState([]);
  const [mediaCount, setMediaCount] = useState(0);
  const [loadingCount, setLoadingCount] = useState(true);
  const [loadingMediaRows, setLoadingMediaRows] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [form, setForm] = useState(() => getInitialForm());
  const [accountForm, setAccountForm] = useState(() => getInitialAccountForm());
  const [accountRecordId, setAccountRecordId] = useState('');
  const [accountCreatedAt, setAccountCreatedAt] = useState('');
  const [accountUpdatedAt, setAccountUpdatedAt] = useState('');
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadCount = async () => {
      setLoadingCount(true);
      const { count, error: countError } = await fetchImagesCount();
      if (cancelled) return;
      if (countError) {
        setError(countError.message || 'Unable to fetch media count.');
      } else {
        setMediaCount(count || 0);
      }
      setLoadingCount(false);
    };
    loadCount();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedPhotoUrl) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const ratioText = toAspectRatioText(image.naturalWidth, image.naturalHeight);
      setForm((prev) => ({ ...prev, aspectRatio: ratioText }));
    };
    image.onerror = () => {
      if (cancelled) return;
      setForm((prev) => ({ ...prev, aspectRatio: prev.aspectRatio || '4:5' }));
    };
    image.src = selectedPhotoUrl;
    return () => {
      cancelled = true;
    };
  }, [selectedPhotoUrl]);

  const loadMediaDetails = useCallback(async () => {
    setLoadingMediaRows(true);
    setError('');
    const { data, error: fetchError } = await fetchImages({ limit: 30 });
    if (fetchError) {
      setError(fetchError.message || 'Unable to load media details.');
      setMediaRows([]);
      setLoadingMediaRows(false);
      return;
    }
    const rows = data || [];
    setMediaRows(rows);
    setSelectedMediaId('');
    setLoadingMediaRows(false);
  }, []);

  const loadAccountDetails = useCallback(async () => {
    if (!trust?.id) return;
    setLoadingAccount(true);
    setError('');

    const { data, error: fetchError } = await fetchSocialMediaAccountByTrust(trust.id);
    if (fetchError) {
      setError(fetchError.message || 'Unable to load account details.');
      setLoadingAccount(false);
      return;
    }

    if (!data) {
      setAccountRecordId('');
      setAccountCreatedAt('');
      setAccountUpdatedAt('');
      setAccountForm(getInitialAccountForm());
      setLoadingAccount(false);
      return;
    }

    setAccountRecordId(data.id || '');
    setAccountCreatedAt(data.createdAt || '');
    setAccountUpdatedAt(data.updatedAt || '');
    setAccountForm({
      blotatoApi: data.blotatoApi || '',
      instagram: data.instagram ?? '',
      fbAccount: data.fbAccount ?? '',
      fbPage: data.fbPage ?? '',
      youtube: data.youtube ?? '',
      x: data.x ?? '',
      threads: data.threads ?? '',
      keywords: data.keywords || '',
      region: data.region || '',
      timeForAutoInput: data.timeForAutoInput || '',
      uploadPostApi: data.uploadPostApi || '',
    });
    setLoadingAccount(false);
  }, [trust?.id]);

  const handleOpenSection = async (sectionId) => {
    if (sectionId === 'accounts-details' && !isAccountsDetailsRoute) return;
    setActiveSection(sectionId);
    if (sectionId === 'media-details') {
      await loadMediaDetails();
    } else if (sectionId === 'accounts-details') {
      await loadAccountDetails();
    }
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAccountFormChange = (field, value) => {
    setAccountForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateImage = async (event) => {
    event.preventDefault();
    const titleValue = form.title.trim();
    if (!titleValue) {
      setError('Title is required.');
      return;
    }
    if (!selectedPhotoId) {
      setError('Selected photo is missing. Please open this page from gallery.');
      return;
    }

    setSaving(true);
    setError('');
    setSaveMessage('');

    const payload = {
      gallery_photo_id: selectedPhotoId,
      Title: titleValue,
      Hashtags: form.hashtags.trim() || null,
      Description: form.description.trim() || null,
      aspectRatio: form.aspectRatio.trim() || null,
      Approved: 'pending',
      created_by: superuserId || null,
    };

    const { error: createError } = await createImage(payload);
    if (createError) {
      setError(createError.message || 'Unable to save image details.');
      setSaving(false);
      return;
    }

    setSaveMessage('Image details saved successfully.');
    setSaving(false);
    setForm({
      ...form,
      title: '',
      hashtags: '',
      description: '',
    });
  };

  const handleSaveAccountDetails = async (event) => {
    event.preventDefault();
    if (!trust?.id) {
      setError('Trust not found. Please re-open from dashboard.');
      return;
    }

    setSavingAccount(true);
    setError('');
    setSaveMessage('');

    const payload = {
      trust_id: trust.id,
      'Blotato-API': toNullableText(accountForm.blotatoApi),
      Instagram: toNullableBigint(accountForm.instagram),
      'FB-Account': toNullableBigint(accountForm.fbAccount),
      'FB-Page': toNullableBigint(accountForm.fbPage),
      Youtube: toNullableBigint(accountForm.youtube),
      X: toNullableBigint(accountForm.x),
      Threads: toNullableBigint(accountForm.threads),
      KeyWords: toNullableText(accountForm.keywords),
      region: toNullableText(accountForm.region),
      TimeForAutoInput: toNullableText(accountForm.timeForAutoInput),
      'upload-Post-Api': toNullableText(accountForm.uploadPostApi),
    };

    if (!accountRecordId && currentMemberId) {
      payload.created_by = currentMemberId;
    }

    const response = await upsertSocialMediaAccountByTrust(payload);

    if (response.error) {
      setError(response.error.message || 'Unable to save account details.');
      setSavingAccount(false);
      return;
    }

    const saved = response.data;
    setAccountRecordId(saved?.id || '');
    setAccountCreatedAt(saved?.createdAt || '');
    setAccountUpdatedAt(saved?.updatedAt || '');
    setAccountForm({
      blotatoApi: saved?.blotatoApi || '',
      instagram: saved?.instagram ?? '',
      fbAccount: saved?.fbAccount ?? '',
      fbPage: saved?.fbPage ?? '',
      youtube: saved?.youtube ?? '',
      x: saved?.x ?? '',
      threads: saved?.threads ?? '',
      keywords: saved?.keywords || '',
      region: saved?.region || '',
      timeForAutoInput: saved?.timeForAutoInput || '',
      uploadPostApi: saved?.uploadPostApi || '',
    });
    setSaveMessage('Social media account details saved.');
    setSavingAccount(false);
  };

  const mediaSubtitle = useMemo(() => {
    if (loadingCount) return 'Loading media count...';
    return `${mediaCount} media record${mediaCount === 1 ? '' : 's'} connected`;
  }, [mediaCount, loadingCount]);
  const pageTitle = isAccountsDetailsRoute ? 'Social Media Account Details' : 'Social Media';
  const pageSubtitle = isCreateRoute
    ? 'Create media details for selected photo'
    : isAccountsDetailsRoute
      ? 'Manage social media account information'
      : 'Manage media and account information';

  useEffect(() => {
    if (isCreateRoute) return;
    if (isAccountsDetailsRoute) {
      handleOpenSection('accounts-details');
      return;
    }
    const requestedSection = location.state?.socialMediaSection || '';
    if (requestedSection && requestedSection !== 'accounts-details') {
      handleOpenSection(requestedSection);
      return;
    }
    handleOpenSection('media-details');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreateRoute, isAccountsDetailsRoute]);

  const selectedMediaRow = useMemo(
    () => mediaRows.find((row) => row.id === selectedMediaId) || null,
    [mediaRows, selectedMediaId]
  );

  const formatDateTime = (value) => {
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
  };

  return (
    <div className="sm-root">
      <Sidebar
        trustName={trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust, superuserId, sidebarNavKey: 'dashboard' } })}
        onLogout={() => navigate('/login')}
      />

      <main className="sm-main">
        <PageHeader
          title={pageTitle}
          subtitle={pageSubtitle}
          right={
            isAccountsDetailsRoute ? (
              <button
                type="button"
                className="sm-queue-btn"
                onClick={() =>
                  navigate('/social-media/approvals', {
                    state: { userName, trust, superuserId, sidebarNavKey: currentSidebarNavKey },
                  })
                }
              >
                Open Approval Queue
              </button>
            ) : null
          }
          onBack={() =>
            navigate(isCreateRoute ? '/gallery' : '/dashboard', {
              state: { userName, trust, superuserId, sidebarNavKey: currentSidebarNavKey },
            })
          }
        />

        <section className="sm-content">
          {error && <div className="sm-error">{error}</div>}
          {saveMessage && <div className="sm-success">{saveMessage}</div>}

          {isCreateRoute ? (
            <div className="sm-section-card sm-create-card">
              <div className="sm-section-head">
                <h4>Create Image Details</h4>
                <span>{selectedPlatform || 'Social'}</span>
              </div>

              <div className="sm-create-layout">
                <div>
                  <div className="sm-create-meta">
                    <div><strong>Folder:</strong> {selectedFolder || 'N/A'}</div>
                  </div>

                  <form className="sm-form-grid" onSubmit={handleCreateImage}>
                    <label className="sm-field">
                      <span>Title *</span>
                      <input
                        type="text"
                        value={form.title}
                        onChange={(e) => handleFormChange('title', e.target.value)}
                        placeholder="Enter title"
                        required
                      />
                    </label>

                    <label className="sm-field">
                      <span>Hashtags</span>
                      <input
                        type="text"
                        value={form.hashtags}
                        onChange={(e) => handleFormChange('hashtags', e.target.value)}
                        placeholder="#event #trust"
                      />
                    </label>

                    <label className="sm-field sm-field-full">
                      <span>Description</span>
                      <textarea
                        value={form.description}
                        onChange={(e) => handleFormChange('description', e.target.value)}
                        placeholder="Write description"
                        rows={4}
                      />
                    </label>

                    <label className="sm-field">
                      <span>aspectRatio</span>
                      <input
                        type="text"
                        value={form.aspectRatio}
                        onChange={(e) => handleFormChange('aspectRatio', e.target.value)}
                        placeholder="4:5 / 1:1 / 16:9"
                      />
                    </label>

                    <div className="sm-form-actions sm-field-full">
                      <button type="submit" disabled={saving}>
                        {saving ? 'Sending...' : 'Send to Social Media'}
                      </button>
                    </div>
                  </form>
                </div>

                <aside className="sm-preview-card">
                  <div className="sm-preview-label">Selected Photo Preview</div>
                  {selectedPhotoUrl ? (
                    <img src={selectedPhotoUrl} alt="Selected for social media" />
                  ) : (
                    <div className="sm-preview-empty">Photo preview not available.</div>
                  )}
                </aside>
              </div>
            </div>
          ) : (
            <>
              {activeSection === 'media-details' && (
                <div className="sm-section-card">
                  <div className="sm-section-head">
                    <h4>Media Details</h4>
                    <span>{loadingMediaRows ? 'Loading...' : mediaSubtitle}</span>
                  </div>

                  {loadingMediaRows ? (
                    <div className="sm-empty">Loading media details...</div>
                  ) : mediaRows.length === 0 ? (
                    <div className="sm-empty">No media rows found in `Images` table.</div>
                  ) : (
                    <div className="sm-media-layout">
                      <div className="sm-media-list">
                        {mediaRows.map((row, index) => (
                          <div
                            key={row.id || `${row.title}-${index}`}
                            className={`sm-media-item ${selectedMediaId === row.id ? 'active' : ''}`}
                          >
                            <div className="sm-media-title">{row.title || 'Untitled'}</div>
                            <div className="sm-media-meta">
                              <span>{row.hashtags || 'No hashtags'}</span>
                              <span>{row.approved || 'Pending'}</span>
                              <span>{row.aspectRatio || 'N/A'}</span>
                            </div>
                            <button
                              type="button"
                              className="sm-media-open-btn"
                              onClick={() => setSelectedMediaId(row.id || '')}
                            >
                              Open
                            </button>
                          </div>
                        ))}
                      </div>

                      {selectedMediaRow ? (
                        <div className="sm-media-details-card">
                          <div className="sm-media-details-head">
                            <h5>{selectedMediaRow.title || 'Untitled'}</h5>
                            <button
                              type="button"
                              className="sm-media-close-btn"
                              onClick={() => setSelectedMediaId('')}
                            >
                              Close
                            </button>
                          </div>
                          <div className="sm-media-preview-short">
                            {selectedMediaRow.previewUrl ? (
                              <img src={selectedMediaRow.previewUrl} alt={selectedMediaRow.title || 'Preview'} />
                            ) : (
                              <div className="sm-media-preview-empty">No preview</div>
                            )}
                          </div>
                          <div className="sm-media-details-grid">
                            <div>
                              <strong>Hashtags:</strong> {selectedMediaRow.hashtags || 'N/A'}
                            </div>
                            <div>
                              <strong>Aspect Ratio:</strong> {selectedMediaRow.aspectRatio || 'N/A'}
                            </div>
                            <div>
                              <strong>Approved:</strong> {selectedMediaRow.approved || 'N/A'}
                            </div>
                            <div>
                              <strong>Created At:</strong> {formatDateTime(selectedMediaRow.createdAt)}
                            </div>
                            <div>
                              <strong>Updated At:</strong> {formatDateTime(selectedMediaRow.updatedAt)}
                            </div>
                          </div>
                          <div className="sm-media-details-desc">
                            <strong>Description:</strong> {selectedMediaRow.description || 'N/A'}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              {isAccountsDetailsRoute && activeSection === 'accounts-details' && (
                <div className="sm-section-card">
                  <div className="sm-section-head">
                    <h4>Accounts Details</h4>
                  </div>
                  {loadingAccount ? (
                    <div className="sm-empty">Loading account details...</div>
                  ) : (
                    <form className="sm-form-grid sm-accounts-form" onSubmit={handleSaveAccountDetails}>
                      <label className="sm-field">
                        <span>Blotato API</span>
                        <input
                          type="text"
                          value={accountForm.blotatoApi}
                          onChange={(e) => handleAccountFormChange('blotatoApi', e.target.value)}
                          placeholder="Enter Blotato API key"
                        />
                      </label>

                      <label className="sm-field">
                        <span>Upload Post API</span>
                        <input
                          type="text"
                          value={accountForm.uploadPostApi}
                          onChange={(e) => handleAccountFormChange('uploadPostApi', e.target.value)}
                          placeholder="Enter upload post API"
                        />
                      </label>

                      <label className="sm-field">
                        <span>Instagram</span>
                        <input
                          type="text"
                          value={accountForm.instagram}
                          onChange={(e) => handleAccountFormChange('instagram', e.target.value)}
                          placeholder="Instagram account id"
                        />
                      </label>

                      <label className="sm-field">
                        <span>FB Account</span>
                        <input
                          type="text"
                          value={accountForm.fbAccount}
                          onChange={(e) => handleAccountFormChange('fbAccount', e.target.value)}
                          placeholder="Facebook account id"
                        />
                      </label>

                      <label className="sm-field">
                        <span>FB Page</span>
                        <input
                          type="text"
                          value={accountForm.fbPage}
                          onChange={(e) => handleAccountFormChange('fbPage', e.target.value)}
                          placeholder="Facebook page id"
                        />
                      </label>

                      <label className="sm-field">
                        <span>Youtube</span>
                        <input
                          type="text"
                          value={accountForm.youtube}
                          onChange={(e) => handleAccountFormChange('youtube', e.target.value)}
                          placeholder="Youtube channel id"
                        />
                      </label>

                      <label className="sm-field">
                        <span>X</span>
                        <input
                          type="text"
                          value={accountForm.x}
                          onChange={(e) => handleAccountFormChange('x', e.target.value)}
                          placeholder="X account id"
                        />
                      </label>

                      <label className="sm-field">
                        <span>Threads</span>
                        <input
                          type="text"
                          value={accountForm.threads}
                          onChange={(e) => handleAccountFormChange('threads', e.target.value)}
                          placeholder="Threads account id"
                        />
                      </label>

                      <label className="sm-field">
                        <span>Region</span>
                        <input
                          type="text"
                          value={accountForm.region}
                          onChange={(e) => handleAccountFormChange('region', e.target.value)}
                          placeholder="e.g. India"
                        />
                      </label>

                      <label className="sm-field">
                        <span>Time For Auto Input</span>
                        <input
                          type="time"
                          value={accountForm.timeForAutoInput}
                          onChange={(e) => handleAccountFormChange('timeForAutoInput', e.target.value)}
                        />
                      </label>

                      <label className="sm-field sm-field-full">
                        <span>KeyWords</span>
                        <textarea
                          value={accountForm.keywords}
                          onChange={(e) => handleAccountFormChange('keywords', e.target.value)}
                          placeholder="Enter keywords"
                          rows={3}
                        />
                      </label>

                      {(accountCreatedAt || accountUpdatedAt) && (
                        <div className="sm-account-meta sm-field-full">
                          <span><strong>Created At:</strong> {formatDateTime(accountCreatedAt)}</span>
                          <span><strong>Updated At:</strong> {formatDateTime(accountUpdatedAt)}</span>
                        </div>
                      )}

                      <div className="sm-form-actions sm-field-full">
                        <button type="submit" disabled={savingAccount}>
                          {savingAccount ? 'Saving...' : 'Save Account Details'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
