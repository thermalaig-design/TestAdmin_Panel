import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import {
  createFamilyMember,
  deleteFamilyMember,
  fetchAllMembersDirectory,
  fetchFamilyMembersByMemberId,
  fetchMemberProfileView,
  fetchRegisteredMembersDirectory,
  registerExistingMember,
  unregisterRegisteredMember,
  updateFamilyMember,
  updateRegisteredMember,
  updateRegisteredMembership,
} from '../services/membersService';
import './MemberProfilePage.css';

const MEMBER_DETAILS_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'mobile', label: 'Mobile' },
  { key: 'email', label: 'Email' },
  { key: 'resident_landline', label: 'Residence Landline' },
  { key: 'office_landline', label: 'Office Landline' },
  { key: 'home_address', label: 'Home Address' },
  { key: 'address_office', label: 'Office Address' },
  { key: 'company_name', label: 'Company Name' },
];

const REGISTRATION_FIELDS = [
  { key: 'membership_number', label: 'Membership Number' },
  { key: 'role', label: 'Role' },
  { key: 'joined_date', label: 'Joined Date' },
];
const REGISTRATION_FIELD_KEYS = new Set(REGISTRATION_FIELDS.map((field) => field.key));

const PROFILE_SECTIONS = [
  {
    title: 'Basic Details',
    fields: [
      { key: 'gender', label: 'Gender' },
      { key: 'date_of_birth', label: 'Date of Birth' },
      { key: 'blood_group', label: 'Blood Group' },
      { key: 'marital_status', label: 'Marital Status' },
      { key: 'nationality', label: 'Nationality' },
    ],
  },
  {
    title: 'Contact Details',
    fields: [
      { key: 'whatsapp', label: 'WhatsApp' },
      { key: 'emergency_contact_name', label: 'Emergency Contact Name' },
      { key: 'emergency_contact_number', label: 'Emergency Contact Number' },
    ],
  },
  {
    title: 'Identity Details',
    fields: [
      { key: 'spouse_name', label: 'Spouse Name' },
      { key: 'spouse_contact', label: 'Spouse Contact' },
      { key: 'no_of_children', label: 'No. of Children' },
      { key: 'aadhaar_id', label: 'Aadhaar ID' },
    ],
  },
  {
    title: 'Social Media Details',
    fields: [
      { key: 'facebook', label: 'Facebook' },
      { key: 'twitter', label: 'Twitter' },
      { key: 'instagram', label: 'Instagram' },
      { key: 'linkedin', label: 'LinkedIn' },
    ],
  },
];
const MEMBERS_CACHE_TTL_MS = 3 * 60 * 1000;
const LIST_PAGE_SIZE = 10;
const PICKER_PAGE_SIZE = 6;
const CREATE_NEW_ROLE_VALUE = '__create_new_role__';
const FAMILY_GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const FAMILY_BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function getMembersCacheKey(trustId) {
  return `member_profile_members_${trustId}`;
}

function getDirectoryCacheKey(trustId) {
  return `member_profile_directory_${trustId}`;
}

