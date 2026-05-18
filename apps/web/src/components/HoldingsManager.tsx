import { useState, useEffect, useCallback, useRef } from 'react';
import type { Holding, HoldingCreate, TickerResult } from '../types';
import {
  getHoldings,
  createHolding,
  updateHolding,
  deleteHolding,
  searchTicker,
} from '../services/api';

const ASSET_TYPES: Array<HoldingCreate['asset_type']> = ['stock', 'etf', 'crypto', 'metal', 'cash'];

const assetLabel = (type: string) => {
  const map: Record<string, string> = {
    stock: 'Stock',
    etf: 'ETF',
    crypto: 'Crypto',
    metal: 'Metal',
    cash: 'Cash',
  };
  return map[type] ?? type;
};

const assetColor = (type: string) => {
  const map: Record<string, string> = {
    stock: '#7C3AED',
    etf: '#2563EB',
    crypto: '#F59E0B',
    metal: '#D97706',
    cash: '#22C55E',
  };
  return map[type] ?? 'var(--text-3)';
};

export default function HoldingsManager() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit quantity inline
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState('');

  // Add form state
  const [form, setForm] = useState<HoldingCreate>({
    asset_type: 'stock',
    ticker: '',
    name: '',
    quantity: 0,
  });

  // Ticker search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TickerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    getHoldings()
      .then(setHoldings)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced ticker search
  useEffect(() => {
    if (!searchQuery.trim() || form.asset_type === 'cash') {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchTicker(searchQuery, form.asset_type);
        setSearchResults(results);
        setShowDropdown(results.length > 0);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, form.asset_type]);

  const handleSelectTicker = (result: TickerResult) => {
    setForm(f => ({ ...f, ticker: result.ticker, name: result.name ?? '' }));
    setSearchQuery(result.ticker);
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ticker.trim()) { setError('Ticker is required.'); return; }
    if (form.quantity <= 0) { setError('Quantity must be greater than 0.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      await createHolding({ ...form, ticker: form.ticker.trim().toUpperCase() });
      setShowForm(false);
      setForm({ asset_type: 'stock', ticker: '', name: '', quantity: 0 });
      setSearchQuery('');
      refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to add holding.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteHolding(id);
    refresh();
  };

  const handleEditQty = async (id: number) => {
    const qty = parseFloat(editQty);
    if (isNaN(qty) || qty <= 0) return;
    await updateHolding(id, qty);
    setEditingId(null);
    setEditQty('');
    refresh();
  };

  const totalValue = holdings.reduce((sum, h) => sum + (h.value ?? 0), 0);

  return (
    <div className="budget-layout">
      {/* Sidebar — Add Holding Form */}
      <div className="card card-sticky">
        <div className="card-title">Holdings</div>

        {showForm ? (
          <form onSubmit={handleSubmit} className="budget-form">
            <label className="form-label">Asset Type</label>
            <select
              className="form-select"
              value={form.asset_type}
              onChange={e => {
                setForm(f => ({ ...f, asset_type: e.target.value as HoldingCreate['asset_type'], ticker: '', name: '' }));
                setSearchQuery('');
                setSearchResults([]);
              }}
            >
              {ASSET_TYPES.map(t => (
                <option key={t} value={t}>{assetLabel(t)}</option>
              ))}
            </select>

            <label className="form-label" style={{ marginTop: 12 }}>
              {form.asset_type === 'cash' ? 'Currency / Label' : 'Ticker Symbol'}
            </label>
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <input
                className="form-input"
                placeholder={form.asset_type === 'cash' ? 'e.g. USD, BOB' : 'Search ticker…'}
                value={searchQuery || form.ticker}
                onChange={e => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  setForm(f => ({ ...f, ticker: val.toUpperCase() }));
                }}
                autoComplete="off"
              />
              {searching && (
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Searching…</div>
              )}
              {showDropdown && searchResults.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  zIndex: 100,
                  maxHeight: 200,
                  overflowY: 'auto',
                }}>
                  {searchResults.map(r => (
                    <div
                      key={r.ticker}
                      onClick={() => handleSelectTicker(r)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid var(--border)',
                        fontSize: 13,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.ticker}</span>
                        {r.name && <span style={{ color: 'var(--text-3)', marginLeft: 8, fontSize: 12 }}>{r.name}</span>}
                      </div>
                      {r.price != null && (
                        <span style={{ color: 'var(--text-2)', fontSize: 12 }}>${r.price.toFixed(2)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className="form-label" style={{ marginTop: 12 }}>Name (optional)</label>
            <input
              className="form-input"
              placeholder="e.g. Apple Inc."
              value={form.name ?? ''}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />

            <label className="form-label" style={{ marginTop: 12 }}>Quantity / Shares</label>
            <input
              className="form-input"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 10.5"
              value={form.quantity || ''}
              onChange={e => setForm(f => ({ ...f, quantity: parseFloat(e.target.value.replace(',', '.')) || 0 }))}
            />

            {error && <div className="form-error">{error}</div>}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit" className="btn-primary" disabled={submitting} style={{ flex: 1 }}>
                {submitting ? 'Adding…' : 'Add Holding'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => { setShowForm(false); setError(null); setSearchQuery(''); }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            className="btn-primary"
            style={{ width: '100%' }}
            onClick={() => setShowForm(true)}
          >
            + Add Holding
          </button>
        )}

        {holdings.length > 0 && (
          <div style={{
            marginTop: 20,
            padding: '14px 0 0',
            borderTop: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Total Portfolio Value</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
              ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        )}
      </div>

      {/* Main — Holdings list */}
      <div>
        {loading ? (
          <div style={{ color: 'var(--text-3)', padding: 40, textAlign: 'center' }}>Loading…</div>
        ) : holdings.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📈</div>
            <div style={{ fontSize: 14 }}>No holdings yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Add a stock, ETF, crypto, or metal to track your portfolio</div>
          </div>
        ) : (
          <div className="budget-list">
            {holdings.map(h => (
              <div key={h.id} className="budget-card">
                <div className="budget-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      className="budget-dot"
                      style={{ background: assetColor(h.asset_type) }}
                    />
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15 }}>{h.ticker}</span>
                      {h.name && (
                        <span style={{ color: 'var(--text-3)', fontSize: 12, marginLeft: 8 }}>{h.name}</span>
                      )}
                      <span style={{
                        marginLeft: 8,
                        fontSize: 11,
                        color: assetColor(h.asset_type),
                        background: `${assetColor(h.asset_type)}22`,
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontWeight: 500,
                      }}>
                        {assetLabel(h.asset_type).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <button
                    className="budget-delete"
                    onClick={() => handleDelete(h.id)}
                    title="Remove holding"
                  >
                    ×
                  </button>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 12,
                  marginTop: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Shares</div>
                    {editingId === h.id ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          className="form-input"
                          type="text"
                          inputMode="decimal"
                          value={editQty}
                          onChange={e => setEditQty(e.target.value.replace(',', '.'))}
                          style={{ padding: '4px 8px', fontSize: 13, width: 80 }}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleEditQty(h.id);
                            if (e.key === 'Escape') { setEditingId(null); setEditQty(''); }
                          }}
                        />
                        <button
                          className="btn-primary"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={() => handleEditQty(h.id)}
                        >✓</button>
                        <button
                          className="btn-ghost"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={() => { setEditingId(null); setEditQty(''); }}
                        >✕</button>
                      </div>
                    ) : (
                      <div
                        style={{ fontSize: 14, color: 'var(--text)', cursor: 'pointer' }}
                        title="Click to edit"
                        onClick={() => { setEditingId(h.id); setEditQty(String(h.quantity)); }}
                      >
                        {h.quantity.toLocaleString('en-US', { maximumFractionDigits: 8 })}
                        <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 4 }}>✎</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Price</div>
                    <div style={{ fontSize: 14, color: 'var(--text)' }}>
                      {h.price != null
                        ? `$${h.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : <span style={{ color: 'var(--text-3)' }}>—</span>
                      }
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Value</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: h.value ? 'var(--green)' : 'var(--text-3)' }}>
                      {h.value != null
                        ? `$${h.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'
                      }
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
