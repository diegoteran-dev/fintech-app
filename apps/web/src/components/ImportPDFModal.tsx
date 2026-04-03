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
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; failed: number } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError('');
    setRows([]);
    setParsing(true);
    try {
      const parsed = await parsePdf(file);
      if (parsed.length === 0) {
        setParseError(t.pdfImport.noRows);
      } else {
        setRows(parsed.map(r => ({
          ...r,
          category: r.type === 'income' ? 'Other' : 'Other',
          selected: true,
        })));
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

  const handleImport = async () => {
    if (selectedRows.length === 0) return;
    setImporting(true);
    setProgress(0);
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < selectedRows.length; i++) {
      const row = selectedRows[i];
      try {
        await createTransaction({
          description: row.description,
          amount: row.amount,
          currency: row.currency,
          category: row.category,
          type: row.type,
          date: new Date(row.date + 'T12:00:00').toISOString(),
        });
        imported++;
      } catch {
        failed++;
      }
      setProgress(Math.round(((i + 1) / selectedRows.length) * 100));
    }

    setResult({ imported, failed });
    setImporting(false);
    // Don't auto-close — let the user see the result and click Close
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
                              <input
                                type="checkbox"
                                checked={row.selected}
                                onChange={() => toggleRow(i)}
                              />
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
                disabled={selectedRows.length === 0 || importing}
              >
                {importing
                  ? t.pdfImport.importing
                  : `${t.pdfImport.importBtn} (${selectedRows.length})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
