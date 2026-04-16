import { supabase } from '../lib/supabase';

const REGISTERED_TABLE_CANDIDATES = ['registered_members', 'reg_members'];
const MEMBER_TABLE_CANDIDATES = ['members', 'Members'];
const MEMBER_PROFILE_TABLE_CANDIDATES = ['member_profiles'];
const FAMILY_MEMBERS_TABLE_CANDIDATES = ['family_members'];
const MEMBER_FETCH_CHUNK_SIZE = 100;
const TABLE_PAGE_SIZE = 1000;

let resolvedRegisteredTable = null;
let resolvedMembersTable = null;
let resolvedRegisteredTables = null;
let resolvedMemberTables = null;

function pickFirst(row = {}, keys = []) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return null;
}

async function resolveTable(candidates, cacheKey) {
  if (cacheKey === 'registered' && resolvedRegisteredTable) return resolvedRegisteredTable;
  if (cacheKey === 'members' && resolvedMembersTable) return resolvedMembersTable;

  let lastError = null;
  for (const table of candidates) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (!error) {
      if (cacheKey === 'registered') resolvedRegisteredTable = table;
      if (cacheKey === 'members') resolvedMembersTable = table;
      return table;
    }
    lastError = error;
  }

  throw lastError || new Error(`Unable to resolve ${cacheKey} table.`);
}

async function resolveAvailableTables(candidates, cacheKey) {
  if (cacheKey === 'registered' && resolvedRegisteredTables) return resolvedRegisteredTables;
  if (cacheKey === 'members' && resolvedMemberTables) return resolvedMemberTables;

  const availableTables = [];
  let lastError = null;

  for (const table of candidates) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (!error) availableTables.push(table);
    else lastError = error;
  }

  if (!availableTables.length) {
    throw lastError || new Error(`Unable to resolve ${cacheKey} tables.`);
  }

  if (cacheKey === 'registered') resolvedRegisteredTables = availableTables;
  if (cacheKey === 'members') resolvedMemberTables = availableTables;
  return availableTables;
}

function getMemberUniqueId(row = {}) {
  return pickFirst(row, ['member_id', 'members_id', 'id']);
}

function getRegisteredMemberId(row = {}) {
  return pickFirst(row, ['member_id', 'members_id']);
}

function getTrustId(row = {}) {
  return pickFirst(row, ['trust_id', 'trustId', 'trustid', 'Trust ID']);
}

function getMembershipNumber(row = {}) {
  return pickFirst(row, ['membership_number', 'Membership number']);
}

function chunkValues(values = [], size = MEMBER_FETCH_CHUNK_SIZE) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function fetchAllRows(queryBuilder) {
  const allRows = [];
  let from = 0;

  while (true) {
    const to = from + TABLE_PAGE_SIZE - 1;
    const { data, error } = await queryBuilder.range(from, to);
    if (error) return { data: [], error };

    const rows = data || [];
    allRows.push(...rows);

    if (rows.length < TABLE_PAGE_SIZE) break;
    from += TABLE_PAGE_SIZE;
  }

  return { data: allRows, error: null };
}

function normalizeMemberRow(row = {}, currentTrustId = null) {
  const memberTrustId = getTrustId(row);
  const normalizedTrustId = memberTrustId ? String(memberTrustId) : '';
  const normalizedCurrentTrustId = currentTrustId ? String(currentTrustId) : '';
  const isEditable = !!normalizedTrustId && normalizedTrustId === normalizedCurrentTrustId;

  return {
    member_id: getMemberUniqueId(row),
    trust_id: memberTrustId,
    name: pickFirst(row, ['name', 'Name']) || '',
    company_name: pickFirst(row, ['company_name', 'Company Name']) || '',
    address_home: pickFirst(row, ['address_home', 'Address Home']) || '',
    address_office: pickFirst(row, ['address_office', 'Address Office']) || '',
    resident_landline: pickFirst(row, ['resident_landline', 'Resident Landline']) || '',
    office_landline: pickFirst(row, ['office_landline', 'Office Landline']) || '',
    mobile: pickFirst(row, ['mobile', 'Mobile']) || '',
    email: pickFirst(row, ['email', 'Email']) || '',
    serial_no: pickFirst(row, ['S.No.']) || null,
    is_editable: isEditable,
    member_type: isEditable ? 'my' : 'others',
  };
}

