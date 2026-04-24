import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import { fetchNotificationsByTrustId } from '../services/notificationsService';
import './NotificationPage.css';

function formatDate(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'home-page';
  const trustId = trust?.id || null;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!trustId) {
      navigate('/dashboard', { replace: true, state: { userName, trust, sidebarNavKey: 'home-page' } });
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      const { data, error: fetchError } = await fetchNotificationsByTrustId(trustId);
      if (fetchError) {
        setError(fetchError.message || 'Unable to load notifications.');
        setList([]);
        setLoading(false);
        return;
      }
      setList(data || []);
      setLoading(false);
    };

    load();
  }, [navigate, trustId, userName, trust]);

  const filtered = useMemo(() => {
    const query = String(search || '').trim().toLowerCase();
    if (!query) return list;
    return list.filter((item) => {
      const title = String(item.title || '').toLowerCase();
      const message = String(item.message || '').toLowerCase();
      const type = String(item.type || '').toLowerCase();
      const audience = String(item.target_audience || '').toLowerCase();
      return (
        title.includes(query) ||
        message.includes(query) ||
        type.includes(query) ||
        audience.includes(query)
      );
    });
  }, [list, search]);

  return (
    <div className="np-root">
      <Sidebar
        trustName={trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
        onLogout={() => navigate('/login')}
      />

      <main className="np-main">
        <PageHeader
          title="Notification"
          subtitle="Manage records from notifications table"
          onBack={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: 'home-page' } })}
        />

        <section className="np-content">
          {error && <div className="np-error">{error}</div>}

          <div className="np-toolbar">
            <div className="np-count">Total Notifications: {filtered.length}</div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, message, type..."
              className="np-search"
            />
          </div>

          {loading && (
            <div className="np-empty-card">
              <h3>Loading...</h3>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="np-empty-card">
              <h3>No Data</h3>
              <p>No notifications data available.</p>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="np-list">
              {filtered.map((item) => (
                <article key={item.id} className="np-item">
                  <div className="np-item-head">
                    <h4>{item.title || 'Untitled Notification'}</h4>
                    <span className={`np-read-badge ${item.is_read ? 'is-read' : 'is-unread'}`}>
                      {item.is_read ? 'Read' : 'Unread'}
                    </span>
                  </div>
                  <p className="np-message">{item.message || '-'}</p>
                  <div className="np-meta">
                    <span>Type: {item.type || 'general'}</span>
                    <span>Audience: {item.target_audience || 'all'}</span>
                    <span>Created: {formatDate(item.created_at)}</span>
                    <span>Updated: {formatDate(item.updated_at)}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
