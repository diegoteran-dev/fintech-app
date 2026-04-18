import { useState, useEffect, useCallback } from 'react';
import { getRules, updateRule, deleteRule, type CategoryRule } from '../services/api';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../constants';

const sourceLabel = (s: string) => {
  if (s === 'manual_create') return 'Added manually';
  if (s === 'manual_edit') return 'Edited in app';
  if (s === 'bulk_categorize') return 'Bulk import';
  return s;
};

type TypeTab = 'expense' | 'income';

export default function RulesManager() {
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TypeTab>('expense');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCat, setEditCat] = useState('');
  const [search, setSearch] = useState('');

  const refresh = useCallback(() => {
    setLoading(true);
    getRules().then(setRules).finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSave = async (id: number) => {
    await updateRule(id, editCat);
    setEditingId(null);
    refresh();
  };

  const handleDelete = async (id: number) => {
    await deleteRule(id);
    refresh();
  };

  // Rules for the active tab: show rules explicitly typed for this tab, plus
  // legacy rules with null type (they applied to both before the type column existed)
  const tabRules = rules.filter(r =>
    r.transaction_type === activeTab || r.transaction_type === null
  );

  const filtered = tabRules.filter(r =>
    !search.trim() ||
    r.merchant_raw.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  );

  const categoryOptions = activeTab === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const tabCounts = {
    expense: rules.filter(r => r.transaction_type === 'expense' || r.transaction_type === null).length,
    income:  rules.filter(r => r.transaction_type === 'income'  || r.transaction_type === null).length,
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div className="card-title" style={{ marginBottom: 2 }}>Category Rules</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Applied automatically when you import transactions
          </div>
        </div>
        <input
          className="tx-search"
          placeholder="Search rules…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 180, flex: 'none' }}
        />
      </div>

      {/* Income / Expense tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['expense', 'income'] as TypeTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setEditingId(null); }}
            style={{
              padding: '4px 14px', borderRadius: 6, border: '1px solid var(--border)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
              background: activeTab === tab ? 'var(--accent)' : 'var(--bg-2)',
              color: activeTab === tab ? '#fff' : 'var(--text-2)',
            }}
          >
            {tab} <span style={{ opacity: 0.7, fontWeight: 400 }}>({tabCounts[tab]})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-3)', padding: '24px 0', textAlign: 'center' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: 'var(--text-3)', padding: '24px 0', textAlign: 'center', fontSize: 13 }}>
          {rules.length === 0
            ? 'No rules yet — they are created automatically when you categorize transactions.'
            : `No ${activeTab} rules match your search.`}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-3)' }}>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 500 }}>Merchant</th>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 500 }}>Category</th>
                <th style={{ textAlign: 'center', padding: '6px 10px', fontWeight: 500 }}>Used</th>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 500 }}>Source</th>
                <th style={{ padding: '6px 10px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(rule => (
                <tr key={rule.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 10px', maxWidth: 240 }}>
                    <div style={{ fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {rule.merchant_raw}
                    </div>
                    {rule.transaction_type === null && (
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>both types</div>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {editingId === rule.id ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select
                          className="tx-filter-select"
                          value={editCat}
                          onChange={e => setEditCat(e.target.value)}
                          autoFocus
                        >
                          {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleSave(rule.id)}>Save</button>
                        <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => setEditingId(null)}>✕</button>
                      </div>
                    ) : (
                      <span
                        style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 500 }}
                        onClick={() => { setEditingId(rule.id); setEditCat(rule.category); }}
                        title="Click to change category"
                      >
                        {rule.category} <span style={{ fontSize: 11, opacity: 0.6 }}>✎</span>
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-3)' }}>
                    {rule.times_applied}×
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-3)', fontSize: 12 }}>
                    {sourceLabel(rule.source)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                    <button className="tx-del" onClick={() => handleDelete(rule.id)} title="Delete rule">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