function normalizeRegisteredRow(row = {}, memberRow = {}, currentTrustId = null) {
  const registrationTrustId = getTrustId(row);
  const memberTrustId = getTrustId(memberRow);
  const normalizedMemberTrustId = memberTrustId ? String(memberTrustId) : '';
  const normalizedCurrentTrustId = currentTrustId ? String(currentTrustId) : '';
  const isEditable = !!normalizedMemberTrustId && normalizedMemberTrustId === normalizedCurrentTrustId;
  const normalizedMember = normalizeMemberRow(memberRow, currentTrustId);

  return {
    id: pickFirst(row, ['id']),
    ...normalizedMember,
    trust_id: registrationTrustId,
    member_id: getRegisteredMemberId(row) || normalizedMember.member_id,
    membership_number: getMembershipNumber(row) || '',
    role: pickFirst(row, ['role']) || '',
    joined_date: pickFirst(row, ['joined_date']) || '',
    is_active: pickFirst(row, ['is_active']) !== false,
    is_editable: isEditable,
    member_type: isEditable ? 'my' : 'others',
  };
}

function normalizeMemberProfileRow(row = {}) {
  return {
    profile_photo_url: pickFirst(row, ['profile_photo_url']) || '',
    gender: pickFirst(row, ['gender']) || '',
    date_of_birth: pickFirst(row, ['date_of_birth']) || '',
    blood_group: pickFirst(row, ['blood_group']) || '',
    marital_status: pickFirst(row, ['marital_status']) || '',
    nationality: pickFirst(row, ['nationality']) || '',
    aadhaar_id: pickFirst(row, ['aadhaar_id']) || '',
    emergency_contact_name: pickFirst(row, ['emergency_contact_name']) || '',
    emergency_contact_number: pickFirst(row, ['emergency_contact_number']) || '',
    spouse_name: pickFirst(row, ['spouse_name']) || '',
    spouse_contact: pickFirst(row, ['spouse_contact']) || '',
    no_of_children: pickFirst(row, ['no_of_children']) ?? '',
    facebook: pickFirst(row, ['facebook']) || '',
    twitter: pickFirst(row, ['twitter']) || '',
    instagram: pickFirst(row, ['instagram']) || '',
    linkedin: pickFirst(row, ['linkedin']) || '',
    whatsapp: pickFirst(row, ['whatsapp']) || '',
  };
}

function buildMemberProfilePayload(payload = {}, memberId) {
  const rawChildren = payload.no_of_children;
  const normalizedChildren =
    rawChildren === '' || rawChildren === null || rawChildren === undefined
      ? null
      : Number.isFinite(Number(rawChildren))
        ? Number(rawChildren)
        : rawChildren;

  return {
    members_id: memberId,
    profile_photo_url: payload.profile_photo_url || null,
    gender: payload.gender || null,
    date_of_birth: payload.date_of_birth || null,
    blood_group: payload.blood_group || null,
    marital_status: payload.marital_status || null,
    nationality: payload.nationality || null,
    aadhaar_id: payload.aadhaar_id || null,
    emergency_contact_name: payload.emergency_contact_name || null,
    emergency_contact_number: payload.emergency_contact_number || null,
    spouse_name: payload.spouse_name || null,
    spouse_contact: payload.spouse_contact || null,
    no_of_children: normalizedChildren,
    facebook: payload.facebook || null,
    twitter: payload.twitter || null,
    instagram: payload.instagram || null,
    linkedin: payload.linkedin || null,
    whatsapp: payload.whatsapp || null,
  };
}

