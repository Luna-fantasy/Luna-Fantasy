'use client';

interface Props {
  value: boolean;
  onChange: (next: boolean) => void;
  onLabel?: string;
  offLabel?: string;
}

export default function ToggleCard({ value, onChange, onLabel = 'On', offLabel = 'Off' }: Props) {
  return (
    <div className="av-games-field-control">
      <button
        type="button"
        className={`av-games-toggle${value ? ' av-games-toggle--on' : ''}`}
        onClick={() => onChange(!value)}
        aria-pressed={value}
      >
        <span className="av-games-toggle-rail" />
        <span className="av-games-toggle-knob" />
      </button>
      <span className="av-games-toggle-text">{value ? onLabel : offLabel}</span>
    </div>
  );
}
