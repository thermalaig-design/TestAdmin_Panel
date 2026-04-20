import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import {
  createMember,
  fetchAllMembersDirectory,
  fetchRegisteredMembersByTrust,
  registerExistingMember,
  unregisterRegisteredMember,
  updateRegisteredMembership,
  updateRegisteredMember,
} from '../services/membersService';
import './SponsorsPage.css';

const EMPTY_FORM = {
  name: '',
  company_name: '',
  membership_number: '',
  role: '',
  joined_date: '',
  mobile: '',
  email: '',
  address_home: '',
  address_office: '',
  resident_landline: '',
  office_landline: '',
  is_active: true,
};

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'name_desc', label: 'Name Z-A' },
  { value: 'company_asc', label: 'Company A-Z' },
  { value: 'membership_asc', label: 'Membership No' },
  { value: 'joined_desc', label: 'Joined Date Newest' },
  { value: 'joined_asc', label: 'Joined Date Oldest' },
  { value: 'status_active', label: 'Active First' },
];
const PAGE_SIZE = 10;
const MEMBERS_CACHE_TTL_MS = 3 * 60 * 1000;
const CREATE_NEW_ROLE_VALUE = '__create_new_role__';

const initials = (value = '') =>
  value.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase() || 'M';

function matchesMemberSearch(member = {}, term = '') {
  const normalizedTerm = String(term || '').trim().toLowerCase();
  if (!normalizedTerm) return true;

  const searchableFields = [
    member.name,
    member.company_name,
    member.address_home,
    member.address_office,
    member.resident_landline,
    member.office_landline,
    member.mobile,
    member.email,
    member.membership_number,
    member.role,
    member.joined_date,
    member.member_type,
    member.is_active ? 'active' : 'inactive',
  ];

  return searchableFields.some((value) => String(value || '').toLowerCase().includes(normalizedTerm));
}

function compareMembers(left = {}, right = {}, sortBy = 'name_asc') {
  const leftName = String(left.name || '').toLowerCase();
  const rightName = String(right.name || '').toLowerCase();
  const leftCompany = String(left.company_name || '').toLowerCase();
  const rightCompany = String(right.company_name || '').toLowerCase();
  const leftMembership = String(left.membership_number || '').toLowerCase();
  const rightMembership = String(right.membership_number || '').toLowerCase();
  const leftJoined = String(left.joined_date || '');
  const rightJoined = String(right.joined_date || '');
  const leftActive = left.is_active ? 1 : 0;
  const rightActive = right.is_active ? 1 : 0;
  const leftId = String(left.id || left.member_id || '');
  const rightId = String(right.id || right.member_id || '');

  const byName = leftName.localeCompare(rightName, undefined, { sensitivity: 'base', numeric: true });
  const byNameDesc = rightName.localeCompare(leftName, undefined, { sensitivity: 'base', numeric: true });
  const byCompany = leftCompany.localeCompare(rightCompany, undefined, { sensitivity: 'base', numeric: true });
  const byMembership = leftMembership.localeCompare(rightMembership, undefined, { sensitivity: 'base', numeric: true });
  const byJoinedDesc = rightJoined.localeCompare(leftJoined);
  const byJoinedAsc = leftJoined.localeCompare(rightJoined);
  const byId = leftId.localeCompare(rightId, undefined, { numeric: true, sensitivity: 'base' });

  switch (sortBy) {
    case 'name_desc':
      return byNameDesc || byId;
    case 'company_asc':
      return byCompany || byName || byId;
    case 'membership_asc':
      return byMembership || byName || byId;
    case 'joined_desc':
      return byJoinedDesc || byName || byId;
    case 'joined_asc':
      return byJoinedAsc || byName || byId;
    case 'status_active':
      return rightActive - leftActive || byName || byId;
    case 'name_asc':
    default:
      return byName || byId;
  }
}

function toDirectoryMember(member = {}) {
  return {
    member_id: member.member_id,
    trust_id: member.trust_id,
    name: member.name || '',
    company_name: member.company_name || '',
    address_home: member.address_home || '',
    address_office: member.address_office || '',
    resident_landline: member.resident_landline || '',
    office_landline: member.office_landline || '',
    mobile: member.mobile || '',
    email: member.email || '',
    serial_no: member.serial_no || null,
    is_editable: member.member_type === 'my' || member.is_editable === true,
    member_type: member.member_type || 'others',
  };
}

