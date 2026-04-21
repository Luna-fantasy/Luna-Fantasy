'use client';

import { useRef, type ReactNode } from 'react';
import Icon from './Icon';
import type { IconName } from './nav-config';
import Counter from './Counter';
import Sparkline from './Sparkline';
import Tooltip from './Tooltip';
import CopyValue from './CopyValue';

export type StatTone = 'cyan' | 'purple' | 'gold' | 'green' | 'red';

const TONE_COLOR: Record<StatTone, string> = {
  cyan:   '#00d4ff',
  purple: '#8b5cf6',
  gold:   '#ffd700',
  green:  '#4ade80',
  red:    '#f43f5e',
};

interface StatCardProps {
  label: string;
  value: number | ReactNode;
  icon: IconName;
  tone?: StatTone;
  meta?: ReactNode;
  trend?: { dir: 'up' | 'down' | 'flat'; label: string };
  spark?: number[];
  hint?: string;             // tooltip definition
  copyable?: boolean;        // if true and value is number, click copies raw
  decimals?: number;
  format?: (n: number) => string;
}

export default function StatCard({
  label, value, icon, tone = 'cyan', meta, trend, spark, hint, copyable, decimals = 0, format,
}: StatCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty('--mx', `${x}%`);
    el.style.setProperty('--my', `${y}%`);
  };

  const isNumber = typeof value === 'number';
  const valueNode = isNumber
    ? <Counter value={value as number} decimals={decimals} format={format} />
    : value;

  const renderedValue = isNumber && copyable
    ? <CopyValue value={value as number} label={label.toLowerCase()}>{valueNode}</CopyValue>
    : valueNode;

  const labelNode = (
    <div className="av-stat-label">
      <Icon name={icon} size={14} />
      <span>{label}</span>
    </div>
  );

  return (
    <div
      ref={ref}
      className="av-stat"
      style={{ ['--av-tone' as any]: TONE_COLOR[tone] }}
      onMouseMove={onMove}
    >
      <div className="av-stat-head">
        {hint ? (
          <Tooltip content={hint} delay={200}>{labelNode}</Tooltip>
        ) : labelNode}
        {spark && spark.length >= 2 && (
          <div className="av-stat-spark">
            <Sparkline data={spark} width={80} height={26} tone={TONE_COLOR[tone]} />
          </div>
        )}
      </div>
      <div className="av-stat-value">{renderedValue}</div>
      {(meta || trend) && (
        <div className="av-stat-meta">
          {trend && (
            <span className="av-stat-trend" data-dir={trend.dir}>
              {trend.dir === 'up' ? '▲' : trend.dir === 'down' ? '▼' : '·'} {trend.label}
            </span>
          )}
          {meta && <span>{meta}</span>}
        </div>
      )}
    </div>
  );
}
