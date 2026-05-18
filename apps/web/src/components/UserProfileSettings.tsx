import { useState } from 'react';
import { useUserProfile, computeAge } from '../hooks/useUserProfile';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../services/auth';

const COUNTRIES = [
  'Bolivia', 'Argentina', 'Mexico', 'Brazil', 'Colombia', 'Peru',
  'Chile', 'Venezuela', 'Ecuador', 'Paraguay', 'Uruguay',
  'United States', 'Other',
];

interface Props {
  inline?: boolean;
  onSaved?: () => void;
}

export default function UserProfileSettings({ inline, onSaved }: Props = {}) {
  const { user } = useAuth();
  const { profile, setProfile } = useUserProfile(user?.id);
  const [dob, setDob] = useState(profile.dob);
  const [country, setCountry] = useState(profile.country);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const age = dob ? computeAge(dob) : null;

  const handleSave = async () => {
    if (!dob) return;
    setSaving(true);
    try {
      // Save to localStorage
      setProfile({ ...profile, dob, country });
      // Save to backend so it persists across devices
      const token = localStorage.getItem('arca_access_token');
      if (token) await updateProfile(token, { dob, country });
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // localStorage save succeeded; backend sync failed silently
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <>
      {!inline && (
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
          Used by the Portfolio Planner and Inflation Tracker to personalize recommendations.
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: '0 0 200px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
            Date of Birth
          </div>
          <input
            className="form-input"
            type="date"
            value={dob}
            max={new Date().toISOString().slice(0, 10)}
            onChange={e => setDob(e.target.value)}
            style={{ width: '100%' }}
          />
          {age !== null && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
              Age: <strong style={{ color: 'var(--text-2)' }}>{age}</strong>
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Country</div>
          <select
            className="form-select"
            value={country}
            onChange={e => setCountry(e.target.value)}
            style={{ width: '100%' }}
          >
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <button className="btn-primary" style={{ width: '100%' }} onClick={handleSave} disabled={!dob || saving}>
        {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Profile'}
      </button>
    </>
  );

  if (inline) return <div>{content}</div>;

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="card-title" style={{ marginBottom: 4 }}>Your Profile</div>
      {content}
    </div>
  );
}
