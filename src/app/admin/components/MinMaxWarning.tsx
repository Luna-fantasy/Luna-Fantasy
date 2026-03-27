'use client';

export default function MinMaxWarning({ min, max, label }: { min: number; max: number; label: string }) {
  if (min == null || max == null || min <= max) return null;
  return (
    <div style={{ gridColumn: '1 / -1', padding: '8px 12px', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: '6px', fontSize: '13px', color: '#fbbf24' }}>
      {label} minimum ({min.toLocaleString()}) is higher than maximum ({max.toLocaleString()})
    </div>
  );
}
