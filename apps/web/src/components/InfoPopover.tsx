import { useState, useEffect, useRef } from 'react';

interface Props {
  title: string;
  body: string;
  align?: 'left' | 'center' | 'right';
}

export default function InfoPopover({ title, body, align = 'center' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <span ref={ref} className="pop-wrap">
      <button
        className={`pop-trigger ${open ? 'pop-trigger--open' : ''}`}
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        aria-label="More info"
        type="button"
      >
        i
      </button>
      {open && (
        <div className={`pop-bubble pop-bubble--${align}`} role="tooltip">
          <div className="pop-head">
            <span className="pop-title">{title}</span>
            <button className="pop-close" onClick={() => setOpen(false)} type="button">×</button>
          </div>
          <p className="pop-body">{body}</p>
        </div>
      )}
    </span>
  );
}
