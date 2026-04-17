import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import { fetchNoticeById } from '../services/noticeboardService';
import { parseAttachmentItem } from '../utils/attachmentUtils';
import './NoticeboardPage.css';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function NoticeDetailPage() {
  const { noticeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const trustId = trust?.id || null;

  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!trustId) {
      navigate('/dashboard', { replace: true, state: { userName, trust } });
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      const { data, error: fetchError } = await fetchNoticeById(trustId, noticeId);
      if (fetchError) {
        setError(fetchError.message || 'Unable to load notice.');
      }
      setNotice(data || null);
      setLoading(false);
    };

    load();
  }, [navigate, noticeId, trustId, userName, trust]);

  if (!trustId) return null;
  const parsedAttachments = (notice?.attachments || [])
    .map((item, index) => parseAttachmentItem(item, index))
    .filter(Boolean);

  return (
    <div className="nb-root">
      <Sidebar
        trustName={trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust } })}
        onLogout={() => navigate('/login')}
      />

      <main className="nb-main">
        <PageHeader
          title="Notice Details"
          subtitle="Loaded from noticeboard table"
          onBack={() => navigate('/noticeboard', { state: { userName, trust } })}
        />

        <section className="nb-content">
          {loading && <div className="nb-empty">Loading notice details...</div>}
          {error && <div className="nb-error">{error}</div>}
          {!loading && !error && !notice && <div className="nb-empty">Notice not found for this trust.</div>}

          {!loading && notice && (
            <article className="nb-detail-card">
              <div className="nb-card-top">
                <span className="nb-chip">{notice.status}</span>
                <span className="nb-date">{formatDate(notice.created_at)}</span>
              </div>
              <h2 className="nb-detail-title">{notice.name}</h2>
              <p className="nb-detail-message">{notice.description || 'No description added.'}</p>
              <div className="nb-detail-footer">Start: {formatDate(notice.start_date)} | End: {formatDate(notice.end_date)}</div>

              {parsedAttachments.length > 0 && (
                <div className="nb-attachment-list">
                  {parsedAttachments.map((item, index) => (
                    <a
                      key={`${item.value}-${index}`}
                      href={item.value}
                      target={item.isDataUrl ? undefined : '_blank'}
                      rel={item.isDataUrl ? undefined : 'noreferrer'}
                      download={item.name}
                      className="nb-attachment-link"
                    >
                      {item.name}
                    </a>
                  ))}
                </div>
              )}
            </article>
          )}
        </section>
      </main>
    </div>
  );
}