function normalizeFamilyMemberRow(row = {}) {
  return {
    id: pickFirst(row, ['id']),
    members_id: pickFirst(row, ['members_id', 'member_id']),
    name: pickFirst(row, ['name']) || '',
    relation: pickFirst(row, ['relation']) || '',
    gender: pickFirst(row, ['gender']) || '',
    age: pickFirst(row, ['age']) ?? '',
    blood_group: pickFirst(row, ['blood_group']) || '',
    contact_no: pickFirst(row, ['contact_no']) || '',
    email: pickFirst(row, ['email']) || '',
    address: pickFirst(row, ['address']) || '',
    created_at: pickFirst(row, ['created_at']) || null,
    updated_at: pickFirst(row, ['updated_at']) || null,
  };
}

function buildFamilyMemberPayload(payload = {}, memberId) {
  const parsedAge =
    payload.age === '' || payload.age === null || payload.age === undefined
      ? null
      : Number.isFinite(Number(payload.age))
        ? Number(payload.age)
        : null;

  return {
    members_id: memberId,
    name: payload.name?.trim() || '',
    relation: payload.relation?.trim() || '',
    gender: payload.gender?.trim() || null,
    age: parsedAge,
    blood_group: payload.blood_group?.trim() || null,
    contact_no: payload.contact_no?.trim() || null,
    email: payload.email?.trim() || null,
    address: payload.address?.trim() || null,
  };
}

async function upsertMemberProfileByMemberId(memberId, payload = {}) {
  const profilePayload = buildMemberProfilePayload(payload, memberId);

  for (const table of MEMBER_PROFILE_TABLE_CANDIDATES) {
    const existingQuery = await supabase
      .from(table)
      .select('members_id')
      .eq('members_id', memberId)
      .limit(1)
      .maybeSingle();

    if (!existingQuery.error) {
      if (existingQuery.data?.members_id) {
        const { error } = await supabase
          .from(table)
          .update(profilePayload)
          .eq('members_id', memberId);
        if (error) return { error };
        return { error: null };
      }

      const { error } = await supabase.from(table).insert([profilePayload]);
      if (error) return { error };
      return { error: null };
    }

    const message = String(existingQuery.error?.message || '').toLowerCase();
    if (message.includes('does not exist')) continue;
    return { error: existingQuery.error };
  }

  return { error: null };
}

export async function fetchFamilyMembersByMemberId(memberId) {
  if (!memberId) return { data: [], error: null };

  const familyTable = await resolveTable(FAMILY_MEMBERS_TABLE_CANDIDATES, 'family_members');
  const { data, error } = await supabase
    .from(familyTable)
    .select('*')
    .eq('members_id', memberId)
    .order('created_at', { ascending: true, nullsFirst: false });

  if (error) {
    // Backward compatibility for alternate key naming if schema differs
    if (String(error?.message || '').toLowerCase().includes('members_id')) {
      const fallback = await supabase
        .from(familyTable)
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: true, nullsFirst: false });

      if (fallback.error) return { data: [], error: fallback.error };
      return { data: (fallback.data || []).map(normalizeFamilyMemberRow), error: null };
    }
    return { data: [], error };
  }

  return { data: (data || []).map(normalizeFamilyMemberRow), error: null };
}

export async function createFamilyMember(memberId, payload = {}) {
  if (!memberId) return { data: null, error: { message: 'Member id is required.' } };
  if (!payload?.name?.trim()) return { data: null, error: { message: 'Family member name is required.' } };
  if (!payload?.relation?.trim()) return { data: null, error: { message: 'Relation is required.' } };

  const familyTable = await resolveTable(FAMILY_MEMBERS_TABLE_CANDIDATES, 'family_members');
  const insertPayload = buildFamilyMemberPayload(payload, memberId);
  const { data, error } = await supabase
    .from(familyTable)
    .insert([insertPayload])
    .select('*')
    .single();

  if (error) return { data: null, error };
  return { data: normalizeFamilyMemberRow(data), error: null };
}

