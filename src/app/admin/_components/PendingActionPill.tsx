'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePendingAction } from './PendingActionProvider';

export default function PendingActionPill() {
  const { action, cancel } = usePendingAction();
  const [mounted, setMounted] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!action) { setRemaining(0); return; }
    const tick = () => {
      const elapsed = Date.now() - action.startedAt;
      setRemaining(Math.max(0, action.delayMs - elapsed));
    };
    tick();
    const t = window.setInterval(tick, 100);
    return () => window.clearInterval(t);
  }, [action]);

  if (!mounted || !action) return null;

  const seconds = Math.ceil(remaining / 1000);
  const pct = Math.max(0, Math.min(1, remaining / action.delayMs));

  const pill = (
    <div className={`av-pending av-pending--${action.tone ?? 'default'}`} role="status">
      <div className="av-pending-ring" style={{ ['--pct' as any]: pct }} aria-hidden="true">
        <span>{seconds}</span>
      </div>
      <div className="av-pending-body">
        <div className="av-pending-label">{action.label}</div>
        {action.detail && <div className="av-pending-detail">{action.detail}</div>}
        <div className="av-pending-hint">Applying in {seconds}s · <kbd>Esc</kbd> to cancel</div>
      </div>
      <button type="button" className="av-btn av-btn-ghost" onClick={cancel}>Cancel</button>
    </div>
  );

  return createPortal(pill, document.body);
}
