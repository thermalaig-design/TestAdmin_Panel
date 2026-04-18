import { useEffect, useState } from 'react';
import './Sidebar.css';
import { useLocation, useNavigate } from 'react-router-dom';

const navItems = [
  {
    id: 'nav-dashboard',
    label: 'Dashboard',
    route: '/dashboard',
    navKey: 'dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
      </svg>
    ),
  },
  {
    id: 'nav-company-details',
    label: 'Company Details',
    route: '/dashboard',
    navKey: 'company-details',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'nav-app-design',
    label: 'App Design',
    route: '/dashboard',
    navKey: 'app-design',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8"/>
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
        <polyline points="21 15 16 10 5 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'nav-home-page',
    label: 'Home Page',
    route: '/dashboard',
    navKey: 'home-page',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-10.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'nav-quick-actions',
    label: 'Quick Actions',
    route: '/dashboard',
    navKey: 'quick-actions',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M4 6h16M4 12h10M4 18h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="17" cy="12" r="2" fill="currentColor"/>
        <circle cx="14" cy="18" r="2" fill="currentColor"/>
      </svg>
    ),
  },
];

export default function Sidebar({ trustName = 'Trust', onDashboard, onLogout }) {
  const MOBILE_BREAKPOINT = 980;
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'dashboard';
  const currentTrusteesView = location.state?.trusteesView || '';
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT
  );
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const handleChange = (event) => {
      setIsMobile(event.matches);
      if (!event.matches) setMenuOpen(false);
    };

    setIsMobile(mediaQuery.matches);
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('sb-mobile-lock', isMobile && menuOpen);
    return () => {
      document.body.classList.remove('sb-mobile-lock');
    };
  }, [isMobile, menuOpen]);

  const closeMobileMenu = () => {
    if (isMobile) setMenuOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className={`sb-mobile-trigger ${menuOpen ? 'is-open' : ''}`}
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
      >
        <span />
        <span />
        <span />
      </button>

      {isMobile && (
        <button
          type="button"
          className={`sb-backdrop ${menuOpen ? 'show' : ''}`}
          onClick={closeMobileMenu}
          aria-label="Close menu overlay"
          tabIndex={menuOpen ? 0 : -1}
        />
      )}

      <aside className={`sb-sidebar ${isMobile ? 'mobile' : ''} ${menuOpen ? 'open' : ''}`}>
        <div className="sb-brand">
          <div className="sb-brand-logo">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L29 9V23L16 30L3 23V9L16 2Z" fill="url(#sbGrad)" />
              <path d="M16 8L12 18H20L16 24" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="sbGrad" x1="3" y1="2" x2="29" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366F1" /><stop offset="1" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="sb-brand-text">
            <span className="sb-brand-name" title={trustName}>{trustName}</span>
            <span className="sb-brand-sub">Admin Panel</span>
          </div>
          {isMobile && (
            <button
              type="button"
              className="sb-close-btn"
              onClick={closeMobileMenu}
              aria-label="Close menu"
            >
              x
            </button>
          )}
        </div>

        <div className="sb-section-label">MAIN MENU</div>
        <nav className="sb-nav">
          {navItems.map((item) => {
            const isTrusteesCompanyView = item.id === 'nav-company-details' && location.pathname === '/trustees' && currentTrusteesView !== 'logo';
            const isTrusteesAppDesignView = item.id === 'nav-app-design' && location.pathname === '/trustees' && currentTrusteesView === 'logo';
            const isActive =
              isTrusteesCompanyView ||
              isTrusteesAppDesignView ||
              (location.pathname === item.route && (
                item.route === '/dashboard'
                  ? item.navKey === currentSidebarNavKey
                  : item.route === '/trustees'
                    ? item.navState?.trusteesView === currentTrusteesView
                    : true
              ));
            return (
              <button
                key={item.id}
                className={`sb-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  if (item.id === 'nav-dashboard' && onDashboard) {
                    onDashboard();
                    closeMobileMenu();
                    return;
                  }
                  navigate(item.route, {
                    state: {
                      userName,
                      trust,
                      ...(item.navState || {}),
                      ...(item.navKey ? { sidebarNavKey: item.navKey } : {}),
                    },
                  });
                  closeMobileMenu();
                }}
              >
                <span className="sb-icon">{item.icon}</span>
                <span className="sb-label">{item.label}</span>
                <span className="sb-indicator" />
              </button>
            );
          })}
        </nav>

        <div className="sb-bottom">
          <button
            className="sb-logout"
            onClick={() => {
              if (onLogout) onLogout();
              else navigate('/login');
              closeMobileMenu();
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
