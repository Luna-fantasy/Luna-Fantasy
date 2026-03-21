'use client';

import { useState, useMemo } from 'react';
import type { CanvasElementDef } from '@/lib/admin/canvas-definitions';

interface ElementListPanelProps {
  elements: CanvasElementDef[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  hiddenElements: Set<string>;
  onToggleVisibility: (id: string) => void;
}

// Inline SVG icons
function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function ElementListPanel({
  elements, selectedId, onSelect, hiddenElements, onToggleVisibility,
}: ElementListPanelProps) {
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Group elements by their group property
  const groups = useMemo(() => {
    const map: Record<string, CanvasElementDef[]> = {};
    for (const el of elements) {
      const g = el.group || 'Other';
      if (!map[g]) map[g] = [];
      map[g].push(el);
    }
    return map;
  }, [elements]);

  // Filter by search
  const query = search.toLowerCase().trim();
  const filteredGroups = useMemo(() => {
    if (!query) return groups;
    const result: Record<string, CanvasElementDef[]> = {};
    for (const [group, items] of Object.entries(groups)) {
      const filtered = items.filter(
        el => el.label.toLowerCase().includes(query) || group.toLowerCase().includes(query)
      );
      if (filtered.length > 0) result[group] = filtered;
    }
    return result;
  }, [groups, query]);

  function toggleGroup(group: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  return (
    <div className="ce-list-panel">
      <div className="ce-panel-title">Elements</div>

      {/* Search */}
      <div className="ce-list-search-wrap">
        <input
          type="text"
          className="ce-list-search"
          placeholder="Search elements..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            className="ce-list-search-clear"
            onClick={() => setSearch('')}
            title="Clear search"
          >
            &times;
          </button>
        )}
      </div>

      <div className="ce-list-scroll">
        {Object.keys(filteredGroups).length === 0 && (
          <div className="ce-list-empty">No elements match your search</div>
        )}
        {Object.entries(filteredGroups).map(([group, items]) => {
          const isCollapsed = collapsedGroups.has(group);
          const totalInGroup = groups[group]?.length ?? items.length;

          return (
            <div key={group} className="ce-list-group">
              <button
                className="ce-list-group-toggle"
                onClick={() => toggleGroup(group)}
              >
                <span className={`ce-list-group-chevron ${isCollapsed ? 'ce-collapsed' : ''}`}>
                  {'\u25B8'}
                </span>
                <span>{group}</span>
                <span className="ce-list-group-count">{totalInGroup}</span>
              </button>

              {!isCollapsed && items.map((el) => {
                const isHidden = hiddenElements.has(el.id);
                return (
                  <div
                    key={el.id}
                    className={`ce-list-item ${selectedId === el.id ? 'ce-list-item-active' : ''} ${isHidden ? 'ce-list-item-hidden' : ''}`}
                  >
                    <button
                      className="ce-list-item-btn"
                      onClick={() => onSelect(el.id)}
                    >
                      <span className={`ce-list-icon ce-list-icon-${el.type}`} />
                      <span className="ce-list-item-label">{el.label}</span>
                    </button>
                    <button
                      className="ce-list-item-visibility"
                      onClick={(e) => { e.stopPropagation(); onToggleVisibility(el.id); }}
                      title={isHidden ? 'Show element' : 'Hide element'}
                    >
                      <EyeIcon open={!isHidden} />
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
