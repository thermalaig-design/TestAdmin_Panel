import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import { fetchTrustDetails } from '../services/trustService';
import { assignTemplateToTrust, createTemplate, fetchTemplates, updateTemplate } from '../services/themeService';
import './ThemePage.css';

const EMPTY_FORM = {
  name: '',
  description: '',
  template_key: 'mahila',
  theme_config: {},
  home_layout: '["trustList","sponsors","marquee","gallery","quickActions"]',
  custom_css: '',
  is_active: true,
};
const DEFAULT_NEW_HOME_LAYOUT = ['trustList', 'sponsors', 'marquee', 'gallery', 'quickActions'];

const pretty = (value, fallback) => JSON.stringify(value ?? fallback, null, 2);
const DEFAULT_ANIMATIONS = { cards: 'fadeUp', navbar: 'fadeSlideDown', gallery: 'zoomIn' };
const GRADIENT_OPTIONS = ['none', 'linear', 'radial', 'conic'];
const DEFAULT_THEME_SECTION_CONFIG = {
  footer: { bg_color_1: '#ffffff', bg_color_2: null, text_color: '#111827', gradient_type: 'none' },
  navbar: { blur: 8, opacity: 0.96, bg_color_1: '#ffffff', bg_color_2: null, text_color: '#1f2937', gradient_type: 'none' },
  marquee: { bg_color_1: '#4a42e8', bg_color_2: null, text_color: '#ffffff', gradient_type: 'none' },
  page_bg: { bg_color_1: '#f6f8fc', bg_color_2: '#eef2ff', gradient_type: 'linear', gradient_angle: 180, gradient_transition: 'ease' },
  sidebar: { blur: 12, opacity: 0.98, bg_color_1: '#4a42e8', bg_color_2: null, text_color: '#ffffff', button_color: '#4a42e8', gradient_type: 'none', button_text_color: '#ffffff' },
  typography: {
    font_family: 'Inter',
    heading_color: '#111827',
    body_text_color: '#4b5563',
    subheading_color: '#4a42e8',
    component_overrides: {
      footer_text: '#111827',
      navbar_text: '#1f2937',
      marquee_text: '#ffffff',
      sidebar_text: '#ffffff',
    },
  },
  app_buttons: { bg_color_1: '#4a42e8', bg_color_2: null, text_color: '#ffffff', gradient_type: 'none' },
  advertisement: { bg_color: '#eef2ff', bg_opacity: 1, text_color: '#4a42e8' },
  quick_actions: { bg_color_1: '#ffffff', bg_color_2: null, text_color: '#111827', gradient_type: 'none', icon_bg_color: '#e0e7ff' },
};
const THEME_SECTION_FIELDS = {
  footer: [
    { key: 'bg_color_1', label: 'Main Background Color', type: 'color', fallback: '#fff' },
    { key: 'bg_color_2', label: 'Second Background Color', type: 'color', fallback: '#fff', allowNull: true },
    { key: 'text_color', label: 'Text Color', type: 'color', fallback: '#000' },
    { key: 'gradient_type', label: 'Background Style', type: 'select', options: GRADIENT_OPTIONS },
  ],
  navbar: [
    { key: 'blur', label: 'Blur Strength', type: 'number', min: 0, step: 1 },
    { key: 'opacity', label: 'Transparency', type: 'number', min: 0, max: 1, step: 0.01 },
    { key: 'bg_color_1', label: 'Main Background Color', type: 'color', fallback: '#000000' },
    { key: 'bg_color_2', label: 'Second Background Color', type: 'color', fallback: '#000000', allowNull: true },
    { key: 'text_color', label: 'Text Color', type: 'color', fallback: '#ffffff' },
    { key: 'gradient_type', label: 'Background Style', type: 'select', options: GRADIENT_OPTIONS },
  ],
  marquee: [
    { key: 'bg_color_1', label: 'Main Background Color', type: 'color', fallback: '#C0241A' },
    { key: 'bg_color_2', label: 'Second Background Color', type: 'color', fallback: '#C0241A', allowNull: true },
    { key: 'text_color', label: 'Text Color', type: 'color', fallback: '#ffffff' },
    { key: 'gradient_type', label: 'Background Style', type: 'select', options: GRADIENT_OPTIONS },
  ],
  page_bg: [
    { key: 'bg_color_1', label: 'Main Background Color', type: 'color', fallback: '#fff5f5' },
    { key: 'bg_color_2', label: 'Second Background Color', type: 'color', fallback: '#f0f1fb' },
    { key: 'gradient_type', label: 'Background Style', type: 'select', options: GRADIENT_OPTIONS },
    { key: 'gradient_angle', label: 'Gradient Angle', type: 'number', min: 0, max: 360, step: 1 },
    { key: 'gradient_transition', label: 'Transition Feel', type: 'text' },
  ],
  sidebar: [
    { key: 'blur', label: 'Blur Strength', type: 'number', min: 0, step: 1 },
    { key: 'opacity', label: 'Transparency', type: 'number', min: 0, max: 1, step: 0.01 },
    { key: 'bg_color_1', label: 'Main Background Color', type: 'color', fallback: '#2B2F7E' },
    { key: 'bg_color_2', label: 'Second Background Color', type: 'color', fallback: '#2B2F7E', allowNull: true },
    { key: 'text_color', label: 'Text Color', type: 'color', fallback: '#ffffff' },
    { key: 'button_color', label: 'Button Color', type: 'color', fallback: '#C0241A' },
    { key: 'button_text_color', label: 'Button Text Color', type: 'color', fallback: '#ffffff' },
    { key: 'gradient_type', label: 'Background Style', type: 'select', options: GRADIENT_OPTIONS },
  ],
  typography: [
    { key: 'font_family', label: 'Font Family', type: 'text' },
    { key: 'heading_color', label: 'Heading Text Color', type: 'color', fallback: '#1a1a2e' },
    { key: 'body_text_color', label: 'Body Text Color', type: 'color', fallback: '#374151' },
    { key: 'subheading_color', label: 'Subheading Color', type: 'color', fallback: '#2B2F7E' },
    { key: 'component_overrides.footer_text', label: 'Footer Text Color', type: 'color', fallback: '#ffffff' },
    { key: 'component_overrides.navbar_text', label: 'Navbar Text Color', type: 'color', fallback: '#ffffff' },
    { key: 'component_overrides.marquee_text', label: 'Marquee Text Color', type: 'color', fallback: '#ffffff' },
    { key: 'component_overrides.sidebar_text', label: 'Sidebar Text Color', type: 'color', fallback: '#ffffff' },
  ],
  app_buttons: [
    { key: 'bg_color_1', label: 'Main Background Color', type: 'color', fallback: '#C0241A' },
    { key: 'bg_color_2', label: 'Second Background Color', type: 'color', fallback: '#C0241A', allowNull: true },
    { key: 'text_color', label: 'Text Color', type: 'color', fallback: '#ffffff' },
    { key: 'icon_color', label: 'Icon Color', type: 'color', fallback: '#ffffff' },
    { key: 'gradient_type', label: 'Background Style', type: 'select', options: GRADIENT_OPTIONS },
  ],
  advertisement: [
    { key: 'bg_color', label: 'Background Color', type: 'color', fallback: '#FDECEA' },
    { key: 'bg_opacity', label: 'Background Transparency', type: 'number', min: 0, max: 1, step: 0.01 },
    { key: 'text_color', label: 'Text Color', type: 'color', fallback: '#C0241A' },
  ],
  quick_actions: [
    { key: 'bg_color_1', label: 'Main Background Color', type: 'color', fallback: '#2B2F7E' },
    { key: 'bg_color_2', label: 'Second Background Color', type: 'color', fallback: '#2B2F7E', allowNull: true },
    { key: 'text_color', label: 'Text Color', type: 'color', fallback: '#ffffff' },
    { key: 'icon_bg_color', label: 'Icon Background Color', type: 'color', fallback: '#ffffff' },
    { key: 'gradient_type', label: 'Background Style', type: 'select', options: GRADIENT_OPTIONS },
  ],
};
const THEME_SECTION_ORDER = [
  { key: 'footer', label: 'Footer' },
  { key: 'navbar', label: 'Navbar' },
  { key: 'marquee', label: 'Marquee' },
  { key: 'page_bg', label: 'Page Background' },
  { key: 'sidebar', label: 'Sidebar' },
  { key: 'typography', label: 'Typography' },
  { key: 'app_buttons', label: 'App Buttons' },
  { key: 'advertisement', label: 'Advertisement' },
  { key: 'quick_actions', label: 'Quick Actions' },
];
const THEME_SECTION_HELP = {
  footer: 'Colors for the bottom area of the app.',
  navbar: 'Controls the top bar look and readability.',
  marquee: 'Style for the running announcement strip.',
  page_bg: 'Overall page background appearance.',
  sidebar: 'Color theme for the left menu panel.',
  typography: 'Control for heading and text colors.',
  app_buttons: 'Common style for buttons and icons.',
  advertisement: 'Background and text for ad/notice boxes.',
  quick_actions: 'Appearance of quick action cards.',
};
const ANIMATION_OPTIONS = {
  cards: ['fadeUp', 'fadeIn', 'slideUp', 'zoomIn', 'none'],
  navbar: ['fadeSlideDown', 'fadeIn', 'slideDown', 'none'],
  gallery: ['zoomIn', 'fadeIn', 'slideUp', 'none'],
};
const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const HOME_LAYOUT_OPTIONS = [
  { key: 'gallery', label: 'Gallery' },
  { key: 'quickActions', label: 'Quick Actions' },
  { key: 'sponsors', label: 'Sponsors' },
  { key: 'marquee', label: 'Marquee' },
  { key: 'trustList', label: 'Trust List' },
];
const normalizePickerColor = (value, fallback) => (HEX_COLOR_RE.test(String(value || '').trim()) ? String(value).trim() : fallback);
const safeText = (value, fallback = '') => (typeof value === 'string' ? value : fallback);
const createLayoutOrderMap = (layout = []) => {
  const parsedLayout = Array.isArray(layout) ? layout : [];
  const nextMap = {};
  HOME_LAYOUT_OPTIONS.forEach((item) => {
    const index = parsedLayout.findIndex((entry) => String(entry || '').trim() === item.key);
    nextMap[item.key] = index >= 0 ? index + 1 : '';
  });
  return nextMap;
};
const previewBg = (theme) => {
  const config = theme?.theme_config && typeof theme.theme_config === 'object' ? theme.theme_config : {};
  const colorA = safeText(config?.app_buttons?.bg_color_1, '') || safeText(theme?.primary_color, '') || '#C0241A';
  const colorB = safeText(config?.quick_actions?.bg_color_1, '') || safeText(theme?.secondary_color, '') || '#2B2F7E';
  return `linear-gradient(135deg, ${colorA} 0%, ${colorB} 100%)`;
};

