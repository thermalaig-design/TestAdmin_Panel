import { supabase } from '../lib/supabase';
import { cachedQuery, invalidateCache } from './requestCache';

const DEFAULT_HOME_LAYOUT = ['gallery', 'quickActions', 'sponsors'];
const DEFAULT_ANIMATIONS = {
  cards: 'fadeUp',
  navbar: 'fadeSlideDown',
  gallery: 'zoomIn',
};

export async function fetchTemplates() {
  return cachedQuery('theme:templates', async () => {
    const { data, error } = await supabase
      .from('app_templates')
      .select('*')
      .order('created_at', { ascending: false });

    return { data, error };
  }, 30000);
}

export async function createTemplate(payload) {
  const normalized = {
    ...payload,
    home_layout: payload.home_layout || DEFAULT_HOME_LAYOUT,
    animations: payload.animations || DEFAULT_ANIMATIONS,
  };

  const { data, error } = await supabase
    .from('app_templates')
    .insert([normalized])
    .select('*')
    .single();

  if (!error) invalidateCache('theme:');
  return { data, error };
}

export async function updateTemplate(id, updates) {
  const { data, error } = await supabase
    .from('app_templates')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (!error) invalidateCache('theme:');
  return { data, error };
}

export async function assignTemplateToTrust(trustId, templateId, themeOverrides = {}) {
  if (!trustId) return { data: null, error: { message: 'No trust ID provided' } };

  const { data, error } = await supabase
    .from('Trust')
    .update({
      template_id: templateId,
      theme_overrides: themeOverrides,
    })
    .eq('id', trustId)
    .select('*')
    .single();

  if (!error) invalidateCache('theme:');
  return { data, error };
}
