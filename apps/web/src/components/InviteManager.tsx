import { useState, useEffect } from 'react';
import { getInviteCode, rotateInviteCode } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function InviteManager() {
  const { user } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only visible to admin (user id 1)
  if (!user || user.id !== 1) return null;

  useEffect(() => {
    getInviteCode()
      .then(r => setCode(r.invite_code))
      .catch(() => setError('Could not load invite code'));
  }, []);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRotate = async () => {
    setRotating(true);
    try {
      const r = await rotateInviteCode();
      setCode(r.invite_code);
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="card-title" style={{ marginBottom: 4 }}>Invite Code</div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
        Share this code with anyone you want to give access to Vault. Rotate it after use.
      </div>

      {error ? (
        <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>
      ) : code === null ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <code style={{
            flex: 1, minWidth: 160,
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 14px',
            fontSize: 16, fontWeight: 700, letterSpacing: '0.05em',
            color: 'var(--accent)', fontFamily: 'monospace',
          }}>
            {code}
          </code>
          <button className="btn-ghost btn-sm" onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <button className="btn-ghost btn-sm" onClick={handleRotate} disabled={rotating}>
            {rotating ? 'Rotating…' : '↻ Rotate'}
          </button>
        </div>
      )}
    </div>
  );
}
