import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import { fetchRegisteredMembersDirectory } from '../services/membersService';
import './ExecutiveBodyPage.css';

const TITLE_FIELD_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'membership_number', label: 'Membership Number' },
  { value: 'role', label: 'Role' },
  { value: 'company_name', label: 'Company Name' },
];

const SUBTITLE_FIELD_OPTIONS = [
  { value: 'role', label: 'Role' },
  { value: 'membership_number', label: 'Membership Number' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'email', label: 'Email' },
  { value: 'joined_date', label: 'Joined Date' },
  { value: 'company_name', label: 'Company Name' },
];

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function getRoleLabel(value) {
  const role = toText(value);
  return role || 'Unassigned';
}

function formatDate(value) {
  const raw = toText(value);
  if (!raw) return '-';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getFieldValue(member = {}, field) {
  const value = member?.[field];
  if (field === 'joined_date') return formatDate(value);
  if (field === 'role') return getRoleLabel(value);
  return toText(value) || '-';
}

function initials(name = '') {
  const text = toText(name);
  if (!text) return 'M';
  return text
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() || '')
    .join('') || 'M';
}

export default function ExecutiveBodyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'quick-actions';
  const trustId = trust?.id || null;

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [titleField, setTitleField] = useState('name');
  const [subtitleField, setSubtitleField] = useState('role');
  const openMemberProfile = (openEdit = false) => {
    if (!selectedMember?.member_id) return;
    navigate('/member-profile', {
      state: {
        userName,
        trust,
        sidebarNavKey: currentSidebarNavKey,
        selectedMemberId: selectedMember.member_id,
        openEdit,
      },
    });
  };

  useEffect(() => {
    if (!trustId) {
      navigate('/dashboard', { replace: true, state: { userName, trust, sidebarNavKey: currentSidebarNavKey } });
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      const { data, error: fetchError } = await fetchRegisteredMembersDirectory(trustId);
      if (fetchError) {
        setError(fetchError.message || 'Unable to load executive body members.');
        setMembers([]);
        setLoading(false);
        return;
      }

      const trustMembers = (data || []).filter((item) => String(item?.trust_id || '') === String(trustId));
      setMembers(trustMembers);
      setSelectedMemberId((prev) => prev || trustMembers[0]?.id || '');
      setLoading(false);
    };

    load();
  }, [navigate, trustId, userName, trust, currentSidebarNavKey]);

  const roleCounts = useMemo(() => {
    const counts = members.reduce((acc, member) => {
      const key = getRoleLabel(member?.role);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const entries = Object.entries(counts).sort((left, right) => left[0].localeCompare(right[0], undefined, { sensitivity: 'base' }));
    return { total: members.length, entries };
  }, [members]);
  const roleTypeOptions = useMemo(
    () => [
      { value: 'all', label: `All Roles (${roleCounts.total})` },
      ...roleCounts.entries.map(([roleName, count]) => ({
        value: roleName,
        label: `${roleName} (${count})`,
      })),
    ],
    [roleCounts]
  );
  const titleFieldOptions = useMemo(
    () =>
      TITLE_FIELD_OPTIONS.filter((option) =>
        members.some((member) => toText(member?.[option.value]))
      ),
    [members]
  );
  const subtitleFieldOptions = useMemo(
    () =>
      SUBTITLE_FIELD_OPTIONS.filter((option) =>
        members.some((member) => toText(member?.[option.value]))
      ),
    [members]
  );

  const filteredMembers = useMemo(() => {
    const term = toText(search).toLowerCase();
    return members
      .filter((member) => {
        const roleName = getRoleLabel(member?.role);
        if (roleFilter !== 'all' && roleName !== roleFilter) return false;
        if (!term) return true;

        const searchable = [
          member?.name,
          member?.membership_number,
          member?.mobile,
          member?.email,
          member?.company_name,
          roleName,
        ].map((value) => toText(value).toLowerCase());

        return searchable.some((value) => value.includes(term));
      })
      .sort((left, right) => toText(left?.name).localeCompare(toText(right?.name), undefined, { sensitivity: 'base' }));
  }, [members, roleFilter, search]);

  useEffect(() => {
    if (!filteredMembers.length) {
      setSelectedMemberId('');
      return;
    }
    const exists = filteredMembers.some((item) => String(item?.id) === String(selectedMemberId));
    if (!exists) {
      setSelectedMemberId(filteredMembers[0]?.id || '');
    }
  }, [filteredMembers, selectedMemberId]);
  useEffect(() => {
    if (!titleFieldOptions.length) return;
    if (!titleFieldOptions.some((option) => option.value === titleField)) {
      setTitleField(titleFieldOptions[0].value);
    }
  }, [titleField, titleFieldOptions]);
  useEffect(() => {
    if (!subtitleFieldOptions.length) return;
    if (!subtitleFieldOptions.some((option) => option.value === subtitleField)) {
      setSubtitleField(subtitleFieldOptions[0].value);
    }
  }, [subtitleField, subtitleFieldOptions]);

  const selectedMember = useMemo(
    () => filteredMembers.find((item) => String(item?.id) === String(selectedMemberId)) || null,
    [filteredMembers, selectedMemberId]
  );

  const titleValue = selectedMember ? getFieldValue(selectedMember, titleField) : '-';
  const subtitleValue = selectedMember ? getFieldValue(selectedMember, subtitleField) : '-';

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
          subtitle="Trust-specific members from reg_members"
          onBack={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
        />

        <section className="eb-panel">
          <div className="eb-top-filters">
            <label className="eb-field">
              <span>Search Member</span>
              <input
                placeholder="Search name, role, mobile, email..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="eb-field">
              <span>Role Type</span>
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                {roleTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="eb-field">
              <span>Title</span>
              <select value={titleField} onChange={(event) => setTitleField(event.target.value)}>
                {titleFieldOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <small>{titleValue}</small>
            </label>
            <label className="eb-field">
              <span>Subtitle</span>
              <select value={subtitleField} onChange={(event) => setSubtitleField(event.target.value)}>
                {subtitleFieldOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <small>{subtitleValue}</small>
            </label>
          </div>

          {loading && <div className="eb-empty">Loading executive body...</div>}
          {!loading && error && <div className="eb-error">{error}</div>}
          {!loading && !error && (
            <div className="eb-layout">
              <aside className="eb-left">
                <div className="eb-left-head">
                  <h3>Members</h3>
                  <span>{filteredMembers.length}</span>
                </div>
                {filteredMembers.length === 0 && (
                  <div className="eb-empty">No members found for selected filters.</div>
                )}
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className={`eb-member-item ${String(selectedMemberId) === String(member.id) ? 'active' : ''}`}
                    onClick={() => setSelectedMemberId(member.id)}
                  >
                    <div className="eb-avatar">{initials(member?.name)}</div>
                    <div className="eb-member-meta">
                      <strong>{toText(member?.name) || 'Member'}</strong>
                      <span>{getRoleLabel(member?.role)}</span>
                    </div>
                  </button>
                ))}
              </aside>

              <section className="eb-right">
                {!selectedMember && <div className="eb-empty">Select a member to view profile.</div>}
                {selectedMember && (
                  <article className="eb-profile-card">
                    <div className="eb-profile-top">
                      <div className="eb-profile-top-left">
                        <div className="eb-profile-avatar">{initials(selectedMember?.name)}</div>
                        <div>
                          <h3>{titleValue}</h3>
                          <p>{subtitleValue}</p>
                        </div>
                      </div>
                      <div className="eb-profile-actions">
                        <button type="button" className="eb-btn eb-btn-primary" onClick={() => openMemberProfile(true)}>
                          Edit Details
                        </button>
                      </div>
                    </div>

                    <div className="eb-profile-grid">
                      <div><span>Name</span><strong>{toText(selectedMember?.name) || '-'}</strong></div>
                      <div><span>Role</span><strong>{getRoleLabel(selectedMember?.role)}</strong></div>
                      <div><span>Membership Number</span><strong>{toText(selectedMember?.membership_number) || '-'}</strong></div>
                      <div><span>Joined Date</span><strong>{formatDate(selectedMember?.joined_date)}</strong></div>
                      <div><span>Status</span><strong>{selectedMember?.is_active ? 'Active' : 'Inactive'}</strong></div>
                      <div><span>Mobile</span><strong>{toText(selectedMember?.mobile) || '-'}</strong></div>
                      <div><span>Email</span><strong>{toText(selectedMember?.email) || '-'}</strong></div>
                      <div><span>Company</span><strong>{toText(selectedMember?.company_name) || '-'}</strong></div>
                    </div>
                  </article>
                )}
              </section>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
