'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGuild, type GuildRole } from './GuildDataProvider';

function roleHex(color: number): string {
  if (!color) return '#99aab5';
  return `#${color.toString(16).padStart(6, '0')}`;
}

interface Props {
  value: string;
  onChange: (id: string) => void;
  showManaged?: boolean;
  placeholder?: string;
  hideFallback?: boolean;
}

export default function RolePicker({ value, onChange, showManaged = false, placeholder, hideFallback }: Props) {
  const { roles, loading } = useGuild();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const available = useMemo(() => {
    let list = roles;
    if (!showManaged) list = list.filter((r) => !r.managed);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }
    return list;
  }, [roles, showManaged, search]);

  const resolved = useMemo(() => roles.find((r) => r.id === value), [roles, value]);

  const openDrop = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const dropH = 360;
    const fitsBelow = r.bottom + dropH + 8 < window.innerHeight;
    setPos({
      top: fitsBelow ? r.bottom + 4 : r.top - dropH - 4,
      left: r.left,
      width: Math.max(r.width, 240),
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

  return (
    <div className="av-picker-wrap">
      <button
        ref={triggerRef}
        type="button"
        className={`av-picker-trigger${value ? ' av-picker-trigger--has-value' : ''}`}
        onClick={() => (open ? setOpen(false) : openDrop())}
      >
        {resolved && <span className="av-picker-role-dot" style={{ background: roleHex(resolved.color) }} />}
        <span className="av-picker-trigger-label">
          {resolved ? resolved.name : value ? value : (placeholder ?? 'Select role')}
        </span>
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
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="av-picker-list">
            {value && (
              <button type="button" className="av-picker-item av-picker-item--clear" onClick={() => select('')}>
                Clear selection
              </button>
            )}
            {available.map((role) => (
              <button
                key={role.id}
                type="button"
                className={`av-picker-item${role.id === value ? ' av-picker-item--selected' : ''}`}
                onClick={() => select(role.id)}
              >
                <span className="av-picker-role-dot" style={{ background: roleHex(role.color) }} />
                <span className="av-picker-item-name">{role.name}</span>
                {role.managed && <span className="av-picker-badge">Bot</span>}
                {role.id === value && <span className="av-picker-check">{'\u2713'}</span>}
              </button>
            ))}
            {available.length === 0 && (
              <div className="av-picker-empty">
                {loading ? 'Loading roles...' : search ? 'No roles match.' : 'No roles available.'}
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
            placeholder="Paste role ID"
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
