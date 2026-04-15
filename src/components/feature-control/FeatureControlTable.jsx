function resolveIconSource(raw = '') {
  const value = String(raw || '').trim();
  if (!value) return '';

  if (/^https?:\/\//i.test(value) || /^data:image\//i.test(value)) return value;

  if (value.startsWith('/')) {
    const base = import.meta.env.BASE_URL || '/';
    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    return `${normalizedBase}${value}`;
  }

  // treat relative storage path as public path
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${value.replace(/^\/+/, '')}`;
}

function FeatureIconCell({ iconUrl, featureName }) {
  const raw = String(iconUrl || '').trim();

  if (!raw) {
    return <span className="fc-icon-fallback">{String(featureName || '?').slice(0, 1).toUpperCase()}</span>;
  }

  if (raw.includes('<svg')) {
    return <span className="fc-icon-raw-svg" dangerouslySetInnerHTML={{ __html: raw }} />;
  }

  const maybeEmoji = !/^https?:\/\//i.test(raw) && !raw.startsWith('/') && !/^data:image\//i.test(raw) && raw.length <= 8;
  if (maybeEmoji) {
    return <span className="fc-icon-emoji">{raw}</span>;
  }

  const src = resolveIconSource(raw);
  return (
    <img
      src={src}
      alt={featureName || 'Feature icon'}
      className="fc-icon-img"
      onError={(event) => {
        event.currentTarget.style.display = 'none';
        const parent = event.currentTarget.parentElement;
        if (parent) {
          parent.innerHTML = `<span class=\"fc-icon-fallback\">${String(featureName || '?').slice(0, 1).toUpperCase()}</span>`;
        }
      }}
    />
  );
}

export default function FeatureControlTable({
  rows,
  loading,
  togglingMap,
  onToggle,
  onEdit,
}) {
  if (loading) {
    return (
      <div className="fc-state fc-loading">
        <div className="fc-spinner" />
        <p>Loading features...</p>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="fc-state fc-empty">
        <div className="fc-empty-icon">FC</div>
        <h3>No features found</h3>
        <p>Try changing search/filter or choose another trust and tier.</p>
      </div>
    );
  }

  return (
    <div className="fc-table-wrap">
      <table className="fc-table">
        <thead>
          <tr>
            <th>Icon</th>
            <th>Feature Name</th>
            <th>Display Name</th>
            <th>Tagline</th>
            <th>Tier</th>
            <th>Quick Order</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isBusy = !!togglingMap[row.feature_id];
            return (
              <tr key={`${row.feature_id}-${row.tier}`}>
                <td>
                  <div className="fc-icon-cell">
                    <div className="fc-icon-preview">
                      <FeatureIconCell iconUrl={row.icon_url} featureName={row.master_name} />
                    </div>
                  </div>
                </td>
                <td>
                  <div className="fc-feature-name">{row.master_name}</div>
                  {row.master_subname ? <div className="fc-feature-sub">{row.master_subname}</div> : null}
                </td>
                <td>{row.display_name || '-'}</td>
                <td>{row.tagline || '-'}</td>
                <td>
                  <span className="fc-pill">{row.tier}</span>
                </td>
                <td>{row.quick_order ?? '-'}</td>
                <td>
                  <button
                    type="button"
                    className={`fc-toggle ${row.is_enabled ? 'on' : 'off'}`}
                    onClick={() => onToggle(row, !row.is_enabled)}
                    disabled={isBusy}
                    aria-pressed={row.is_enabled}
                    title={row.is_enabled ? 'Disable feature' : 'Enable feature'}
                  >
                    <span className="fc-toggle-track">
                      <span className="fc-toggle-thumb" />
                    </span>
                    <span>{isBusy ? 'Saving...' : row.is_enabled ? 'Enabled' : 'Disabled'}</span>
                  </button>
                </td>
                <td>
                  <button className="fc-btn fc-btn-edit" type="button" onClick={() => onEdit(row)}>
                    Edit
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