export async function updateFamilyMember(familyMemberId, memberId, payload = {}) {
  if (!familyMemberId) return { data: null, error: { message: 'Family member id is required.' } };
  if (!payload?.name?.trim()) return { data: null, error: { message: 'Family member name is required.' } };
  if (!payload?.relation?.trim()) return { data: null, error: { message: 'Relation is required.' } };

  const familyTable = await resolveTable(FAMILY_MEMBERS_TABLE_CANDIDATES, 'family_members');
  const updatePayload = buildFamilyMemberPayload(payload, memberId);
  const query = supabase
    .from(familyTable)
    .update(updatePayload)
    .eq('id', familyMemberId)
    .select('*')
    .single();

  const { data, error } = memberId ? await query.eq('members_id', memberId) : await query;
  if (error) return { data: null, error };
  return { data: normalizeFamilyMemberRow(data), error: null };
}

export async function deleteFamilyMember(familyMemberId, memberId) {
  if (!familyMemberId) return { error: { message: 'Family member id is required.' } };
  const familyTable = await resolveTable(FAMILY_MEMBERS_TABLE_CANDIDATES, 'family_members');
  const query = supabase.from(familyTable).delete().eq('id', familyMemberId);
  const { error } = memberId ? await query.eq('members_id', memberId) : await query;
  return { error };
}

function buildMemberPayload(payload, trustId, table) {
  if (table === 'members') {
    return {
      name: payload.name,
      address_home: payload.address_home || null,
      company_name: payload.company_name || null,
      address_office: payload.address_office || null,
      resident_landline: payload.resident_landline || null,
      office_landline: payload.office_landline || null,
      mobile: payload.mobile || null,
      email: payload.email || null,
      trust_id: trustId || null,
    };
  }

  return {
    Name: payload.name,
    'Address Home': payload.address_home || null,
    'Company Name': payload.company_name || null,
    'Address Office': payload.address_office || null,
    'Resident Landline': payload.resident_landline || null,
    'Office Landline': payload.office_landline || null,
    Mobile: payload.mobile || null,
    Email: payload.email || null,
    trust_id: trustId ? String(trustId) : null,
  };
}

function buildRegisteredPayload(payload, trustId, memberId, table) {
  if (table === 'registered_members') {
    return {
      trust_id: trustId,
      member_id: memberId,
      membership_number: payload.membership_number || null,
      role: payload.role || null,
      joined_date: payload.joined_date || null,
      is_active: payload.is_active !== false,
    };
  }

  return {
    trust_id: trustId,
    members_id: memberId,
    'Membership number': payload.membership_number || null,
    role: payload.role || null,
    joined_date: payload.joined_date || null,
    is_active: payload.is_active !== false,
  };
}

async function fetchMemberRowsByIds(memberIds) {
  const memberTables = await resolveAvailableTables(MEMBER_TABLE_CANDIDATES, 'members');
  if (!memberIds.length) return { data: [], error: null, table: memberTables[0] };

  const ids = [...new Set(memberIds.filter(Boolean))];
  const idChunks = chunkValues(ids);
  const combinedRows = [];
  let lastTable = memberTables[0];

  for (const membersTable of memberTables) {
    const idColumn = membersTable === 'members' ? 'member_id' : 'members_id';
    lastTable = membersTable;
    const chunkResults = await Promise.all(
      idChunks.map((chunk) => supabase.from(membersTable).select('*').in(idColumn, chunk))
    );
    const errored = chunkResults.find((result) => result.error);
    if (errored?.error) return { data: [], error: errored.error, table: membersTable };
    combinedRows.push(...chunkResults.flatMap((result) => result.data || []));
  }

  return { data: combinedRows, error: null, table: lastTable };
}

