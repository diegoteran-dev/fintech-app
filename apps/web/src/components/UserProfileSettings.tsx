import { useState } from 'react';
import { useUserProfile } from '../hooks/useUserProfile';

const COUNTRIES = [
  'Bolivia', 'Argentina', 'Mexico', 'Brazil', 'Colombia', 'Peru',
  'Chile', 'Venezuela', 'Ecuador', 'Paraguay', 'Uruguay',
  'United States', 'Other',
];

export default function UserProfileSettings() {
  const { profile, setProfile } = useUserProfile();
  const [age, setAge] = useState(String(profile.age));
  const [country, setCountry] = useState(profile.country);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const parsedAge = parseInt(age, 10);
    if (!parsedAge || parsedAge < 1 || parsedAge > 120) return;
    setProfile({ age: parsedAge, country });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="card-title" style={{ marginBottom: 4 }}>Your Profile</div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
        Used by the Portfolio Planner and Inflation Tracker to personalize recommendations.
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ flex: '0 0 100px' }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Age</div>
          <input
            className="form-input"
            type="number"
            min={1}
            max={120}
            value={age}
            onChange={e => setAge(e.target.value)}
            style={{ width: '100%' }}
          />
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

      <button className="btn-primary" style={{ width: '100%' }} onClick={handleSave}>
        {saved ? '✓ Saved' : 'Save Profile'}
      </button>
    </div>
  );
}
