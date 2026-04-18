import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from './requestCache';

export async function fetchSponsors() {
  return cachedQuery('sponsors:list', async () => {
    const { data, error } = await supabase
      .from('sponsors')
      .select('*')
      .order('company_name', { ascending: true })
      .order('ref_no', { ascending: true });

    return { data, error };
  }, 20000);
}

export async function createSponsor(payload) {
  const { data, error } = await supabase
    .from('sponsors')
    .insert([payload])
    .select('*')
    .single();

  if (!error) invalidateCache('sponsors:');
  return { data, error };
}

export async function updateSponsor(id, updates) {
  const { data, error } = await supabase
    .from('sponsors')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (!error) invalidateCache('sponsors:');
  return { data, error };
}

export async function deleteSponsor(id) {
  const { error } = await supabase
    .from('sponsors')
    .delete()
    .eq('id', id);

  if (!error) invalidateCache('sponsors:');
  return { error };
}

export async function fetchSponsorFlashByTrust(trustId) {
  if (!trustId) return { data: null, error: { message: 'No trust ID provided' } };

  return cachedQuery(`sponsors:flash:${trustId}`, async () => {
    const { data, error } = await supabase
      .from('sponsor_flash')
      .select('*')
      .eq('trust_id', trustId);

    return { data, error };
  }, 12000);
}

export async function createSponsorFlash(payload) {
  const { data, error } = await supabase
    .from('sponsor_flash')
    .insert([payload])
    .select('*')
    .single();

  if (!error) invalidateCache('sponsors:flash:');
  return { data, error };
}

export async function updateSponsorFlash(id, updates) {
  const { data, error } = await supabase
    .from('sponsor_flash')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (!error) invalidateCache('sponsors:flash:');
  return { data, error };
}

export async function deleteSponsorFlash(id) {
  const { error } = await supabase
    .from('sponsor_flash')
    .delete()
    .eq('id', id);

  if (!error) invalidateCache('sponsors:flash:');
  return { error };
}