async function fetchRegisteredRowById(id, currentTrustId) {
  const registeredTable = await resolveTable(REGISTERED_TABLE_CANDIDATES, 'registered');
  const { data: regRow, error } = await supabase.from(registeredTable).select('*').eq('id', id).single();
  if (error) return { data: null, error };

  const memberId = getRegisteredMemberId(regRow);
  const { data: memberRows, error: memberError } = await fetchMemberRowsByIds([memberId]);
  if (memberError) return { data: null, error: memberError };

  const memberRow = (memberRows || []).find((item) => String(getMemberUniqueId(item)) === String(memberId)) || {};
  return { data: normalizeRegisteredRow(regRow, memberRow, currentTrustId), error: null };
}

export async function fetchRegisteredMembersByTrust(trustId) {
  if (!trustId) return { data: [], error: null };

  const registeredTables = await resolveAvailableTables(REGISTERED_TABLE_CANDIDATES, 'registered');
  const tableResults = await Promise.all(
    registeredTables.map((registeredTable) =>
      fetchAllRows(
        supabase
          .from(registeredTable)
          .select('*')
          .eq('trust_id', trustId)
          .order('joined_date', { ascending: false, nullsFirst: false })
      )
    )
  );
  const errored = tableResults.find((result) => result.error);
  if (errored?.error) return { data: [], error: errored.error };
  const registeredRows = tableResults.flatMap((result) => result.data || []);

  const memberIds = (registeredRows || []).map(getRegisteredMemberId).filter(Boolean);
  const { data: memberRows, error: memberError } = await fetchMemberRowsByIds(memberIds);
  if (memberError) return { data: [], error: memberError };

  const memberMap = new Map((memberRows || []).map((row) => [String(getMemberUniqueId(row)), row]));
  const normalized = (registeredRows || []).map((row) =>
    normalizeRegisteredRow(row, memberMap.get(String(getRegisteredMemberId(row))) || {}, trustId)
  );

  return { data: normalized, error: null };
}

export async function fetchAllMembersDirectory(currentTrustId) {
  const memberTables = await resolveAvailableTables(MEMBER_TABLE_CANDIDATES, 'members');
  const tableResults = await Promise.all(
    memberTables.map((membersTable) =>
      fetchAllRows(supabase.from(membersTable).select('*'))
    )
  );
  const errored = tableResults.find((result) => result.error);
  if (errored?.error) return { data: [], error: errored.error };
  const memberRows = tableResults.flatMap((result) => result.data || []);

  return { data: memberRows.map((row) => normalizeMemberRow(row, currentTrustId)), error: null };
}

export async function fetchRegisteredMembersDirectory(currentTrustId) {
  const allRows = [];
  let from = 0;

  while (true) {
    const to = from + TABLE_PAGE_SIZE - 1;
    const { data, error } = await fetchRegisteredMembersDirectoryPage(currentTrustId, { from, to });
    if (error) return { data: [], error };

    const rows = data || [];
    allRows.push(...rows);

    if (rows.length < TABLE_PAGE_SIZE) break;
    from += TABLE_PAGE_SIZE;
  }

  return { data: allRows, error: null };
}

export async function fetchRegisteredMembersDirectoryPage(currentTrustId, { from = 0, to = TABLE_PAGE_SIZE - 1 } = {}) {
  const registeredTable = await resolveTable(REGISTERED_TABLE_CANDIDATES, 'registered');

  let query = supabase
    .from(registeredTable)
    .select('*')
    .order('joined_date', { ascending: false, nullsFirst: false })
    .range(from, to);

  if (currentTrustId) query = query.eq('trust_id', currentTrustId);

  const { data: registeredRows, error } = await query;

  if (error) return { data: [], error };

  const rows = registeredRows || [];
  if (!rows.length) return { data: [], error: null };

  const memberIds = rows.map(getRegisteredMemberId).filter(Boolean);
  const { data: memberRows, error: memberError } = await fetchMemberRowsByIds(memberIds);
  if (memberError) return { data: [], error: memberError };

  const memberMap = new Map((memberRows || []).map((row) => [String(getMemberUniqueId(row)), row]));
  const normalized = rows.map((row) =>
    normalizeRegisteredRow(row, memberMap.get(String(getRegisteredMemberId(row))) || {}, currentTrustId)
  );

  return { data: normalized, error: null };
}

