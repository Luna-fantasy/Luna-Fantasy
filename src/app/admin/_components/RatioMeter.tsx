'use client';

import { useEffect, useState } from 'react';

interface RatioMeterProps {
  parts: { label: string; value: number; tone?: string }[];
  total?: number;
  format?: (n: number) => string;
}

const fmt = (n: number) => n.toLocaleString('en-US');

export default function RatioMeter({ parts, total, format = fmt }: RatioMeterProps) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setDrawn(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  const sum = total ?? parts.reduce((a, p) => a + p.value, 0);
  const safeSum = sum || 1;

  return (
    <div className="av-ratio">
      <div className="av-ratio-bar">
        {parts.map((p, i) => {
          const pct = (p.value / safeSum) * 100;
          return (
            <div
              key={i}
              className="av-ratio-seg"
              style={{
                width: drawn ? `${pct}%` : '0%',
                background: p.tone ?? 'var(--accent-primary)',
                transitionDelay: `${i * 80}ms`,
              }}
              title={`${p.label}: ${format(p.value)} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <div className="av-ratio-legend">
        {parts.map((p, i) => {
          const pct = (p.value / safeSum) * 100;
          return (
            <div key={i} className="av-ratio-legend-item">
              <span className="av-ratio-dot" style={{ background: p.tone ?? 'var(--accent-primary)' }} />
              <span className="av-ratio-legend-label">{p.label}</span>
              <span className="av-ratio-legend-pct">{pct.toFixed(1)}%</span>
              <span className="av-ratio-legend-val">{format(p.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
