'use client';

import { useId } from 'react';

interface PercentInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  disabled?: boolean;
}

export default function PercentInput({
  label, value, onChange, min = 0, max = 1, step = 0.01, description, disabled,
}: PercentInputProps) {
  const id = useId();
  // Use parseFloat to avoid floating-point artifacts (e.g. 0.155 * 100 = 15.499999...)
  // toFixed(10) then parseFloat strips trailing zeros while keeping precision
  const displayValue = parseFloat((value * 100).toFixed(10));
  const displayMin = parseFloat((min * 100).toFixed(10));
  const displayMax = parseFloat((max * 100).toFixed(10));
  const displayStep = parseFloat((step * 100).toFixed(10)) || 1;

  return (
    <div className="admin-number-input-wrap">
      <label htmlFor={id} className="admin-number-input-label">{label}</label>
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <input
          id={id}
          type="number"
          className="admin-number-input"
          value={displayValue}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          min={displayMin}
          max={displayMax}
          step={displayStep}
          disabled={disabled}
          style={{ paddingRight: '28px' }}
        />
        <span className="admin-percent-suffix">%</span>
      </div>
      {description && <span className="admin-number-input-desc">{description}</span>}
    </div>
  );
}
