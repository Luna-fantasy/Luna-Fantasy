'use client';

import { useEffect, useMemo, useState } from 'react';

interface HeatmapData {
  days: number;
  from: string;
  buckets: number[];
  max: number;
  total: number;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ActivityHeatmap({ discordId }: { discordId: string }) {
  const [data, setData] = useState<HeatmapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/users/${discordId}/heatmap`, { cache: 'no-store' })
      .then(async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => { cancelled = true; };
  }, [discordId]);

  const { weeks, monthTicks } = useMemo(() => {
    if (!data) return { weeks: [] as number[][], monthTicks: [] as { label: string; col: number }[] };

    const fromDate = new Date(data.from);
    const startDow = fromDate.getDay(); // 0 = Sun
    // Build columns (weeks): each week is 7 days starting on Sunday
    const padded = new Array(startDow).fill(-1).concat(data.buckets);
    const weekCount = Math.ceil(padded.length / 7);
    const weeks: number[][] = [];
    for (let w = 0; w < weekCount; w++) {
      weeks.push(padded.slice(w * 7, w * 7 + 7));
    }

    const monthTicks: { label: string; col: number }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < weeks.length; w++) {
      const dayIdxInWeek0 = w * 7 - startDow; // day offset in bucket
      if (dayIdxInWeek0 < 0 || dayIdxInWeek0 >= data.buckets.length) continue;
      const d = new Date(fromDate.getTime() + dayIdxInWeek0 * 86400_000);
      if (d.getMonth() !== lastMonth) {
        monthTicks.push({ label: MONTH_LABELS[d.getMonth()], col: w });
        lastMonth = d.getMonth();
      }
    }

    return { weeks, monthTicks };
  }, [data]);

  if (error) return <div className="av-flows-empty">Failed to load heatmap: {error}</div>;
  if (!data) return <div className="av-flows-empty">Loading heatmap…</div>;
  if (data.total === 0) return <div className="av-flows-empty">No activity recorded for this user.</div>;

  const cellSize = 10;
  const cellGap = 2;
  const leftPad = 22; // day labels
  const topPad = 16;  // month labels
  const width = leftPad + weeks.length * (cellSize + cellGap);
  const height = topPad + 7 * (cellSize + cellGap);

  const intensity = (count: number): number => {
    if (count <= 0) return 0;
    const normalized = Math.log(count + 1) / Math.log(data.max + 1);
    return Math.min(1, normalized);
  };

  const fromDate = new Date(data.from);

  return (
    <div className="av-heatmap">
      <div className="av-heatmap-meta">
        <strong>{data.total.toLocaleString()}</strong> events · peak day <strong>{data.max}</strong>
      </div>
      <svg width={width} height={height} role="img" aria-label="Activity heatmap">
        {monthTicks.map((t, i) => (
          <text key={i} x={leftPad + t.col * (cellSize + cellGap)} y={10}
                fontSize="9" fill="var(--text-muted)">{t.label}</text>
        ))}
        {['Mon', 'Wed', 'Fri'].map((label, i) => (
          <text key={label} x={0} y={topPad + ((i * 2 + 1) * (cellSize + cellGap)) + 8}
                fontSize="9" fill="var(--text-muted)">{label}</text>
        ))}
        {weeks.map((week, w) => (
          week.map((count, d) => {
            if (count === -1) return null;
            const x = leftPad + w * (cellSize + cellGap);
            const y = topPad + d * (cellSize + cellGap);
            const intensity01 = intensity(count);
            const dayIdx = (w * 7 + d) - fromDate.getDay();
            const dateLabel = new Date(fromDate.getTime() + dayIdx * 86400_000).toISOString().slice(0, 10);
            return (
              <rect
                key={`${w}-${d}`}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={count === 0
                  ? 'rgba(255, 255, 255, 0.07)'
                  : `color-mix(in srgb, var(--rank-tone, var(--accent-primary)) ${Math.round(20 + intensity01 * 75)}%, transparent)`}
                stroke="rgba(255,255,255,0.04)"
              >
                <title>{dateLabel}: {count} event{count === 1 ? '' : 's'}</title>
              </rect>
            );
          })
        ))}
      </svg>
      <div className="av-heatmap-legend">
        <span>Less</span>
        {[0, 0.2, 0.45, 0.7, 1].map((i) => (
          <span key={i} className="av-heatmap-legend-swatch"
            style={{ background: i === 0 ? 'rgba(255, 255, 255, 0.07)' :
              `color-mix(in srgb, var(--rank-tone, var(--accent-primary)) ${Math.round(20 + i * 75)}%, transparent)` }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
