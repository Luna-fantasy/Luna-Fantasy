'use client';

interface Props {
  value: string;
  onChange: (next: string) => void;
}

export default function SingleChannelInput({ value, onChange }: Props) {
  return (
    <div className="av-games-field-control">
      <span className="av-games-chip-hash" aria-hidden="true">#</span>
      <input
        className="av-games-field-input av-games-field-input--mono"
        value={value ?? ''}
        placeholder="Channel ID"
        onChange={(e) => onChange(e.target.value.trim().replace(/[^\d]/g, ''))}
        inputMode="numeric"
      />
    </div>
  );
}
