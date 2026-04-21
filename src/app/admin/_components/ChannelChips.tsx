'use client';

import { useMemo } from 'react';
import { useGuild } from './GuildDataProvider';
import ChannelPicker from './ChannelPicker';

const TYPE_ICON: Record<number, string> = { 0: '#', 2: '\u{1F50A}', 4: '\u{1F4C1}', 5: '\u{1F4E2}', 15: '\u{1F4AC}' };

interface Props {
  value: string[];
  onChange: (ids: string[]) => void;
  filter?: 'text' | 'voice' | 'category' | 'all';
}

export default function ChannelChips({ value, onChange, filter }: Props) {
  const { channels } = useGuild();
  const list = Array.isArray(value) ? value : [];

  const channelMap = useMemo(() => {
    const m = new Map<string, (typeof channels)[0]>();
    for (const c of channels) m.set(c.id, c);
    return m;
  }, [channels]);

  const add = (id: string) => {
    if (!id || list.includes(id)) return;
    onChange([...list, id]);
  };
  const remove = (id: string) => onChange(list.filter((v) => v !== id));

  return (
    <div className="av-picker-chips-wrap">
      {list.length === 0 && (
        <div className="av-picker-chips-empty">Every channel allowed — add one to scope.</div>
      )}
      {list.length > 0 && (
        <div className="av-picker-chips">
          {list.map((id) => {
            const ch = channelMap.get(id);
            return (
              <span key={id} className="av-picker-chip av-picker-chip--channel" title={id}>
                <span className="av-picker-chip-icon">{ch ? (TYPE_ICON[ch.type] ?? '#') : '#'}</span>
                <span className="av-picker-chip-label">{ch ? ch.name : id}</span>
                <button
                  type="button"
                  className="av-picker-chip-remove"
                  onClick={() => remove(id)}
                  aria-label={`Remove ${ch?.name ?? id}`}
                >&times;</button>
              </span>
            );
          })}
        </div>
      )}
      <ChannelPicker value="" onChange={add} filter={filter} placeholder="+ Add channel" hideFallback />
    </div>
  );
}
