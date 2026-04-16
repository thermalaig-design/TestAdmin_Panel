import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Dashboard.css';

// ── Export reusable icon renderer component ───────────────────────────────────
export function FeatureIconRenderer({ icon_url, size = 26, className = '' }) {
  const rawIcon = icon_url?.trim() || '';
  const decodedIcon = rawIcon
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

  // 1. emoji or short text stored in icon_url (≤ 4 chars = emoji)
  if (decodedIcon && decodedIcon.length <= 4 && !decodedIcon.startsWith('http') && !decodedIcon.startsWith('/') && !decodedIcon.startsWith('data:')) {
    return (
      <span style={{ fontSize: size, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {decodedIcon}
      </span>
    );
  }

  // 2. Raw SVG markup stored in DB
  if (decodedIcon && decodedIcon.includes('<svg')) {
    // Ensure SVG has white fill and stroke for visibility
    const enhancedSvg = decodedIcon
      .replace(/<svg([^>]*)>/i, `<svg$1 width="${size}" height="${size}" fill="white" stroke="white">`)
      .replace(/stroke="[^"]*"/g, 'stroke="white"')
      .replace(/fill="[^"]*"/g, 'fill="white"');

    return (
      <span
        className={`qp-icon-svg ${className}`}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: enhancedSvg }}
      />
    );
  }

  // 3. Full URL / data URL — render as image
  if (
    decodedIcon &&
    (
      decodedIcon.startsWith('http') ||
      decodedIcon.startsWith('/') ||
      decodedIcon.startsWith('data:image') ||
      decodedIcon.startsWith('blob:')
    )
  ) {
    return (
      <img
        src={decodedIcon}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: 5, objectFit: 'cover' }}
        onError={e => { e.target.style.display = 'none'; }}
      />
    );
  }

  return null;
}

// ── Module cards ──────────────────────────────────────────────────────────────
const MODULE_CARDS = [
  {
    id: 'card-trust',
    label: 'Trust',
    description: 'Manage trustees & trust details',
    route: '/trustees',
    gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    icon: (
      <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
        <path d="M16 2L29 9V23L16 30L3 23V9L16 2Z" fill="rgba(255,255,255,0.25)" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
        <path d="M16 9L13 17H19L16 23" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'card-sponsor',
    label: 'Sponsor',
    description: 'Manage sponsors & partnerships',
    route: '/sponsor',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" fill="rgba(255,255,255,0.2)"/>
      </svg>
    ),
  },
  {
    id: 'card-members',
    label: 'Members',
    description: 'Manage trust members & registrations',
    route: '/members',
    temporarilyDeactivated: true,
    deactivationText: 'Temporarily Deactivated',
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="8" r="3.2" stroke="white" strokeWidth="1.8" fill="rgba(255,255,255,0.16)"/>
        <path d="M4 18c0-2.8 2.46-5 5.5-5S15 15.2 15 18" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="17.5" cy="9" r="2.2" stroke="white" strokeWidth="1.8"/>
        <path d="M15.5 17.2c.55-1.62 1.96-2.7 4-2.7" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'card-gallery',
    label: 'Gallery',
    description: 'Upload & manage photo albums',
    route: '/gallery',
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="white" strokeWidth="1.8" fill="rgba(255,255,255,0.15)"/>
        <circle cx="8.5" cy="8.5" r="1.8" fill="white"/>
        <polyline points="21 15 16 10 5 21" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'card-marquee',
    label: 'Marquee',
    description: 'Manage scrolling announcements',
    route: '/marquee',
    gradient: 'linear-gradient(135deg, #0891B2 0%, #6366F1 100%)',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="7" width="20" height="10" rx="2.5" stroke="white" strokeWidth="1.8" fill="rgba(255,255,255,0.15)"/>
        <line x1="6" y1="12" x2="18" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <polyline points="14 9 18 12 14 15" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'card-theme',
    label: 'Theme',
    description: 'Preview and manage visual themes',
    route: '/theme',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
        <path d="M12 3C7.03 3 3 7.03 3 12c0 4.46 3.24 8.16 7.5 8.87.67.12 1.25-.42 1.25-1.1v-1.46c0-.78.63-1.41 1.41-1.41h1.21c3.67 0 6.63-2.96 6.63-6.63C21 6.25 17 3 12 3Z" fill="rgba(255,255,255,0.18)" stroke="white" strokeWidth="1.8"/>
        <circle cx="8" cy="10" r="1.2" fill="white" />
        <circle cx="11.5" cy="7.5" r="1.2" fill="white" />
        <circle cx="15.5" cy="9" r="1.2" fill="white" />
      </svg>
    ),
  },
  {
    id: 'card-feature-control',
    label: 'Feature Control',
    description: 'Manage feature access & visibility',
    route: '/feature-control',
    gradient: 'linear-gradient(135deg, #2563EB 0%, #4F46E5 100%)',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="3" stroke="white" strokeWidth="1.8" fill="rgba(255,255,255,0.18)"/>
        <path d="M8 9h8M8 12h5M8 15h3" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="17.5" cy="15" r="2.2" stroke="white" strokeWidth="1.8"/>
      </svg>
    ),
  },
  {
    id: 'card-sub-feature-control',
    label: 'Sub Feature Control',
    description: 'Manage sub feature labels and visibility',
    route: '/sub-feature-control',
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #1D4ED8 100%)',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="3" stroke="white" strokeWidth="1.8" fill="rgba(255,255,255,0.18)"/>
        <path d="M8 9h8M8 12h8M8 15h5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="17.5" cy="15" r="1.6" fill="white"/>
      </svg>
    ),
  },
  {
    id: 'card-profile',
    label: 'Profile',
    description: 'View member profile details by member id',
    route: '/member-profile',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)',
    icon: (
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="3.3" stroke="white" strokeWidth="1.8" />
        <path d="M5 19c0-3.2 2.9-5.8 7-5.8s7 2.6 7 5.8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="16.3" y="14.5" width="5.2" height="5.2" rx="1.2" stroke="white" strokeWidth="1.6" />
      </svg>
    ),
  },
];

