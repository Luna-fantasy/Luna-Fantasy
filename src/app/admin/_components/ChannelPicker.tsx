'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGuild, type GuildChannel } from './GuildDataProvider';

const TYPE_ICON: Record<number, string> = {
  0: '#',
  2: '\u{1F50A}',
  4: '\u{1F4C1}',
  5: '\u{1F4E2}',
  15: '\u{1F4AC}',
};

interface Props {
  value: string;
  onChange: (id: string) => void;
  filter?: 'text' | 'voice' | 'category' | 'all';
  placeholder?: string;
  hideFallback?: boolean;
}

export default function ChannelPicker({ value, onChange, filter = 'all', placeholder, hideFallback }: Props) {
  const { channels, loading } = useGuild();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const filtered = useMemo(() => {
    let list = channels;
    if (filter === 'text') list = list.filter((c) => c.type === 0 || c.type === 5);
    else if (filter === 'voice') list = list.filter((c) => c.type === 2);
    else if (filter === 'category') list = list.filter((c) => c.type === 4);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.parentName.toLowerCase().includes(q));
    }
    return list;
  }, [channels, filter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, GuildChannel[]>();
    for (const ch of filtered) {
      const key = ch.parentName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ch);
    }
    return map;
  }, [filtered]);

  const resolved = useMemo(() => channels.find((c) => c.id === value), [channels, value]);

  const openDrop = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const dropH = 360;
    const fitsBelow = r.bottom + dropH + 8 < window.innerHeight;
    setPos({
      top: fitsBelow ? r.bottom + 4 : r.top - dropH - 4,
      left: r.left,
      width: Math.max(r.width, 280),
    });
    setSearch('');
    setOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (dropRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('scroll', onScroll, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const select = (id: string) => {
    onChange(id);
    setOpen(false);
    setManualMode(false);
  };

  const triggerLabel = resolved
    ? `${TYPE_ICON[resolved.type] ?? '#'} ${resolved.name}`
    : value
      ? `# ${value}`
      : (placeholder ?? 'Select channel');

  return (
    <div className="av-picker-wrap">
      <button
        ref={triggerRef}
        type="button"
        className={`av-picker-trigger${value ? ' av-picker-trigger--has-value' : ''}`}
        onClick={() => (open ? setOpen(false) : openDrop())}
      >
        <span className="av-picker-trigger-label">{triggerLabel}</span>
        <span className="av-picker-trigger-caret" aria-hidden="true">{open ? '\u25B4' : '\u25BE'}</span>
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          className="av-picker-dropdown"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <input
            ref={searchRef}
            className="av-picker-search"
            placeholder="Search channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="av-picker-list">
            {value && (
              <button type="button" className="av-picker-item av-picker-item--clear" onClick={() => select('')}>
                Clear selection
              </button>
            )}
            {Array.from(grouped.entries()).map(([cat, chs]) => (
              <div key={cat} className="av-picker-group">
                <div className="av-picker-group-header">{cat}</div>
                {chs.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    className={`av-picker-item${ch.id === value ? ' av-picker-item--selected' : ''}`}
                    onClick={() => select(ch.id)}
                  >
                    <span className="av-picker-item-icon">{TYPE_ICON[ch.type] ?? '#'}</span>
                    <span className="av-picker-item-name">{ch.name}</span>
                    {ch.id === value && <span className="av-picker-check">{'\u2713'}</span>}
                  </button>
                ))}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="av-picker-empty">
                {loading ? 'Loading channels...' : search ? 'No channels match.' : 'No channels available.'}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}

      {!hideFallback && <div className="av-picker-fallback-row">
        {manualMode ? (
          <input
            className="av-picker-fallback"
            value={value}
            placeholder="Paste channel ID"
            onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, '').slice(0, 20))}
            inputMode="numeric"
            onBlur={() => { if (!value) setManualMode(false); }}
          />
        ) : (
          <button type="button" className="av-picker-fallback-toggle" onClick={() => setManualMode(true)}>
            Or paste ID manually
          </button>
        )}
      </div>}
    </div>
  );
}