export async function registerExistingMember(trustId, memberId, payload = {}) {
  const registeredTable = await resolveTable(REGISTERED_TABLE_CANDIDATES, 'registered');
  const memberIdColumn = registeredTable === 'registered_members' ? 'member_id' : 'members_id';

  const existingQuery = await supabase
    .from(registeredTable)
    .select('*')
    .eq('trust_id', trustId)
    .eq(memberIdColumn, memberId)
    .limit(1)
    .maybeSingle();

  if (existingQuery.error) return { data: null, error: existingQuery.error };

  const registrationPayload = buildRegisteredPayload(payload, trustId, memberId, registeredTable);

  if (existingQuery.data?.id) {
    const { error } = await supabase
      .from(registeredTable)
      .update(registrationPayload)
      .eq('id', existingQuery.data.id);

    if (error) return { data: null, error };
    return fetchRegisteredRowById(existingQuery.data.id, trustId);
  }

  const { data, error } = await supabase
    .from(registeredTable)
    .insert([registrationPayload])
    .select('id')
    .single();

  if (error) return { data: null, error };
  return fetchRegisteredRowById(data.id, trustId);
}

export async function createMember(trustId, payload) {
  const membersTable = await resolveTable(MEMBER_TABLE_CANDIDATES, 'members');
  const memberIdColumn = membersTable === 'members' ? 'member_id' : 'members_id';
  const memberPayload = buildMemberPayload(payload, trustId, membersTable);

  const { data, error } = await supabase
    .from(membersTable)
    .insert([memberPayload])
    .select('*')
    .single();

  if (error) return { data: null, error };

  const createdMemberId = data?.[memberIdColumn];
  if (!createdMemberId) return { data: null, error: { message: 'Member id not returned after create.' } };

  return registerExistingMember(trustId, createdMemberId, payload);
}

export async function updateRegisteredMember(registrationId, payload, currentTrustId) {
  const registration = await fetchRegisteredRowById(registrationId, currentTrustId);
  if (registration.error) return registration;
  if (!registration.data) return { data: null, error: { message: 'Registered member not found.' } };

  const membersTable = await resolveTable(MEMBER_TABLE_CANDIDATES, 'members');
  const memberIdColumn = membersTable === 'members' ? 'member_id' : 'members_id';
  const registeredTable = await resolveTable(REGISTERED_TABLE_CANDIDATES, 'registered');
  const memberPayload = buildMemberPayload(payload, currentTrustId, membersTable);
  const memberId = registration.data.member_id;

  const { error: memberError } = await supabase
    .from(membersTable)
    .update(memberPayload)
    .eq(memberIdColumn, memberId);

  if (memberError) return { data: null, error: memberError };

  const registeredPayload = buildRegisteredPayload(payload, currentTrustId, memberId, registeredTable);
  const { error: registrationError } = await supabase
    .from(registeredTable)
    .update(registeredPayload)
    .eq('id', registrationId)
    .eq('trust_id', currentTrustId);

  if (registrationError) return { data: null, error: registrationError };

  const { error: memberProfileError } = await upsertMemberProfileByMemberId(memberId, payload);
  if (memberProfileError) return { data: null, error: memberProfileError };

  return fetchRegisteredRowById(registrationId, currentTrustId);
}

export async function updateRegisteredMembership(registrationId, payload, currentTrustId) {
  const registeredTable = await resolveTable(REGISTERED_TABLE_CANDIDATES, 'registered');
  const registration = await fetchRegisteredRowById(registrationId, currentTrustId);
  if (registration.error) return registration;
  if (!registration.data) return { data: null, error: { message: 'Registered member not found.' } };

  const registeredPayload = buildRegisteredPayload(
    payload,
    currentTrustId,
    registration.data.member_id,
    registeredTable
  );

  const { error } = await supabase
    .from(registeredTable)
    .update(registeredPayload)
    .eq('id', registrationId)
    .eq('trust_id', currentTrustId);

  if (error) return { data: null, error };

  return fetchRegisteredRowById(registrationId, currentTrustId);
}

