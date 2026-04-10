import { useState, useRef } from 'react';
import { createTransaction } from '../services/api';
import { useLang } from '../context/LangContext';

interface Props {
  onClose: () => void;
  onImported: () => void;
}

type ColMap = {
  date: string;
  description: string;
  amount: string;
  type: string;
};

// ── Simple CSV parser (handles quoted fields) ──────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    rows.push(fields);
  }
  return rows;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ImportCSVModal({ onClose, onImported }: Props) {
  const { t } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [colMap, setColMap] = useState<ColMap>({ date: '', description: '', amount: '', type: '' });
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) return;
      const hdrs = parsed[0];
      setHeaders(hdrs);
      setRows(parsed.slice(1));
      // Auto-detect common column names
      const find = (keywords: string[]) =>
        hdrs.find(h => keywords.some(k => h.toLowerCase().includes(k))) ?? '';
      setColMap({
        date: find(['date', 'fecha']),
        description: find(['desc', 'memo', 'narr', 'detail', 'concepto']),
        amount: find(['amount', 'monto', 'value', 'importe', 'sum']),
        type: find(['type', 'tipo', 'kind']),
      });
    };
    reader.readAsText(file);
  };

  const colIdx = (col: string) => headers.indexOf(col);

  const canImport =
    colMap.date && colMap.description && colMap.amount && rows.length > 0;

  const handleImport = async () => {
    if (!canImport) return;
    setImporting(true);
    setProgress(0);
    let imported = 0;
    let failed = 0;

    const today = () => new Date().toISOString().slice(0, 10);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const rawDate = row[colIdx(colMap.date)] || today();
        const rawAmount = parseFloat(row[colIdx(colMap.amount)]?.replace(/[^0-9.\-]/g, '') ?? '0');
        const rawType = colMap.type ? row[colIdx(colMap.type)]?.toLowerCase() : '';
        const rawDesc = row[colIdx(colMap.description)] || 'Imported';

        let type: 'income' | 'expense';
        if (rawType.includes('income') || rawType.includes('ingreso') || rawType.includes('credit')) {
          type = 'income';
        } else if (rawType.includes('expense') || rawType.includes('gasto') || rawType.includes('debit')) {
          type = 'expense';
        } else {
          // Detect from sign
          type = rawAmount < 0 ? 'expense' : 'income';
        }

        const amount = Math.abs(rawAmount);
        if (!amount || isNaN(amount)) {
          failed++;
          continue;
        }

        const date = new Date(rawDate);
        if (isNaN(date.getTime())) {
          failed++;
          continue;
        }

        await createTransaction({
          description: rawDesc,
          amount,
          currency: 'USD',
          category: type === 'income' ? 'Other' : 'Other',
          type,
          date: date.toISOString(),
        }, true);
        imported++;
      } catch {
        failed++;
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }

    setResult({ imported, failed });
    setImporting(false);
    onImported();
  };

  const previewRows = rows.slice(0, 5);

  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal csv-modal">
        <div className="modal-head">
          <span className="modal-title">{t.csvImport.title}</span>
          <button className="modal-x" onClick={onClose}>×</button>
        </div>

        {result ? (
          <div className="csv-result">
            <div className="csv-result-title">{t.csvImport.done}</div>
            <div className="csv-result-row">
              <span className="csv-result-ok">{result.imported} {t.csvImport.imported}</span>
              {result.failed > 0 && (
                <span className="csv-result-fail">{result.failed} {t.csvImport.failed}</span>
              )}
            </div>
            <button className="btn-primary" onClick={onClose} style={{ marginTop: 16 }}>
              Close
            </button>
          </div>
        ) : (
          <>
            {/* File picker */}
            <div className="field">
              <label>{t.csvImport.selectFile}</label>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFile}
                style={{ display: 'none' }}
              />
              <button className="btn-ghost csv-file-btn" onClick={() => fileRef.current?.click()}>
                {fileName || t.csvImport.selectFile}
              </button>
            </div>

            {rows.length > 0 && (
              <>
                {/* Column mapping */}
                <div className="csv-col-map">
                  <div className="csv-col-map-title">{t.csvImport.mapColumns}</div>
                  <div className="csv-col-map-grid">
                    {(['date', 'description', 'amount', 'type'] as const).map(field => (
                      <div key={field} className="csv-col-map-row">
                        <label className="csv-col-map-label">{t.csvImport[field]}</label>
                        <select
                          className="nw-input"
                          value={colMap[field]}
                          onChange={e => setColMap(prev => ({ ...prev, [field]: e.target.value }))}
                        >
                          <option value="">—</option>
                          {headers.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  {!colMap.type && (
                    <div className="csv-type-hint">{t.csvImport.typeHint}</div>
                  )}
                </div>

                {/* Preview */}
                <div>
                  <div className="csv-col-map-title">{t.csvImport.preview} ({rows.length} rows)</div>
                  <div className="csv-preview-wrap">
                    <table className="csv-preview-table">
                      <thead>
                        <tr>
                          {headers.map(h => <th key={h}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i}>
                            {row.map((cell, j) => <td key={j}>{cell}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Progress */}
                {importing && (
                  <div className="csv-import-progress">
                    <div className="csv-progress-bar">
                      <div className="csv-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="csv-progress-label">{t.csvImport.importing} {progress}%</div>
                  </div>
                )}
              </>
            )}

            {rows.length === 0 && (
              <div className="csv-no-file">{t.csvImport.noFile}</div>
            )}

            <div className="modal-foot">
              <button className="btn-cancel" onClick={onClose}>{t.csvImport.cancel}</button>
              <button
                className="btn-save"
                onClick={handleImport}
                disabled={!canImport || importing}
              >
                {importing ? t.csvImport.importing : `${t.csvImport.importBtn} (${rows.length})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