function readMembersCache(trustId) {
  if (!trustId) return null;
  try {
    const raw = sessionStorage.getItem(getMembersCacheKey(trustId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.timestamp || !Array.isArray(parsed?.members)) return null;
    if (Date.now() - Number(parsed.timestamp) > MEMBERS_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeMembersCache(trustId, members = []) {
  if (!trustId) return;
  try {
    sessionStorage.setItem(
      getMembersCacheKey(trustId),
      JSON.stringify({ timestamp: Date.now(), members })
    );
  } catch {
    // Ignore storage failures and continue with live data.
  }
}

function readDirectoryCache(trustId) {
  if (!trustId) return null;
  try {
    const raw = sessionStorage.getItem(getDirectoryCacheKey(trustId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.timestamp || !Array.isArray(parsed?.members)) return null;
    if (Date.now() - Number(parsed.timestamp) > MEMBERS_CACHE_TTL_MS) return null;
    return parsed.members;
  } catch {
    return null;
  }
}

function writeDirectoryCache(trustId, members = []) {
  if (!trustId) return;
  try {
    sessionStorage.setItem(
      getDirectoryCacheKey(trustId),
      JSON.stringify({ timestamp: Date.now(), members })
    );
  } catch {
    // Ignore storage failures and continue with live data.
  }
}

function toText(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function initials(name = '') {
  return (
    name
      .split(' ')
      .map((word) => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'M'
  );
}

function buildEditForm(source = {}) {
  return {
    profile_photo_url: toText(source.profile_photo_url),
    name: toText(source.name),
    membership_number: toText(source.membership_number),
    role: toText(source.role),
    joined_date: toText(source.joined_date),
    mobile: toText(source.mobile),
    email: toText(source.email),
    home_address: toText(source.address_home),
    company_name: toText(source.company_name),
    address_office: toText(source.address_office),
    resident_landline: toText(source.resident_landline),
    office_landline: toText(source.office_landline),
    gender: toText(source.gender),
    date_of_birth: toText(source.date_of_birth),
    blood_group: toText(source.blood_group),
    marital_status: toText(source.marital_status),
    nationality: toText(source.nationality),
    aadhaar_id: toText(source.aadhaar_id),
    emergency_contact_name: toText(source.emergency_contact_name),
    emergency_contact_number: toText(source.emergency_contact_number),
    spouse_name: toText(source.spouse_name),
    spouse_contact: toText(source.spouse_contact),
    no_of_children: toText(source.no_of_children),
    facebook: toText(source.facebook),
    twitter: toText(source.twitter),
    instagram: toText(source.instagram),
    linkedin: toText(source.linkedin),
    whatsapp: toText(source.whatsapp),
  };
}

function dedupeMembersByMemberId(list = []) {
  const seen = new Set();
  const unique = [];

  for (const member of list) {
    const id = String(member?.member_id || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(member);
  }

  return unique;
}

function buildFamilyForm(source = {}) {
  return {
    id: source.id || null,
    name: toText(source.name),
    relation: toText(source.relation),
    gender: toText(source.gender),
    age: toText(source.age),
    blood_group: toText(source.blood_group),
    contact_no: toText(source.contact_no),
    email: toText(source.email),
    address: toText(source.address),
  };
}

function compareMembers(left = {}, right = {}, sortBy = 'name_asc') {
  const leftName = String(left.name || '').toLowerCase();
  const rightName = String(right.name || '').toLowerCase();
  const leftMembership = String(left.membership_number || '').toLowerCase();
  const rightMembership = String(right.membership_number || '').toLowerCase();

  const parseMembershipStartNumber = (value) => {
    const text = String(value || '').trim();
    const startIndex = text.search(/\d/);
    if (startIndex === -1) return null;
    const slice = text.slice(startIndex);
    const match = slice.match(/^\d+/);
    if (!match) return null;
    const num = Number(match[0]);
    return Number.isFinite(num) ? num : null;
  };

  const leftMembershipNumber = parseMembershipStartNumber(leftMembership);
  const rightMembershipNumber = parseMembershipStartNumber(rightMembership);

  const byNameAsc = leftName.localeCompare(rightName, undefined, { sensitivity: 'base', numeric: true });
  const byNameDesc = rightName.localeCompare(leftName, undefined, { sensitivity: 'base', numeric: true });
  const byMembershipAsc = (() => {
    if (leftMembershipNumber === null && rightMembershipNumber === null) return byNameAsc;
    if (leftMembershipNumber === null) return 1;
    if (rightMembershipNumber === null) return -1;
    if (leftMembershipNumber !== rightMembershipNumber) return leftMembershipNumber - rightMembershipNumber;
    return leftMembership.localeCompare(rightMembership, undefined, { sensitivity: 'base', numeric: true }) || byNameAsc;
  })();
  const byMembershipDesc = (() => {
    if (leftMembershipNumber === null && rightMembershipNumber === null) return byNameAsc;
    if (leftMembershipNumber === null) return 1;
    if (rightMembershipNumber === null) return -1;
    if (leftMembershipNumber !== rightMembershipNumber) return rightMembershipNumber - leftMembershipNumber;
    return rightMembership.localeCompare(leftMembership, undefined, { sensitivity: 'base', numeric: true }) || byNameAsc;
  })();

  if (sortBy === 'membership_asc') return byMembershipAsc || byNameAsc;
  if (sortBy === 'membership_desc') return byMembershipDesc || byNameAsc;
  if (sortBy === 'name_desc') return byNameDesc;
  return byNameAsc;
}

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

function comparePickerMembers(left = {}, right = {}, sortBy = 'name_asc') {
  const leftName = String(left.name || '').toLowerCase();
  const rightName = String(right.name || '').toLowerCase();
  const leftCompany = String(left.company_name || '').toLowerCase();
  const rightCompany = String(right.company_name || '').toLowerCase();

  const byNameAsc = leftName.localeCompare(rightName, undefined, { sensitivity: 'base', numeric: true });
  const byNameDesc = rightName.localeCompare(leftName, undefined, { sensitivity: 'base', numeric: true });
  const byCompanyAsc = leftCompany.localeCompare(rightCompany, undefined, { sensitivity: 'base', numeric: true }) || byNameAsc;
  const byCompanyDesc = rightCompany.localeCompare(leftCompany, undefined, { sensitivity: 'base', numeric: true }) || byNameAsc;

  if (sortBy === 'name_desc') return byNameDesc;
  if (sortBy === 'company_asc') return byCompanyAsc;
  if (sortBy === 'company_desc') return byCompanyDesc;
  return byNameAsc;
}

export default function MemberProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const trustId = trust?.id || null;

  const [members, setMembers] = useState([]);
  const [directoryMembers, setDirectoryMembers] = useState([]);
  const [directoryTrustId, setDirectoryTrustId] = useState(null);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerFilter, setPickerFilter] = useState('all');
  const [pickerSortBy, setPickerSortBy] = useState('name_asc');
  const [pickerPage, setPickerPage] = useState(1);
  const [sortBy, setSortBy] = useState('name_asc');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeGroup, setActiveGroup] = useState('all');
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editForm, setEditForm] = useState(() => buildEditForm());
  const [photoDragOver, setPhotoDragOver] = useState(false);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loadingFamily, setLoadingFamily] = useState(false);
  const [familyForm, setFamilyForm] = useState(() => buildFamilyForm());
  const [isFamilyEditing, setIsFamilyEditing] = useState(false);
  const [familySaving, setFamilySaving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [unregistering, setUnregistering] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registeringId, setRegisteringId] = useState(null);
  const [registerCandidate, setRegisterCandidate] = useState(null);
  const [registerForm, setRegisterForm] = useState({
    membership_number: '',
    role: '',
    joined_date: '',
    is_active: true,
  });
  const [useCustomEditRole, setUseCustomEditRole] = useState(false);
  const [useCustomRegisterRole, setUseCustomRegisterRole] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [familyError, setFamilyError] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!trustId) navigate('/dashboard', { replace: true, state: { userName, trust } });
  }, [trustId, navigate, trust, userName]);

  useEffect(() => {
    let cancelled = false;

    const loadMembers = async () => {
      if (!trustId) return;

      setError('');
      const cached = readMembersCache(trustId);
      const hadCachedData = !!cached?.members?.length;

      if (hadCachedData) {
        if (cancelled) return;
        const uniqueCached = dedupeMembersByMemberId(cached.members);
        setMembers(uniqueCached);
        setSelectedMemberId((prev) => prev || uniqueCached[0]?.member_id || '');
        setLoadingMembers(false);
      } else {
        if (cancelled) return;
        setLoadingMembers(true);
      }

      const { data, error: fetchError } = await fetchRegisteredMembersDirectory(trustId);
      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message || 'Unable to load members.');
        if (!hadCachedData) setMembers([]);
        setLoadingMembers(false);
        return;
      }

      const freshMembers = dedupeMembersByMemberId(data || []);
      setMembers(freshMembers);
      setSelectedMemberId((prev) => {
        const stillExists = freshMembers.some((member) => String(member.member_id) === String(prev));
        if (stillExists) return prev;
        return freshMembers[0]?.member_id || '';
      });
      writeMembersCache(trustId, freshMembers);
      setLoadingMembers(false);
    };

    loadMembers();
    return () => {
      cancelled = true;
    };
  }, [trustId]);

  const ensureDirectoryMembersLoaded = async ({ forceRefresh = false } = {}) => {
    if (!trustId) return;
    if (loadingDirectory) return;
    if (!forceRefresh && directoryTrustId === trustId && directoryMembers.length > 0) return;

    if (!forceRefresh) {
      const cachedDirectory = readDirectoryCache(trustId);
      if (cachedDirectory?.length) {
        setDirectoryMembers(cachedDirectory);
        setDirectoryTrustId(trustId);
        return;
      }
    }

    setLoadingDirectory(true);
    const { data, error: fetchError } = await fetchAllMembersDirectory(trustId);
    if (!fetchError) {
      const next = data || [];
      setDirectoryMembers(next);
      setDirectoryTrustId(trustId);
      writeDirectoryCache(trustId, next);
    }
    setLoadingDirectory(false);
  };

  const membersForRoleCount = useMemo(() => {
    if (activeGroup === 'my') {
      return members.filter((member) => String(member.member_type || '').toLowerCase() === 'my');
    }
    if (activeGroup === 'others') {
      return members.filter((member) => String(member.member_type || '').toLowerCase() !== 'my');
    }
    return members;
  }, [activeGroup, members]);
  const roleOptions = useMemo(() => {
    const uniqueRoles = new Set(
      (membersForRoleCount || [])
        .map((member) => String(member.role || '').trim())
        .filter(Boolean)
    );
    return [...uniqueRoles].sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })
    );
  }, [membersForRoleCount]);
  const trustRoleOptions = useMemo(() => {
    const uniqueRoles = new Set(
      (members || [])
        .map((member) => String(member.role || '').trim())
        .filter(Boolean)
    );
    return [...uniqueRoles].sort((left, right) =>
      left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })
    );
  }, [members]);

  const profileName = useMemo(() => toText(profile?.name) || 'Member Profile', [profile]);
  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    return members.filter((member) => {
      const matchesQuery = !query || [member.name, member.company_name, member.mobile, member.email]
        .some((value) => String(value || '').toLowerCase().includes(query));

      const memberRole = String(member.role || '').trim();
      const matchesRole = roleFilter === 'all' || memberRole === roleFilter;

      return matchesQuery && matchesRole;
    });
  }, [members, memberSearch, roleFilter]);
  const myMembers = useMemo(
    () => filteredMembers.filter((member) => String(member.member_type || '').toLowerCase() === 'my'),
    [filteredMembers]
  );
  const otherMembers = useMemo(
    () => filteredMembers.filter((member) => String(member.member_type || '').toLowerCase() !== 'my'),
    [filteredMembers]
  );
  const visibleMembers = useMemo(() => {
    if (activeGroup === 'my') return myMembers;
    if (activeGroup === 'others') return otherMembers;
    return filteredMembers;
  }, [activeGroup, filteredMembers, myMembers, otherMembers]);
  const sortedVisibleMembers = useMemo(
    () => [...visibleMembers].sort((left, right) => compareMembers(left, right, sortBy)),
    [visibleMembers, sortBy]
  );
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedVisibleMembers.length / LIST_PAGE_SIZE)),
    [sortedVisibleMembers.length]
  );
  const safeCurrentPage = useMemo(
    () => Math.min(currentPage, totalPages),
    [currentPage, totalPages]
  );
  const paginatedMembers = useMemo(() => {
    const start = (safeCurrentPage - 1) * LIST_PAGE_SIZE;
    return sortedVisibleMembers.slice(start, start + LIST_PAGE_SIZE);
  }, [safeCurrentPage, sortedVisibleMembers]);
  const panelTitle = activeGroup === 'my' ? 'My Members' : activeGroup === 'others' ? 'Others Members' : 'All Members';
  const registeredMemberIds = useMemo(
    () => new Set((members || []).map((member) => String(member.member_id || '')).filter(Boolean)),
    [members]
  );
  const roleCountMap = useMemo(() => {
    const map = new Map();
    for (const member of membersForRoleCount) {
      const role = String(member.role || '').trim();
      if (!role) continue;
      map.set(role, (map.get(role) || 0) + 1);
    }
    return map;
  }, [membersForRoleCount]);
  const selectedRoleCount = useMemo(() => {
    if (roleFilter === 'all') return membersForRoleCount.length;
    return roleCountMap.get(roleFilter) || 0;
  }, [membersForRoleCount.length, roleCountMap, roleFilter]);
  const effectiveSelectedMemberId = useMemo(() => {
    const selectedExists = sortedVisibleMembers.some((member) => String(member.member_id) === String(selectedMemberId));
    if (selectedExists) return selectedMemberId;
    return sortedVisibleMembers[0]?.member_id || '';
  }, [sortedVisibleMembers, selectedMemberId]);
  const selectedMemberRecord = useMemo(
    () => members.find((member) => String(member.member_id) === String(effectiveSelectedMemberId)) || null,
    [members, effectiveSelectedMemberId]
  );
  const filteredDirectoryMembers = useMemo(() => {
    return directoryMembers
      .filter((member) => !registeredMemberIds.has(String(member.member_id || '')))
      .filter((member) => matchesMemberSearch(member, pickerSearch))
      .filter((member) => {
        if (pickerFilter === 'my') return String(member.member_type || '').toLowerCase() === 'my';
        if (pickerFilter === 'others') return String(member.member_type || '').toLowerCase() !== 'my';
        return true;
      });
  }, [directoryMembers, pickerFilter, pickerSearch, registeredMemberIds]);
  const sortedPickerMembers = useMemo(
    () => [...filteredDirectoryMembers].sort((left, right) => comparePickerMembers(left, right, pickerSortBy)),
    [filteredDirectoryMembers, pickerSortBy]
  );
  const pickerTotalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedPickerMembers.length / PICKER_PAGE_SIZE)),
    [sortedPickerMembers.length]
  );
  const safePickerPage = useMemo(
    () => Math.min(pickerPage, pickerTotalPages),
    [pickerPage, pickerTotalPages]
  );
  const paginatedPickerMembers = useMemo(() => {
    const start = (safePickerPage - 1) * PICKER_PAGE_SIZE;
    return sortedPickerMembers.slice(start, start + PICKER_PAGE_SIZE);
  }, [safePickerPage, sortedPickerMembers]);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!trustId || !effectiveSelectedMemberId) return;
      setError('');
      setSaveError('');
      setIsEditing(false);

      const { data, error: fetchError } = await fetchMemberProfileView({
        registrationId: null,
        memberId: effectiveSelectedMemberId,
        trustId,
      });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message || 'Unable to load member profile.');
        setProfile(null);
        setUseCustomEditRole(false);
      } else {
        setProfile(data || null);
        setEditForm(buildEditForm(data || {}));
        setUseCustomEditRole(false);
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [effectiveSelectedMemberId, trustId]);

  useEffect(() => {
    let cancelled = false;
    const loadFamilyMembers = async () => {
      if (!effectiveSelectedMemberId) {
        setFamilyMembers([]);
        return;
      }
      setLoadingFamily(true);
      setFamilyError('');
      setIsFamilyEditing(false);
      setFamilyForm(buildFamilyForm());

      const { data, error: fetchError } = await fetchFamilyMembersByMemberId(effectiveSelectedMemberId);
      if (cancelled) return;

      if (fetchError) {
        setFamilyError(fetchError.message || 'Unable to load family members.');
        setFamilyMembers([]);
      } else {
        setFamilyMembers(data || []);
      }
      setLoadingFamily(false);
    };

    loadFamilyMembers();
    return () => {
      cancelled = true;
    };
  }, [effectiveSelectedMemberId]);

  const canEditProfile = profile?.is_editable === true;
  const canEditFamily = canEditProfile || String(selectedMemberRecord?.member_type || '').toLowerCase() === 'my';
  const canEditDetails = true;
  const isFieldEditable = (key) => {
    if (!isEditing) return false;
    if (canEditProfile) return true;
    return REGISTRATION_FIELD_KEYS.has(key);
  };
  const getProfileFieldValue = (key) => {
    if (isEditing) return toText(editForm[key] ?? '');
    if (key === 'home_address') return toText(profile?.address_home);
    return toText(profile?.[key]);
  };

  const handleStartEdit = () => {
    if (!canEditDetails || !profile) return;
    setEditForm(buildEditForm(profile));
    setUseCustomEditRole(
      !!profile.role && !trustRoleOptions.includes(String(profile.role || '').trim())
    );
    setSaveError('');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditForm(buildEditForm(profile || {}));
    setUseCustomEditRole(false);
    setSaveError('');
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!profile?.registration_id) return;
    if (!canEditDetails) return;

    if (canEditProfile && !editForm.name.trim()) {
      setSaveError('Name is required.');
      return;
    }

    setSaving(true);
    setSaveError('');

    const payload = canEditProfile
      ? {
          profile_photo_url: editForm.profile_photo_url.trim() || null,
          name: editForm.name.trim(),
          company_name: editForm.company_name.trim() || null,
          membership_number: editForm.membership_number.trim() || null,
          role: editForm.role.trim() || null,
          joined_date: editForm.joined_date || null,
          mobile: editForm.mobile.trim() || null,
          email: editForm.email.trim() || null,
          address_home: editForm.home_address.trim() || null,
          address_office: editForm.address_office.trim() || null,
          resident_landline: editForm.resident_landline.trim() || null,
          office_landline: editForm.office_landline.trim() || null,
          gender: editForm.gender.trim() || null,
          date_of_birth: editForm.date_of_birth || null,
          blood_group: editForm.blood_group.trim() || null,
          marital_status: editForm.marital_status.trim() || null,
          nationality: editForm.nationality.trim() || null,
          aadhaar_id: editForm.aadhaar_id.trim() || null,
          emergency_contact_name: editForm.emergency_contact_name.trim() || null,
          emergency_contact_number: editForm.emergency_contact_number.trim() || null,
          spouse_name: editForm.spouse_name.trim() || null,
          spouse_contact: editForm.spouse_contact.trim() || null,
          no_of_children: editForm.no_of_children.trim() || null,
          facebook: editForm.facebook.trim() || null,
          twitter: editForm.twitter.trim() || null,
          instagram: editForm.instagram.trim() || null,
          linkedin: editForm.linkedin.trim() || null,
          whatsapp: editForm.whatsapp.trim() || null,
          is_active: profile.is_active !== false,
        }
      : {
          membership_number: editForm.membership_number.trim() || null,
          role: editForm.role.trim() || null,
          joined_date: editForm.joined_date || null,
          is_active: profile.is_active !== false,
        };

    const { data, error: saveErr } = canEditProfile
      ? await updateRegisteredMember(profile.registration_id, payload, trustId)
      : await updateRegisteredMembership(profile.registration_id, payload, trustId);

    if (saveErr) {
      setSaveError(saveErr.message || 'Unable to save member details.');
      setSaving(false);
      return;
    }

    const updated = data || {};
    setMembers((prev) =>
      prev.map((member) =>
        String(member.member_id) === String(updated.member_id)
          ? { ...member, ...updated }
          : member
      )
    );
    const { data: refreshedProfile, error: refreshError } = await fetchMemberProfileView({
      registrationId: profile.registration_id,
      memberId: profile.member_id,
      trustId,
    });
    if (refreshError) {
      setProfile((prev) => ({ ...prev, ...updated }));
      setEditForm(buildEditForm({ ...profile, ...updated }));
    } else {
      setProfile(refreshedProfile || null);
      setEditForm(buildEditForm(refreshedProfile || {}));
    }
    setUseCustomEditRole(false);
    setIsEditing(false);
    setSaving(false);
  };

  const handleProfilePhotoFile = (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      setSaveError('Please select a valid image file for profile photo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEditForm((prev) => ({ ...prev, profile_photo_url: String(reader.result || '') }));
      setSaveError('');
    };
    reader.readAsDataURL(file);
  };

  const handleStartFamilyAdd = () => {
    if (!canEditFamily) return;
    setFamilyError('');
    setFamilyForm(buildFamilyForm());
    setIsFamilyEditing(true);
  };

  const handleStartFamilyEdit = (member) => {
    if (!canEditFamily) return;
    setFamilyError('');
    setFamilyForm(buildFamilyForm(member));
    setIsFamilyEditing(true);
  };

  const handleCancelFamilyEdit = () => {
    setFamilyForm(buildFamilyForm());
    setFamilyError('');
    setIsFamilyEditing(false);
  };

  const handleSaveFamilyMember = async () => {
    if (!canEditFamily) return;
    if (!effectiveSelectedMemberId) return;
    if (!familyForm.name.trim()) {
      setFamilyError('Family member name is required.');
      return;
    }
    if (!familyForm.relation.trim()) {
      setFamilyError('Relation is required.');
      return;
    }

    setFamilySaving(true);
    setFamilyError('');
    const payload = {
      name: familyForm.name,
      relation: familyForm.relation,
      gender: familyForm.gender || null,
      age: familyForm.age || null,
      blood_group: familyForm.blood_group || null,
      contact_no: familyForm.contact_no || null,
      email: familyForm.email || null,
      address: familyForm.address || null,
    };

    const action = familyForm.id
      ? updateFamilyMember(familyForm.id, effectiveSelectedMemberId, payload)
      : createFamilyMember(effectiveSelectedMemberId, payload);

    const { data, error: saveErr } = await action;
    if (saveErr) {
      setFamilyError(saveErr.message || 'Unable to save family member.');
      setFamilySaving(false);
      return;
    }

    setFamilyMembers((prev) => {
      if (familyForm.id) {
        return prev.map((item) => (item.id === data.id ? data : item));
      }
      return [...prev, data];
    });
    setFamilyForm(buildFamilyForm());
    setIsFamilyEditing(false);
    setFamilySaving(false);
  };

  const handleDeleteFamilyMember = async (familyMemberId) => {
    if (!canEditFamily) return;
    if (!familyMemberId) return;
    const ok = window.confirm('Delete this family member?');
    if (!ok) return;

    const { error: deleteErr } = await deleteFamilyMember(familyMemberId, effectiveSelectedMemberId);
    if (deleteErr) {
      setFamilyError(deleteErr.message || 'Unable to delete family member.');
      return;
    }

    setFamilyMembers((prev) => prev.filter((item) => item.id !== familyMemberId));
    if (familyForm.id === familyMemberId) {
      setFamilyForm(buildFamilyForm());
      setIsFamilyEditing(false);
    }
  };

  const handleToggleRegistrationStatus = async () => {
    if (!profile?.registration_id || !trustId) return;
    setSaveError('');
    setStatusUpdating(true);

    const payload = {
      membership_number: profile.membership_number || null,
      role: profile.role || null,
      joined_date: profile.joined_date || null,
      is_active: profile.is_active === false,
    };

    const { data, error: toggleError } = await updateRegisteredMembership(profile.registration_id, payload, trustId);
    if (toggleError) {
      setSaveError(toggleError.message || 'Unable to update member status.');
      setStatusUpdating(false);
      return;
    }

    const updated = data || {};
    setProfile((prev) => ({ ...prev, ...updated }));
    setMembers((prev) =>
      prev.map((member) =>
        String(member.member_id) === String(updated.member_id)
          ? { ...member, ...updated }
          : member
      )
    );
    setStatusUpdating(false);
  };

  const handleUnregisterMember = async () => {
    if (!profile?.registration_id || !trustId) return;
    const ok = window.confirm('Unregister this member from the current trust? This will not delete master member data.');
    if (!ok) return;

    setSaveError('');
    setUnregistering(true);
    const { error: unregisterError } = await unregisterRegisteredMember(profile.registration_id, trustId);
    if (unregisterError) {
      setSaveError(unregisterError.message || 'Unable to unregister member.');
      setUnregistering(false);
      return;
    }

    const removedMemberId = profile.member_id;
    setMembers((prev) => prev.filter((member) => String(member.member_id) !== String(removedMemberId)));
    setSelectedMemberId('');
    setProfile(null);
    setUnregistering(false);
  };

  const openPicker = () => {
    setPickerSearch('');
    setPickerFilter('all');
    setPickerSortBy('name_asc');
    setPickerPage(1);
    setRegisterError('');
    setShowPicker(true);
    ensureDirectoryMembersLoaded();
  };

  const openNewMemberForm = () => {
    setShowPicker(false);
    setShowRegisterForm(false);
    navigate('/member/create_member', { state: { userName, trust } });
  };

  const openRegisterForm = (directoryMember) => {
    setRegisterCandidate(directoryMember);
    setRegisterForm({
      membership_number: '',
      role: '',
      joined_date: '',
      is_active: true,
    });
    setUseCustomRegisterRole(false);
    setRegisterError('');
    setShowRegisterForm(true);
  };

  const handleRegisterExisting = async (directoryMember) => {
    if (!trustId || !directoryMember?.member_id) return;
    setRegisteringId(directoryMember.member_id);
    setRegisterError('');
    const { data, error: registerErr } = await registerExistingMember(trustId, directoryMember.member_id, registerForm);
    if (registerErr) {
      setRegisterError(registerErr.message || 'Unable to register member for this trust.');
      setRegisteringId(null);
      return;
    }

    const nextMemberId = data?.member_id || directoryMember.member_id;
    setMembers((prev) => {
      const exists = prev.some((member) => String(member.member_id) === String(nextMemberId));
      const next = exists
        ? prev.map((member) => (
          String(member.member_id) === String(nextMemberId)
            ? { ...member, ...data }
            : member
        ))
        : [{ ...directoryMember, ...data }, ...prev];
      writeMembersCache(trustId, next);
      return next;
    });
    setSelectedMemberId(nextMemberId);
    setRegisterCandidate(null);
    setRegisteringId(null);
    setShowRegisterForm(false);
    setShowPicker(false);
  };

  if (!trustId) return null;

  return (
    <div className="mp-root">
      <Sidebar
        trustName={trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust } })}
        onLogout={() => navigate('/login')}
      />

      <main className="mp-main">
        <PageHeader
          title="Profile"
          subtitle="View Members, Registered Member, and Member Profile table data"
          onBack={() => navigate('/dashboard', { state: { userName, trust } })}
        />

        <div className="mp-content">
          <div className="mp-layout">
            <aside className="mp-members-panel">
              <div className="mp-members-head">
                <h3>{panelTitle}</h3>
                <span>{filteredMembers.length}</span>
              </div>
              <div className="mp-members-stats">
                <button
                  className={`mp-stat-chip my ${activeGroup === 'my' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveGroup('my');
                    setCurrentPage(1);
                  }}
                  type="button"
                >
                  <strong>My</strong>
                  <span>{myMembers.length}</span>
                </button>
                <button
                  className={`mp-stat-chip others ${activeGroup === 'others' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveGroup('others');
                    setCurrentPage(1);
                  }}
                  type="button"
                >
                  <strong>Others</strong>
                  <span>{otherMembers.length}</span>
                </button>
              </div>
              <div className="mp-members-controls">
                <label className="mp-sort-label" htmlFor="mp-role-filter">
                  Role
                  <span className="mp-filter-count">{selectedRoleCount}</span>
                </label>
                <select
                  id="mp-role-filter"
                  className="mp-sort-select"
                  value={roleFilter}
                  onChange={(event) => {
                    setRoleFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">All Roles ({membersForRoleCount.length})</option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>{role} ({roleCountMap.get(role) || 0})</option>
                  ))}
                </select>
              </div>
              <input
                className="mp-members-search"
                placeholder="Search member..."
                value={memberSearch}
                onChange={(event) => {
                  setMemberSearch(event.target.value);
                  setCurrentPage(1);
                }}
              />
              <button className="mp-add-member-btn" onClick={openPicker} type="button">
                <span className="mp-add-member-icon" aria-hidden="true">+</span>
                <span className="mp-add-member-text">Add a Member</span>
              </button>
              <div className="mp-members-controls">
                <label className="mp-sort-label" htmlFor="mp-sort">
                  Sort By
                </label>
                <select
                  id="mp-sort"
                  className="mp-sort-select"
                  value={sortBy}
                  onChange={(event) => {
                    setSortBy(event.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="name_asc">Name A-Z</option>
                  <option value="name_desc">Name Z-A</option>
                  <option value="membership_asc">Membership No (Asc)</option>
                  <option value="membership_desc">Membership No (Desc)</option>
                </select>
              </div>
              {!loadingMembers && sortedVisibleMembers.length === 0 && (
                <div className="mp-info-card">No members found.</div>
              )}
              <div className="mp-members-list">
                {paginatedMembers.map((member) => (
                  <button
                    key={member.member_id}
                    className={`mp-member-item ${String(effectiveSelectedMemberId) === String(member.member_id) ? 'active' : ''}`}
                    onClick={() => setSelectedMemberId(member.member_id || '')}
                    type="button"
                  >
                    <div className="mp-member-avatar">{initials(member.name || 'Member')}</div>
                    <div className="mp-member-meta">
                      <div className="mp-member-name">{member.name || 'Member'}</div>
                      <div className="mp-member-sub">
                        {member.company_name || member.mobile || member.email || 'No details'}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {!loadingMembers && sortedVisibleMembers.length > 0 && (
                <div className="mp-pagination">
                  <button
                    type="button"
                    className="mp-page-btn"
                    onClick={() => setCurrentPage((prev) => Math.max(1, Math.min(prev, totalPages) - 1))}
                    disabled={safeCurrentPage <= 1}
                  >
                    Prev
                  </button>
                  <span className="mp-page-info">Page {safeCurrentPage} / {totalPages}</span>
                  <button
                    type="button"
                    className="mp-page-btn"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, Math.min(prev, totalPages) + 1))}
                    disabled={safeCurrentPage >= totalPages}
                  >
                    Next
                  </button>
                </div>
              )}
            </aside>

            <section className="mp-detail-panel">
              {error && <div className="mp-error-card">{error}</div>}
              {saveError && <div className="mp-error-card">{saveError}</div>}
              {familyError && <div className="mp-error-card">{familyError}</div>}

              {!loadingMembers && profile && (
                <>
                  <section className="mp-hero">
                    <div className="mp-avatar-wrap">
                      {profile.profile_photo_url ? (
                        <img src={profile.profile_photo_url} alt={profileName} className="mp-avatar-img" />
                      ) : (
                        <div className="mp-avatar-fallback">{initials(profileName)}</div>
                      )}
                    </div>
                    <div className="mp-hero-meta">
                      <h2>{profileName}</h2>
                      <p>{canEditProfile ? 'My Member' : 'Others Member'}</p>
                      <div className="mp-registration-actions">
                        <button
                          type="button"
                          className={`mp-registration-status ${profile.is_active !== false ? 'active' : 'inactive'}`}
                          onClick={handleToggleRegistrationStatus}
                          disabled={statusUpdating || unregistering}
                        >
                          {statusUpdating ? 'Updating...' : profile.is_active !== false ? 'Active' : 'Inactive'}
                        </button>
                        <button
                          type="button"
                          className="mp-registration-unregister"
                          onClick={handleUnregisterMember}
                          disabled={statusUpdating || unregistering}
                        >
                          {unregistering ? 'Unregistering...' : 'Unregister'}
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="mp-grid">
                    <div className="mp-card mp-single-form-card">
                      <div className="mp-detail-head">
                        <h3>Profile Details</h3>
                        <div className="mp-action-group">
                        {!isEditing && (
                            <button type="button" className="mp-action-btn mp-action-btn-edit" onClick={handleStartEdit}>
                              Edit Details
                            </button>
                        )}
                        {isEditing && (
                          <>
                              <button
                                type="button"
                                className="mp-action-btn mp-action-btn-cancel"
                                onClick={handleCancelEdit}
                                disabled={saving}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="mp-action-btn mp-action-btn-save"
                                onClick={handleSaveEdit}
                                disabled={saving}
                              >
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                          </>
                        )}
                        </div>
                      </div>
                      {isEditing && canEditProfile && (
                        <div className="mp-photo-upload">
                          <div className="mp-upload-head">
                            <span className="mp-photo-label">Profile Photo</span>
                          </div>
                          <label
                            className={`mp-photo-drop ${photoDragOver ? 'drag' : ''}`}
                            onDragOver={(event) => {
                              event.preventDefault();
                              setPhotoDragOver(true);
                            }}
                            onDragLeave={() => setPhotoDragOver(false)}
                            onDrop={(event) => {
                              event.preventDefault();
                              setPhotoDragOver(false);
                              handleProfilePhotoFile(event.dataTransfer.files?.[0]);
                            }}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => handleProfilePhotoFile(event.target.files?.[0])}
                            />
                            <div className="mp-photo-drop-inner">
                              <span className="mp-photo-drop-primary">Upload Photo</span>
                            </div>
                          </label>
                          {editForm.profile_photo_url && (
                            <div className="mp-photo-preview">
                              <img src={editForm.profile_photo_url} alt="Profile Preview" />
                              <div className="mp-photo-meta">
                                <span>Preview</span>
                              </div>
                              <button
                                type="button"
                                className="mp-photo-clear"
                                onClick={() => setEditForm((prev) => ({ ...prev, profile_photo_url: '' }))}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="mp-profile-sections">
                        <div className="mp-profile-section">
                          <h4>Registration</h4>
                          <p className="mp-section-source">registered_members table</p>
                          <div className="mp-form-grid">
                            {REGISTRATION_FIELDS.map((field) => (
                              <label key={field.key}>
                                <span>{field.label}</span>
                                {field.key === 'role' && isFieldEditable(field.key) ? (
                                  <>
                                    <select
                                      value={useCustomEditRole ? CREATE_NEW_ROLE_VALUE : (editForm.role || '')}
                                      onChange={(event) => {
                                        const nextValue = event.target.value;
                                        if (nextValue === CREATE_NEW_ROLE_VALUE) {
                                          setUseCustomEditRole(true);
                                          setEditForm((prev) => ({ ...prev, role: '' }));
                                          return;
                                        }
                                        setUseCustomEditRole(false);
                                        setEditForm((prev) => ({ ...prev, role: nextValue }));
                                      }}
                                    >
                                      <option value="">Select role</option>
                                      {trustRoleOptions.map((role) => (
                                        <option key={role} value={role}>{role}</option>
                                      ))}
                                      <option value={CREATE_NEW_ROLE_VALUE}>+ Create New Role</option>
                                    </select>
                                    {useCustomEditRole && (
                                      <input
                                        placeholder="Enter new role"
                                        value={editForm.role}
                                        onChange={(event) => setEditForm((prev) => ({ ...prev, role: event.target.value }))}
                                      />
                                    )}
                                  </>
                                ) : (
                                  <input
                                    value={getProfileFieldValue(field.key)}
                                    onChange={(event) => {
                                      if (!isFieldEditable(field.key)) return;
                                      setEditForm((prev) => ({ ...prev, [field.key]: event.target.value }));
                                    }}
                                    readOnly={!isFieldEditable(field.key)}
                                  />
                                )}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="mp-profile-section">
                          <h4>Member Details</h4>
                          <p className="mp-section-source">Members table</p>
                          <div className="mp-form-grid">
                            {MEMBER_DETAILS_FIELDS.map((field) => (
                              <label key={field.key}>
                                <span>{field.label}</span>
                                <input
                                  value={getProfileFieldValue(field.key)}
                                  onChange={(event) => {
                                    if (!isFieldEditable(field.key)) return;
                                    setEditForm((prev) => ({ ...prev, [field.key]: event.target.value }));
                                  }}
                                  readOnly={!isFieldEditable(field.key)}
                                />
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="mp-profile-section">
                          <h4>Profile</h4>
                          <p className="mp-section-source">member_profile table</p>
                          {PROFILE_SECTIONS.map((section) => (
                            <div key={section.title} className="mp-profile-subsection">
                              <h5>{section.title}</h5>
                              <div className="mp-form-grid">
                                {section.fields.map((field) => (
                                  <label key={field.key}>
                                    <span>{field.label}</span>
                                    <input
                                      value={getProfileFieldValue(field.key)}
                                      onChange={(event) => {
                                        if (!isFieldEditable(field.key)) return;
                                        setEditForm((prev) => ({ ...prev, [field.key]: event.target.value }));
                                      }}
                                      readOnly={!isFieldEditable(field.key)}
                                    />
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mp-card mp-single-form-card">
                      <div className="mp-detail-head">
                        <h3>Family Members</h3>
                        {canEditFamily && !isFamilyEditing && (
                          <button type="button" className="mp-action-btn mp-action-btn-edit" onClick={handleStartFamilyAdd}>
                            Add Family Member
                          </button>
                        )}
                      </div>

                      {!loadingFamily && familyMembers.length === 0 && (
                        <div className="mp-info-card">No family members added yet.</div>
                      )}

                      {!loadingFamily && familyMembers.length > 0 && (
                        <div className="mp-family-list">
                          {familyMembers.map((item) => (
                            <div key={item.id} className="mp-family-item">
                              <div className="mp-family-row-head">
                                <div className="mp-family-title">{item.name}</div>
                                <span className="mp-family-relation">{item.relation}</span>
                              </div>
                              <div className="mp-family-sub mp-family-chip-row">
                                <span className="mp-family-chip">{item.gender || '-'}</span>
                                <span className="mp-family-chip">Age: {toText(item.age) || '-'}</span>
                                <span className="mp-family-chip">Blood: {item.blood_group || '-'}</span>
                              </div>
                              <div className="mp-family-sub">
                                {item.contact_no || '-'} {item.email ? `| ${item.email}` : ''}
                              </div>
                              {item.address && <div className="mp-family-sub">{item.address}</div>}
                              {canEditFamily && (
                                <div className="mp-family-actions">
                                  <button type="button" className="mp-page-btn" onClick={() => handleStartFamilyEdit(item)}>
                                    Edit
                                  </button>
                                  <button type="button" className="mp-page-btn mp-page-btn-danger" onClick={() => handleDeleteFamilyMember(item.id)}>
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {canEditFamily && isFamilyEditing && (
                        <div className="mp-family-form">
                          <div className="mp-family-form-head">
                            <h4>{familyForm.id ? 'Edit Family Member' : 'Add Family Member'}</h4>
                            <p>Fill details as per family member information.</p>
                          </div>
                          <div className="mp-form-grid">
                            <label>
                              <span>Name *</span>
                              <input
                                value={familyForm.name}
                                onChange={(event) => setFamilyForm((prev) => ({ ...prev, name: event.target.value }))}
                              />
                            </label>
                            <label>
                              <span>Relation *</span>
                              <input
                                value={familyForm.relation}
                                onChange={(event) => setFamilyForm((prev) => ({ ...prev, relation: event.target.value }))}
                              />
                            </label>
                            <label>
                              <span>Gender</span>
                              <select
                                value={familyForm.gender}
                                onChange={(event) => setFamilyForm((prev) => ({ ...prev, gender: event.target.value }))}
                              >
                                <option value="">Select</option>
                                {FAMILY_GENDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                              </select>
                            </label>
                            <label>
                              <span>Age</span>
                              <input
                                type="number"
                                min="0"
                                value={familyForm.age}
                                onChange={(event) => setFamilyForm((prev) => ({ ...prev, age: event.target.value }))}
                              />
                            </label>
                            <label>
                              <span>Blood Group</span>
                              <select
                                value={familyForm.blood_group}
                                onChange={(event) => setFamilyForm((prev) => ({ ...prev, blood_group: event.target.value }))}
                              >
                                <option value="">Select</option>
                                {FAMILY_BLOOD_GROUP_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                              </select>
                            </label>
                            <label>
                              <span>Contact No</span>
                              <input
                                value={familyForm.contact_no}
                                onChange={(event) => setFamilyForm((prev) => ({ ...prev, contact_no: event.target.value }))}
                              />
                            </label>
                            <label>
                              <span>Email</span>
                              <input
                                value={familyForm.email}
                                onChange={(event) => setFamilyForm((prev) => ({ ...prev, email: event.target.value }))}
                              />
                            </label>
                            <label>
                              <span>Address</span>
                              <input
                                value={familyForm.address}
                                onChange={(event) => setFamilyForm((prev) => ({ ...prev, address: event.target.value }))}
                              />
                            </label>
                          </div>

                          <div className="mp-action-group">
                            <button type="button" className="mp-action-btn mp-action-btn-cancel" onClick={handleCancelFamilyEdit} disabled={familySaving}>
                              Cancel
                            </button>
                            <button type="button" className="mp-action-btn mp-action-btn-save" onClick={handleSaveFamilyMember} disabled={familySaving}>
                              {familySaving ? 'Saving...' : familyForm.id ? 'Update Family Member' : 'Save Family Member'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </>
              )}
              {!loadingMembers && !profile && !error && (
                <div className="mp-info-card">Select a member to view details.</div>
              )}
            </section>
          </div>
        </div>

        {showPicker && (
          <div className="mp-modal-overlay" onClick={() => setShowPicker(false)}>
            <div className="mp-modal" onClick={(event) => event.stopPropagation()}>
              <div className="mp-modal-head">
                <div>
                  <h3>Select Member</h3>
                  <p>Search by name, company, mobile, or email.</p>
                </div>
                <button className="mp-modal-close" onClick={() => setShowPicker(false)} type="button">x</button>
              </div>
              <div className="mp-modal-search">
                <input
                  placeholder="Search by name, company, membership no, role, mobile, email, address, or status..."
                  value={pickerSearch}
                  onChange={(event) => {
                    setPickerSearch(event.target.value);
                    setPickerPage(1);
                  }}
                />
                <button className="mp-modal-create-btn" onClick={openNewMemberForm} type="button">
                  Create New Member
                </button>
              </div>
              <div className="mp-modal-controls">
                <label className="mp-modal-control">
                  <span>Filter</span>
                  <select
                    value={pickerFilter}
                    onChange={(event) => {
                      setPickerFilter(event.target.value);
                      setPickerPage(1);
                    }}
                  >
                    <option value="all">All Members</option>
                    <option value="my">My Members</option>
                    <option value="others">Other Members</option>
                  </select>
                </label>
                <label className="mp-modal-control">
                  <span>Sort By</span>
                  <select
                    value={pickerSortBy}
                    onChange={(event) => {
                      setPickerSortBy(event.target.value);
                      setPickerPage(1);
                    }}
                  >
                    <option value="name_asc">Name A-Z</option>
                    <option value="name_desc">Name Z-A</option>
                    <option value="company_asc">Company A-Z</option>
                    <option value="company_desc">Company Z-A</option>
                  </select>
                </label>
              </div>
              <div className="mp-modal-list">
                {loadingDirectory && (
                  <div className="mp-modal-empty">Loading members...</div>
                )}
                {sortedPickerMembers.length > 0 && (
                  <div className={`mp-modal-section ${pickerFilter === 'others' ? 'other' : 'my'}`}>
                    <div className="mp-modal-section-title">
                      {pickerFilter === 'my' ? 'My Members' : pickerFilter === 'others' ? 'Other Members' : 'Members'}
                    </div>
                    {paginatedPickerMembers.map((member) => (
                      <div
                        key={member.member_id}
                        className="mp-modal-item"
                        onClick={() => openRegisterForm(member)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openRegisterForm(member);
                          }
                        }}
                      >
                        <div>
                          <div className="mp-modal-title-row">
                            <div className="mp-modal-title">{member.name}</div>
                            <span className={`mp-modal-badge ${String(member.member_type || '').toLowerCase() === 'my' ? 'my' : 'other'}`}>
                              {String(member.member_type || '').toLowerCase() === 'my' ? 'My Member' : 'Others'}
                            </span>
                          </div>
                          <div className="mp-modal-sub">{member.company_name || 'No company'}</div>
                          <div className="mp-modal-sub">{member.mobile || member.email || ''}</div>
                        </div>
                        <div className="mp-modal-actions">
                          <button
                            className="mp-modal-action-btn"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openRegisterForm(member);
                            }}
                          >
                            Add to Trust
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!loadingDirectory && filteredDirectoryMembers.length === 0 && (
                  <div className="mp-modal-empty">No members found.</div>
                )}
                {sortedPickerMembers.length > 0 && (
                  <div className="mp-modal-pagination">
                    <button
                      type="button"
                      className="mp-page-btn"
                      onClick={() => setPickerPage((prev) => Math.max(1, prev - 1))}
                      disabled={safePickerPage <= 1}
                    >
                      Prev
                    </button>
                    <span className="mp-page-info">Page {safePickerPage} / {pickerTotalPages}</span>
                    <button
                      type="button"
                      className="mp-page-btn"
                      onClick={() => setPickerPage((prev) => Math.min(pickerTotalPages, prev + 1))}
                      disabled={safePickerPage >= pickerTotalPages}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showRegisterForm && registerCandidate && (
          <div className="mp-modal-overlay" onClick={() => setShowRegisterForm(false)}>
            <div className="mp-modal mp-modal-register" onClick={(event) => event.stopPropagation()}>
              <div className="mp-modal-head">
                <div>
                  <h3>Register Member to Trust</h3>
                  <p>{registerCandidate.name || 'Selected member'}</p>
                </div>
                <button className="mp-modal-close" onClick={() => setShowRegisterForm(false)} type="button">x</button>
              </div>
              <div className="mp-register-summary">
                <div className="mp-register-chip">
                  <span>Name</span>
                  <strong>{registerCandidate.name || 'Member'}</strong>
                </div>
                <div className="mp-register-chip">
                  <span>Company</span>
                  <strong>{registerCandidate.company_name || 'No company'}</strong>
                </div>
                <div className="mp-register-chip">
                  <span>Mobile</span>
                  <strong>{registerCandidate.mobile || '-'}</strong>
                </div>
                <div className="mp-register-chip">
                  <span>Member Type</span>
                  <strong>{registerCandidate.member_type === 'my' ? 'My Member' : 'Others'}</strong>
                </div>
              </div>
              <div className="mp-register-member-details">
                <h4>Members Table Details</h4>
                <div className="mp-register-member-grid">
                  <div className="mp-register-member-item">
                    <span>Email</span>
                    <strong>{registerCandidate.email || '-'}</strong>
                  </div>
                  <div className="mp-register-member-item">
                    <span>Resident Landline</span>
                    <strong>{registerCandidate.resident_landline || '-'}</strong>
                  </div>
                  <div className="mp-register-member-item">
                    <span>Office Landline</span>
                    <strong>{registerCandidate.office_landline || '-'}</strong>
                  </div>
                  <div className="mp-register-member-item">
                    <span>Home Address</span>
                    <strong>{registerCandidate.address_home || '-'}</strong>
                  </div>
                  <div className="mp-register-member-item">
                    <span>Office Address</span>
                    <strong>{registerCandidate.address_office || '-'}</strong>
                  </div>
                </div>
              </div>
              <div className="mp-modal-form">
                <label>
                  <span>Membership Number</span>
                  <input
                    value={registerForm.membership_number}
                    onChange={(event) => setRegisterForm((prev) => ({ ...prev, membership_number: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Role</span>
                  <select
                    value={useCustomRegisterRole ? CREATE_NEW_ROLE_VALUE : (registerForm.role || '')}
                    onChange={(event) => {
                      const nextValue = event.target.value;
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
                      onChange={(event) => setRegisterForm((prev) => ({ ...prev, role: event.target.value }))}
                    />
                  )}
                </label>
                <label>
                  <span>Joined Date</span>
                  <input
                    type="date"
                    value={registerForm.joined_date}
                    onChange={(event) => setRegisterForm((prev) => ({ ...prev, joined_date: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Status</span>
                  <select
                    value={registerForm.is_active ? 'active' : 'inactive'}
                    onChange={(event) => setRegisterForm((prev) => ({ ...prev, is_active: event.target.value === 'active' }))}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                {registerError && <div className="mp-error-card">{registerError}</div>}
                <div className="mp-action-group">
                  <button className="mp-action-btn mp-action-btn-cancel" onClick={() => setShowRegisterForm(false)} type="button">
                    Cancel
                  </button>
                  <button
                    className="mp-action-btn mp-action-btn-save"
                    onClick={() => handleRegisterExisting(registerCandidate)}
                    type="button"
                    disabled={registeringId === registerCandidate.member_id}
                  >
                    {registeringId === registerCandidate.member_id ? 'Saving...' : 'Save to Trust'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