function getMembersCacheKey(trustId) {
  return `members_page_cache_${trustId}`;
}

function readMembersCache(trustId) {
  if (!trustId) return null;
  try {
    const raw = sessionStorage.getItem(getMembersCacheKey(trustId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.timestamp) return null;
    if (!Array.isArray(parsed?.registeredMembers) || !Array.isArray(parsed?.directoryMembers)) return null;
    if (Date.now() - Number(parsed.timestamp) > MEMBERS_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeMembersCache(trustId, registeredMembers = [], directoryMembers = []) {
  if (!trustId) return;
  try {
    sessionStorage.setItem(
      getMembersCacheKey(trustId),
      JSON.stringify({
        timestamp: Date.now(),
        registeredMembers,
        directoryMembers,
      })
    );
  } catch {
    // Ignore cache write failures.
  }
}

export default function MembersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'dashboard';
  const trustId = trust?.id || null;
  const isCreateRoute = location.pathname === '/member/create_member';
  const cachedMembers = readMembersCache(trustId);

  const [registeredMembers, setRegisteredMembers] = useState(() => cachedMembers?.registeredMembers || []);
  const [directoryMembers, setDirectoryMembers] = useState(() => cachedMembers?.directoryMembers || []);
  const [loading, setLoading] = useState(() => !cachedMembers);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [registeringId, setRegisteringId] = useState(null);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [registeredSortBy, setRegisteredSortBy] = useState('name_asc');
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(isCreateRoute);
  const [showPicker, setShowPicker] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [editingRegistrationId, setEditingRegistrationId] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [useCustomMainRole, setUseCustomMainRole] = useState(false);
  const [useCustomRegisterRole, setUseCustomRegisterRole] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    membership_number: '',
    role: '',
    joined_date: '',
    is_active: true,
  });
  const [registerCandidate, setRegisterCandidate] = useState(null);
  const currentPageParam = Number(new URLSearchParams(location.search).get('page') || '1');

  useEffect(() => {
    if (!trustId) navigate('/dashboard', { replace: true, state: { userName, trust } });
  }, [trustId, navigate, trust, userName]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!trustId) return;
      setError('');
      setLoadingDirectory(true);

      const directoryPromise = fetchAllMembersDirectory(trustId);
      const { data: registeredData, error: registeredError } = await fetchRegisteredMembersByTrust(trustId);
      if (cancelled) return;

      if (registeredError) setError(registeredError.message || 'Unable to load registered members.');
      const nextRegistered = registeredData || [];
      setRegisteredMembers(nextRegistered);
      setLoading(false);

      const { data: directoryData, error: directoryError } = await directoryPromise;
      if (cancelled) return;

      if (directoryError) setError(directoryError.message || 'Unable to load members directory.');
      const nextDirectory = directoryData || [];
      setDirectoryMembers(nextDirectory);
      writeMembersCache(trustId, nextRegistered, nextDirectory);
      setLoadingDirectory(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [trustId]);

  useEffect(() => {
    if (!trustId) return;
    writeMembersCache(trustId, registeredMembers, directoryMembers);
  }, [trustId, registeredMembers, directoryMembers]);

  const selectedMember = useMemo(
    () => registeredMembers.find((member) => member.id === selectedId) || null,
    [registeredMembers, selectedId]
  );
  const trustRoleOptions = useMemo(() => {
    const uniqueRoles = new Set(
      (registeredMembers || [])
        .map((member) => String(member.role || '').trim())
        .filter(Boolean)
    );
    return [...uniqueRoles].sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })
    );
  }, [registeredMembers]);

  const detailMember = useMemo(
    () => registeredMembers.find((member) => member.id === detailId) || null,
    [registeredMembers, detailId]
  );

  const filteredRegisteredMembers = useMemo(
    () => registeredMembers.filter((member) => !hiddenIds.has(member.id) && matchesMemberSearch(member, searchTerm)),
    [registeredMembers, hiddenIds, searchTerm]
  );

  const sortedRegisteredMembers = useMemo(
    () => [...filteredRegisteredMembers].sort((left, right) => compareMembers(left, right, registeredSortBy)),
    [filteredRegisteredMembers, registeredSortBy]
  );

  const filteredDirectoryMembers = useMemo(() => {
    return directoryMembers.filter((member) => matchesMemberSearch(member, searchTerm));
  }, [directoryMembers, searchTerm]);

  const sortedDirectoryMembers = useMemo(
    () => [...filteredDirectoryMembers].sort((left, right) => compareMembers(left, right, 'name_asc')),
    [filteredDirectoryMembers]
  );

  const hasRegisteredMembers = sortedRegisteredMembers.length > 0;
  const visibleMembers = hasRegisteredMembers ? sortedRegisteredMembers : sortedDirectoryMembers;
  const totalVisibleMembers = visibleMembers.length;
  const totalPages = Math.max(1, Math.ceil(totalVisibleMembers / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, currentPageParam || 1), totalPages);
  const paginatedVisibleMembers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return visibleMembers.slice(start, start + PAGE_SIZE);
  }, [currentPage, visibleMembers]);

  const myDirectoryMembers = useMemo(
    () => sortedDirectoryMembers.filter((member) => member.member_type === 'my'),
    [sortedDirectoryMembers]
  );

  const otherDirectoryMembers = useMemo(
    () => sortedDirectoryMembers.filter((member) => member.member_type === 'others'),
    [sortedDirectoryMembers]
  );

  useEffect(() => {
    if (isCreateRoute) return;
    const params = new URLSearchParams(location.search);
    const existing = Number(params.get('page') || '1');
    if (existing === currentPage) return;
    params.set('page', String(currentPage));
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true, state: location.state });
  }, [currentPage, isCreateRoute, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (isCreateRoute) return;
    const params = new URLSearchParams(location.search);
    params.set('page', '1');
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true, state: location.state });
  }, [isCreateRoute, location.pathname, location.state, location.search, navigate, searchTerm, registeredSortBy]);

  const goToPage = (page) => {
    const nextPage = Math.min(Math.max(1, page), totalPages);
    const params = new URLSearchParams(location.search);
    params.set('page', String(nextPage));
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: false, state: location.state });
  };

  useEffect(() => {
    if (selectedMember) {
      setForm({
        name: selectedMember.name || '',
        company_name: selectedMember.company_name || '',
        membership_number: selectedMember.membership_number || '',
        role: selectedMember.role || '',
        joined_date: selectedMember.joined_date || '',
        mobile: selectedMember.mobile || '',
        email: selectedMember.email || '',
        address_home: selectedMember.address_home || '',
        address_office: selectedMember.address_office || '',
        resident_landline: selectedMember.resident_landline || '',
        office_landline: selectedMember.office_landline || '',
        is_active: selectedMember.is_active !== false,
      });
      setUseCustomMainRole(
        !!selectedMember.role && !trustRoleOptions.includes(String(selectedMember.role || '').trim())
      );
    } else {
      setForm(EMPTY_FORM);
      setUseCustomMainRole(false);
    }
  }, [selectedMember, trustRoleOptions]);

  const openNewMemberForm = () => {
    setShowPicker(false);
    setShowRegisterForm(false);
    setShowDetailModal(false);
    setUseCustomMainRole(false);
    navigate('/member/create_member', { state: { userName, trust } });
  };

  const openRegisterForm = (directoryMember) => {
    setRegisterCandidate(directoryMember);
    setEditingRegistrationId(null);
    setRegisterForm({
      membership_number: '',
      role: '',
      joined_date: '',
      is_active: true,
    });
    setUseCustomRegisterRole(false);
    setSaveError('');
    setShowRegisterForm(true);
  };

  const openRegistrationEditForm = (registeredMember) => {
    setRegisterCandidate(registeredMember);
    setEditingRegistrationId(registeredMember.id);
    setRegisterForm({
      membership_number: registeredMember.membership_number || '',
      role: registeredMember.role || '',
      joined_date: registeredMember.joined_date || '',
      is_active: registeredMember.is_active !== false,
    });
    setUseCustomRegisterRole(
      !!registeredMember.role && !trustRoleOptions.includes(String(registeredMember.role || '').trim())
    );
    setSaveError('');
    setShowDetailModal(false);
    setShowRegisterForm(true);
  };

  const openEdit = (registrationId) => {
    setSelectedId(registrationId);
    setSaveError('');
    setShowForm(true);
    setShowDetailModal(false);
    setShowPicker(false);
  };

  const openDetail = (registrationId) => {
    setDetailId(registrationId);
    setShowDetailModal(true);
  };

  const openPicker = () => {
    setSearchTerm('');
    setShowPicker(true);
  };

  const handleRegisterExisting = async (directoryMember) => {
    if (!directoryMember?.member_id) return;
    setRegisteringId(directoryMember.member_id);
    setSaveError('');
    const action = editingRegistrationId
      ? updateRegisteredMembership(editingRegistrationId, registerForm, trustId)
      : registerExistingMember(trustId, directoryMember.member_id, registerForm);
    const { data, error: registerError } = await action;
    if (registerError) {
      setSaveError(registerError.message || 'Unable to register member for this trust.');
    } else if (data) {
      setRegisteredMembers((prev) => {
        const exists = prev.some((item) => item.id === data.id);
        return exists ? prev.map((item) => (item.id === data.id ? data : item)) : [data, ...prev];
      });
      setDirectoryMembers((prev) => {
        const nextMember = toDirectoryMember(data);
        const exists = prev.some((item) => item.member_id === nextMember.member_id);
        return exists
          ? prev.map((item) => (item.member_id === nextMember.member_id ? { ...item, ...nextMember } : item))
          : [nextMember, ...prev];
      });
      setSelectedId(data.id);
      setShowRegisterForm(false);
      setShowPicker(false);
      setRegisterCandidate(null);
      setEditingRegistrationId(null);
    }
    setRegisteringId(null);
  };

  const handleSave = async () => {
    setSaveError('');
    if (!form.name.trim()) {
      setSaveError('Member name is required.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      company_name: form.company_name.trim() || null,
      membership_number: form.membership_number.trim() || null,
      role: form.role.trim() || null,
      joined_date: form.joined_date || null,
      mobile: form.mobile.trim() || null,
      email: form.email.trim() || null,
      address_home: form.address_home.trim() || null,
      address_office: form.address_office.trim() || null,
      resident_landline: form.resident_landline.trim() || null,
      office_landline: form.office_landline.trim() || null,
      is_active: !!form.is_active,
    };

    setSaving(true);
    if (selectedMember?.id) {
      const { data, error: updateError } = await updateRegisteredMember(selectedMember.id, payload, trustId);
      if (updateError) {
        setSaveError(updateError.message || 'Unable to update member.');
      } else if (data) {
        setRegisteredMembers((prev) => prev.map((member) => (member.id === selectedMember.id ? data : member)));
        setDirectoryMembers((prev) =>
          prev.map((item) => (item.member_id === data.member_id ? { ...item, ...toDirectoryMember(data) } : item))
        );
        setShowForm(false);
      }
    } else {
      const { data, error: createError } = await createMember(trustId, payload);
      if (createError) {
        setSaveError(createError.message || 'Unable to create member.');
      } else if (data) {
        setRegisteredMembers((prev) => [data, ...prev]);
        setDirectoryMembers((prev) => [toDirectoryMember(data), ...prev]);
        if (isCreateRoute) {
          navigate('/member', { state: { userName, trust } });
        } else {
          setSelectedId(data.id);
          setShowForm(false);
        }
      }
    }
    setSaving(false);
  };

  const handleUnregister = async (registrationId) => {
    const ok = window.confirm('Unregister this member from the current trust? This will not delete the member from the members table.');
    if (!ok) return;
    setSaveError('');
    const { error: unregisterError } = await unregisterRegisteredMember(registrationId, trustId);
    if (unregisterError) {
      setSaveError(unregisterError.message || 'Unable to unregister member from this trust.');
      return;
    }
    setRegisteredMembers((prev) => prev.filter((member) => member.id !== registrationId));
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(registrationId);
      return next;
    });
    if (selectedId === registrationId) setSelectedId(null);
    if (detailId === registrationId) {
      setDetailId(null);
      setShowDetailModal(false);
    }
  };

  if (!trustId) return null;

  return (
    <div className="sp-root">
      <Sidebar
        trustName={trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
        onLogout={() => navigate('/login')}
      />

      <main className="sp-main">
        <PageHeader
          title="Members"
          subtitle="Manage registered members for the current trust"
          onBack={() => {
            if (isCreateRoute) {
              navigate('/member', { state: { userName, trust } });
              return;
            }
            navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } });
          }}
        />

        {error && <div className="sp-error">{error}</div>}
        {saveError && !(isCreateRoute || showForm) && <div className="sp-error">{saveError}</div>}

        <div className={`sp-content ${isCreateRoute || showForm ? 'form-only' : ''}`}>
          {!isCreateRoute && !showForm && (
            <>
              <div className="sp-modal-search">
                <input
                  placeholder="Search by name, company, membership no, role, mobile, email, address, or status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select value={registeredSortBy} onChange={(e) => setRegisteredSortBy(e.target.value)}>
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <button className="sp-add-btn" onClick={openPicker} type="button">Add a Member</button>
              </div>

              <section className="sp-list">
                {loading && <div className="sp-loading">Loading members...</div>}

                {!loading && totalVisibleMembers === 0 && (
                  <div className="sp-empty">
                    <div className="sp-empty-icon">M</div>
                    <h3>No matching members found</h3>
                    <p>Filter members using columns from both member and registered-member data.</p>
                    <button className="sp-add-btn" onClick={openPicker}>Add a Member</button>
                  </div>
                )}

                {!loading && totalVisibleMembers > 0 && (
                  <div className="sp-modal-section sp-list-section my">
                    <div className="sp-section-title-row">
                      <div className="sp-modal-section-title">{hasRegisteredMembers ? 'Registered Members' : 'Members Directory'}</div>
                      <span className="sp-section-count">Total: {totalVisibleMembers}</span>
                    </div>
                    {paginatedVisibleMembers.map((member) => (
                      <div
                        key={member.id || member.member_id}
                        className={`sp-card ${selectedId === member.id ? 'active' : ''} ${member.member_type === 'my' ? 'my' : 'other'}`}
                        onClick={() => {
                          if (!hasRegisteredMembers) return;
                          setSelectedId(member.id);
                          openDetail(member.id);
                        }}
                      >
                        <div className="sp-card-avatar">
                          <span>{initials(member.name)}</span>
                        </div>
                        <div className="sp-card-body">
                          <div className="sp-card-title-row">
                            <div className="sp-card-title">{member.name}</div>
                            <span className={`sp-card-badge ${member.member_type === 'my' ? 'my' : 'other'}`}>
                              {member.member_type === 'my' ? 'My Member' : 'Others'}
                            </span>
                          </div>
                          <div className="sp-card-sub">{member.company_name || member.membership_number || 'No company or membership number'}</div>
                          {member.role && <div className="sp-card-tag">{member.role}</div>}
                        </div>
                        <div className="sp-card-actions">
                          <button
                            className={`sp-status-btn ${hasRegisteredMembers && !member.is_active ? 'inactive' : 'active'}`}
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {hasRegisteredMembers ? (member.is_active ? 'Active' : 'Inactive') : 'Directory'}
                          </button>
                          {hasRegisteredMembers ? (
                            <button
                              className="sp-icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRegistrationEditForm(member);
                              }}
                              type="button"
                            >
                              Edit Registration
                            </button>
                          ) : (
                            <button
                              className="sp-icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRegisterForm(member);
                              }}
                              type="button"
                            >
                              Register
                            </button>
                          )}
                          {hasRegisteredMembers && member.is_editable && (
                            <button
                              className="sp-icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(member.id);
                              }}
                              type="button"
                            >
                              Edit
                            </button>
                          )}
                          {hasRegisteredMembers && (
                            <button
                              className="sp-icon-btn danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnregister(member.id);
                              }}
                              type="button"
                            >
                              Unregister
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="sp-pagination">
                      <button
                        className="sp-icon-btn"
                        type="button"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage <= 1}
                      >
                        Prev
                      </button>
                      <span className="sp-pagination-label">Page {currentPage} of {totalPages}</span>
                      <button
                        className="sp-icon-btn"
                        type="button"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}

          {(isCreateRoute || showForm) && (
            <section className="sp-form">
              <div className="sp-form-card">
                <div className="sp-form-title">{selectedId ? 'Edit Member' : 'Create New Member'}</div>

                <div className="sp-form-section">
                  <div className="sp-form-section-title">Members Table</div>
                  <div className="sp-grid">
                    <label className="sp-field">
                      <span>Member Name *</span>
                      <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
                    </label>
                    <label className="sp-field">
                      <span>Company Name</span>
                      <input value={form.company_name} onChange={(e) => setForm((prev) => ({ ...prev, company_name: e.target.value }))} />
                    </label>
                    <label className="sp-field">
                      <span>Mobile</span>
                      <input value={form.mobile} onChange={(e) => setForm((prev) => ({ ...prev, mobile: e.target.value }))} />
                    </label>
                    <label className="sp-field">
                      <span>Email</span>
                      <input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
                    </label>
                    <label className="sp-field">
                      <span>Resident Landline</span>
                      <input value={form.resident_landline} onChange={(e) => setForm((prev) => ({ ...prev, resident_landline: e.target.value }))} />
                    </label>
                    <label className="sp-field">
                      <span>Office Landline</span>
                      <input value={form.office_landline} onChange={(e) => setForm((prev) => ({ ...prev, office_landline: e.target.value }))} />
                    </label>
                    <label className="sp-field sp-span-2">
                      <span>Home Address</span>
                      <input value={form.address_home} onChange={(e) => setForm((prev) => ({ ...prev, address_home: e.target.value }))} />
                    </label>
                    <label className="sp-field sp-span-2">
                      <span>Office Address</span>
                      <input value={form.address_office} onChange={(e) => setForm((prev) => ({ ...prev, address_office: e.target.value }))} />
                    </label>
                  </div>
                </div>

                <div className="sp-form-section">
                  <div className="sp-form-section-title">Registered Members Table</div>
                  <div className="sp-grid">
                    <label className="sp-field">
                      <span>Membership Number</span>
                      <input value={form.membership_number} onChange={(e) => setForm((prev) => ({ ...prev, membership_number: e.target.value }))} />
                    </label>
                    <label className="sp-field">
                      <span>Role</span>
                      <select
                        value={useCustomMainRole ? CREATE_NEW_ROLE_VALUE : (form.role || '')}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          if (nextValue === CREATE_NEW_ROLE_VALUE) {
                            setUseCustomMainRole(true);
                            setForm((prev) => ({ ...prev, role: '' }));
                            return;
                          }
                          setUseCustomMainRole(false);
                          setForm((prev) => ({ ...prev, role: nextValue }));
                        }}
                      >
                        <option value="">Select role</option>
                        {trustRoleOptions.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                        <option value={CREATE_NEW_ROLE_VALUE}>+ Create New Role</option>
                      </select>
                      {useCustomMainRole && (
                        <input
                          placeholder="Enter new role"
                          value={form.role}
                          onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                        />
                      )}
                    </label>
                    <label className="sp-field">
                      <span>Joined Date</span>
                      <input type="date" value={form.joined_date} onChange={(e) => setForm((prev) => ({ ...prev, joined_date: e.target.value }))} />
                    </label>
                    <label className="sp-field">
                      <span>Status</span>
                      <select value={form.is_active ? 'active' : 'inactive'} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.value === 'active' }))}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                  </div>
                </div>

                {saveError && <div className="sp-error">{saveError}</div>}

                <div className="sp-form-actions">
                  <button
                    className="sp-secondary"
                    onClick={() => {
                      if (isCreateRoute) {
                        navigate('/member', { state: { userName, trust } });
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
                    {saving ? 'Saving...' : selectedId ? 'Save Member' : 'Create Member'}
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>

        {!isCreateRoute && showPicker && (
          <div className="sp-modal-overlay" onClick={() => setShowPicker(false)}>
            <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sp-modal-head">
                <div>
                  <h3>Select Member</h3>
                  <p>Search by name, company, mobile, or email.</p>
                </div>
                <button className="sp-modal-close" onClick={() => setShowPicker(false)} type="button">x</button>
              </div>
              <div className="sp-modal-search">
                <input
                  placeholder="Search by name, company, membership no, role, mobile, email, address, or status..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button className="sp-add-btn" onClick={openNewMemberForm} type="button">
                  Create New Member
                </button>
              </div>
              <div className="sp-modal-list">
                {loadingDirectory && (
                  <div className="sp-modal-empty">Loading members...</div>
                )}
                {myDirectoryMembers.length > 0 && (
                  <div className="sp-modal-section my">
                    <div className="sp-modal-section-title">My Members</div>
                    {myDirectoryMembers.map((member) => (
                      <div
                        key={member.member_id}
                        className="sp-modal-item"
                        onClick={() => openRegisterForm(member)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openRegisterForm(member);
                          }
                        }}
                      >
                        <div>
                          <div className="sp-modal-title-row">
                            <div className="sp-modal-title">{member.name}</div>
                            <span className="sp-modal-badge my">My Member</span>
                          </div>
                          <div className="sp-modal-sub">{member.company_name || 'No company'}</div>
                          <div className="sp-modal-sub">{member.mobile || member.email || ''}</div>
                        </div>
                        <div className="sp-modal-actions">
                          <button className="sp-icon-btn" type="button" onClick={(e) => { e.stopPropagation(); openRegisterForm(member); }}>
                            Add to Trust
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {otherDirectoryMembers.length > 0 && (
                  <div className="sp-modal-section other">
                    <div className="sp-modal-section-title">Other Members</div>
                    {otherDirectoryMembers.map((member) => (
                      <div
                        key={member.member_id}
                        className="sp-modal-item"
                        onClick={() => openRegisterForm(member)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openRegisterForm(member);
                          }
                        }}
                      >
                        <div>
                          <div className="sp-modal-title-row">
                            <div className="sp-modal-title">{member.name}</div>
                            <span className="sp-modal-badge other">Others</span>
                          </div>
                          <div className="sp-modal-sub">{member.company_name || 'No company'}</div>
                          <div className="sp-modal-sub">{member.mobile || member.email || ''}</div>
                        </div>
                        <div className="sp-modal-actions">
                          <button className="sp-icon-btn" type="button" onClick={(e) => { e.stopPropagation(); openRegisterForm(member); }}>
                            Add to Trust
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!loadingDirectory && filteredDirectoryMembers.length === 0 && (
                  <div className="sp-modal-empty">No members found.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {showRegisterForm && registerCandidate && (
          <div className="sp-modal-overlay" onClick={() => setShowRegisterForm(false)}>
            <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sp-modal-head">
                <div>
                  <h3>{editingRegistrationId ? 'Edit Registered Member' : 'Register Member to Trust'}</h3>
                  <p>{registerCandidate.name || 'Selected member'}</p>
                </div>
                <button className="sp-modal-close" onClick={() => setShowRegisterForm(false)} type="button">x</button>
              </div>
              <div className="sp-detail-info" style={{ marginBottom: '12px' }}>
                <div><strong>Company:</strong> {registerCandidate.company_name || 'No company'}</div>
                <div><strong>Mobile:</strong> {registerCandidate.mobile || '-'}</div>
                <div><strong>Member Type:</strong> {registerCandidate.member_type === 'my' ? 'My Member' : 'Others'}</div>
              </div>
              <div className="sp-modal-form">
                <label>
                  <span>Membership Number</span>
                  <input
                    value={registerForm.membership_number}
                    onChange={(e) => setRegisterForm((prev) => ({ ...prev, membership_number: e.target.value }))}
                  />
                </label>
                <label>
                  <span>Role</span>
                  <select
                    value={useCustomRegisterRole ? CREATE_NEW_ROLE_VALUE : (registerForm.role || '')}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      if (nextValue === CREATE_NEW_ROLE_VALUE) {
                        setUseCustomRegisterRole(true);
                        setRegisterForm((prev) => ({ ...prev, role: '' }));
                        return;
                      }
                      setUseCustomRegisterRole(false);
                      setRegisterForm((prev) => ({ ...prev, role: nextValue }));
                    }}
                  >
                    <option value="">Select role</option>
                    {trustRoleOptions.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                    <option value={CREATE_NEW_ROLE_VALUE}>+ Create New Role</option>
                  </select>
                  {useCustomRegisterRole && (
                    <input
                      placeholder="Enter new role"
                      value={registerForm.role}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, role: e.target.value }))}
                    />
                  )}
                </label>
                <label>
                  <span>Joined Date</span>
                  <input
                    type="date"
                    value={registerForm.joined_date}
                    onChange={(e) => setRegisterForm((prev) => ({ ...prev, joined_date: e.target.value }))}
                  />
                </label>
                <label>
                  <span>Status</span>
                  <select
                    value={registerForm.is_active ? 'active' : 'inactive'}
                    onChange={(e) => setRegisterForm((prev) => ({ ...prev, is_active: e.target.value === 'active' }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                {saveError && <div className="sp-error">{saveError}</div>}
                <div className="sp-form-actions">
                  <button className="sp-secondary" onClick={() => setShowRegisterForm(false)} type="button">Cancel</button>
                  <button
                    className="sp-primary"
                    onClick={() => handleRegisterExisting(registerCandidate)}
                    type="button"
                    disabled={registeringId === registerCandidate.member_id}
                  >
                    {registeringId === registerCandidate.member_id ? 'Saving...' : editingRegistrationId ? 'Save Changes' : 'Save to Trust'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDetailModal && detailMember && (
          <div className="sp-modal-overlay" onClick={() => setShowDetailModal(false)}>
            <div className="sp-modal sp-detail-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sp-modal-head">
                <div>
                  <h3>{detailMember.name || 'Member'}</h3>
                  <p>{detailMember.company_name || 'No company name'}</p>
                </div>
                <button className="sp-modal-close" onClick={() => setShowDetailModal(false)} type="button">x</button>
              </div>

              <div className="sp-detail-body">
                <div className="sp-detail-avatar">
                  <span>{initials(detailMember.name)}</span>
                </div>
                <div className="sp-detail-info">
                  <div><strong>Member Type:</strong> {detailMember.member_type === 'my' ? 'My Member' : 'Others'}</div>
                  <div><strong>Editable:</strong> {detailMember.is_editable ? 'Yes' : 'No'}</div>
                  {detailMember.membership_number && <div><strong>Membership No:</strong> {detailMember.membership_number}</div>}
                  {detailMember.role && <div><strong>Role:</strong> {detailMember.role}</div>}
                  {detailMember.joined_date && <div><strong>Joined:</strong> {detailMember.joined_date}</div>}
                  {detailMember.mobile && <div><strong>Mobile:</strong> {detailMember.mobile}</div>}
                  {detailMember.email && <div><strong>Email:</strong> {detailMember.email}</div>}
                  {detailMember.address_home && <div><strong>Home Address:</strong> {detailMember.address_home}</div>}
                  {detailMember.address_office && <div><strong>Office Address:</strong> {detailMember.address_office}</div>}
                  {detailMember.resident_landline && <div><strong>Resident Landline:</strong> {detailMember.resident_landline}</div>}
                  {detailMember.office_landline && <div><strong>Office Landline:</strong> {detailMember.office_landline}</div>}
                  <div><strong>Status:</strong> {detailMember.is_active ? 'Active' : 'Inactive'}</div>
                </div>
              </div>

              <div className="sp-detail-actions">
                <button
                  className="sp-icon-btn danger"
                  type="button"
                  onClick={() => handleUnregister(detailMember.id)}
                >
                  Unregister
                </button>
                <button
                  className="sp-icon-btn"
                  type="button"
                  onClick={() => openRegistrationEditForm(detailMember)}
                >
                  Edit Registration
                </button>
                {detailMember.is_editable && (
                  <button
                    className="sp-icon-btn"
                    type="button"
                    onClick={() => {
                      setShowDetailModal(false);
                      openEdit(detailMember.id);
                    }}
                  >
                    Edit Member
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
