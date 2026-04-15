import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Sidebar from '../components/Sidebar';
import FeatureControlTable from '../components/feature-control/FeatureControlTable';
import FeatureEditModal from '../components/feature-control/FeatureEditModal';
import { fetchLinkedTrusts } from '../services/authService';
import {
  fetchMasterFeatures,
  fetchFeatureFlagsByTrustAndTier,
  mergeFeaturesWithFlags,
  mergeSingleFeatureWithFlag,
  saveFeatureCustomization,
  toggleFeatureEnabled,
} from '../services/featureControlService';
import './FeatureControlPage.css';

function normalizeQuickOrder(value) {
  if (value === null || value === undefined || value === '') return Number.MAX_SAFE_INTEGER;
  return Number(value);
}

export default function FeatureControlPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userName = 'Admin', trust = null, superuserId = null } = location.state || {};

  const [trustOptions, setTrustOptions] = useState(trust ? [trust] : []);
  const [selectedTrustId, setSelectedTrustId] = useState(trust?.id || '');
  const [selectedTier, setSelectedTier] = useState('general');
  const [masterFeatures, setMasterFeatures] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [quickOrderSort, setQuickOrderSort] = useState('asc');

  const [togglingMap, setTogglingMap] = useState({});
  const [activeEditRow, setActiveEditRow] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [flash, setFlash] = useState(null);

  const selectedTrust = useMemo(
    () => trustOptions.find((item) => String(item.id) === String(selectedTrustId)) || null,
    [trustOptions, selectedTrustId]
  );

  const loadTrusts = useCallback(async () => {
    if (!superuserId) {
      setTrustOptions(trust ? [trust] : []);
      return;
    }

    const { data, error: trustsError } = await fetchLinkedTrusts(superuserId);
    if (trustsError) {
      setTrustOptions(trust ? [trust] : []);
      return;
    }

    const linked = data || [];
    if (!linked.length && trust) {
      setTrustOptions([trust]);
      return;
    }

    setTrustOptions(linked);
    setSelectedTrustId((prev) => {
      if (prev && linked.some((item) => String(item.id) === String(prev))) return prev;
      return linked[0]?.id || '';
    });
  }, [superuserId, trust]);

  const loadMasterFeatures = useCallback(async () => {
    const { data, error: masterError } = await fetchMasterFeatures();
    if (masterError) {
      setError(masterError.message || 'Unable to load features master list.');
      return [];
    }
    setMasterFeatures(data || []);
    return data || [];
  }, []);

  const loadMergedRows = useCallback(async (featuresInput) => {
    if (!selectedTrustId) return;

    setLoading(true);
    setError('');

    const masterList = featuresInput || [];
    const { data: flags, error: flagsError } = await fetchFeatureFlagsByTrustAndTier(selectedTrustId, selectedTier);

    if (flagsError) {
      setError(flagsError.message || 'Unable to load feature flags.');
      setLoading(false);
      return;
    }

    const merged = mergeFeaturesWithFlags(masterList, flags || [], selectedTrustId, selectedTier);
    setRows(merged);
    setLoading(false);
  }, [selectedTier, selectedTrustId]);

  useEffect(() => {
    if (!trust?.id) {
      navigate('/dashboard', { replace: true, state: { userName, trust } });
    }
  }, [navigate, trust, userName]);

  useEffect(() => {
    loadTrusts();
  }, [loadTrusts]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!selectedTrustId) return;
      const master = await loadMasterFeatures();
      if (!mounted) return;
      await loadMergedRows(master);
    };

    run();

    return () => {
      mounted = false;
    };
  }, [selectedTrustId, selectedTier, loadMasterFeatures, loadMergedRows]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(timer);
  }, [flash]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const searched = rows.filter((row) => {
      if (!normalizedSearch) return true;
      const fields = [
        row.master_name,
        row.master_subname,
        row.display_name,
        row.tagline,
        row.route,
        row.name,
        row.description,
      ];
      return fields.some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
    });

    const byStatus = searched.filter((row) => {
      if (statusFilter === 'enabled') return !!row.is_enabled;
      if (statusFilter === 'disabled') return !row.is_enabled;
      return true;
    });

    return [...byStatus].sort((left, right) => {
      const leftOrder = normalizeQuickOrder(left.quick_order);
      const rightOrder = normalizeQuickOrder(right.quick_order);
      const direction = quickOrderSort === 'desc' ? -1 : 1;
      if (leftOrder !== rightOrder) return (leftOrder - rightOrder) * direction;
      return String(left.master_name || '').localeCompare(String(right.master_name || ''), undefined, {
        sensitivity: 'base',
      });
    });
  }, [rows, searchTerm, statusFilter, quickOrderSort]);

  const applyUpdatedFlag = (featureId, updatedFlag) => {
    setRows((prev) =>
      prev.map((row) => (row.feature_id === featureId ? mergeSingleFeatureWithFlag(row, updatedFlag) : row))
    );
  };

  const handleToggle = async (row, nextEnabled) => {
    const key = row.feature_id;
    setTogglingMap((prev) => ({ ...prev, [key]: true }));

    const { data, error: toggleError } = await toggleFeatureEnabled({
      mergedFeature: row,
      trustId: selectedTrustId,
      tier: selectedTier,
      isEnabled: nextEnabled,
      trustName: selectedTrust?.name || '',
    });

    setTogglingMap((prev) => ({ ...prev, [key]: false }));

    if (toggleError) {
      setFlash({ type: 'error', text: toggleError.message || 'Unable to update status.' });
      return;
    }

    applyUpdatedFlag(row.feature_id, data);
    setFlash({ type: 'success', text: `Feature ${nextEnabled ? 'enabled' : 'disabled'} successfully.` });
  };

  const handleOpenEdit = (row) => {
    setSaveError('');
    setActiveEditRow(row);
  };

  const handleSaveEdit = async (payload) => {
    if (!activeEditRow) return;

    setSavingEdit(true);
    setSaveError('');

    const { data, error: updateError } = await saveFeatureCustomization({
      mergedFeature: activeEditRow,
      trustId: selectedTrustId,
      tier: selectedTier,
      trustName: selectedTrust?.name || '',
      updates: payload,
    });

    setSavingEdit(false);

    if (updateError) {
      setSaveError(updateError.message || 'Unable to save feature details.');
      return;
    }

    applyUpdatedFlag(activeEditRow.feature_id, data);
    setActiveEditRow(null);
    setFlash({ type: 'success', text: 'Feature updated successfully.' });
  };

  if (!trust?.id) return null;

  return (
    <div className="fc-root">
      <Sidebar
        trustName={selectedTrust?.name || trust?.name || 'Trust'}
        onDashboard={() => navigate('/dashboard', { state: { userName, trust: selectedTrust || trust } })}
        onLogout={() => navigate('/login')}
      />

      <main className="fc-main">
        <PageHeader
          title="Feature Control"
          subtitle="Enable, disable and customize dashboard features"
          onBack={() => navigate('/dashboard', { state: { userName, trust: selectedTrust || trust } })}
        />

        <section className="fc-panel">
          <div className="fc-controls">
            <label>
              <span>Trust</span>
              <select value={selectedTrustId} onChange={(event) => setSelectedTrustId(event.target.value)}>
                {trustOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Tier</span>
              <select value={selectedTier} onChange={(event) => setSelectedTier(event.target.value)}>
                <option value="general">general</option>
                <option value="vip">vip</option>
              </select>
            </label>

            <label className="fc-search">
              <span>Search</span>
              <input
                type="text"
                placeholder="Search feature, display name, route..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>

            <label>
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">all</option>
                <option value="enabled">enabled</option>
                <option value="disabled">disabled</option>
              </select>
            </label>

            <label>
              <span>Sort by Quick Order</span>
              <select value={quickOrderSort} onChange={(event) => setQuickOrderSort(event.target.value)}>
                <option value="asc">ascending</option>
                <option value="desc">descending</option>
              </select>
            </label>
          </div>

          {error ? (
            <div className="fc-error">
              <span>{error}</span>
              <button type="button" onClick={() => loadMergedRows(masterFeatures)}>
                Retry
              </button>
            </div>
          ) : null}

          <FeatureControlTable
            rows={filteredRows}
            loading={loading}
            togglingMap={togglingMap}
            onToggle={handleToggle}
            onEdit={handleOpenEdit}
          />
        </section>
      </main>

      <FeatureEditModal
        key={activeEditRow ? `${activeEditRow.feature_id}-${activeEditRow.tier}` : 'feature-edit'}
        open={!!activeEditRow}
        row={activeEditRow}
        tier={selectedTier}
        saving={savingEdit}
        saveError={saveError}
        onClose={() => setActiveEditRow(null)}
        onSave={handleSaveEdit}
      />

      {flash ? (
        <div className={`fc-toast ${flash.type === 'error' ? 'error' : 'success'}`} role="status">
          {flash.text}
        </div>
      ) : null}
    </div>
  );
}