export async function unregisterRegisteredMember(registrationId, currentTrustId) {
  const registeredTable = await resolveTable(REGISTERED_TABLE_CANDIDATES, 'registered');
  const { error } = await supabase
    .from(registeredTable)
    .delete()
    .eq('id', registrationId)
    .eq('trust_id', currentTrustId);

  return { error };
}

export async function fetchMemberProfileView({ registrationId = null, memberId = null, trustId = null } = {}) {
  const registeredTable = await resolveTable(REGISTERED_TABLE_CANDIDATES, 'registered');
  const memberIdColumn = registeredTable === 'registered_members' ? 'member_id' : 'members_id';

  let registrationRow = null;
  let registrationError = null;
  let currentMemberId = memberId ? String(memberId) : null;

  if (registrationId) {
    const query = supabase
      .from(registeredTable)
      .select('*')
      .eq('id', registrationId)
      .limit(1)
      .maybeSingle();

    if (trustId) query.eq('trust_id', trustId);

    const { data, error } = await query;
    if (error) registrationError = error;
    registrationRow = data || null;
    currentMemberId = currentMemberId || String(getRegisteredMemberId(registrationRow) || '');
  } else if (currentMemberId) {
    const query = supabase
      .from(registeredTable)
      .select('*')
      .eq(memberIdColumn, currentMemberId)
      .limit(1);

    if (trustId) query.eq('trust_id', trustId);

    const { data, error } = await query.maybeSingle();
    if (error) registrationError = error;
    registrationRow = data || null;
  }

  if (!currentMemberId) {
    return { data: null, error: registrationError || { message: 'Member id is required to load profile.' } };
  }

  const { data: memberRows, error: memberError } = await fetchMemberRowsByIds([currentMemberId]);
  if (memberError) return { data: null, error: memberError };

  const memberRow = (memberRows || []).find((row) => String(getMemberUniqueId(row)) === currentMemberId) || {};
  const normalizedMember = normalizeMemberRow(memberRow, trustId);

  let profileRow = null;
  let profileError = null;
  for (const table of MEMBER_PROFILE_TABLE_CANDIDATES) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('members_id', currentMemberId)
      .limit(1)
      .maybeSingle();

    if (!error) {
      profileRow = data || null;
      profileError = null;
      break;
    }

    if (String(error?.message || '').toLowerCase().includes('does not exist')) {
      profileError = null;
      profileRow = null;
      break;
    }

    profileError = error;
  }

  if (profileError) return { data: null, error: profileError };

  const registeredData = registrationRow
    ? normalizeRegisteredRow(registrationRow, memberRow, trustId)
    : {
        id: null,
        membership_number: '',
        role: '',
      };

  return {
    data: {
      registration_id: registeredData.id || registrationId || null,
      trust_id: registeredData.trust_id || null,
      member_id: currentMemberId,
      name: normalizedMember.name || '',
      address_home: normalizedMember.address_home || '',
      company_name: normalizedMember.company_name || '',
      address_office: normalizedMember.address_office || '',
      resident_landline: normalizedMember.resident_landline || '',
      office_landline: normalizedMember.office_landline || '',
      mobile: normalizedMember.mobile || '',
      email: normalizedMember.email || '',
      membership_number: registeredData.membership_number || '',
      role: registeredData.role || '',
      joined_date: registeredData.joined_date || '',
      is_active: registeredData.is_active !== false,
      is_editable: registeredData.is_editable === true,
      member_type: registeredData.member_type || 'others',
      ...normalizeMemberProfileRow(profileRow || {}),
    },
    error: null,
  };
}
