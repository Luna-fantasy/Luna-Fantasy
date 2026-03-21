'use client';

import { useState } from 'react';

interface Props {
  discordId: string;
  currentLevel: number;
  onSuccess: () => void;
}

export default function LevelModifier({ discordId, currentLevel, onSuccess }: Props) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string; levelBefore?: number; levelAfter?: number } | null>(null);

  const getCsrfToken = () => {
    const match = document.cookie.match(/bazaar_csrf=([^;]+)/);
    return match?.[1] ?? '';
  };

  const submit = async () => {
    const numAmount = parseInt(amount);
    if (!numAmount || !Number.isFinite(numAmount)) { setResult({ error: 'Enter a valid integer' }); return; }
    if (reason.trim().length < 3) { setResult({ error: 'Reason must be at least 3 characters' }); return; }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/admin/users/${discordId}/level`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': getCsrfToken(),
        },
        body: JSON.stringify({ amount: numAmount, reason: reason.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data.error });
        return;
      }

      setResult({ success: true, levelBefore: data.levelBefore, levelAfter: data.levelAfter });
      setAmount('');
      setReason('');
      onSuccess();
    } catch {
      setResult({ error: 'Request failed' });
    } finally {
      setLoading(false);
    }
  };

  const preview = parseInt(amount) || 0;
  const previewAfter = currentLevel + preview;

  return (
    <div className="admin-stat-card">
      <h3 className="admin-section-title">Modify Level</h3>

      <div className="admin-form-grid-2col">
        <div>
          <label className="admin-label">Amount (positive = increase, negative = decrease)</label>
          <input
            type="number"
            className="admin-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 5 or -3"
            step="1"
          />
        </div>
        <div>
          <label className="admin-label">Reason (required)</label>
          <input
            type="text"
            className="admin-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you modifying the level?"
          />
        </div>
      </div>

      {preview !== 0 && (
        <div className="admin-balance-preview">
          <span className="admin-balance-preview-label">Preview: </span>
          <span className="admin-balance-preview-current">Lv.{currentLevel}</span>
          <span className={`admin-balance-preview-delta ${preview > 0 ? 'positive' : 'negative'}`}>
            {preview > 0 ? '+' : ''}{preview}
          </span>
          <span className="admin-balance-preview-equals">=</span>
          <span className={`admin-balance-preview-total ${previewAfter < 0 ? 'negative' : ''}`}>
            Lv.{previewAfter}
          </span>
        </div>
      )}

      <button
        className="admin-btn admin-btn-primary"
        onClick={submit}
        disabled={loading || !amount || !Number.isFinite(parseInt(amount)) || parseInt(amount) === 0 || reason.trim().length < 3}
      >
        {loading ? 'Processing...' : 'Apply'}
      </button>

      {result && (
        <p className={`admin-inline-result ${result.error ? 'error' : 'success'}`}>
          {result.error ?? `Level updated: ${result.levelBefore} -> ${result.levelAfter}`}
        </p>
      )}
    </div>
  );
}
