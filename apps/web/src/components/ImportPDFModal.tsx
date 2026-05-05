import { useState, useRef } from 'react';
import { parsePdf, createTransaction, type ParsedPdfRow } from '../services/api';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../constants';
import { useLang } from '../context/LangContext';

interface Props {
  onClose: () => void;
  onImported: () => void;
}

interface PreviewRow extends ParsedPdfRow {
  category: string;
  selected: boolean;
}

export default function ImportPDFModal({ onClose, onImported }: Props) {
  const { t } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [bankName, setBankName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [openingBalance, setOpeningBalance] = useState<string>('');
  const [openingCurrency, setOpeningCurrency] = useState<string>('BOB');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; skipped: number; failed: number } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError('');
    setRows([]);
    setOpeningBalance('');
    setParsing(true);
    try {
      const parsed = await parsePdf(file);
      if (parsed.rows.length === 0) {
        setParseError(t.pdfImport.noRows);
      } else {
        setRows(parsed.rows.map(r => ({ ...r, category: r.category, selected: true })));
        setBankName(parsed.bank_name ?? '');
        if (parsed.opening_balance != null) {
          setOpeningBalance(String(parsed.opening_balance));
          // Detect currency from first row
          if (parsed.rows[0]) setOpeningCurrency(parsed.rows[0].currency);
        }
      }
    } catch {
      setParseError(t.pdfImport.parseError);
    } finally {
      setParsing(false);
    }
  };

  const toggleRow = (i: number) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r));

  const setCategory = (i: number, cat: string) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, category: cat } : r));

  const selectedRows = rows.filter(r => r.selected);
  const obAmount = parseFloat(openingBalance);
  const hasOpeningBalance = !isNaN(obAmount) && obAmount > 0;

  const handleImport = async () => {
    if (selectedRows.length === 0 && !hasOpeningBalance) return;
    setImporting(true);
    setProgress(0);
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    // Determine the date for the Balance Forward entry: one day before the
    // earliest transaction, so it sorts first in the running total.
    const allDates = selectedRows.map(r => r.date).filter(Boolean).sort();
    const firstDate = allDates[0] ?? new Date().toISOString().slice(0, 10);
    const balanceFwdDate = new Date(firstDate + 'T00:00:00');
    balanceFwdDate.setDate(balanceFwdDate.getDate() - 1);
    const balanceFwdDateStr = balanceFwdDate.toISOString().slice(0, 10);

    const allToImport: Array<{ tx: object; isBalanceFwd?: boolean }> = [];

    // Prepend the opening balance as a Balance Forward income entry
    if (hasOpeningBalance) {
      allToImport.push({
        isBalanceFwd: true,
        tx: {
          description: 'Balance Forward',
          amount: obAmount,
          currency: openingCurrency,
          category: 'Other',
          type: 'income',
          date: new Date(balanceFwdDateStr + 'T12:00:00').toISOString(),
        },
      });
    }

    for (const row of selectedRows) {
      allToImport.push({
        tx: {
          description: row.description,
          amount: row.amount,
          currency: row.currency,
          category: row.category,
          type: row.type,
          date: new Date(row.date + 'T12:00:00').toISOString(),
          ...(row.comprobante ? { comprobante: row.comprobante } : {}),
        },
      });
    }

    for (let i = 0; i < allToImport.length; i++) {
      try {
        await createTransaction(allToImport[i].tx as any, true);
        imported++;
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 409) skipped++;
        else failed++;
      }
      setProgress(Math.round(((i + 1) / allToImport.length) * 100));
    }

    setResult({ imported, skipped, failed });
    setImporting(false);
  };

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal csv-modal">
        <div className="modal-head">
          <span className="modal-title">{t.pdfImport.title}</span>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>

        {result ? (
          <div className="csv-result">
            <div className="csv-result-title">{t.pdfImport.done}</div>
            <div className="csv-result-row">
              <span className="csv-result-ok">{result.imported} {t.pdfImport.imported}</span>
              {result.skipped > 0 && (
                <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{result.skipped} already in DB</span>
              )}
              {result.failed > 0 && (
                <span className="csv-result-fail">{result.failed} {t.pdfImport.failed}</span>
              )}
            </div>
            <button className="btn-primary" onClick={onImported} style={{ marginTop: 16 }}>Close</button>
          </div>
        ) : (
          <>
            <div className="field">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                onChange={handleFile}
                style={{ display: 'none' }}
              />
              <button className="btn-ghost csv-file-btn" onClick={() => fileRef.current?.click()}>
                {fileName || t.pdfImport.selectFile}
              </button>
              {bankName && (
                <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 8 }}>
                  {bankName}
                </span>
              )}
            </div>

            {parsing && (
              <div className="csv-no-file" style={{ color: 'var(--accent)' }}>{t.pdfImport.parsing}</div>
            )}
            {parseError && (
              <div className="csv-no-file" style={{ color: 'var(--danger, #EF4444)' }}>{parseError}</div>
            )}
            {rows.length === 0 && !parsing && !parseError && (
              <div className="csv-no-file">{t.pdfImport.noFile}</div>
            )}

            {rows.length > 0 && (
              <>
                {/* ── Opening balance ─────────────────────────────────────── */}
                <div style={{
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '12px 14px', marginBottom: 12,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>
                    Opening Balance
                    {openingBalance && parseFloat(openingBalance) > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--accent)', marginLeft: 8 }}>
                        ✓ detected from PDF
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                    Your account balance <em>before</em> these transactions began.
                    It will be imported as a "Balance Forward" income entry so your running total starts correctly.
                    Leave blank to skip.
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      value={openingCurrency}
                      onChange={e => setOpeningCurrency(e.target.value)}
                      style={{ fontSize: 13, padding: '5px 8px', background: 'var(--bg-2)', color: 'var(--text-1)', border: '1px solid var(--border)', borderRadius: 6 }}
                    >
                      {['BOB', 'USD', 'ARS', 'MXN'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 5,420.00"
                      value={openingBalance}
                      onChange={e => setOpeningBalance(e.target.value)}
                      style={{
                        flex: 1, fontSize: 13, padding: '5px 8px',
                        background: 'var(--bg-2)', color: 'var(--text-1)',
                        border: '1px solid var(--border)', borderRadius: 6,
                      }}
                    />
                    {openingBalance && (
                      <button
                        onClick={() => setOpeningBalance('')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                        title="Clear"
                      >×</button>
                    )}
                  </div>
                </div>

                {/* ── Transaction preview ─────────────────────────────────── */}
                <div className="csv-col-map-title" style={{ marginBottom: 8 }}>
                  {t.pdfImport.preview} ({rows.length} rows — {selectedRows.length} selected)
                </div>
                <div className="csv-preview-wrap">
                  <table className="csv-preview-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Type</th>
                        <th>{t.pdfImport.category}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => {
                        const cats = row.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
                        return (
                          <tr key={i} style={{ opacity: row.selected ? 1 : 0.4 }}>
                            <td>
                              <input type="checkbox" checked={row.selected} onChange={() => toggleRow(i)} />
                            </td>
                            <td>{row.date}</td>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.description}>
                              {row.description}
                            </td>
                            <td style={{ color: row.type === 'income' ? 'var(--income)' : 'var(--expense)' }}>
                              {row.type === 'income' ? '+' : '−'}{row.amount.toLocaleString()} {row.currency}
                            </td>
                            <td>{row.type}</td>
                            <td>
                              <select
                                value={row.category}
                                onChange={e => setCategory(i, e.target.value)}
                                style={{ fontSize: 12, padding: '2px 4px', background: 'var(--bg-2)', color: 'var(--text-1)', border: '1px solid var(--border)', borderRadius: 4 }}
                              >
                                {cats.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {importing && (
                  <div className="csv-import-progress">
                    <div className="csv-progress-bar">
                      <div className="csv-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="csv-progress-label">{t.pdfImport.importing} {progress}%</div>
                  </div>
                )}
              </>
            )}

            <div className="modal-foot">
              <button className="btn-cancel" onClick={onClose}>{t.pdfImport.cancel}</button>
              <button
                className="btn-save"
                onClick={handleImport}
                disabled={(selectedRows.length === 0 && !hasOpeningBalance) || importing}
              >
                {importing
                  ? t.pdfImport.importing
                  : `${t.pdfImport.importBtn} (${selectedRows.length + (hasOpeningBalance ? 1 : 0)})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