// ── Nav items ─────────────────────────────────────────────────────────────────
const navItems = [
  {
    id: 'nav-dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
      </svg>
    ),
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const initials = (name = '') =>
  name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'A';

const todayStr = new Date().toLocaleDateString('en-IN', {
  weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
});

// �� Feature card icon renderer ������������������������������������������������
// Priority: route-based SVG ? name-based SVG ? generic grid
function FeatureIcon({ flag }) {
  const { route } = flag;
  const label = (flag.display_name || flag.features?.name || '').toLowerCase().trim();

  // Route-based built-in SVGs
  const routeSVGs = {
    '/directory': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <ellipse cx="12" cy="5" rx="9" ry="3" stroke="white" strokeWidth="1.8" />
        <path d="M3 5c0 0 0 5 9 5s9-5 9-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M3 12c0 0 0 5 9 5s9-5 9-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="3" y1="5" x2="3" y2="19" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="21" y1="5" x2="21" y2="19" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    '/appointments': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="3" stroke="white" strokeWidth="1.8" />
        <line x1="3" y1="9" x2="21" y2="9" stroke="white" strokeWidth="1.8" />
        <line x1="8" y1="2" x2="8" y2="6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="16" y1="2" x2="16" y2="6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 14l2.5 2.5L16 12" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    '/referrals': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    '/gallery': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="white" strokeWidth="1.8" />
        <circle cx="8.5" cy="8.5" r="1.5" stroke="white" strokeWidth="1.8" />
        <polyline points="21 15 16 10 5 21" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    '/members': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="8" r="3" stroke="white" strokeWidth="1.8" />
        <path d="M4 19c0-2.76 2.24-5 5-5s5 2.24 5 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="17.5" cy="9" r="2.2" stroke="white" strokeWidth="1.8" />
        <path d="M15.5 18c.41-1.64 1.7-2.83 3.9-3" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    '/profiles': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="white" strokeWidth="1.8" />
        <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    '/messages': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    '/slots': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.8" />
        <polyline points="12 6 12 12 16 14" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    '/trustees': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="7" r="4" stroke="white" strokeWidth="1.8" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    '/noticeboard': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    '/reports': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <line x1="18" y1="20" x2="18" y2="10" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="12" y1="20" x2="12" y2="4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="6" y1="20" x2="6" y2="14" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  };

  if (route && routeSVGs[route]) return routeSVGs[route];

  // Name-based icons for cards without routes (static, not from DB)
  const nameSVGs = {
    'vip login': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2z" stroke="white" strokeWidth="1.8" />
        <path d="M7 10V8a5 5 0 0 1 10 0v2" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="15" r="1.5" fill="white" />
        <path d="M10 15h1v2h2v-2h1" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    'opd schedule': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="white" strokeWidth="1.8" />
        <line x1="3" y1="9" x2="21" y2="9" stroke="white" strokeWidth="1.8" />
        <line x1="9" y1="2" x2="9" y2="6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="15" y1="2" x2="15" y2="6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="9" cy="13" r="1.5" fill="white" />
        <circle cx="15" cy="13" r="1.5" fill="white" />
        <path d="M9 17l2.5 2.5L17 15" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    'appointment': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="white" strokeWidth="1.8" />
        <line x1="3" y1="9" x2="21" y2="9" stroke="white" strokeWidth="1.8" />
        <line x1="9" y1="2" x2="9" y2="6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="15" y1="2" x2="15" y2="6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 14l2.5 2.5L16 12" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    'medical reports': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <line x1="18" y1="20" x2="18" y2="10" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="12" y1="20" x2="12" y2="4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="6" y1="20" x2="6" y2="14" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="3" cy="3" r="0.5" fill="white" />
        <circle cx="21" cy="3" r="0.5" fill="white" />
        <path d="M3 20h18" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    'reports': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <line x1="18" y1="20" x2="18" y2="10" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="12" y1="20" x2="12" y2="4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="6" y1="20" x2="6" y2="14" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M3 20h18" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    'patient referral': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="2.5" fill="white" />
      </svg>
    ),
    'referral': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    'noticeboard': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="5" width="16" height="12" rx="1.5" stroke="white" strokeWidth="1.8" />
        <line x1="8" y1="9" x2="16" y2="9" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="8" y1="12" x2="14" y2="12" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="10" y1="17" x2="10" y2="20" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="14" y1="17" x2="14" y2="20" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    'directory': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <g stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          <line x1="18" y1="5" x2="22" y2="5" />
          <line x1="20" y1="3" x2="20" y2="7" />
        </g>
      </svg>
    ),
    'birthday wishes': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M9 4c0 1 1 2 1 3M15 4c0 1-1 2-1 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <rect x="4" y="9" width="16" height="10" rx="2" stroke="white" strokeWidth="1.8" />
        <path d="M4 12h16" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8" cy="15" r="1" fill="white" />
        <circle cx="12" cy="15" r="1" fill="white" />
        <circle cx="16" cy="15" r="1" fill="white" />
      </svg>
    ),
    'notifications': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="19" cy="5" r="3" fill="white" />
      </svg>
    ),
    'profile photo': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3.5" y="6" width="17" height="12" rx="2.5" stroke="white" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="2.5" stroke="white" strokeWidth="1.8" />
        <path d="M7 6l1.5-2h7L17 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    'my profile': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke="white" strokeWidth="1.8" />
        <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    'gallery': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="1.8" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="white" />
        <polyline points="21 15 16 10 5 21" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    'messages': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="12" r="1.5" fill="white" />
        <circle cx="15" cy="12" r="1.5" fill="white" />
      </svg>
    ),
  };

  if (label && nameSVGs[label]) return nameSVGs[label];

  // Generic fallback — grid icon
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.8" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.8" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.8" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="white" strokeWidth="1.8" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  // Data from SelectTrustPage navigation
  const { userName = 'Admin', trust = null } = location.state || {};
  const trustId = trust?.id || null;
  const trustName = trust?.name || 'No Trust Selected';

  const [collapsed, setCollapsed] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const userInitials = initials(userName);
  const pageTitle = 'Dashboard';
  const filteredModules = useMemo(() => {
    const query = String(searchTerm || '').trim().toLowerCase();
    if (!query) return MODULE_CARDS;

    return MODULE_CARDS.filter((card) => {
      const label = String(card.label || '').toLowerCase();
      const description = String(card.description || '').toLowerCase();
      return label.includes(query) || description.includes(query);
    });
  }, [searchTerm]);

  // If no trust is linked, redirect
  useEffect(() => {
    if (!trustId) {
      navigate('/select-trust', { state: location.state, replace: true });
    }
  }, [trustId, navigate, location.state]);

  if (!trustId) return null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={`dash-root ${collapsed ? 'sidebar-collapsed' : ''}`}>

      {/* ═══════════════════════════════════════════
          SIDEBAR
      ═══════════════════════════════════════════ */}
      <aside className="sidebar">

        {/* Brand / Trust */}
        <div className="sidebar-brand">
          <div className="brand-logo">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L29 9V23L16 30L3 23V9L16 2Z" fill="url(#lgGrad)" />
              <path d="M16 8L12 18H20L16 24" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="lgGrad" x1="3" y1="2" x2="29" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366F1" /><stop offset="1" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          {!collapsed && (
            <div className="brand-text">
              <span className="brand-name" title={trustName}>{trustName}</span>
              <span className="brand-sub">Admin Panel</span>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          className="collapse-btn"
          onClick={() => setCollapsed(p => !p)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            {collapsed
              ? <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              : <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            }
          </svg>
        </button>

        {!collapsed && <div className="sidebar-section-label">MAIN MENU</div>}

        {/* Nav */}
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              id={item.id}
              className="nav-item active"
              title={collapsed ? item.label : ''}
              onClick={() => {
                if (item.id === 'nav-dashboard') {
                  navigate('/dashboard', { state: { userName, trust } });
                }
              }}
            >
              <span className="nav-icon-wrap">{item.icon}</span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
              {!collapsed && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="sidebar-bottom">
          <button
            id="logout-btn"
            className="sidebar-logout"
            onClick={() => navigate('/login')}
            title={collapsed ? 'Logout' : ''}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════
          MAIN CONTENT
      ═══════════════════════════════════════════ */}
      <main className="dash-main">

        {/* Top Bar */}
        <header className="dash-topbar">
          <div className="topbar-left">
            <h1 className="page-title">{pageTitle}</h1>
            <p className="page-subtitle">
              Hi, <strong>{userName}</strong> 👋 &nbsp;·&nbsp; {todayStr}
            </p>
          </div>

          <div className="topbar-right">
            <div className={`search-box ${searchFocused ? 'focused' : ''}`}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M11 11l2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                className="search-input"
                id="dash-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              <span className="search-kbd">⌘K</span>
            </div>

            <button className="topbar-icon-btn" title="Notifications">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="icon-dot" />
            </button>

            <div className="avatar-wrap">
              <div className="avatar-btn">{userInitials}</div>
              <div className="avatar-online" />
            </div>
          </div>
        </header>

        {/* ─── Page content ─── */}
        <div className="dash-content">

          {/* ──── Trust Badge ──── */}
          <div className="trust-badge-container">
            <div 
              className="trust-badge"
              onClick={() => navigate('/trust-details', { state: { trustId, trustName: trust?.name } })}
              role="button"
              tabIndex={0}
            >
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <path d="M16 2L29 9V23L16 30L3 23V9L16 2Z" fill="url(#trustGradBadge)" />
                <path d="M16 8L12 18H20L16 24" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <defs>
                  <linearGradient id="trustGradBadge" x1="3" y1="2" x2="29" y2="30" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#6366F1" /><stop offset="1" stopColor="#8B5CF6" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="trust-badge-text">{trust?.name || 'No Trust'}</span>
            </div>
          </div>

          {/* ──── Module Cards Heading ──── */}
          <div className="features-section-header">
            <h1 className="features-title">Modules</h1>
            <p className="features-subtitle">Select a module to manage</p>
          </div>

          {/* ──── 4 Module Cards ──── */}
          {filteredModules.length ? (
            <div className="modules-grid">
              {filteredModules.map((card, i) => (
                <button
                  key={card.id}
                  id={card.id}
                  className={`module-card ${card.temporarilyDeactivated ? 'is-deactivated' : ''}`}
                  style={{
                    background: card.gradient,
                    animationDelay: `${i * 0.08}s`,
                  }}
                  onClick={() => {
                    if (card.temporarilyDeactivated) return;
                    navigate(card.route, { state: { userName, trust } });
                  }}
                  title={card.label}
                  aria-disabled={card.temporarilyDeactivated ? 'true' : 'false'}
                >
                  <div className="module-card-shine" />
                  {card.temporarilyDeactivated && (
                    <div className="module-card-deactivated-text">{card.deactivationText || 'Temporarily Deactivated'}</div>
                  )}
                  <div className="module-icon-wrap">
                    {card.icon}
                  </div>
                  <div className="module-card-body">
                    <span className="module-card-label">{card.label}</span>
                    <span className="module-card-desc">{card.description}</span>
                  </div>
                  <div className="module-card-arrow">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M5 12h14M12 5l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="features-empty">No module found for "{searchTerm}".</div>
          )}
        </div>
      </main>
    </div>
  );
}
