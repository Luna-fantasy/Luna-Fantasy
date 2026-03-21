'use client';

import { useState, useRef, useEffect } from 'react';
import { useGuildData, type GuildChannel } from '../utils/useGuildData';

interface ChannelPickerProps {
  label: string;
  description?: string;
  value: string | string[];
  onChange: (val: string | string[]) => void;
  multi?: boolean;
  channelTypes?: number[];
  placeholder?: string;
}

function channelIcon(type: number): string {
  if (type === 5) return '\ud83d\udce2'; // announcement
  if (type === 2) return '\ud83d\udd0a'; // voice
  if (type === 15) return '\ud83d\udcac'; // forum
  return '#'; // text
}

export default function ChannelPicker({
  label, description, value, onChange, multi = false, channelTypes = [0, 5], placeholder,
}: ChannelPickerProps) {
  const { channels, loading, error } = useGuildData();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const ids = multi ? (Array.isArray(value) ? value : [value].filter(Boolean)) : [];
  const singleId = multi ? '' : (Array.isArray(value) ? value[0] ?? '' : value ?? '');

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const channelMap = new Map<string, GuildChannel>();
  for (const c of channels) channelMap.set(c.id, c);

  const filtered = channels
    .filter((c) => channelTypes.includes(c.type))
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  // Group by category
  const groups: { category: string; items: GuildChannel[] }[] = [];
  const seen = new Set<string>();
  for (const ch of filtered) {
    if (!seen.has(ch.parentName)) {
      seen.add(ch.parentName);
      groups.push({ category: ch.parentName, items: [] });
    }
    groups.find((g) => g.category === ch.parentName)!.items.push(ch);
  }

  function resolveChannel(id: string): { name: string; type: number; missing: boolean } {
    const c = channelMap.get(id);
    if (c) return { name: c.name, type: c.type, missing: false };
    return { name: id, type: 0, missing: true };
  }

  function handleSelect(channelId: string) {
    if (multi) {
      const arr = Array.isArray(value) ? value : [value].filter(Boolean);
      if (arr.includes(channelId)) {
        onChange(arr.filter((id) => id !== channelId));
      } else {
        onChange([...arr, channelId]);
      }
    } else {
      onChange(channelId === singleId ? '' : channelId);
      setOpen(false);
      setSearch('');
    }
  }

  function handleRemove(channelId: string) {
    if (multi) {
      const arr = Array.isArray(value) ? value : [value].filter(Boolean);
      onChange(arr.filter((id) => id !== channelId));
    } else {
      onChange('');
    }
  }

  function renderDropdown() {
    return (
      <div className="admin-picker-dropdown">
        <input
          ref={searchRef}
          type="text"
          className="admin-picker-search"
          placeholder="Search channels..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setSearch(''); } }}
        />
        <div className="admin-picker-list">
          {error ? (
            <div className="admin-picker-empty" style={{ color: '#f43f5e' }}>
              Failed to load channels. Check Discord API connection.
            </div>
          ) : loading ? (
            <div className="admin-picker-empty">Loading channels...</div>
          ) : groups.length === 0 ? (
            <div className="admin-picker-empty">No channels found</div>
          ) : (
            groups.map((g) => (
              <div key={g.category}>
                <div className="admin-picker-group-header">{g.category}</div>
                {g.items.map((ch) => {
                  const selected = multi ? ids.includes(ch.id) : singleId === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      className={`admin-picker-item ${selected ? 'admin-picker-item-selected' : ''}`}
                      onClick={() => handleSelect(ch.id)}
                    >
                      <span className="admin-picker-channel-icon">{channelIcon(ch.type)}</span>
                      <span className="admin-picker-item-name">{ch.name}</span>
                      {selected && <span className="admin-picker-check">&#10003;</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  const displayIds = multi ? ids : (singleId ? [singleId] : []);

  return (
    <div className="admin-number-input-wrap" ref={wrapRef} style={{ position: 'relative' }}>
      {label && <label className="admin-number-input-label">{label}</label>}
      {description && <span className="admin-number-input-desc" style={{ marginBottom: '8px', display: 'block' }}>{description}</span>}

      {multi && displayIds.length > 0 && (
        <div className="admin-picker-chips">
          {displayIds.map((id) => {
            const ch = resolveChannel(id);
            return (
              <span key={id} className="admin-picker-chip">
                <span className="admin-picker-channel-icon" style={{ fontSize: '12px' }}>{channelIcon(ch.type)}</span>
                <span style={{ opacity: ch.missing ? 0.5 : 1 }}>{ch.missing ? id : ch.name}</span>
                <button type="button" className="admin-picker-chip-remove" onClick={() => handleRemove(id)} title="Remove">&times;</button>
              </span>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className={`admin-picker-trigger ${open ? 'admin-picker-open' : ''}`}
        onClick={() => setOpen(!open)}
      >
        {!multi && singleId ? (() => {
          const ch = resolveChannel(singleId);
          return (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
              <span style={{ fontSize: '13px' }}>{channelIcon(ch.type)}</span>
              <span style={{ opacity: ch.missing ? 0.5 : 1 }}>
                {ch.missing ? singleId : ch.name}
              </span>
            </span>
          );
        })() : (
          <span style={{ color: 'var(--text-muted)', flex: 1 }}>
            {loading ? 'Loading channels...' : (placeholder || (multi ? 'Click to add channels' : 'Select a channel'))}
          </span>
        )}
        <span className="admin-picker-arrow">&#9662;</span>
      </button>

      {open && renderDropdown()}
    </div>
  );
}