const getNestedValue = (obj, keyPath) =>
  String(keyPath)
    .split('.')
    .reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), obj);

const setNestedValue = (obj, keyPath, value) => {
  const parts = String(keyPath).split('.');
  const nextObj = { ...(obj && typeof obj === 'object' ? obj : {}) };
  let cursor = nextObj;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    cursor[part] = cursor[part] && typeof cursor[part] === 'object' ? { ...cursor[part] } : {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
  return nextObj;
};

const buildThemeConfigForm = (source = {}) => {
  const sourceConfig = source && typeof source === 'object' ? source : {};
  const nextConfig = {};

  THEME_SECTION_ORDER.forEach(({ key }) => {
    const defaults = DEFAULT_THEME_SECTION_CONFIG[key] || {};
    const sourceSection = sourceConfig[key] && typeof sourceConfig[key] === 'object' ? sourceConfig[key] : {};
    nextConfig[key] = { ...defaults, ...sourceSection };
    if (defaults.component_overrides && typeof defaults.component_overrides === 'object') {
      nextConfig[key].component_overrides = {
        ...defaults.component_overrides,
        ...(sourceSection.component_overrides && typeof sourceSection.component_overrides === 'object' ? sourceSection.component_overrides : {}),
      };
    }
  });

  return nextConfig;
};

const buildLegacyColorFields = (themeConfig) => {
  const config = buildThemeConfigForm(themeConfig);
  const pageBg = config.page_bg || {};
  const gradientType = safeText(pageBg.gradient_type, 'linear') || 'linear';
  const angle = Number(pageBg.gradient_angle);
  const gradientAngle = Number.isFinite(angle) ? angle : 160;
  const bgOne = safeText(pageBg.bg_color_1, '#f6f8fc') || '#f6f8fc';
  const bgTwo = safeText(pageBg.bg_color_2, '#eef2ff') || '#eef2ff';
  const fallbackPageBg = gradientType === 'none' ? bgOne : `${gradientType}-gradient(${gradientAngle}deg, ${bgOne} 0%, ${bgTwo} 100%)`;

  return {
    primary_color: safeText(config?.app_buttons?.bg_color_1, '#4a42e8') || '#4a42e8',
    secondary_color: safeText(config?.sidebar?.bg_color_1, '#111827') || '#111827',
    accent_color: safeText(config?.advertisement?.text_color, '#4a42e8') || '#4a42e8',
    accent_bg: safeText(config?.advertisement?.bg_color, '#eef2ff') || '#eef2ff',
    navbar_bg: safeText(config?.navbar?.bg_color_1, '#ffffff') || '#ffffff',
    page_bg: fallbackPageBg,
  };
};

export default function ThemePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'dashboard';
  const trustId = trust?.id || null;
  const [currentTrust, setCurrentTrust] = useState(trust);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [assigningId, setAssigningId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [themeConfigForm, setThemeConfigForm] = useState(buildThemeConfigForm(DEFAULT_THEME_SECTION_CONFIG));
  const [animationConfig, setAnimationConfig] = useState(DEFAULT_ANIMATIONS);
  const [homeLayoutOrder, setHomeLayoutOrder] = useState(createLayoutOrderMap(DEFAULT_NEW_HOME_LAYOUT));

  useEffect(() => {
    if (!trustId) navigate('/dashboard', { replace: true, state: { userName, trust } });
  }, [trustId, userName, trust, navigate]);

  useEffect(() => {
    const load = async () => {
      if (!trustId) return;
      setLoading(true);
      setError('');
      const [{ data: templateData, error: templateErr }, { data: trustData, error: trustErr }] = await Promise.all([
        fetchTemplates(),
        fetchTrustDetails(trustId),
      ]);
      if (templateErr) setError(templateErr.message || 'Unable to load templates.');
      if (trustErr) setError(trustErr.message || 'Unable to load trust theme.');
      setTemplates(templateData || []);
      setCurrentTrust(trustData || trust);
      setLoading(false);
    };
    load();
  }, [trustId, trust]);



  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return templates;
    return templates.filter((item) =>
      [item.name, item.description, item.template_key].some((v) => String(v || '').toLowerCase().includes(term))
    );
  }, [templates, searchTerm]);

  const myTemplates = useMemo(
    () => filtered.filter((item) => String(item.trust_id || '') === String(trustId || '')),
    [filtered, trustId]
  );
  const otherTemplates = useMemo(
    () => filtered.filter((item) => String(item.trust_id || '') !== String(trustId || '')),
    [filtered, trustId]
  );
  const activeTemplateId = currentTrust?.template_id || null;
  const selectedTemplate = useMemo(() => templates.find((item) => item.id === selectedId) || null, [templates, selectedId]);
  const detailTemplate = useMemo(() => templates.find((item) => item.id === detailId) || null, [templates, detailId]);
  const canEdit = (item) => String(item?.trust_id || '') === String(trustId || '');
  useEffect(() => {
    if (!selectedTemplate) {
      setForm(EMPTY_FORM);
      setThemeConfigForm(buildThemeConfigForm(DEFAULT_THEME_SECTION_CONFIG));
      setAnimationConfig(DEFAULT_ANIMATIONS);
      setHomeLayoutOrder(createLayoutOrderMap(DEFAULT_NEW_HOME_LAYOUT));
      return;
    }
    const nextHomeLayout = Array.isArray(selectedTemplate.home_layout)
      ? selectedTemplate.home_layout
      : DEFAULT_NEW_HOME_LAYOUT;
    setForm({
      name: selectedTemplate.name || '',
      description: selectedTemplate.description || '',
      template_key: selectedTemplate.template_key || 'mahila',
      home_layout: pretty(nextHomeLayout, DEFAULT_NEW_HOME_LAYOUT),
      custom_css: selectedTemplate.custom_css || '',
      is_active: selectedTemplate.is_active !== false,
    });
    setThemeConfigForm(buildThemeConfigForm(selectedTemplate.theme_config));
    setAnimationConfig({
      cards: safeText(selectedTemplate?.animations?.cards, DEFAULT_ANIMATIONS.cards) || DEFAULT_ANIMATIONS.cards,
      navbar: safeText(selectedTemplate?.animations?.navbar, DEFAULT_ANIMATIONS.navbar) || DEFAULT_ANIMATIONS.navbar,
      gallery: safeText(selectedTemplate?.animations?.gallery, DEFAULT_ANIMATIONS.gallery) || DEFAULT_ANIMATIONS.gallery,
    });
    setHomeLayoutOrder(createLayoutOrderMap(nextHomeLayout));
  }, [selectedTemplate]);

  const openCreate = () => {
    setSelectedId(null);
    setForm(EMPTY_FORM);
    setThemeConfigForm(buildThemeConfigForm(DEFAULT_THEME_SECTION_CONFIG));
    setAnimationConfig(DEFAULT_ANIMATIONS);
    setHomeLayoutOrder(createLayoutOrderMap(DEFAULT_NEW_HOME_LAYOUT));
    setSaveError('');
    setShowForm(true);
    setShowPicker(false);
  };

  const openEdit = (id) => {
    setSelectedId(id);
    setSaveError('');
    setShowForm(true);
    setShowPicker(false);
    setShowDetail(false);
  };

  const openDetail = (id) => {
    setDetailId(id);
    setShowDetail(true);
  };

  const handleAssign = async (template) => {
    if (!template?.id || !trustId) return;
    setSaveError('');
    setAssigningId(template.id);
    const { data, error: assignErr } = await assignTemplateToTrust(trustId, template.id);
    if (assignErr) {
      setSaveError(assignErr.message || 'Unable to apply template.');
    } else {
      setCurrentTrust((prev) => ({ ...(prev || {}), ...(data || {}), template_id: template.id }));
      setShowPicker(false);
      setShowDetail(false);
    }
    setAssigningId(null);
  };



  const handleSave = async () => {
    setSaveError('');
    if (!form.name.trim()) {
      setSaveError('Theme name is required.');
      return;
    }
    let homeLayout;
    homeLayout = HOME_LAYOUT_OPTIONS
      .map((item) => ({
        key: item.key,
        order: Number(homeLayoutOrder[item.key]) || 0,
      }))
      .filter((item) => item.order > 0)
      .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
      .map((item) => item.key);
    if (!homeLayout.length) {
      setSaveError('Home layout mein kam se kam ek section order dena zaroori hai.');
      return;
    }
    const animations = {
      cards: animationConfig.cards || DEFAULT_ANIMATIONS.cards,
      navbar: animationConfig.navbar || DEFAULT_ANIMATIONS.navbar,
      gallery: animationConfig.gallery || DEFAULT_ANIMATIONS.gallery,
    };
    const normalizedThemeConfig = buildThemeConfigForm(themeConfigForm);
    const legacyThemeColors = buildLegacyColorFields(normalizedThemeConfig);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      template_key: form.template_key.trim() || 'mahila',
      ...legacyThemeColors,
      theme_config: normalizedThemeConfig,
      home_layout: homeLayout,
      animations,
      custom_css: form.custom_css || '',
      is_active: !!form.is_active,
      trust_id: trustId,
    };

    setSaving(true);
    if (selectedId) {
      if (!canEdit(selectedTemplate)) {
        setSaveError('You can only edit themes linked to your trust.');
        setSaving(false);
        return;
      }
      const { data, error: updateErr } = await updateTemplate(selectedId, payload);
      if (updateErr) setSaveError(updateErr.message || 'Unable to update theme.');
      else if (data) {
        setTemplates((prev) => prev.map((item) => item.id === selectedId ? data : item));
        setShowForm(false);
      }
    } else {
      const { data, error: createErr } = await createTemplate(payload);
      if (createErr) setSaveError(createErr.message || 'Unable to create theme.');
      else if (data) {
        setTemplates((prev) => [data, ...prev]);
        setSelectedId(data.id);
        setShowForm(false);
        setShowPicker(true);
      }
    }
    setSaving(false);
  };

  const updateThemeConfigField = (sectionKey, fieldKey, value) => {
    setThemeConfigForm((prev) => {
      const nextSection = setNestedValue(prev[sectionKey] || {}, fieldKey, value);
      return { ...prev, [sectionKey]: nextSection };
    });
  };

  const renderThemeField = (sectionKey, field) => {
    const sectionValue = themeConfigForm[sectionKey] || {};
    const currentValue = getNestedValue(sectionValue, field.key);
    const fieldId = `theme-config-${sectionKey}-${field.key.replaceAll('.', '-')}`;

    if (field.type === 'color') {
      const fallback = field.fallback || '#000000';
      const displayValue = currentValue ?? '';
      return (
        <label className="theme-field theme-color-field" key={fieldId}>
          <span>{field.label}</span>
          <div className="theme-color-input-shell">
            <input
              className="theme-color-text"
              value={displayValue}
              placeholder={field.allowNull ? 'null' : fallback}
              onChange={(e) => updateThemeConfigField(sectionKey, field.key, e.target.value || (field.allowNull ? null : fallback))}
            />
            <input
              className="theme-color-native"
              id={fieldId}
              type="color"
              aria-label={`${field.label} picker`}
              value={normalizePickerColor(displayValue, fallback)}
              onChange={(e) => updateThemeConfigField(sectionKey, field.key, e.target.value)}
            />
          </div>
        </label>
      );
    }

    if (field.type === 'select') {
      return (
        <label className="theme-field" key={fieldId}>
          <span>{field.label}</span>
          <select
            value={currentValue ?? ''}
            onChange={(e) => updateThemeConfigField(sectionKey, field.key, e.target.value)}
          >
            {(field.options || []).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      );
    }

    if (field.type === 'number') {
      return (
        <label className="theme-field" key={fieldId}>
          <span>{field.label}</span>
          <input
            type="number"
            min={field.min}
            max={field.max}
            step={field.step || 1}
            value={currentValue ?? ''}
            onChange={(e) => updateThemeConfigField(sectionKey, field.key, e.target.value === '' ? null : Number(e.target.value))}
          />
        </label>
      );
    }

    return (
      <label className="theme-field" key={fieldId}>
        <span>{field.label}</span>
        <input
          value={currentValue ?? ''}
          onChange={(e) => updateThemeConfigField(sectionKey, field.key, e.target.value)}
        />
      </label>
    );
  };

  const renderSectionPreview = (sectionKey) => {
    const section = themeConfigForm?.[sectionKey] || {};
    const backgroundA = safeText(section.bg_color_1, '') || safeText(section.bg_color, '') || '#ffffff';
    const backgroundB = safeText(section.bg_color_2, '') || backgroundA;
    const textColor = safeText(section.text_color, '') || '#111827';
    const gradientType = safeText(section.gradient_type, 'none') || 'none';
    const gradientAngle = Number(section.gradient_angle);
    const angle = Number.isFinite(gradientAngle) ? gradientAngle : 135;
    const previewBackground = gradientType !== 'none'
      ? `${gradientType}-gradient(${angle}deg, ${backgroundA} 0%, ${backgroundB} 100%)`
      : backgroundA;
    const iconBg = safeText(section.icon_bg_color, '#e5e7eb') || '#e5e7eb';

    if (sectionKey === 'typography') {
      const headingColor = safeText(section.heading_color, '#1a1a2e') || '#1a1a2e';
      const bodyColor = safeText(section.body_text_color, '#374151') || '#374151';
      const subColor = safeText(section.subheading_color, '#2B2F7E') || '#2B2F7E';
      const fontFamily = safeText(section.font_family, 'Inter') || 'Inter';
      return (
        <div className="theme-config-preview typography">
          <div style={{ fontFamily, color: headingColor, fontWeight: 800 }}>Heading Preview</div>
          <div style={{ fontFamily, color: subColor, fontSize: '12px', fontWeight: 700 }}>Subheading Preview</div>
          <div style={{ fontFamily, color: bodyColor, fontSize: '12px' }}>This is normal body text preview.</div>
        </div>
      );
    }

    if (sectionKey === 'navbar') {
      return (
        <div className="theme-config-preview theme-config-preview-app">
          <div className="theme-config-preview-navbar" style={{ background: previewBackground, color: textColor }}>
            <span>☰</span>
            <strong>Home</strong>
            <span>🔔</span>
          </div>
          <div className="theme-config-preview-body">Navbar top area preview</div>
        </div>
      );
    }

    if (sectionKey === 'footer') {
      return (
        <div className="theme-config-preview theme-config-preview-app">
          <div className="theme-config-preview-body">Page Content</div>
          <div className="theme-config-preview-footer" style={{ background: previewBackground, color: textColor }}>
            <span>Home</span>
            <span>Profile</span>
            <span>More</span>
          </div>
        </div>
      );
    }

    if (sectionKey === 'sidebar') {
      const buttonColor = safeText(section.button_color, '#C0241A') || '#C0241A';
      const buttonText = safeText(section.button_text_color, '#ffffff') || '#ffffff';
      return (
        <div className="theme-config-preview theme-config-preview-sidebar" style={{ background: previewBackground, color: textColor }}>
          <div className="theme-config-preview-side-item">Dashboard</div>
          <div className="theme-config-preview-side-item">Members</div>
          <button type="button" className="theme-config-preview-btn" style={{ background: buttonColor, color: buttonText }}>
            Action Button
          </button>
        </div>
      );
    }

    if (sectionKey === 'marquee') {
      return (
        <div className="theme-config-preview theme-config-preview-app">
          <div className="theme-config-preview-marquee" style={{ background: previewBackground, color: textColor }}>
            Emergency services available | New updates
          </div>
        </div>
      );
    }

    if (sectionKey === 'page_bg') {
      return (
        <div className="theme-config-preview theme-config-preview-pagebg" style={{ background: previewBackground }}>
          <div className="theme-config-preview-phone-card" />
          <div className="theme-config-preview-phone-card short" />
        </div>
      );
    }

    if (sectionKey === 'app_buttons') {
      return (
        <div className="theme-config-preview">
          <button type="button" className="theme-config-preview-btn" style={{ background: previewBackground, color: textColor }}>
            Primary Button
          </button>
          <button type="button" className="theme-config-preview-btn" style={{ background: previewBackground, color: textColor }}>
            Secondary Button
          </button>
        </div>
      );
    }

    if (sectionKey === 'quick_actions') {
      return (
        <div className="theme-config-preview theme-config-preview-quick-actions">
          <div className="theme-config-preview-action-card" style={{ background: previewBackground, color: textColor }}>
            <span className="theme-config-preview-action-icon" style={{ background: iconBg }} />
            <strong>Directory</strong>
          </div>
          <div className="theme-config-preview-action-card" style={{ background: previewBackground, color: textColor }}>
            <span className="theme-config-preview-action-icon" style={{ background: iconBg }} />
            <strong>Reports</strong>
          </div>
        </div>
      );
    }

    if (sectionKey === 'advertisement') {
      return (
        <div className="theme-config-preview" style={{ background: previewBackground, color: textColor }}>
          <div style={{ fontWeight: 800 }}>Special Offer / Notice</div>
          <div style={{ fontSize: '12px', opacity: 0.9 }}>Short message preview</div>
        </div>
      );
    }

    return (
      <div className="theme-config-preview" style={{ background: previewBackground, color: textColor }}>
        <div className="theme-config-preview-line" />
        <div className="theme-config-preview-line short" />
        <div style={{ fontSize: '12px', fontWeight: 700 }}>Sample Text</div>
      </div>
    );
  };

  const renderHomeLayoutField = () => (
    <div className="theme-field theme-span-2" key="home_layout_order">
      <span>Home Layout Order</span>
      <div className="theme-layout-order-card">
        <div className="theme-layout-order-list">
          {HOME_LAYOUT_OPTIONS.map((item) => (
            <label className="theme-layout-order-row" key={item.key}>
              <div className="theme-layout-order-copy">
                <strong>{item.label}</strong>
                <small>{item.key}</small>
              </div>
              <input
                type="number"
                min="0"
                placeholder="-"
                value={homeLayoutOrder[item.key]}
                onChange={(e) => {
                  const rawValue = e.target.value;
                  setHomeLayoutOrder((prev) => ({ ...prev, [item.key]: rawValue === '' ? '' : Math.max(0, Number(rawValue) || 0) }));
                }}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAnimationsField = () => (
    <div className="theme-field theme-span-2" key="animations_ui">
      <span>Animation Settings</span>
      <div className="theme-layout-order-card">
        <div className="theme-layout-order-list">
          {[
            { key: 'cards', label: 'Cards Animation' },
            { key: 'navbar', label: 'Navbar Animation' },
            { key: 'gallery', label: 'Gallery Animation' },
          ].map((item) => (
            <label className="theme-layout-order-row" key={item.key}>
              <div className="theme-layout-order-copy">
                <strong>{item.label}</strong>
                <small>{item.key}</small>
              </div>
              <select
                value={animationConfig[item.key] || DEFAULT_ANIMATIONS[item.key]}
                onChange={(e) =>
                  setAnimationConfig((prev) => ({
                    ...prev,
                    [item.key]: e.target.value,
                  }))
                }
              >
                {(ANIMATION_OPTIONS[item.key] || []).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    const generatedLayout = HOME_LAYOUT_OPTIONS
      .map((item) => ({
        key: item.key,
        order: Number(homeLayoutOrder[item.key]) || 0,
      }))
      .filter((item) => item.order > 0)
      .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
      .map((item) => item.key);
    setForm((prev) => {
      const nextHomeLayout = pretty(generatedLayout, []);
      if (prev.home_layout === nextHomeLayout) return prev;
      return { ...prev, home_layout: nextHomeLayout };
    });
  }, [homeLayoutOrder]);

  if (!trustId) return null;

  return (
    <div className="theme-root">
      <Sidebar
        trustName={currentTrust?.name || trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust: currentTrust || trust, sidebarNavKey: currentSidebarNavKey } })}
        onLogout={() => navigate('/login')}
      />
      <main className="theme-main">
        <PageHeader
          title="Theme"
          subtitle="Manage templates and trust theme selection"
          onBack={() => navigate('/dashboard', { state: { userName, trust: currentTrust || trust, sidebarNavKey: currentSidebarNavKey } })}
          right={<button className="theme-add-btn" onClick={() => setShowPicker(true)}>Select Theme</button>}
        />

        {error && <div className="theme-error">{error}</div>}
        {saveError && <div className="theme-error">{saveError}</div>}

        <div className={`theme-content ${showForm ? 'form-only' : ''}`}>
          {!showForm && (
            <>
          <section className="theme-hero">
            <div className="theme-hero-copy">
              <span className="theme-kicker">Theme manager</span>
              <h2>Create templates and assign a live theme to this trust.</h2>
              <p>
                This module follows the sponsor flow: list, pick, inspect, create, edit, and apply.
                Use it to manage `app_templates` and connect one to {currentTrust?.name || trust?.name || 'your trust'}.
              </p>
            </div>
            <div className="theme-hero-stats">
              <div className="theme-stat-card"><span>Templates</span><strong>{templates.length}</strong></div>
              <div className="theme-stat-card"><span>Active template</span><strong>{activeTemplateId ? 'Assigned' : 'None'}</strong></div>

            </div>
          </section>

          <section className="theme-list">
            {loading && <div className="theme-loading">Loading themes...</div>}
            {!loading && templates.filter((item) => item.is_active !== false).length === 0 && (
              <div className="theme-empty">
                <div className="theme-empty-icon">T</div>
                <h3>No themes yet</h3>
                <p>Create your first theme template to get started.</p>
                <button className="theme-add-btn" onClick={openCreate}>Create Theme</button>
              </div>
            )}
            {!loading && templates.filter((item) => item.is_active !== false).map((theme) => (
              <div key={theme.id} className={`theme-card ${activeTemplateId === theme.id ? 'active' : ''} ${canEdit(theme) ? 'my' : 'other'}`} onClick={() => openDetail(theme.id)}>
                <div className="theme-card-preview" style={{ background: previewBg(theme) }}>
                  <div className="theme-preview-glass">
                    <div className="theme-preview-dot-row"><span /><span /><span /></div>
                    <div className="theme-preview-strip" />
                    <div className="theme-preview-strip short" />
                  </div>
                </div>
                <div className="theme-card-body">
                  <div className="theme-card-title-row">
                    <div className="theme-card-title">{theme.name}</div>
                    <span className={`theme-card-badge ${canEdit(theme) ? 'my' : 'other'}`}>{canEdit(theme) ? 'My' : 'Other'}</span>
                  </div>
                  <div className="theme-card-sub">{theme.template_key || 'template'}</div>
                  {theme.description && <div className="theme-card-tag">{theme.description}</div>}
                </div>
                <div className="theme-card-actions">
                  <button className={`theme-status-btn ${activeTemplateId === theme.id ? 'active' : 'inactive'}`} type="button" onClick={(e) => { e.stopPropagation(); handleAssign(theme); }}>
                    {assigningId === theme.id ? 'Applying...' : activeTemplateId === theme.id ? 'Applied' : 'Apply'}
                  </button>
                  {canEdit(theme) && <button className="theme-icon-btn" type="button" onClick={(e) => { e.stopPropagation(); openEdit(theme.id); }}>Edit</button>}
                </div>
              </div>
            ))}
          </section>
            </>
          )}

          {showForm && (
            <section className="theme-form">
              <div className="theme-form-card">
                <div className="theme-form-title">{selectedId ? 'Edit Theme' : 'Create Theme'}</div>
                <div className="theme-grid">
                  <label className="theme-field"><span>Name *</span><input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></label>
                  <label className="theme-field"><span>Template Key</span><input value={form.template_key} onChange={(e) => setForm((p) => ({ ...p, template_key: e.target.value }))} /></label>
                  <label className="theme-field theme-span-2"><span>Description</span><textarea rows="3" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></label>
                  <div className="theme-field theme-span-2">
                    <span>Colors</span>
                  </div>
                  <div className="theme-span-2 theme-config-groups">
                    {THEME_SECTION_ORDER.map((section) => (
                      <div className="theme-config-group" key={section.key}>
                        <div className="theme-config-group-head-row">
                          <div>
                            <div className="theme-config-group-head">{section.label}</div>
                            <div className="theme-config-group-help">{THEME_SECTION_HELP[section.key] || ''}</div>
                          </div>
                          {renderSectionPreview(section.key)}
                        </div>
                        <div className="theme-config-group-grid">
                          {(THEME_SECTION_FIELDS[section.key] || []).map((field) => renderThemeField(section.key, field))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {renderHomeLayoutField()}
                  {renderAnimationsField()}
                  <label className="theme-field theme-span-2"><span>Custom CSS</span><textarea rows="5" value={form.custom_css} onChange={(e) => setForm((p) => ({ ...p, custom_css: e.target.value }))} /></label>
                  <label className="theme-check"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} /><span>Template is active</span></label>
                </div>
                <div className="theme-form-actions">
                  <button className="theme-secondary-btn" type="button" onClick={() => { setShowForm(false); setSelectedId(null); setSaveError(''); }}>Close</button>
                  <button className="theme-primary-btn" type="button" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Theme'}</button>
                </div>
              </div>
            </section>
          )}

          {showPicker && (
            <div className="theme-modal-overlay" onClick={() => setShowPicker(false)}>
              <div className="theme-modal" onClick={(e) => e.stopPropagation()}>
                <div className="theme-modal-head">
                  <div><h3>Select Theme</h3><p>Search by name, description, or template key.</p></div>
                  <button className="theme-modal-close" onClick={() => setShowPicker(false)} type="button">x</button>
                </div>
                <div className="theme-modal-search">
                  <input placeholder="Search themes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  <button className="theme-add-btn" onClick={openCreate} type="button">Create Theme</button>
                </div>
                <div className="theme-modal-list">
                  {myTemplates.length > 0 && <div className="theme-modal-section my"><div className="theme-modal-section-title">My Themes</div>{myTemplates.map((item) => (
                    <div key={item.id} className="theme-modal-item" onClick={() => openDetail(item.id)}>
                      <div><div className="theme-modal-title-row"><div className="theme-modal-title">{item.name}</div><span className="theme-modal-badge my">My</span></div><div className="theme-modal-sub">{item.template_key || 'template'}</div><div className="theme-modal-sub">{item.description || 'No description'}</div></div>
                      <div className="theme-modal-actions"><button className="theme-icon-btn" type="button" onClick={(e) => { e.stopPropagation(); handleAssign(item); }}>{activeTemplateId === item.id ? 'Applied' : 'Apply'}</button><button className="theme-icon-btn" type="button" onClick={(e) => { e.stopPropagation(); openEdit(item.id); }}>Edit</button></div>
                    </div>
                  ))}</div>}
                  {otherTemplates.length > 0 && <div className="theme-modal-section other"><div className="theme-modal-section-title">Other Themes</div>{otherTemplates.map((item) => (
                    <div key={item.id} className="theme-modal-item" onClick={() => openDetail(item.id)}>
                      <div><div className="theme-modal-title-row"><div className="theme-modal-title">{item.name}</div><span className="theme-modal-badge other">Other</span></div><div className="theme-modal-sub">{item.template_key || 'template'}</div><div className="theme-modal-sub">{item.description || 'No description'}</div></div>
                      <div className="theme-modal-actions"><button className="theme-icon-btn" type="button" onClick={(e) => { e.stopPropagation(); handleAssign(item); }}>{activeTemplateId === item.id ? 'Applied' : 'Apply'}</button></div>
                    </div>
                  ))}</div>}
                  {filtered.length === 0 && <div className="theme-modal-empty">No themes found.</div>}
                </div>
              </div>
            </div>
          )}

          {showDetail && detailTemplate && (
            <div className="theme-modal-overlay" onClick={() => setShowDetail(false)}>
              <div className="theme-modal theme-detail-modal" onClick={(e) => e.stopPropagation()}>
                <div className="theme-modal-head">
                  <div><h3>{detailTemplate.name}</h3><p>{detailTemplate.description || detailTemplate.template_key || 'Theme template'}</p></div>
                  <button className="theme-modal-close" onClick={() => setShowDetail(false)} type="button">x</button>
                </div>
                <div className="theme-detail-preview" style={{ background: previewBg(detailTemplate) }}>
                  <div className="theme-detail-chip-row"><span /><span /><span /></div>
                  <div className="theme-detail-panel" />
                  <div className="theme-detail-grid"><div /><div /><div /></div>
                </div>
                <div className="theme-detail-info">
                  <div><strong>Template key:</strong> {detailTemplate.template_key || '-'}</div>
                  <div><strong>Assigned:</strong> {activeTemplateId === detailTemplate.id ? 'Yes' : 'No'}</div>
                </div>
                <div className="theme-detail-actions">
                  <button className="theme-icon-btn" type="button" onClick={() => handleAssign(detailTemplate)}>{activeTemplateId === detailTemplate.id ? 'Applied' : 'Apply Theme'}</button>
                  {canEdit(detailTemplate) && <button className="theme-icon-btn" type="button" onClick={() => openEdit(detailTemplate.id)}>Edit Theme</button>}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
