import { supabase } from '../lib/supabase';

const REGISTERED_TABLE_CANDIDATES = ['reg_members'];
const MEMBER_TABLE_CANDIDATES = ['Members'];
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
  const memberTrustId = pickFirst(row, ['trust_id']);
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
  const normalizedMember = normalizeMemberRow(memberRow, currentTrustId);
  const registrationTrustId = pickFirst(row, ['trust_id']);

  return {
    id: pickFirst(row, ['id']),
    trust_id: registrationTrustId,
    member_id: getRegisteredMemberId(row) || normalizedMember.member_id,
    membership_number: getMembershipNumber(row) || '',
    role: pickFirst(row, ['role']) || '',
    joined_date: pickFirst(row, ['joined_date']) || '',
    is_active: pickFirst(row, ['is_active']) !== false,
    ...normalizedMember,
  };
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

    for (const chunk of idChunks) {
      const { data, error } = await supabase.from(membersTable).select('*').in(idColumn, chunk);
      if (error) return { data: [], error, table: membersTable };
      combinedRows.push(...(data || []));
    }
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
  const registeredRows = [];

  for (const registeredTable of registeredTables) {
    const { data, error } = await fetchAllRows(
      supabase
        .from(registeredTable)
        .select('*')
        .eq('trust_id', trustId)
        .order('joined_date', { ascending: false, nullsFirst: false })
    );
    if (error) return { data: [], error };
    registeredRows.push(...(data || []));
  }

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
  const memberRows = [];

  for (const membersTable of memberTables) {
    const { data, error } = await fetchAllRows(
      supabase.from(membersTable).select('*')
    );
    if (error) return { data: [], error };
    memberRows.push(...(data || []));
  }

  return { data: memberRows.map((row) => normalizeMemberRow(row, currentTrustId)), error: null };
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
  if (!registration.data.is_editable) {
    return { data: null, error: { message: 'You can only edit members linked to your trust.' } };
  }

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
