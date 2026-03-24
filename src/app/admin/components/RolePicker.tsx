'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useGuildData, type GuildRole } from '../utils/useGuildData';

interface RolePickerProps {
  label: string;
  description?: string;
  value: string | string[];
  onChange: (val: string | string[]) => void;
  multi?: boolean;
  placeholder?: string;
  compact?: boolean;
}

function roleColor(color: number): string {
  if (!color) return '#6b7280';
  return `#${color.toString(16).padStart(6, '0')}`;
}

export default function RolePicker({
  label, description, value, onChange, multi = false, placeholder, compact = false,
}: RolePickerProps) {
  const { roles, loading, error } = useGuildData();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const ids = multi ? (Array.isArray(value) ? value : [value].filter(Boolean)) : [];
  const singleId = multi ? '' : (Array.isArray(value) ? value[0] ?? '' : value ?? '');

  // Calculate position when opening
  useLayoutEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, [open]);

  // Focus search
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  // Close on outside click (check both wrapper AND portal dropdown)
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const inWrap = wrapRef.current?.contains(target);
      const inDrop = dropRef.current?.contains(target);
      if (!inWrap && !inDrop) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on scroll
  useEffect(() => {
    if (!open) return;
    const handleScroll = () => setOpen(false);
    const scrollParent = document.querySelector('.admin-content') || window;
    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollParent.removeEventListener('scroll', handleScroll);
  }, [open]);

  const roleMap = new Map<string, GuildRole>();
  for (const r of roles) roleMap.set(r.id, r);

  const filtered = roles.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  function resolveRole(id: string): { name: string; color: string; missing: boolean } {
    const r = roleMap.get(id);
    if (r) return { name: r.name, color: roleColor(r.color), missing: false };
    return { name: id, color: '#6b7280', missing: true };
  }

  function handleSelect(roleId: string) {
    if (multi) {
      const arr = Array.isArray(value) ? value : [value].filter(Boolean);
      if (arr.includes(roleId)) {
        onChange(arr.filter((id) => id !== roleId));
      } else {
        onChange([...arr, roleId]);
      }
    } else {
      onChange(roleId === singleId ? '' : roleId);
      setOpen(false);
      setSearch('');
    }
  }

  function handleRemove(roleId: string) {
    if (multi) {
      const arr = Array.isArray(value) ? value : [value].filter(Boolean);
      onChange(arr.filter((id) => id !== roleId));
    } else {
      onChange('');
    }
  }

  function renderPortalDropdown() {
    return createPortal(
      <div
        ref={dropRef}
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: Math.max(pos.width, 240),
          zIndex: 999999,
        }}
      >
        <div className="admin-picker-dropdown">
          <input
            ref={searchRef}
            type="text"
            className="admin-picker-search"
            placeholder="Search roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setOpen(false); setSearch(''); } }}
          />
          <div className="admin-picker-list">
            {error ? (
              <div className="admin-picker-empty" style={{ color: '#f43f5e' }}>Failed to load roles.</div>
            ) : loading ? (
              <div className="admin-picker-empty">Loading roles...</div>
            ) : filtered.length === 0 ? (
              <div className="admin-picker-empty">No roles found</div>
            ) : (
              filtered.map((r) => {
                const selected = multi ? ids.includes(r.id) : singleId === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`admin-picker-item ${selected ? 'admin-picker-item-selected' : ''}`}
                    onClick={() => handleSelect(r.id)}
                  >
                    <span className="admin-role-dot" style={{ background: roleColor(r.color) }} />
                    <span className="admin-picker-item-name">{r.name}</span>
                    {r.managed && <span className="admin-picker-badge">Bot</span>}
                    {selected && <span className="admin-picker-check">&#10003;</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // Compact mode (for ConfigTable cells)
  if (compact) {
    const resolved = singleId ? resolveRole(singleId) : null;
    return (
      <div ref={wrapRef} style={{ position: 'relative' }}>
        <button
          ref={triggerRef}
          type="button"
          className={`admin-form-input admin-picker-trigger ${open ? 'admin-picker-open' : ''}`}
          onClick={() => setOpen(!open)}
          style={{ padding: '6px 10px', fontSize: '13px', width: '100%', textAlign: 'left' }}
        >
          {resolved ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="admin-role-dot" style={{ background: resolved.color }} />
              <span style={{ opacity: resolved.missing ? 0.5 : 1 }}>{resolved.name}</span>
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>{placeholder || 'Select role'}</span>
          )}
        </button>
        {open && renderPortalDropdown()}
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
            const r = resolveRole(id);
            return (
              <span key={id} className="admin-picker-chip">
                <span className="admin-role-dot" style={{ background: r.color }} />
                <span style={{ opacity: r.missing ? 0.5 : 1 }}>{r.name}</span>
                <button type="button" className="admin-picker-chip-remove" onClick={() => handleRemove(id)} title="Remove">&times;</button>
              </span>
            );
          })}
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        className={`admin-picker-trigger ${open ? 'admin-picker-open' : ''}`}
        onClick={() => setOpen(!open)}
      >
        {!multi && singleId ? (() => {
          const r = resolveRole(singleId);
          return (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
              <span className="admin-role-dot" style={{ background: r.color }} />
              <span style={{ opacity: r.missing ? 0.5 : 1 }}>{r.name}</span>
            </span>
          );
        })() : (
          <span style={{ color: 'var(--text-muted)', flex: 1 }}>
            {loading ? 'Loading roles...' : (placeholder || (multi ? 'Click to add roles' : 'Select a role'))}
          </span>
        )}
        <span className="admin-picker-arrow">&#9662;</span>
      </button>

      {open && renderPortalDropdown()}
    </div>
  );
}
