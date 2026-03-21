'use client';

import { useState, useRef, useEffect } from 'react';
import { CANVAS_DEFINITIONS, type CanvasTypeDef } from '@/lib/admin/canvas-definitions';

interface CanvasSelectorProps {
  activeCanvasId: string;
  onSwitch: (id: string) => void;
  getChangedCount: (id: string) => number;
}

export default function CanvasSelector({ activeCanvasId, onSwitch, getChangedCount }: CanvasSelectorProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const activeDef = CANVAS_DEFINITIONS.find(d => d.id === activeCanvasId)!;
  const butlerDefs = CANVAS_DEFINITIONS.filter(d => d.bot === 'butler');
  const jesterDefs = CANVAS_DEFINITIONS.filter(d => d.bot === 'jester');

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function handleSelect(id: string) {
    setOpen(false);
    if (id !== activeCanvasId) onSwitch(id);
  }

  function renderGroup(label: string, defs: CanvasTypeDef[], botColor: string) {
    return (
      <div className="ce-canvas-dropdown-group" key={label}>
        <div className="ce-canvas-dropdown-group-label">
          <span className="ce-canvas-dropdown-dot" style={{ background: botColor }} />
          {label}
        </div>
        {defs.map(d => {
          const count = getChangedCount(d.id);
          return (
            <button
              key={d.id}
              className={`ce-canvas-dropdown-item ${d.id === activeCanvasId ? 'ce-canvas-dropdown-item-active' : ''}`}
              onClick={() => handleSelect(d.id)}
            >
              <span className="ce-canvas-dropdown-item-label">{d.label}</span>
              <span className="ce-canvas-dropdown-meta">{d.elements.length} el</span>
              {count > 0 && <span className="ce-tab-badge">{count}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="ce-canvas-selector-wrap" ref={wrapRef}>
      <button className="ce-canvas-selector" onClick={() => setOpen(!open)}>
        <span
          className="ce-canvas-dropdown-dot"
          style={{ background: activeDef.bot === 'butler' ? '#00d4ff' : '#8b5cf6' }}
        />
        <span className="ce-canvas-selector-label">{activeDef.label}</span>
        <span className={`ce-canvas-selector-chevron ${open ? 'ce-open' : ''}`}>{'\u25BE'}</span>
      </button>

      {open && (
        <div className="ce-canvas-dropdown">
          {renderGroup('Butler', butlerDefs, '#00d4ff')}
          {renderGroup('Jester', jesterDefs, '#8b5cf6')}
        </div>
      )}
    </div>
  );
}
