'use client';

import { useState, useId } from 'react';

export function formatDuration(ms: number): string {
  if (ms <= 0) return '0 seconds';
  if (ms >= 86_400_000) {
    const days = Math.round(ms / 86_400_000);
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  if (ms >= 3_600_000) {
    const hours = Math.round(ms / 3_600_000);
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  if (ms >= 60_000) {
    const minutes = Math.round(ms / 60_000);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  const seconds = Math.round(ms / 1000);
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

const DURATION_UNITS = [
  { label: 'seconds', ms: 1000 },
  { label: 'minutes', ms: 60_000 },
  { label: 'hours', ms: 3_600_000 },
  { label: 'days', ms: 86_400_000 },
];

function getBestUnit(ms: number): number {
  for (let i = DURATION_UNITS.length - 1; i >= 0; i--) {
    if (ms >= DURATION_UNITS[i].ms && ms % DURATION_UNITS[i].ms === 0) return i;
  }
  return 0;
}

interface DurationInputProps {
  label: string;
  value: number;
  onChange: (ms: number) => void;
  description?: string;
}

export default function DurationInput({ label, value, onChange, description }: DurationInputProps) {
  const id = useId();
  const [unitIndex, setUnitIndex] = useState(getBestUnit(value));
  const displayValue = Math.round(value / DURATION_UNITS[unitIndex].ms);

  return (
    <div className="admin-number-input-wrap">
      <label htmlFor={id} className="admin-number-input-label">{label}</label>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          id={id}
          type="number"
          className="admin-number-input"
          style={{ flex: 1 }}
          value={displayValue}
          onChange={e => onChange(Math.max(0, Number(e.target.value)) * DURATION_UNITS[unitIndex].ms)}
          min={0}
        />
        <select
          className="admin-number-input"
          style={{ width: '120px' }}
          value={unitIndex}
          onChange={e => setUnitIndex(Number(e.target.value))}
        >
          {DURATION_UNITS.map((u, i) => (
            <option key={i} value={i}>{u.label}</option>
          ))}
        </select>
      </div>
      <span className="admin-number-input-desc">
        {formatDuration(value)}{description ? ` — ${description}` : ''}
      </span>
    </div>
  );
}
