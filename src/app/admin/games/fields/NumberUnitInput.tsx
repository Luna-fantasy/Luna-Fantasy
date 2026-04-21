'use client';

import type { FieldType } from '../game-schema';

interface Props {
  type: FieldType;
  value: number;
  onChange: (next: number) => void;
  unit?: string | null;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

/**
 * Number input with a trailing unit pill. Handles the two ms↔seconds variants
 * transparently so the UI always shows seconds but the document stores ms.
 */
export default function NumberUnitInput({ type, value, onChange, unit, min, max, step, placeholder }: Props) {
  const isMs = type === 'number-ms-as-seconds';
  const displayed = isMs ? (Number.isFinite(value) ? value / 1000 : 0) : (Number.isFinite(value) ? value : 0);
  const displayStep = step ?? (type === 'number-multiplier' ? 0.1 : 1);

  const handle = (next: number) => {
    if (!Number.isFinite(next)) next = 0;
    onChange(isMs ? Math.round(next * 1000) : next);
  };

  return (
    <div className="av-games-field-control">
      <input
        className="av-games-field-input av-games-field-input--num"
        type="number"
        value={displayed}
        min={min}
        max={max}
        step={displayStep}
        placeholder={placeholder}
        onChange={(e) => {
          const n = e.target.value === '' ? 0 : Number(e.target.value);
          handle(n);
        }}
      />
      {unit && <span className="av-games-field-unit">{unit}</span>}
    </div>
  );
}
