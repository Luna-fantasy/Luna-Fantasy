'use client';

interface Props {
  value: number;
  onChange: (next: number) => void;
  unit?: string | null;
  min: number;
  max: number;
  step?: number;
}

export default function SliderNumberInput({ value, onChange, unit, min, max, step = 1 }: Props) {
  const v = Number.isFinite(value) ? value : min;
  const clamped = Math.min(Math.max(v, min), max);
  const pct = ((clamped - min) / (max - min)) * 100;

  return (
    <div className="av-games-field-control av-games-slider-wrap">
      <input
        className="av-games-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamped}
        style={{ ['--slider-fill' as any]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <input
        className="av-games-field-input av-games-field-input--num av-games-slider-num"
        type="number"
        value={clamped}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = e.target.value === '' ? min : Number(e.target.value);
          onChange(Math.min(Math.max(n, min), max));
        }}
      />
      {unit && <span className="av-games-field-unit">{unit}</span>}
    </div>
  );
}
