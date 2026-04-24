import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import {
  createOtherMembership,
  deleteOtherMembership,
  fetchOtherMembershipsByTrustId,
  updateOtherMembership,
} from '../services/membersService';
import './OtherMembershipPage.css';

const EMPTY_FORM = {
  member_name: '',
  member_phone: '',
  organisation_name: '',
  membership_no: '',
  membership_type: '',
  is_active: true,
  remark: '',
};

const sanitizeDigits = (value) => String(value ?? '').replace(/\D+/g, '');

export default function OtherMembershipPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null } = location.state || {};
  const currentSidebarNavKey = location.state?.sidebarNavKey || 'menu';
  const trustId = trust?.id || null;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError('');
  };

  useEffect(() => {
    if (!trustId) {
      navigate('/dashboard', { replace: true, state: { userName, trust, sidebarNavKey: 'menu' } });
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      const { data, error: fetchError } = await fetchOtherMembershipsByTrustId(trustId);
      if (fetchError) setError(fetchError.message || 'Unable to load other memberships.');
      setList(data || []);
      setLoading(false);
    };

    load();
  }, [navigate, trustId, userName, trust]);

  const headingText = useMemo(() => (
    editingId ? 'Update Other Membership' : 'Create Other Membership'
  ), [editingId]);

  const handleSave = async () => {
    if (!trustId) return;
    if (!form.membership_no.trim()) {
      setFormError('Membership No is required.');
      return;
    }

    setSaving(true);
    setFormError('');

    const payload = {
      member_name: form.member_name.trim() || null,
      member_phone: sanitizeDigits(form.member_phone) || null,
      organisation_name: form.organisation_name.trim() || null,
      membership_no: form.membership_no.trim(),
      membership_type: form.membership_type.trim() || null,
      is_active: form.is_active !== false,
      remark: form.remark.trim() || null,
    };

    const action = editingId
      ? updateOtherMembership(editingId, payload, trustId)
      : createOtherMembership(payload, trustId);

    const { data, error: saveError } = await action;
    if (saveError) {
      setFormError(saveError.message || 'Unable to save other membership.');
      setSaving(false);
      return;
    }

    setList((prev) => {
      if (editingId) return prev.map((item) => (item.id === data.id ? data : item));
      return [data, ...prev];
    });

    resetForm();
    setSaving(false);
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      member_name: item.member_name || '',
      member_phone: item.member_phone || '',
      organisation_name: item.organisation_name || '',
      membership_no: item.membership_no || '',
      membership_type: item.membership_type || '',
      is_active: item.is_active !== false,
      remark: item.remark || '',
    });
    setFormError('');
  };

  const handleDelete = async (id) => {
    const ok = window.confirm('Delete this other membership?');
    if (!ok) return;
    const { error: deleteError } = await deleteOtherMembership(id);
    if (deleteError) {
      setError(deleteError.message || 'Unable to delete other membership.');
      return;
    }
    setList((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) resetForm();
  };

  return (
    <div className="om-root">
      <Sidebar
        trustName={trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: currentSidebarNavKey } })}
        onLogout={() => navigate('/login')}
      />

      <main className="om-main">
        <PageHeader
          title="Other Membership"
          subtitle="Manage records from other_memberships table"
          onBack={() => navigate('/dashboard', { state: { userName, trust, sidebarNavKey: 'menu' } })}
        />

        <section className="om-content">
          {error && <div className="om-error">{error}</div>}
          {formError && <div className="om-error">{formError}</div>}

          <div className="om-layout">
            <div className="om-card">
              <h3>{headingText}</h3>
              <div className="om-form-grid">
                <label>
                  <span>Membership Number *</span>
                  <input
                    value={form.membership_no}
                    onChange={(event) => setForm((prev) => ({ ...prev, membership_no: event.target.value }))}
                    placeholder="Required membership_no"
                  />
                </label>
                <label>
                  <span>Member Name</span>
                  <input
                    value={form.member_name}
                    onChange={(event) => setForm((prev) => ({ ...prev, member_name: event.target.value }))}
                    placeholder="Optional member_name"
                  />
                </label>
                <label>
                  <span>Member Phone</span>
                  <input
                    value={form.member_phone}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    onChange={(event) => setForm((prev) => ({ ...prev, member_phone: sanitizeDigits(event.target.value) }))}
                    placeholder="Optional member_phone"
                  />
                </label>
                <label>
                  <span>Organisation Name</span>
                  <input
                    value={form.organisation_name}
                    onChange={(event) => setForm((prev) => ({ ...prev, organisation_name: event.target.value }))}
                    placeholder="Optional organisation_name"
                  />
                </label>
                <label>
                  <span>Membership Type</span>
                  <input
                    value={form.membership_type}
                    onChange={(event) => setForm((prev) => ({ ...prev, membership_type: event.target.value }))}
                    placeholder="Optional membership_type"
                  />
                </label>
                <label className="om-span-2">
                  <span>Remark</span>
                  <textarea
                    rows="3"
                    value={form.remark}
                    onChange={(event) => setForm((prev) => ({ ...prev, remark: event.target.value }))}
                    placeholder="Optional remark"
                  />
                </label>
                <label className="om-toggle">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                  <span>Active</span>
                </label>
              </div>
              <div className="om-actions">
                <button type="button" className="om-btn om-btn-muted" onClick={resetForm} disabled={saving}>
                  Reset
                </button>
                <button type="button" className="om-btn om-btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : editingId ? 'Update' : 'Save'}
                </button>
              </div>
            </div>

            <div className="om-card">
              <h3>Other Membership Records</h3>
              {loading && <div className="om-empty">Loading...</div>}
              {!loading && list.length === 0 && <div className="om-empty">No records yet.</div>}
              {!loading && list.length > 0 && (
                <div className="om-list">
                  {list.map((item) => (
                    <div key={item.id} className="om-item">
                      <div className="om-item-head">
                        <strong>{item.organisation_name || 'Organisation'}</strong>
                        <span className={`om-status ${item.is_active ? 'active' : 'inactive'}`}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="om-item-meta">
                        <span>Membership No: {item.membership_no || '-'}</span>
                        <span>Type: {item.membership_type || '-'}</span>
                        <span>Member: {item.member_name || '-'} {item.member_phone ? `| ${item.member_phone}` : ''}</span>
                      </div>
                      {item.remark && <div className="om-item-remark">{item.remark}</div>}
                      <div className="om-item-actions">
                        <button type="button" className="om-btn om-btn-muted" onClick={() => handleEdit(item)}>Edit</button>
                        <button type="button" className="om-btn om-btn-danger" onClick={() => handleDelete(item.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
