'use client';

import { useEffect, useRef, useState } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  area?: boolean;
  tone?: string;
}

export default function Sparkline({ data, width = 120, height = 32, area = true, tone }: SparklineProps) {
  const [drawn, setDrawn] = useState(false);
  const pathRef = useRef<SVGPathElement | null>(null);
  const [pathLen, setPathLen] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      const len = pathRef.current.getTotalLength();
      setPathLen(len);
      // Trigger draw on next frame
      requestAnimationFrame(() => setDrawn(true));
    }
  }, [data]);

  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  const stroke = tone || 'var(--av-tone, var(--accent-primary))';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="av-sparkline"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {area && (
        <defs>
          <linearGradient id={`av-spark-fill-${data.length}-${data[0]}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {area && (
        <path d={areaPath} fill={`url(#av-spark-fill-${data.length}-${data[0]})`} opacity={drawn ? 1 : 0} style={{ transition: 'opacity 0.6s ease 0.4s' }} />
      )}
      <path
        ref={pathRef}
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: pathLen ? `${pathLen}` : undefined,
          strokeDashoffset: pathLen ? (drawn ? 0 : pathLen) : undefined,
          transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4, 0, 0.2, 1)',
          filter: `drop-shadow(0 0 4px ${stroke})`,
        }}
      />
      {/* Last point dot */}
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r="2"
        fill={stroke}
        opacity={drawn ? 1 : 0}
        style={{ transition: 'opacity 0.4s ease 0.7s' }}
      />
    </svg>
  );
}
