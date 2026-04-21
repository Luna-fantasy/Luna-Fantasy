'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';

interface Withdrawal {
  _id: string;
  discordId: string;
  recipientName?: string;
  amount: number;
  reason: string;
  adminName: string;
  reserveBefore?: number;
  reserveAfter?: number;
  timestamp: string;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

export default function ReservePanel({ initialReserve }: { initialReserve: number }) {
  const toast = useToast();
  const pending = usePendingAction();

  const [balance, setBalance] = useState<number>(initialReserve);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/banking/reserve', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setBalance(body.balance ?? 0);
      setWithdrawals(body.recentWithdrawals ?? []);
    } catch (e) {
      toast.show({ tone: 'error', title: 'Load failed', message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const submit = () => {
    if (!/^\d{17,20}$/.test(recipientId.trim())) {
      toast.show({ tone: 'error', title: 'Bad recipient', message: 'Discord ID must be 17-20 digits.' });
      return;
    }
    const amt = Math.floor(Number(amount));
    if (!Number.isFinite(amt) || amt < 1 || amt > 10_000_000) {
      toast.show({ tone: 'error', title: 'Bad amount', message: 'Amount must be 1 – 10,000,000.' });
      return;
    }
    if (reason.trim().length < 3) {
      toast.show({ tone: 'error', title: 'Reason required', message: 'Reason must be at least 3 chars for audit.' });
      return;
    }
    if (amt > balance) {
      toast.show({ tone: 'error', title: 'Insufficient reserve', message: `Only ${fmt(balance)} available.` });
      return;
    }

    // Double-confirm via PendingAction queue only — no native window.confirm.
    // The 5s danger-toned countdown with explicit "Withdraw" + recipient + reason
    // is stronger UX than a blocking alert, and is consistent with the rest of
    // the dashboard's destructive-action affordances.
    pending.queue({
      label: `Withdraw ${fmt(amt)} to ${recipientId}`,
      detail: `${reason} · audited, cannot be undone`,
      delayMs: 5000,
      tone: 'danger',
      run: async () => {
        try {
          const token = await fetchCsrf();
          const res = await fetch('/api/admin/banking/reserve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
            credentials: 'include',
            body: JSON.stringify({ discordId: recipientId.trim(), amount: amt, reason: reason.trim() }),
          });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
          toast.show({ tone: 'success', title: 'Withdrawn', message: `${fmt(amt)} → ${recipientId}` });
          setRecipientId('');
          setAmount(0);
          setReason('');
          await load();
        } catch (e) {
          toast.show({ tone: 'error', title: 'Withdrawal failed', message: (e as Error).message });
        }
      },
    });
  };

  return (
    <section className="av-banking-panel">
      <header className="av-banking-panel-head">
        <div>
          <h3>Luna's Bank Reserve</h3>
          <p>Avelle's vault. Withdrawals credit a user's balance and leave an audit trail.</p>
        </div>
        <div className="av-banking-reserve-balance">
          <span className="av-banking-reserve-balance-label">Current balance</span>
          <span className="av-banking-reserve-balance-value">{fmt(balance)}</span>
          <span className="av-banking-reserve-balance-unit">Lunari</span>
        </div>
      </header>

      <div className="av-banking-withdraw-form">
        <h4>Manual withdrawal</h4>
        <p className="av-banking-form-help">
          Use for rewards, compensation, or owner-approved transfers out of the reserve. Every entry is
          logged to <code>lunari_transactions</code> with your Discord ID and reason, and audited under
          <code> admin_audit_log</code>.
        </p>
        <div className="av-banking-withdraw-grid">
          <label className="av-banking-field">
            <span>Recipient Discord ID</span>
            <input
              className="av-audit-input"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value.replace(/\D/g, ''))}
              placeholder="17-20 digit Discord ID"
              inputMode="numeric"
            />
          </label>
          <label className="av-banking-field">
            <span>Amount (Lunari)</span>
            <input
              className="av-audit-input"
              type="number"
              min={1}
              max={10_000_000}
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              placeholder="e.g. 50000"
            />
          </label>
          <label className="av-banking-field" style={{ gridColumn: '1 / -1' }}>
            <span>Reason <small>· required for audit</small></span>
            <input
              className="av-audit-input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Winner of Luna Fantasy tournament"
              maxLength={500}
            />
          </label>
        </div>
        <div className="av-banking-withdraw-actions">
          <button
            type="button"
            className="av-btn av-btn-primary"
            onClick={submit}
            disabled={loading || !recipientId || !amount || !reason.trim()}
            title={!recipientId || !amount || !reason.trim() ? 'Fill every field before withdrawing' : 'Withdraw from reserve'}
          >
            ↓ Withdraw from reserve
          </button>
        </div>
      </div>

      <div className="av-banking-withdraw-history">
        <header className="av-flows-head">
          <div>
            <h4>Recent withdrawals</h4>
            <p>Last 20 reserve withdrawals. Refresh after each save.</p>
          </div>
          <button type="button" className="av-btn av-btn-ghost av-btn-sm" onClick={() => void load()} disabled={loading}>↻ Refresh</button>
        </header>
        {loading ? (
          <div className="av-commands-empty">Loading…</div>
        ) : withdrawals.length === 0 ? (
          <div className="av-flows-empty">No withdrawals yet.</div>
        ) : (
          <div className="av-banking-withdraw-list">
            {withdrawals.map((w) => (
              <div key={w._id} className="av-banking-withdraw-row">
                <div className="av-banking-withdraw-amount">
                  <strong>-{fmt(w.amount)}</strong>
                  <small>Lunari</small>
                </div>
                <div className="av-banking-withdraw-body">
                  <div className="av-banking-withdraw-recipient">
                    To <strong>{w.recipientName || w.discordId}</strong>
                    <span className="av-banking-withdraw-id">{w.discordId}</span>
                  </div>
                  <div className="av-banking-withdraw-reason">{w.reason || '(no reason)'}</div>
                  <div className="av-banking-withdraw-meta">
                    By {w.adminName || 'admin'} · {new Date(w.timestamp).toLocaleString()}
                    {typeof w.reserveAfter === 'number' && ` · reserve after: ${fmt(w.reserveAfter)}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
