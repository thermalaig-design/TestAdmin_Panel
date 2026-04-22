import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import {
  createDonation,
  deleteDonation,
  fetchDonationsByTrust,
  updateDonation,
} from '../services/donationsService';
import './NoticeboardPage.css';

const DONATION_STATUS_OPTIONS = ['active', 'inactive'];
const DONATION_AMOUNT_TYPE_OPTIONS = ['fixed', 'variable', 'monthly'];
const DONATION_TYPE_OPTIONS = ['general', 'campaign', 'other'];
const PARTIAL_MONEY_RE = /^\d*(?:\.\d{0,2})?$/;
const MONEY_RE = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitials(value = '') {
  const safe = String(value || '').trim();
  if (!safe) return 'D';
  return safe.charAt(0).toUpperCase();
}

function parseAttachments(value = '') {
  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function attachmentsToText(attachments = []) {
  if (!Array.isArray(attachments)) return '';
  return attachments.map((item) => String(item || '').trim()).filter(Boolean).join('\n');
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '-';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  const hasDecimals = Math.round(amount * 100) % 100 !== 0;
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

export default function DonationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'dashboard';
  const trustId = trust?.id || null;
  const isCreateRoute = location.pathname === '/donations/create_donation';
  const isEditRoute = location.pathname === '/donations/edit_details';
  const isFormRoute = isCreateRoute || isEditRoute;
  const routeEditId = location.state?.editId || new URLSearchParams(location.search).get('id') || '';

  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const deferredSearch = useDeferredValue(search);
  const PAGE_SIZE = 10;

  const [form, setForm] = useState({
    name: '',
    description: '',
    amount: '',
    amount_type: '',
    status: 'active',
    type: '',
    attachments: '',
  });
  const [amountWarning, setAmountWarning] = useState('');

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      amount: '',
      amount_type: '',
      status: 'active',
      type: '',
      attachments: '',
    });
    setFormError('');
    setAmountWarning('');
    setEditingId(null);
  };

  const handleAmountChange = (rawValue) => {
    const value = String(rawValue || '').trim();
    if (!value) {
      setAmountWarning('');
      setForm((prev) => ({ ...prev, amount: '' }));
      return;
    }

    if (!PARTIAL_MONEY_RE.test(value)) {
      setAmountWarning('Enter a valid amount using numbers only (e.g., 345000.54).');
    } else {
      setAmountWarning('');
    }

    setForm((prev) => ({ ...prev, amount: value }));
  };

  const goToList = () => {
    navigate('/donations', { replace: true, state: { userName, trust, sidebarNavKey: currentSidebarNavKey } });
  };

  useEffect(() => {
    if (!trustId) {
      navigate('/dashboard', { replace: true, state: { userName, trust, sidebarNavKey: currentSidebarNavKey } });
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      const { data, error: fetchError } = await fetchDonationsByTrust(trustId);
      if (fetchError) setError(fetchError.message || 'Unable to load donations.');
      setDonations(data || []);
      setLoading(false);
    };

    load();
  }, [navigate, trustId, userName, trust, currentSidebarNavKey]);

  useEffect(() => {
    const closeMenu = () => setActiveMenuId(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  const filteredDonations = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    let list = [...donations];

    if (statusFilter !== 'all') {
      list = list.filter((item) => String(item?.status || 'active') === statusFilter);
    }

    if (term) {
      list = list.filter((item) => {
        const name = String(item?.name || '').toLowerCase();
        const description = String(item?.description || '').toLowerCase();
        const type = String(item?.type || '').toLowerCase();
        const amountType = String(item?.amount_type || '').toLowerCase();
        return name.includes(term) || description.includes(term) || type.includes(term) || amountType.includes(term);
      });
    }

    if (sortBy === 'name') {
      list.sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || '')));
    } else if (sortBy === 'date_oldest') {
      list.sort((left, right) => String(left?.created_at || '').localeCompare(String(right?.created_at || '')));
    } else {
      list.sort((left, right) => String(right?.created_at || '').localeCompare(String(left?.created_at || '')));
    }

    return list;
  }, [donations, deferredSearch, sortBy, statusFilter]);

  const activeCount = useMemo(
    () => donations.filter((item) => String(item?.status || 'active') === 'active').length,
    [donations]
  );
  const inactiveCount = Math.max(0, donations.length - activeCount);

  const selectedDonation = useMemo(
    () => filteredDonations.find((item) => item.id === selectedId) || null,
    [filteredDonations, selectedId]
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredDonations.length / PAGE_SIZE)),
    [filteredDonations.length]
  );

  const paginatedDonations = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredDonations.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredDonations]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortBy, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (loading || isFormRoute) return;
    if (!filteredDonations.length) {
      setSelectedId('');
      return;
    }
    const exists = filteredDonations.some((item) => item.id === selectedId);
    if (!exists) setSelectedId(filteredDonations[0].id);
  }, [filteredDonations, selectedId, loading, isFormRoute]);

  useEffect(() => {
    if (!isFormRoute) return;

    if (isCreateRoute) {
      resetForm();
      return;
    }

    if (!isEditRoute) return;
    const targetId = String(routeEditId || selectedId || '');
    if (!targetId) return;
    const target = donations.find((item) => String(item.id) === targetId);
    if (!target) return;

    setForm({
      name: target.name || '',
      description: target.description || '',
      amount: target.amount ?? '',
      amount_type: target.amount_type || '',
      status: target.status || 'active',
      type: target.type || '',
      attachments: attachmentsToText(target.attachments),
    });
    setEditingId(target.id);
    setFormError('');
    setAmountWarning('');
  }, [isFormRoute, isCreateRoute, isEditRoute, routeEditId, selectedId, donations]);

  const handleSave = async () => {
    setFormError('');
    if (!String(form.name || '').trim()) {
      setFormError('Donation name is required.');
      return;
    }

    const amountValue = String(form.amount || '').trim();
    if (amountValue !== '' && !MONEY_RE.test(amountValue)) {
      setFormError('Enter a valid amount using numbers only (e.g., 345000.54).');
      return;
    }

    if (amountWarning) {
      setFormError(amountWarning);
      return;
    }

    setSaving(true);
    const payload = {
      trust_id: trustId,
      name: form.name,
      description: form.description,
      amount: amountValue,
      amount_type: form.amount_type,
      status: form.status || 'active',
      type: form.type,
      attachments: parseAttachments(form.attachments),
    };

    if (editingId) {
      const { data, error: updateError } = await updateDonation(editingId, payload, trustId);
      if (updateError) {
        setFormError(updateError.message || 'Unable to update donation.');
        setSaving(false);
        return;
      }
      setDonations((prev) => prev.map((item) => (item.id === editingId ? data : item)));
    } else {
      const { data, error: createError } = await createDonation(payload);
      if (createError) {
        setFormError(createError.message || 'Unable to create donation.');
        setSaving(false);
        return;
      }
      setDonations((prev) => [data, ...prev]);
    }

    resetForm();
    setSaving(false);
    if (isFormRoute) goToList();
  };

  const handleDelete = async (item) => {
    const shouldDelete = window.confirm(`Delete donation "${item?.name || 'this item'}"?`);
    if (!shouldDelete) {
      setActiveMenuId(null);
      return;
    }

    setUpdatingId(item.id);
    const { error: deleteError } = await deleteDonation(item.id, trustId);
    if (deleteError) {
      setError(deleteError.message || 'Unable to delete donation.');
    } else {
      setDonations((prev) => prev.filter((entry) => entry.id !== item.id));
    }
    setUpdatingId(null);
    setActiveMenuId(null);
  };

  const handleEdit = (item) => {
    setForm({
      name: item.name || '',
      description: item.description || '',
      amount: item.amount ?? '',
      amount_type: item.amount_type || '',
      status: item.status || 'active',
      type: item.type || '',
      attachments: attachmentsToText(item.attachments),
    });
    setEditingId(item.id);
    setFormError('');
    setActiveMenuId(null);
    navigate(`/donations/edit_details?id=${item.id}`, {
      state: { userName, trust, editId: item.id, sidebarNavKey: currentSidebarNavKey },
    });
  };

  if (!trustId) return null;

  return (
    <div className="nb-root">
      <Sidebar
        trustName={trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
        onLogout={() => navigate('/login')}
      />

      <main className="nb-main">
        <PageHeader
          title="Donations"
          subtitle='Manage "Donations" records'
          onBack={() => {
            if (isFormRoute) {
              goToList();
              return;
            }
            navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } });
          }}
        />

        <section className="nb-content">
          {error && <div className="nb-error">{error}</div>}

          {isFormRoute && (
            <div className="nb-form-card">
              <h3>{editingId ? 'Edit Donation' : 'Create Donation'}</h3>
              <div className="nb-form-layout">
                <section className="nb-form-section">
                  <h4 className="nb-section-title">Donation Fields</h4>
                  <div className="nb-form-grid nb-form-grid-2">
                    <label>
                      <span>Name *</span>
                      <input
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter donation name"
                      />
                    </label>
                    <label>
                      <span>Status</span>
                      <select
                        value={form.status}
                        onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                      >
                        {DONATION_STATUS_OPTIONS.map((statusValue) => (
                          <option key={statusValue} value={statusValue}>
                            {statusValue}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Amount</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className={amountWarning ? 'dn-input-error' : ''}
                        value={form.amount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        placeholder="Enter amount"
                      />
                      {amountWarning && <small className="dn-input-warning">{amountWarning}</small>}
                    </label>
                    <label>
                      <span>Amount Type</span>
                      <select
                        value={form.amount_type}
                        onChange={(e) => setForm((prev) => ({ ...prev, amount_type: e.target.value }))}
                      >
                        <option value="">Select amount type</option>
                        {DONATION_AMOUNT_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Type</span>
                      <select
                        value={form.type}
                        onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                      >
                        <option value="">Select type</option>
                        {DONATION_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="nb-span-2">
                      <span>Description</span>
                      <textarea
                        rows={4}
                        value={form.description}
                        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Enter description"
                      />
                    </label>
                    <label className="nb-span-2">
                      <span>Attachments (one URL per line)</span>
                      <textarea
                        rows={4}
                        value={form.attachments}
                        onChange={(e) => setForm((prev) => ({ ...prev, attachments: e.target.value }))}
                        placeholder="https://.../file-1.jpg"
                      />
                    </label>
                  </div>
                </section>
              </div>

              {formError && <div className="nb-error">{formError}</div>}
              <div className="nb-form-actions">
                <button
                  className="nb-secondary-btn"
                  onClick={() => {
                    resetForm();
                    goToList();
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button className="nb-add-btn" onClick={handleSave} disabled={saving} type="button">
                  {saving ? 'Saving...' : editingId ? 'Update Donation' : 'Save Donation'}
                </button>
              </div>
            </div>
          )}

          {!isFormRoute && loading && <div className="nb-empty">Loading donations...</div>}

          {!isFormRoute && !loading && donations.length === 0 && (
            <div className="nb-empty">
              <button
                className="nb-add-btn nb-list-add-btn"
                type="button"
                onClick={() => navigate('/donations/create_donation', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
              >
                Add Donation
              </button>
              <div>No donation found for this trust. Create your first donation entry.</div>
            </div>
          )}

          {!isFormRoute && !loading && donations.length > 0 && (
            <section className="nb-profile-layout">
              <aside className="nb-left-panel">
                <div className="nb-left-head">
                  <h3>All Donations</h3>
                  <span className="nb-left-count">{donations.length}</span>
                </div>

                <input
                  className="nb-left-search"
                  placeholder="Search donation..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />

                <div className="nb-category-tabs">
                  <button
                    type="button"
                    className={`nb-category-tab ${statusFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('all')}
                  >
                    <span>All</span>
                    <b>{donations.length}</b>
                  </button>
                  <button
                    type="button"
                    className={`nb-category-tab ${statusFilter === 'active' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('active')}
                  >
                    <span>Active</span>
                    <b>{activeCount}</b>
                  </button>
                  <button
                    type="button"
                    className={`nb-category-tab ${statusFilter === 'inactive' ? 'active' : ''}`}
                    onClick={() => setStatusFilter('inactive')}
                  >
                    <span>Inactive</span>
                    <b>{inactiveCount}</b>
                  </button>
                </div>

                <button
                  className="nb-add-btn nb-list-add-btn"
                  type="button"
                  onClick={() => navigate('/donations/create_donation', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
                >
                  Add Donation
                </button>

                <div className="nb-filter-row">
                  <label className="nb-inline-field">
                    <span>Sort By</span>
                    <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                      <option value="date">Date (Newest)</option>
                      <option value="date_oldest">Date (Oldest)</option>
                      <option value="name">Name A-Z</option>
                    </select>
                  </label>
                </div>

                <div className="nb-left-list">
                  {filteredDonations.length === 0 && (
                    <div className="nb-empty">No donation matched your filters.</div>
                  )}
                  {paginatedDonations.map((item) => (
                    <button
                      key={item.id}
                      className={`nb-left-item ${selectedId === item.id ? 'active' : ''}`}
                      onClick={() => setSelectedId(item.id)}
                      type="button"
                    >
                      <div className="nb-left-avatar">{getInitials(item?.name)}</div>
                      <div className="nb-left-item-body">
                        <div className="nb-left-item-title">{item.name || '-'}</div>
                        <div className="nb-left-item-sub">{item.amount_type || item.type || '-'}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {filteredDonations.length > 0 && (
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
                {!selectedDonation && (
                  <div className="nb-empty">Select a donation to view details.</div>
                )}

                {selectedDonation && (
                  <>
                    <div className="nb-profile-hero">
                      <div className="nb-profile-hero-left">
                        <div className="nb-profile-avatar">{getInitials(selectedDonation.name)}</div>
                        <div>
                          <h3>{selectedDonation.name || '-'}</h3>
                          <p>{selectedDonation.type || selectedDonation.amount_type || 'Donation entry'}</p>
                          <div className="dn-hero-meta-chips">
                            {selectedDonation.amount_type ? (
                              <span className="dn-hero-chip">{selectedDonation.amount_type}</span>
                            ) : null}
                            {selectedDonation.type ? (
                              <span className="dn-hero-chip dn-hero-chip-soft">{selectedDonation.type}</span>
                            ) : null}
                            {selectedDonation.amount !== null && selectedDonation.amount !== undefined ? (
                              <span className="dn-hero-chip dn-hero-chip-money">Rs. {formatMoney(selectedDonation.amount)}</span>
                            ) : null}
                          </div>
                          <div className="nb-profile-hero-actions">
                            <button
                              className="nb-secondary-btn"
                              type="button"
                              onClick={() => handleEdit(selectedDonation)}
                            >
                              Edit Details
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="nb-card-menu-wrap">
                        <button
                          type="button"
                          className="nb-card-menu-btn"
                          title="Actions"
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveMenuId((prev) => (prev === selectedDonation.id ? null : selectedDonation.id));
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {activeMenuId === selectedDonation.id && (
                          <div className="nb-card-menu">
                            <button
                              type="button"
                              onClick={() => handleEdit(selectedDonation)}
                              disabled={updatingId === selectedDonation.id}
                            >
                              Edit Details
                            </button>
                            <button
                              type="button"
                              className="danger"
                              onClick={() => handleDelete(selectedDonation)}
                              disabled={updatingId === selectedDonation.id}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="nb-profile-details">
                      <div className="nb-profile-details-head">
                        <h3>Donation Details</h3>
                      </div>
                      <div className="nb-profile-detail-grid">
                        <div><span>Name</span><strong>{selectedDonation.name || '-'}</strong></div>
                        <div><span>Status</span><strong>{selectedDonation.status || '-'}</strong></div>
                        <div><span>Amount</span><strong>{selectedDonation.amount !== null && selectedDonation.amount !== undefined ? `Rs. ${formatMoney(selectedDonation.amount)}` : '-'}</strong></div>
                        <div><span>Amount Type</span><strong>{selectedDonation.amount_type || '-'}</strong></div>
                        <div><span>Type</span><strong>{selectedDonation.type || '-'}</strong></div>
                        <div><span>Created Date</span><strong>{formatDate(selectedDonation.created_at)}</strong></div>
                        <div><span>Updated Date</span><strong>{formatDate(selectedDonation.updated_at)}</strong></div>
                      </div>
                      <div className="nb-profile-detail-block">
                        <h4>Description</h4>
                        <p>{selectedDonation.description || '-'}</p>
                      </div>
                      <div className="nb-profile-detail-block">
                        <h4>Attachments</h4>
                        {selectedDonation.attachments?.length ? (
                          <ul className="nb-attachment-list">
                            {selectedDonation.attachments.map((item) => (
                              <li key={item}>
                                <a href={item} target="_blank" rel="noreferrer">
                                  {item}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>-</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </section>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}
