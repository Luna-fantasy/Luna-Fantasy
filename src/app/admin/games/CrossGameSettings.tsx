'use client';

import ChannelChips from '../_components/ChannelChips';

interface Props {
  botLabel: string;
  allowedChannels: string[];
  voteDuration: number;
  onAllowedChannelsChange: (next: string[]) => void;
  onVoteDurationChange: (next: number) => void;
}

export default function CrossGameSettings({
  botLabel,
  allowedChannels,
  voteDuration,
  onAllowedChannelsChange,
  onVoteDurationChange,
}: Props) {
  return (
    <section className="av-games-cross">
      <header className="av-games-cross-head">
        <h3 className="av-games-cross-title">Cross-game settings</h3>
        <p className="av-games-cross-hint">
          Applies to every {botLabel} game, not just this one.
        </p>
      </header>

      <div className="av-games-cross-body">
        <div className="av-games-field av-games-field--full">
          <div className="av-games-field-head">
            <label className="av-games-field-label">Allowed channels (all games)</label>
            <p className="av-games-field-help">
              Restrict every game to these channels. Leave empty to allow any channel.
            </p>
          </div>
          <ChannelChips value={allowedChannels} onChange={onAllowedChannelsChange} />
        </div>

        <div className="av-games-field av-games-field--card">
          <div className="av-games-field-head">
            <label className="av-games-field-label">Vote duration</label>
            <p className="av-games-field-help">
              Seconds a `votegame` poll stays open before tallying.
            </p>
          </div>
          <div className="av-games-field-control">
            <input
              className="av-games-field-input av-games-field-input--num"
              type="number"
              min={5}
              max={600}
              step={5}
              value={voteDuration}
              onChange={(e) => onVoteDurationChange(Number(e.target.value))}
            />
            <span className="av-games-field-unit">seconds</span>
          </div>
        </div>
      </div>
    </section>
  );
}
