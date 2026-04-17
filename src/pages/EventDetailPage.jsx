import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import { fetchEventById } from '../services/eventsService';
import { parseAttachmentItem } from '../utils/attachmentUtils';
import './EventsPage.css';

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(value) {
  if (!value) return '-';
  return value.slice(0, 5);
}

export default function EventDetailPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const trustId = trust?.id || null;

  const [event, setEvent] = useState(null);
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
      const { data, error: fetchError } = await fetchEventById(trustId, eventId);
      if (fetchError) {
        setError(fetchError.message || 'Unable to load event.');
      }
      setEvent(data || null);
      setLoading(false);
    };

    load();
  }, [eventId, navigate, trustId, userName, trust]);

  if (!trustId) return null;

  const parsedAttachments = (event?.attachments || [])
    .map((item, index) => parseAttachmentItem(item, index))
    .filter(Boolean);

  return (
    <div className="ev-root">
      <Sidebar
        trustName={trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust } })}
        onLogout={() => navigate('/login')}
      />

      <main className="ev-main">
        <PageHeader
          title="Event Details"
          subtitle="Loaded from events table"
          onBack={() => navigate('/events', { state: { userName, trust } })}
        />

        <section className="ev-content">
          {loading && <div className="ev-empty">Loading event details...</div>}
          {error && <div className="ev-error">{error}</div>}
          {!loading && !error && !event && <div className="ev-empty">Event not found for this trust.</div>}

          {!loading && event && (
            <article className="ev-detail-card">
              <div className="ev-card-top">
                <span className="ev-chip">{event.status}</span>
                <span className="ev-date">{formatDate(event.startEventDate)}</span>
              </div>
              <h2 className="ev-detail-title">{event.title}</h2>
              <p className="ev-detail-message">{event.description || 'No description added.'}</p>
              <div className="ev-detail-footer">Location: {event.location || '-'}</div>
              <div className="ev-detail-meta">
                <div>Start Date: {formatDate(event.startEventDate)}</div>
                <div>Start Time: {formatTime(event.start_time)}</div>
                <div>End Date: {formatTime(event.endEventDate)}</div>
                <div>Registration Required: {event.is_registration_required ? 'Yes' : 'No'}</div>
              </div>

              {parsedAttachments.length > 0 && (
                <div className="ev-attachment-list">
                  {parsedAttachments.map((item, index) => (
                    <a
                      key={`${item.value}-${index}`}
                      href={item.value}
                      target={item.isDataUrl ? undefined : '_blank'}
                      rel={item.isDataUrl ? undefined : 'noreferrer'}
                      download={item.name}
                      className="ev-attachment-link"
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
