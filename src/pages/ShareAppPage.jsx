import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import './SimplePage.css';

export default function ShareAppPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null, superuserId = null } = location.state || {};
  const trustName = trust?.name || 'Trust';

  return (
    <div className="simple-root">
      <Sidebar
        trustName={trustName}
        onDashboard={() =>
          navigate('/dashboard', {
            state: {
              userName,
              trust,
              superuserId,
              sidebarNavKey: 'dashboard',
            },
          })
        }
        onLogout={() => navigate('/login')}
      />

      <main className="simple-main">
        <div className="simple-content">
          <div className="simple-card">
            <h2 style={{ marginTop: 0, marginBottom: 12, color: '#1F2937' }}>Share App</h2>
            <p style={{ margin: 0 }}>No data available.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
