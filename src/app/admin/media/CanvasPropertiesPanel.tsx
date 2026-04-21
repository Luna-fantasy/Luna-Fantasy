'use client';

import type { CanvasElementDef, CanvasTypeDef } from './types';
import { getAtPath } from './layoutPath';

interface Props {
  canvas: CanvasTypeDef;
  layout: Record<string, any>;
  activeElementId: string | null;
  onPatchElement: (elementId: string, patch: Record<string, number>) => void;
  onPatchColor: (key: string, value: string) => void;
}

const PROP_UNIT: Record<string, string> = {
  x: 'px', y: 'px',
  fontSize: 'px',
  radiusX: 'px', radiusY: 'px',
  width: 'px', height: 'px',
  startX: 'px', startY: 'px', spacing: 'px',
};

const PROP_LABEL: Record<string, string> = {
  x: 'X', y: 'Y',
  fontSize: 'Font size',
  radiusX: 'Radius X', radiusY: 'Radius Y',
  width: 'Width', height: 'Height',
  startX: 'Start X', startY: 'Start Y', spacing: 'Spacing',
};

export default function CanvasPropertiesPanel({ canvas, layout, activeElementId, onPatchElement, onPatchColor }: Props) {
  const colorsObj = (layout?.colors ?? {}) as Record<string, string>;

  const grouped = new Map<string, CanvasElementDef[]>();
  for (const el of canvas.elements) {
    if (!grouped.has(el.group)) grouped.set(el.group, []);
    grouped.get(el.group)!.push(el);
  }

  const activeEl = canvas.elements.find((e) => e.id === activeElementId) ?? null;
  const activeEntry = activeEl ? (getAtPath(layout, activeEl.id) ?? {}) : null;

  return (
    <aside className="av-canvas-props">
      <section className="av-canvas-props-section">
        <h4>Element</h4>
        {activeEl ? (
          <>
            <div className="av-canvas-props-header">
              <strong>{activeEl.label}</strong>
              <code>{activeEl.id}</code>
            </div>
            <div className="av-canvas-props-fields">
              {activeEl.props.map((prop) => (
                <label key={prop} className="av-canvas-prop-field">
                  <span>{PROP_LABEL[prop] ?? prop}</span>
                  <div className="av-canvas-prop-control">
                    <input
                      type="number"
                      className="av-games-field-input av-games-field-input--num"
                      value={Number(activeEntry?.[prop] ?? 0)}
                      step={prop === 'fontSize' ? 1 : 2}
                      onChange={(e) => onPatchElement(activeEl.id, { [prop]: Number(e.target.value) || 0 })}
                    />
                    {PROP_UNIT[prop] && <span className="av-games-field-unit">{PROP_UNIT[prop]}</span>}
                  </div>
                </label>
              ))}
            </div>
          </>
        ) : (
          <p className="av-canvas-props-empty">Pick an element on the stage or from the list below to tweak its position.</p>
        )}
      </section>

      <section className="av-canvas-props-section">
        <h4>Colours</h4>
        {canvas.colorKeys.length === 0 && <p className="av-canvas-props-empty">No colour slots for this canvas.</p>}
        <div className="av-canvas-props-colors">
          {canvas.colorKeys.map((c) => (
            <label key={c.key} className="av-canvas-color-row">
              <span>{c.label}</span>
              <div className="av-canvas-color-control">
                <input
                  type="color"
                  value={(colorsObj[c.key] ?? c.default).slice(0, 7)}
                  onChange={(e) => onPatchColor(c.key, e.target.value)}
                />
                <input
                  type="text"
                  className="av-games-field-input av-games-field-input--mono"
                  value={colorsObj[c.key] ?? c.default}
                  onChange={(e) => onPatchColor(c.key, e.target.value)}
                />
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="av-canvas-props-section av-canvas-props-elements">
        <h4>All elements</h4>
        <div className="av-canvas-element-list">
          {Array.from(grouped.entries()).map(([group, els]) => (
            <details key={group} open={els.some((e) => e.id === activeElementId)}>
              <summary>{group} <span>{els.length}</span></summary>
              <ul>
                {els.map((el) => (
                  <li key={el.id}>
                    <button
                      type="button"
                      className={`av-canvas-element-btn${el.id === activeElementId ? ' av-canvas-element-btn--active' : ''}`}
                      onClick={() => onPatchElement(el.id, {})}
                    >
                      <span className="av-canvas-element-type" data-type={el.type}>{el.type[0]}</span>
                      <span>{el.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
    </aside>
  );
}
