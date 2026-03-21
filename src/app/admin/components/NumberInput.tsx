'use client';

import { useId, useState } from 'react';

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  disabled?: boolean;
}

export default function NumberInput({
  label, value, onChange, min, max, step = 1, description, disabled,
}: NumberInputProps) {
  const id = useId();
  const [outOfRange, setOutOfRange] = useState(false);

  function handleBlur() {
    let clamped = value;
    if (min !== undefined && clamped < min) clamped = min;
    if (max !== undefined && clamped > max) clamped = max;
    if (clamped !== value) onChange(clamped);
    setOutOfRange(false);
  }

  function handleChange(raw: number) {
    const oob = (min !== undefined && raw < min) || (max !== undefined && raw > max);
    setOutOfRange(oob);
    onChange(raw);
  }

  return (
    <div className="admin-number-input-wrap">
      <label htmlFor={id} className="admin-number-input-label">{label}</label>
      <input
        id={id}
        type="number"
        className={`admin-number-input${outOfRange ? ' admin-number-input-error' : ''}`}
        value={value}
        onChange={(e) => handleChange(Number(e.target.value))}
        onBlur={handleBlur}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      />
      {description && <span className="admin-number-input-desc">{description}</span>}
    </div>
  );
}
