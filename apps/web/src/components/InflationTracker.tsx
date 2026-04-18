import { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { getInflation, type InflationData } from '../services/api';
import { loadProfile } from '../hooks/useUserProfile';

const LATAM_COUNTRIES: { code: string; name: string }[] = [
  { code: 'BO', name: 'Bolivia' },
  { code: 'AR', name: 'Argentina' },
  { code: 'MX', name: 'Mexico' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PE', name: 'Peru' },
  { code: 'CL', name: 'Chile' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'US', name: 'United States' },
];

const COUNTRY_TO_CODE: Record<string, string> = {
  'Bolivia': 'BO', 'Argentina': 'AR', 'Mexico': 'MX', 'Brazil': 'BR',
  'Colombia': 'CO', 'Peru': 'PE', 'Chile': 'CL', 'Venezuela': 'VE',
  'Ecuador': 'EC', 'Paraguay': 'PY', 'Uruguay': 'UY', 'United States': 'US',
};

function inflationColor(rate: number | null): string {
  if (rate === null) return 'var(--text-3)';
  if (rate > 50) return '#EF4444';
  if (rate > 20) return '#F97316';
  if (rate > 10) return '#F59E0B';
  if (rate > 4)  return '#EAB308';
  return '#10B981';
}

function inflationLabel(rate: number | null): string {
  if (rate === null) return 'No data';
  if (rate > 50) return 'Hyperinflation';
  if (rate > 20) return 'Very High';
  if (rate > 10) return 'High';
  if (rate > 4)  return 'Elevated';
  return 'Moderate';
}

const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-name">{label}</div>
      <div style={{ color: inflationColor(payload[0].value), fontSize: 13, fontWeight: 600 }}>
        {payload[0].value?.toFixed(1)}% inflation
      </div>
    </div>
  );
};

export default function InflationTracker() {
  const profile = loadProfile();
  const defaultCode = COUNTRY_TO_CODE[profile.country] ?? 'BO';
  const [countryCode, setCountryCode] = useState(defaultCode);
  const [data, setData] = useState<InflationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getInflation(countryCode)
      .then(setData)
      .finally(() => setLoading(false));
  }, [countryCode]);

  const rate = data?.latest_rate ?? null;
  const color = inflationColor(rate);

  // Purchasing power: $1000 eroded over history
  const purchasingPower = (() => {
    if (!data?.history?.length) return [];
    let value = 1000;
    return data.history.map(d => {
      value = value / (1 + d.rate / 100);
      return { year: d.year, value: Math.round(value) };
    });
  })();

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="card-title" style={{ marginBottom: 2 }}>Inflation Tracker</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
            Annual CPI inflation — World Bank data
          </div>
        </div>
        <select
          className="tx-filter-select"
          value={countryCode}
          onChange={e => setCountryCode(e.target.value)}
          style={{ width: 160 }}
        >
          {LATAM_COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 32 }}>Loading…</div>
      ) : !data || rate === null ? (
        <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 32 }}>No inflation data available.</div>
      ) : (
        <>
          {/* Big rate card */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160, padding: '16px 20px', background: `color-mix(in srgb, ${color} 10%, transparent)`, borderRadius: 12, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)` }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>
                {data.country_name} · {data.latest_year}
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color, letterSpacing: '-1px' }}>
                {rate.toFixed(1)}%
              </div>
              <div style={{ fontSize: 12, color, fontWeight: 600, marginTop: 2 }}>
                {inflationLabel(rate)}
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 160, padding: '16px 20px', background: 'var(--bg-2)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>
                Purchasing power of $1,000
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
                ${purchasingPower[purchasingPower.length - 1]?.value ?? 1000}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                after {data.history.length} years of inflation
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 160, padding: '16px 20px', background: 'color-mix(in srgb, #10B981 8%, transparent)', borderRadius: 12, border: '1px solid color-mix(in srgb, #10B981 25%, transparent)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>
                S&P 500 avg. annual return
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#10B981', letterSpacing: '-1px' }}>
                10%
              </div>
              <div style={{ fontSize: 12, color: '#10B981', fontWeight: 600, marginTop: 2 }}>
                {rate < 10 ? `+${(10 - rate).toFixed(1)}% real return` : `Inflation exceeds market avg.`}
              </div>
            </div>
          </div>

          {/* Inflation history chart */}
          {data.history.length >= 2 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                Annual Inflation History
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data.history} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="year" tick={{ fill: 'var(--text-2)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-2)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={45} />
                  <Tooltip content={<ChartTip />} />
                  <ReferenceLine y={10} stroke="#EF4444" strokeDasharray="4 3" strokeWidth={1} label={{ value: '10%', fill: '#EF4444', fontSize: 10, position: 'right' }} />
                  <ReferenceLine y={4} stroke="#10B981" strokeDasharray="4 3" strokeWidth={1} label={{ value: '4%', fill: '#10B981', fontSize: 10, position: 'right' }} />
                  <Line type="monotone" dataKey="rate" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} name="Inflation" />
                </LineChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                Red dashed = 10% threshold (above S&P 500 avg). Green dashed = 4% (target for healthy economies). Source: World Bank.
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
