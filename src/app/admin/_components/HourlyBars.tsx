'use client';

import { useEffect, useRef, useState } from 'react';
import Tooltip from './Tooltip';

interface HourlyBarsProps {
  data: number[]; // length 24, count per hour [0..23]
  height?: number;
}

export default function HourlyBars({ data, height = 64 }: HourlyBarsProps) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setDrawn(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  const max = Math.max(1, ...data);
  const now = new Date();
  const currentHour = now.getHours();

  return (
    <div className="av-hourly" style={{ ['--av-hourly-h' as any]: `${height}px` }}>
      <div className="av-hourly-bars">
        {data.map((v, i) => {
          const pct = v === 0 ? 0 : Math.max(6, (v / max) * 100);
          const isNow = i === currentHour;
          const label = `${i.toString().padStart(2, '0')}:00 — ${v} transaction${v === 1 ? '' : 's'}`;
          return (
            <Tooltip key={i} content={label} side="top" delay={150}>
              <div className={`av-hourly-bar${isNow ? ' av-hourly-bar--now' : ''}`}>
                <div
                  className="av-hourly-bar-fill"
                  style={{
                    height: drawn ? `${pct}%` : '0%',
                    transitionDelay: `${i * 18}ms`,
                  }}
                />
              </div>
            </Tooltip>
          );
        })}
      </div>
      <div className="av-hourly-axis">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
      </div>
    </div>
  );
}
