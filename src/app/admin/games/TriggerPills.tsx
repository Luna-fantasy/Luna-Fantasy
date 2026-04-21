'use client';

interface Props {
  triggers: string[];
  enabled: boolean;
}

export default function TriggerPills({ triggers, enabled }: Props) {
  if (!triggers || triggers.length === 0) {
    return (
      <span className="av-games-triggers-empty" title="No command triggers set for this game">
        no triggers
      </span>
    );
  }

  return (
    <div className={`av-games-triggers${enabled ? '' : ' av-games-triggers--disabled'}`}>
      {triggers.map((t, i) => (
        <span key={i} className="av-games-trigger-pill" dir="auto">
          !{t}
        </span>
      ))}
    </div>
  );
}
