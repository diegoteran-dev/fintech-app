import { useState, useEffect } from 'react';
import { generateInviteLink, rotateInviteCode } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function InviteManager() {
  const { user } = useAuth();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user?.is_admin) return null;

  useEffect(() => {}, []); // mount anchor for hooks

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const r = await generateInviteLink();
      setLink(r.url);
      // Auto-copy the link
      await navigator.clipboard.writeText(r.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setError('Could not generate invite link');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRotate = async () => {
    setRotating(true);
    setLink(null);
    try {
      await rotateInviteCode();
    } catch {
      setError('Could not rotate invite code');
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="card-title" style={{ marginBottom: 4 }}>Invite Link</div>
      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
        Generate a one-time invite link (expires in 7 days, single use). The raw invite code is never exposed in the URL.
      </div>

      {error && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary btn-sm" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating…' : '+ Generate Invite Link'}
          </button>
          <button className="btn-ghost btn-sm" onClick={handleRotate} disabled={rotating} title="Invalidate all existing invite codes">
            {rotating ? 'Rotating…' : '↻ Rotate Code'}
          </button>
        </div>

        {link && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <code style={{
              flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 12px',
              fontSize: 12, color: 'var(--text-2)', fontFamily: 'monospace',
            }}>
              {link}
            </code>
            <button className="btn-ghost btn-sm" onClick={handleCopy} style={{ flexShrink: 0 }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
