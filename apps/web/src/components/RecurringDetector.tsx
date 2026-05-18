import { useState, useEffect } from 'react';
import { detectRecurring, type RecurringPattern } from '../services/api';

interface Props {
  onMarked?: () => void;
}

export default function RecurringDetector({ onMarked: _onMarked }: Props) {
  const [patterns, setPatterns] = useState<RecurringPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    detectRecurring().then(setPatterns).finally(() => setLoading(false));
  }, []);

  const visible = patterns.filter(p => !dismissed.has(p.description));

  if (loading || visible.length === 0) return null;

  return (
    <div className="card" style={{ padding: '14px 18px', marginBottom: 0 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>↻</span>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
            {visible.length} recurring pattern{visible.length !== 1 ? 's' : ''} detected
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>— click to review</span>
        </div>
        <span style={{ color: 'var(--text-3)', fontSize: 14 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.map(p => (
            <div key={p.description} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', borderRadius: 8, background: 'var(--bg-2)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.description}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                  {p.category} · ~{p.currency === 'BOB' ? 'Bs.' : '$'}{p.avg_amount.toFixed(0)} avg · {p.month_count} months
                </div>
              </div>
              <button
                className="btn-ghost btn-sm"
                style={{ flexShrink: 0 }}
                onClick={() => setDismissed(d => new Set([...d, p.description]))}
              >
                Dismiss
              </button>
            </div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
            Mark individual transactions as recurring using the ↻ button on each row.
          </div>
        </div>
      )}
    </div>
  );
}
