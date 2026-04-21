import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import {
  createContactTrust,
  deleteContactTrust,
  fetchContactTrustByTrust,
  updateContactTrust,
} from '../services/contactTrustService';
import './NoticeboardPage.css';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitials(value = '') {
  const safe = String(value || '').trim();
  if (!safe) return 'C';
  return safe.charAt(0).toUpperCase();
}

export default function ContactUsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'dashboard';
  const trustId = trust?.id || null;
  const isCreateRoute = location.pathname === '/contact-us/create_contact';
  const isEditRoute = location.pathname === '/contact-us/edit_details';
  const isFormRoute = isCreateRoute || isEditRoute;
  const routeEditId = location.state?.editId || new URLSearchParams(location.search).get('id') || '';

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const deferredSearch = useDeferredValue(search);
  const PAGE_SIZE = 10;

  const [form, setForm] = useState({
    facility_name: '',
    contact_number: '',
    email_id: '',
    contact_person: '',
  });

  const resetForm = () => {
    setForm({
      facility_name: '',
      contact_number: '',
      email_id: '',
      contact_person: '',
    });
    setFormError('');
    setEditingId(null);
  };

  const goToList = () => {
    navigate('/contact-us', { replace: true, state: { userName, trust, sidebarNavKey: currentSidebarNavKey } });
  };

  useEffect(() => {
    if (!trustId) {
      navigate('/dashboard', { replace: true, state: { userName, trust, sidebarNavKey: currentSidebarNavKey } });
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      const { data, error: fetchError } = await fetchContactTrustByTrust(trustId);
      if (fetchError) setError(fetchError.message || 'Unable to load contact details.');
      setContacts(data || []);
      setLoading(false);
    };

    load();
  }, [navigate, trustId, userName, trust, currentSidebarNavKey]);

  useEffect(() => {
    const closeMenu = () => setActiveMenuId(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  const filteredContacts = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    let list = [...contacts];

    if (term) {
      list = list.filter((item) => {
        const facilityName = String(item?.facility_name || '').toLowerCase();
        const contactPerson = String(item?.contact_person || '').toLowerCase();
        const email = String(item?.email_id || '').toLowerCase();
        const contactNumber = String(item?.contact_number || '').toLowerCase();
        return (
          facilityName.includes(term) ||
          contactPerson.includes(term) ||
          email.includes(term) ||
          contactNumber.includes(term)
        );
      });
    }

    if (sortBy === 'name') {
      list.sort((left, right) =>
        String(left?.facility_name || '').localeCompare(String(right?.facility_name || ''))
      );
    } else if (sortBy === 'date_oldest') {
      list.sort((left, right) =>
        String(left?.created_at || '').localeCompare(String(right?.created_at || ''))
      );
    } else {
      list.sort((left, right) =>
        String(right?.created_at || '').localeCompare(String(left?.created_at || ''))
      );
    }

    return list;
  }, [contacts, deferredSearch, sortBy]);

  const selectedContact = useMemo(
    () => filteredContacts.find((item) => item.id === selectedId) || null,
    [filteredContacts, selectedId]
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredContacts.length / PAGE_SIZE)),
    [filteredContacts.length]
  );

  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredContacts.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredContacts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortBy]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (loading || isFormRoute) return;
    if (!filteredContacts.length) {
      setSelectedId('');
      return;
    }
    const exists = filteredContacts.some((item) => item.id === selectedId);
    if (!exists) setSelectedId(filteredContacts[0].id);
  }, [filteredContacts, selectedId, loading, isFormRoute]);

  useEffect(() => {
    if (!isFormRoute) return;

    if (isCreateRoute) {
      resetForm();
      return;
    }

    if (!isEditRoute) return;
    const targetId = String(routeEditId || selectedId || '');
    if (!targetId) return;
    const target = contacts.find((item) => String(item.id) === targetId);
    if (!target) return;

    setForm({
      facility_name: target.facility_name || '',
      contact_number: target.contact_number || '',
      email_id: target.email_id || '',
      contact_person: target.contact_person || '',
    });
    setEditingId(target.id);
    setFormError('');
  }, [isFormRoute, isCreateRoute, isEditRoute, routeEditId, selectedId, contacts]);

  const handleSave = async () => {
    setFormError('');
    if (!form.facility_name.trim()) {
      setFormError('Facility name is required.');
      return;
    }

    setSaving(true);
    const payload = {
      trust_id: trustId,
      facility_name: form.facility_name,
      contact_number: form.contact_number,
      email_id: form.email_id,
      contact_person: form.contact_person,
    };

    if (editingId) {
      const { data, error: updateError } = await updateContactTrust(editingId, payload, trustId);
      if (updateError) {
        setFormError(updateError.message || 'Unable to update contact.');
        setSaving(false);
        return;
      }
      setContacts((prev) => prev.map((item) => (item.id === editingId ? data : item)));
    } else {
      const { data, error: createError } = await createContactTrust(payload);
      if (createError) {
        setFormError(createError.message || 'Unable to create contact.');
        setSaving(false);
        return;
      }
      setContacts((prev) => [data, ...prev]);
    }

    resetForm();
    setSaving(false);
    if (isFormRoute) goToList();
  };

  const handleDelete = async (item) => {
    const shouldDelete = window.confirm(`Delete contact for "${item?.facility_name || 'this facility'}"?`);
    if (!shouldDelete) {
      setActiveMenuId(null);
      return;
    }

    setUpdatingId(item.id);
    const { error: deleteError } = await deleteContactTrust(item.id, trustId);
    if (deleteError) {
      setError(deleteError.message || 'Unable to delete contact.');
    } else {
      setContacts((prev) => prev.filter((entry) => entry.id !== item.id));
    }
    setUpdatingId(null);
    setActiveMenuId(null);
  };

  const handleEdit = (item) => {
    setForm({
      facility_name: item.facility_name || '',
      contact_number: item.contact_number || '',
      email_id: item.email_id || '',
      contact_person: item.contact_person || '',
    });
    setEditingId(item.id);
    setFormError('');
    setActiveMenuId(null);
    navigate(`/contact-us/edit_details?id=${item.id}`, {
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
          title="Contact Us"
          subtitle='Manage "ContactTrust" details'
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
              <h3>{editingId ? 'Edit Contact' : 'Create Contact'}</h3>
              <div className="nb-form-layout">
                <section className="nb-form-section">
                  <h4 className="nb-section-title">Basic Info</h4>
                  <div className="nb-form-grid nb-form-grid-2">
                    <label>
                      <span>Facility Name *</span>
                      <input
                        value={form.facility_name}
                        onChange={(e) => setForm((prev) => ({ ...prev, facility_name: e.target.value }))}
                        placeholder="Enter facility name"
                      />
                    </label>
                    <label>
                      <span>Contact Person</span>
                      <input
                        value={form.contact_person}
                        onChange={(e) => setForm((prev) => ({ ...prev, contact_person: e.target.value }))}
                        placeholder="Enter contact person"
                      />
                    </label>
                    <label>
                      <span>Contact Number</span>
                      <input
                        value={form.contact_number}
                        onChange={(e) => setForm((prev) => ({ ...prev, contact_number: e.target.value }))}
                        placeholder="Enter contact number"
                      />
                    </label>
                    <label>
                      <span>Email ID</span>
                      <input
                        value={form.email_id}
                        onChange={(e) => setForm((prev) => ({ ...prev, email_id: e.target.value }))}
                        placeholder="Enter email address"
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
                  {saving ? 'Saving...' : editingId ? 'Update Contact' : 'Save Contact'}
                </button>
              </div>
            </div>
          )}

          {!isFormRoute && loading && <div className="nb-empty">Loading contacts...</div>}

          {!isFormRoute && !loading && contacts.length === 0 && (
            <div className="nb-empty">
              <button
                className="nb-add-btn nb-list-add-btn"
                type="button"
                onClick={() => navigate('/contact-us/create_contact', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
              >
                Add Contact
              </button>
              <div>No contact found for this trust. Create your first contact.</div>
            </div>
          )}

          {!isFormRoute && !loading && contacts.length > 0 && (
            <section className="nb-profile-layout">
              <aside className="nb-left-panel">
                <div className="nb-left-head">
                  <h3>All Contacts</h3>
                  <span className="nb-left-count">{contacts.length}</span>
                </div>

                <input
                  className="nb-left-search"
                  placeholder="Search contact..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />

                <button
                  className="nb-add-btn nb-list-add-btn"
                  type="button"
                  onClick={() => navigate('/contact-us/create_contact', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
                >
                  Add Contact
                </button>

                <div className="nb-filter-row">
                  <label className="nb-inline-field">
                    <span>Sort By</span>
                    <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                      <option value="name">Name A-Z</option>
                      <option value="date">Date (Newest)</option>
                      <option value="date_oldest">Date (Oldest)</option>
                    </select>
                  </label>
                </div>

                <div className="nb-left-list">
                  {filteredContacts.length === 0 && (
                    <div className="nb-empty">No contact matched your filters.</div>
                  )}
                  {paginatedContacts.map((item) => (
                    <button
                      key={item.id}
                      className={`nb-left-item ${selectedId === item.id ? 'active' : ''}`}
                      onClick={() => setSelectedId(item.id)}
                      type="button"
                    >
                      <div className="nb-left-avatar">{getInitials(item?.facility_name)}</div>
                      <div className="nb-left-item-body">
                        <div className="nb-left-item-title">{item.facility_name || '-'}</div>
                        <div className="nb-left-item-sub">{item.contact_person || '-'}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {filteredContacts.length > 0 && (
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
                {!selectedContact && (
                  <div className="nb-empty">Select a contact to view details.</div>
                )}

                {selectedContact && (
                  <>
                    <div className="nb-profile-hero">
                      <div className="nb-profile-hero-left">
                        <div className="nb-profile-avatar">{getInitials(selectedContact.facility_name)}</div>
                        <div>
                          <h3>{selectedContact.facility_name || '-'}</h3>
                          <div className="nb-profile-hero-actions">
                            <button
                              className="nb-secondary-btn"
                              type="button"
                              onClick={() => handleEdit(selectedContact)}
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
                            setActiveMenuId((prev) => (prev === selectedContact.id ? null : selectedContact.id));
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4 12.5-12.5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {activeMenuId === selectedContact.id && (
                          <div className="nb-card-menu">
                            <button
                              type="button"
                              onClick={() => handleEdit(selectedContact)}
                              disabled={updatingId === selectedContact.id}
                            >
                              Edit Details
                            </button>
                            <button
                              type="button"
                              className="danger"
                              onClick={() => handleDelete(selectedContact)}
                              disabled={updatingId === selectedContact.id}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="nb-profile-details">
                      <div className="nb-profile-details-head">
                        <h3>Contact Details</h3>
                      </div>
                      <div className="nb-profile-detail-grid">
                        <div><span>Facility Name</span><strong>{selectedContact.facility_name || '-'}</strong></div>
                        <div><span>Contact Person</span><strong>{selectedContact.contact_person || '-'}</strong></div>
                        <div><span>Contact Number</span><strong>{selectedContact.contact_number || '-'}</strong></div>
                        <div><span>Email ID</span><strong>{selectedContact.email_id || '-'}</strong></div>
                        <div><span>Created Date</span><strong>{formatDate(selectedContact.created_at)}</strong></div>
                        <div><span>Updated Date</span><strong>{formatDate(selectedContact.updated_at)}</strong></div>
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
