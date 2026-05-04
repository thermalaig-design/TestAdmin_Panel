import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import { createMemberRole, fetchMemberRolesByTrust, fetchRegisteredMembersByTrust, updateMemberRole } from '../services/membersService';
import { getCachedQueryValue } from '../services/requestCache';
import './ExecutiveBodyPage.css';

const ROLE_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'committee', label: 'Committee' },
  { value: 'elected', label: 'Elected' },
];
const LEFT_PAGE_SIZE = 8;

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function initials(name = '') {
  const text = toText(name);
  if (!text) return 'M';
  return (
    text
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((item) => item[0]?.toUpperCase() || '')
      .join('') || 'M'
  );
}

function formatDate(value) {
  const raw = toText(value);
  if (!raw) return '-';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRoleType(value) {
  const normalized = toText(value).toLowerCase();
  if (!normalized) return '-';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export default function ExecutiveBodyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'quick-actions';
  const trustId = trust?.id || null;

  const [roleMembers, setRoleMembers] = useState([]);
  const [registeredMembers, setRegisteredMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
  const [roleTypeFilter, setRoleTypeFilter] = useState('all');
  const [selectedGroupKey, setSelectedGroupKey] = useState('');
  const [leftPage, setLeftPage] = useState(1);
  const [editRoleId, setEditRoleId] = useState('');
  const [editForm, setEditForm] = useState({ role_type: 'committee', title: '', subtitle: '' });
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ reg_id: '', role_type: 'committee', title: '', subtitle: '' });
  const [createMemberSearch, setCreateMemberSearch] = useState('');
  const [createError, setCreateError] = useState('');
  const [createSaving, setCreateSaving] = useState(false);
  const normalizedTrustId = String(trustId || '');
  const backdropMouseDownRef = useRef({ edit: false, create: false });
  const isAnyModalOpen = Boolean(editRoleId) || createOpen;

  useEffect(() => {
    if (!trustId) {
      navigate('/dashboard', { replace: true, state: { userName, trust, sidebarNavKey: currentSidebarNavKey } });
      return;
    }

    let cancelled = false;
    const roleCacheKey = `members:member-roles:${trustId}`;
    const registeredCacheKey = `members:registered-by-trust:${trustId}`;
    const cachedRoles = getCachedQueryValue(roleCacheKey);
    const cachedRegistered = getCachedQueryValue(registeredCacheKey);

    if (cachedRoles?.data && Array.isArray(cachedRoles.data)) {
      const trustOnlyRoleData = cachedRoles.data.filter(
        (item) => String(item?.member?.trust_id || '') === normalizedTrustId
      );
      setRoleMembers(trustOnlyRoleData);
      setSelectedGroupKey((prev) => prev || toText(trustOnlyRoleData?.[0]?.title).toLowerCase() || '');
      setLoading(false);
    }

    if (cachedRegistered?.data && Array.isArray(cachedRegistered.data)) {
      const trustOnlyRegisteredData = cachedRegistered.data.filter(
        (item) => String(item?.trust_id || '') === normalizedTrustId
      );
      setRegisteredMembers(trustOnlyRegisteredData);
    }

    const load = async () => {
      if (!(cachedRoles?.data && Array.isArray(cachedRoles.data))) setLoading(true);
      setError('');
      const { data: roleData, error: fetchError } = await fetchMemberRolesByTrust(trustId);

      if (fetchError) {
        if (cancelled) return;
        setError(fetchError.message || 'Unable to load executive body roles.');
        setRoleMembers([]);
        setRegisteredMembers([]);
        setLoading(false);
        return;
      }

      const trustOnlyRoleData = (roleData || []).filter(
        (item) => String(item?.member?.trust_id || '') === normalizedTrustId
      );

      if (cancelled) return;
      setRoleMembers(trustOnlyRoleData);
      setSelectedGroupKey((prev) => prev || toText(trustOnlyRoleData?.[0]?.title).toLowerCase() || '');
      setLoading(false);

      // Lazy load: this data is needed mainly for create modal dropdown, so don't block initial paint.
      const { data: registeredData } = await fetchRegisteredMembersByTrust(trustId);
      if (cancelled) return;
      const trustOnlyRegisteredData = (registeredData || []).filter(
        (item) => String(item?.trust_id || '') === normalizedTrustId
      );
      setRegisteredMembers(trustOnlyRegisteredData);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [navigate, trustId, trust, userName, currentSidebarNavKey, normalizedTrustId]);

  useEffect(() => {
    if (!isAnyModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAnyModalOpen]);

  const filteredRoleMembers = useMemo(() => {
    const term = toText(search).toLowerCase();
    return (roleMembers || [])
      .filter((item) => {
        const roleType = toText(item?.role_type).toLowerCase();
        if (roleTypeFilter !== 'all' && roleType !== roleTypeFilter) return false;
        if (!term) return true;

        const member = item?.member || {};
        const searchable = [
          item?.title,
          item?.subtitle,
          item?.role_type,
          member?.name,
          member?.role,
          member?.membership_number,
          member?.mobile,
          member?.email,
          member?.company_name,
        ]
          .map((value) => toText(value).toLowerCase())
          .filter(Boolean);

        return searchable.some((value) => value.includes(term));
      })
      .sort((left, right) =>
        toText(left?.member?.name).localeCompare(toText(right?.member?.name), undefined, { sensitivity: 'base' })
      );
  }, [roleMembers, roleTypeFilter, search]);

  const roleTypeCounts = useMemo(() => {
    const counts = { all: (roleMembers || []).length, committee: 0, elected: 0 };
    (roleMembers || []).forEach((item) => {
      const roleType = toText(item?.role_type).toLowerCase();
      if (roleType === 'committee') counts.committee += 1;
      if (roleType === 'elected') counts.elected += 1;
    });
    return counts;
  }, [roleMembers]);

  const groupedRoleMembers = useMemo(() => {
    const groups = new Map();
    filteredRoleMembers.forEach((item) => {
      const key = toText(item?.title).toLowerCase() || `untitled-${item?.id}`;
      if (!groups.has(key)) {
        groups.set(key, {
          groupKey: key,
          title: toText(item?.title) || 'Member',
          count: 0,
          roleTypes: new Set(),
          representative: item,
        });
      }
      const group = groups.get(key);
      group.count += 1;
      group.roleTypes.add(toText(item?.role_type).toLowerCase());
    });
    return Array.from(groups.values()).map((group) => {
      const roleTypeLabel =
        group.roleTypes.size > 1
          ? 'Mixed'
          : formatRoleType(Array.from(group.roleTypes)[0] || '');
      return {
        ...group,
        roleTypeLabel,
      };
    }).sort((left, right) => {
      const base = toText(left?.title).localeCompare(toText(right?.title), undefined, { sensitivity: 'base' });
      return sortBy === 'name_desc' ? -base : base;
    });
  }, [filteredRoleMembers, sortBy]);

  useEffect(() => {
    if (!groupedRoleMembers.length) {
      setSelectedGroupKey('');
      return;
    }
    const exists = groupedRoleMembers.some((item) => item.groupKey === selectedGroupKey);
    if (!exists) setSelectedGroupKey(groupedRoleMembers[0]?.groupKey || '');
  }, [groupedRoleMembers, selectedGroupKey]);

  const selectedRoleMember = useMemo(
    () => groupedRoleMembers.find((item) => item.groupKey === selectedGroupKey) || null,
    [groupedRoleMembers, selectedGroupKey]
  );

  const registeredMemberOptions = useMemo(() => {
    const base = (registeredMembers || []).length
      ? registeredMembers
      : (roleMembers || []).map((item) => item?.member).filter(Boolean);
    const unique = new Map();
    base.forEach((member) => {
      const id = String(member?.id || member?.registration_id || '').trim();
      if (!id) return;
      if (!unique.has(id)) unique.set(id, member);
    });
    return Array.from(unique.values())
      .filter((item) => String(item?.trust_id || '') === normalizedTrustId)
      .sort((left, right) =>
      toText(left?.name).localeCompare(toText(right?.name), undefined, { sensitivity: 'base' })
    );
  }, [registeredMembers, roleMembers, normalizedTrustId]);

  const filteredRegisteredMemberOptions = useMemo(() => {
    const term = toText(createMemberSearch).toLowerCase();
    if (!term) return registeredMemberOptions;
    return registeredMemberOptions.filter((member) => {
      const searchable = [
        member?.name,
        member?.membership_number,
        member?.mobile,
        member?.email,
        member?.company_name,
      ]
        .map((value) => toText(value).toLowerCase())
        .filter(Boolean);
      return searchable.some((value) => value.includes(term));
    });
  }, [createMemberSearch, registeredMemberOptions]);

  const leftTotalPages = Math.max(1, Math.ceil(groupedRoleMembers.length / LEFT_PAGE_SIZE));

  useEffect(() => {
    setLeftPage((prev) => Math.min(Math.max(prev, 1), leftTotalPages));
  }, [leftTotalPages]);

  useEffect(() => {
    if (!selectedGroupKey) return;
    const selectedIndex = groupedRoleMembers.findIndex((item) => item.groupKey === selectedGroupKey);
    if (selectedIndex < 0) return;
    const targetPage = Math.floor(selectedIndex / LEFT_PAGE_SIZE) + 1;
    setLeftPage(targetPage);
  }, [groupedRoleMembers, selectedGroupKey]);

  const paginatedRoleMembers = useMemo(() => {
    const start = (leftPage - 1) * LEFT_PAGE_SIZE;
    return groupedRoleMembers.slice(start, start + LEFT_PAGE_SIZE);
  }, [groupedRoleMembers, leftPage]);

  const selectedCommitteeMembers = useMemo(() => {
    const selectedTitle = toText(selectedRoleMember?.title).toLowerCase();
    if (!selectedTitle) return selectedRoleMember ? [selectedRoleMember] : [];
    const rows = (filteredRoleMembers || [])
      .filter((item) => toText(item?.title).toLowerCase() === selectedTitle)
      .sort((left, right) =>
        toText(left?.member?.name).localeCompare(toText(right?.member?.name), undefined, { sensitivity: 'base' })
      );
    return sortBy === 'name_desc' ? [...rows].reverse() : rows;
  }, [filteredRoleMembers, selectedRoleMember, sortBy]);

  const startEditRole = (roleItem) => {
    if (!roleItem?.id) return;
    setEditRoleId(String(roleItem.id));
    setEditForm({
      role_type: toText(roleItem?.role_type).toLowerCase() || 'committee',
      title: toText(roleItem?.title),
      subtitle: toText(roleItem?.subtitle),
    });
    setEditError('');
  };

  const closeEditRole = () => {
    setEditRoleId('');
    setEditError('');
    setEditSaving(false);
  };

  const openCreateRole = () => {
    setCreateForm({
      reg_id: String(selectedRoleMember?.reg_id || ''),
      role_type: toText(selectedRoleMember?.role_type).toLowerCase() || 'committee',
      title: toText(selectedRoleMember?.title),
      subtitle: '',
    });
    setCreateMemberSearch('');
    setCreateError('');
    setCreateOpen(true);
  };

  const closeCreateRole = () => {
    setCreateOpen(false);
    setCreateError('');
    setCreateSaving(false);
    setCreateMemberSearch('');
  };

  const handleBackdropMouseDown = (key) => (event) => {
    backdropMouseDownRef.current[key] = event.target === event.currentTarget;
  };

  const handleBackdropClick = (key, closeHandler) => (event) => {
    const startedOnBackdrop = !!backdropMouseDownRef.current[key];
    const endedOnBackdrop = event.target === event.currentTarget;
    backdropMouseDownRef.current[key] = false;
    if (startedOnBackdrop && endedOnBackdrop) closeHandler();
  };

  const saveEditedRole = async () => {
    if (!editRoleId) return;
    if (!toText(editForm.title)) {
      setEditError('Title is required.');
      return;
    }
    setEditSaving(true);
    setEditError('');
    const { data, error: updateError } = await updateMemberRole(editRoleId, editForm);
    if (updateError) {
      setEditError(updateError.message || 'Unable to update member role.');
      setEditSaving(false);
      return;
    }
    setRoleMembers((prev) =>
      (prev || []).map((item) =>
        String(item?.id) === String(editRoleId)
          ? {
              ...item,
              role_type: data?.role_type ?? item.role_type,
              title: data?.title ?? item.title,
              subtitle: data?.subtitle ?? item.subtitle,
            }
          : item
      )
    );
    setEditSaving(false);
    closeEditRole();
  };

  const saveCreatedRole = async () => {
    if (!toText(createForm.reg_id)) {
      setCreateError('Please select a member.');
      return;
    }
    if (!toText(createForm.title)) {
      setCreateError('Title is required.');
      return;
    }
    setCreateSaving(true);
    setCreateError('');
    const payload = {
      reg_id: createForm.reg_id,
      role_type: createForm.role_type,
      title: createForm.title,
      subtitle: createForm.subtitle,
    };
    const { data, error: createRoleError } = await createMemberRole(payload);
    if (createRoleError) {
      setCreateError(createRoleError.message || 'Unable to create executive member role.');
      setCreateSaving(false);
      return;
    }

    const selectedMember = registeredMemberOptions.find((item) => String(item?.id) === String(data?.reg_id)) || null;
    const createdRole = {
      id: data?.id,
      reg_id: data?.reg_id,
      role_type: data?.role_type || '',
      title: data?.title || '',
      subtitle: data?.subtitle || '',
      created_at: data?.created_at || null,
      member: selectedMember,
    };
    setRoleMembers((prev) => [createdRole, ...(prev || [])]);
    setSelectedGroupKey(toText(createdRole.title).toLowerCase() || '');
    setCreateSaving(false);
    closeCreateRole();
  };

  if (!trustId) return null;

  return (
    <div className="eb-root">
      <Sidebar
        trustName={trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
        onLogout={() => navigate('/login')}
      />

      <main className="eb-main">
        <PageHeader
          title="Executive Body"
          subtitle="Trust members from member_roles table"
          onBack={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
        />

        <section className="eb-panel">
          <div className="eb-top-filters">
            <label className="eb-field">
              <span>Search</span>
              <input
                placeholder="Search title, member, role, mobile..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="eb-inline-sort">
                <span>Sort By</span>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="name_asc">Name A-Z</option>
                  <option value="name_desc">Name Z-A</option>
                </select>
              </div>
            </label>
            <div className="eb-field">
              <span>Role Type</span>
              <div className="eb-role-type-group" role="group" aria-label="Role Type Filter">
                {ROLE_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`eb-role-type-btn ${roleTypeFilter === option.value ? 'active' : ''}`}
                    onClick={() => setRoleTypeFilter(option.value)}
                  >
                    {option.label} ({roleTypeCounts[option.value] ?? 0})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading && <div className="eb-empty">Loading executive body...</div>}
          {!loading && error && <div className="eb-error">{error}</div>}

          {!loading && !error && (
            <div className="eb-layout">
              <aside className="eb-left">
                <div className="eb-left-head">
                  <h3>Members</h3>
                  <span>{groupedRoleMembers.length}</span>
                </div>
                <button type="button" className="eb-btn eb-btn-primary eb-create-role-btn" onClick={openCreateRole}>
                  + Create Executive Member
                </button>
                {!filteredRoleMembers.length && <div className="eb-empty">No member_roles found for this trust.</div>}
                {paginatedRoleMembers.map((item) => {
                  const titleText = toText(item?.title) || 'Member';
                  const roleTypeText = item.roleTypeLabel || '-';
                  return (
                    <button
                      key={item.groupKey}
                      type="button"
                      className={`eb-member-item ${selectedGroupKey === item.groupKey ? 'active' : ''}`}
                      onClick={() => setSelectedGroupKey(item.groupKey)}
                    >
                      <div className="eb-avatar">{initials(titleText)}</div>
                      <div className="eb-member-meta">
                        <strong>{titleText}{item.count > 1 ? ` (${item.count})` : ''}</strong>
                        <span>{roleTypeText}</span>
                      </div>
                    </button>
                  );
                })}
                {groupedRoleMembers.length > LEFT_PAGE_SIZE && (
                  <div className="eb-pagination">
                    <button
                      type="button"
                      className="eb-btn eb-btn-secondary"
                      onClick={() => setLeftPage((prev) => Math.max(prev - 1, 1))}
                      disabled={leftPage === 1}
                    >
                      Prev
                    </button>
                    <span>
                      Page {leftPage} of {leftTotalPages}
                    </span>
                    <button
                      type="button"
                      className="eb-btn eb-btn-secondary"
                      onClick={() => setLeftPage((prev) => Math.min(prev + 1, leftTotalPages))}
                      disabled={leftPage === leftTotalPages}
                    >
                      Next
                    </button>
                  </div>
                )}
              </aside>

              <section className="eb-right">
                {!selectedRoleMember && <div className="eb-empty">Select a member to view details.</div>}
                {selectedRoleMember && (
                  <article className="eb-profile-card">
                    <div className="eb-committee-list-wrap">
                      <div className="eb-committee-head">
                        <h4>{toText(selectedRoleMember?.title) || 'Committee Members'}</h4>
                        <span>{selectedCommitteeMembers.length}</span>
                      </div>
                      {!selectedCommitteeMembers.length && (
                        <div className="eb-empty">No members found in this committee.</div>
                      )}
                      {selectedCommitteeMembers.map((item) => (
                        <div key={item.id} className="eb-committee-row">
                          <div className="eb-committee-col name">{toText(item?.member?.name) || '-'}</div>
                          <div className="eb-committee-col subtitle">{toText(item?.subtitle) || '-'}</div>
                          <div className="eb-committee-col role">{toText(item?.member?.role) || '-'}</div>
                          <div className="eb-committee-col membership">{toText(item?.member?.membership_number) || '-'}</div>
                          <div className="eb-committee-col mobile">{toText(item?.member?.mobile) || '-'}</div>
                          <div className="eb-committee-actions">
                            <button type="button" className="eb-btn eb-btn-primary" onClick={() => startEditRole(item)}>
                              Edit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                )}
              </section>
            </div>
          )}

          {editRoleId && (
            <div
              className="eb-modal-backdrop"
              onMouseDown={handleBackdropMouseDown('edit')}
              onClick={handleBackdropClick('edit', closeEditRole)}
            >
              <div className="eb-modal-card" onClick={(event) => event.stopPropagation()}>
                <h4>Edit Member Role</h4>
                <div className="eb-modal-grid">
                  <label className="eb-field">
                    <span>Role Type</span>
                    <select
                      value={editForm.role_type}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, role_type: event.target.value }))}
                    >
                      <option value="committee">Committee</option>
                      <option value="elected">Elected</option>
                    </select>
                  </label>
                  <label className="eb-field">
                    <span>Title</span>
                    <input
                      value={editForm.title}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, title: event.target.value }))}
                    />
                  </label>
                  <label className="eb-field">
                    <span>Subtitle</span>
                    <input
                      value={editForm.subtitle}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, subtitle: event.target.value }))}
                    />
                  </label>
                </div>
                {editError && <div className="eb-error">{editError}</div>}
                <div className="eb-modal-actions">
                  <button type="button" className="eb-btn eb-btn-secondary" onClick={closeEditRole}>
                    Cancel
                  </button>
                  <button type="button" className="eb-btn eb-btn-primary" onClick={saveEditedRole} disabled={editSaving}>
                    {editSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {createOpen && (
            <div
              className="eb-modal-backdrop"
              onMouseDown={handleBackdropMouseDown('create')}
              onClick={handleBackdropClick('create', closeCreateRole)}
            >
              <div className="eb-modal-card" onClick={(event) => event.stopPropagation()}>
                <h4>Create Executive Member</h4>
                <div className="eb-modal-grid">
                  <label className="eb-field">
                    <span>Member</span>
                    <input
                      type="text"
                      value={createMemberSearch}
                      onChange={(event) => setCreateMemberSearch(event.target.value)}
                      placeholder="Search member by name, membership no, mobile..."
                    />
                    <small>{filteredRegisteredMemberOptions.length} member(s) found</small>
                    <select
                      value={createForm.reg_id}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, reg_id: event.target.value }))}
                    >
                      <option value="">Select member</option>
                      {filteredRegisteredMemberOptions.map((member) => (
                        <option key={member.id} value={member.id}>
                          {toText(member?.name) || 'Member'} ({toText(member?.membership_number) || '-'})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="eb-field">
                    <span>Role Type</span>
                    <select
                      value={createForm.role_type}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, role_type: event.target.value }))}
                    >
                      <option value="committee">Committee</option>
                      <option value="elected">Elected</option>
                    </select>
                  </label>
                  <label className="eb-field">
                    <span>Title</span>
                    <input
                      value={createForm.title}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="e.g. Fundraising Committee"
                    />
                  </label>
                  <label className="eb-field">
                    <span>Subtitle</span>
                    <input
                      value={createForm.subtitle}
                      onChange={(event) => setCreateForm((prev) => ({ ...prev, subtitle: event.target.value }))}
                      placeholder="e.g. Committee"
                    />
                  </label>
                </div>
                {createError && <div className="eb-error">{createError}</div>}
                <div className="eb-modal-actions">
                  <button type="button" className="eb-btn eb-btn-secondary" onClick={closeCreateRole}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="eb-btn eb-btn-primary"
                    onClick={saveCreatedRole}
                    disabled={createSaving || !registeredMemberOptions.length}
                  >
                    {createSaving ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
