import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import PageHeader from '../components/PageHeader';
import './Features20Page.css';

export default function Features20Page() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'dashboard';

  useEffect(() => {
    if (!trust?.id) {
      navigate('/dashboard', { replace: true, state: { userName, trust } });
    }
  }, [navigate, trust, userName]);

  if (!trust?.id) return null;

  const sharedState = {
    userName,
    trust,
    sidebarNavKey: currentSidebarNavKey,
  };

  return (
    <div className="f20-root">
      <Sidebar
        trustName={trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: sharedState })}
        onLogout={() => navigate('/login')}
      />

      <main className="f20-main">
        <PageHeader
          title="Features2.O"
          subtitle="Merged entry point for Feature Control and Sub Feature Control"
          onBack={() => navigate('/dashboard', { state: sharedState })}
        />

        <section className="f20-panel">
          <div className="f20-intro">
            <h2>Control Center</h2>
            <p>
              Existing Feature Control and Sub Feature Control remain unchanged.
              Use any card below to open the exact same modules.
            </p>
          </div>

          <div className="f20-grid">
            <button
              type="button"
              className="f20-card f20-card-feature"
              onClick={() => navigate('/feature-control', { state: sharedState })}
            >
              <span className="f20-card-title">Feature Control</span>
              <span className="f20-card-desc">Enable, disable and customize dashboard features.</span>
              <span className="f20-card-cta">Open</span>
            </button>

            <button
              type="button"
              className="f20-card f20-card-subfeature"
              onClick={() => navigate('/sub-feature-control', { state: sharedState })}
            >
              <span className="f20-card-title">Sub Feature Control</span>
              <span className="f20-card-desc">Manage sub feature visibility, order and labels.</span>
              <span className="f20-card-cta">Open</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
