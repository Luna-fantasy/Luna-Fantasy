'use client';

import { useState, useEffect } from 'react';
import type { CanvasElementDef, ColorKeyDef } from '@/lib/admin/canvas-definitions';

const VALID_HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

// Human-readable property labels
const PROP_LABELS: Record<string, string> = {
  x: 'Horizontal Position',
  y: 'Vertical Position',
  size: 'Radius',
  radiusX: 'Horizontal Radius',
  radiusY: 'Vertical Radius',
  fontSize: 'Font Size',
  width: 'Width',
  height: 'Height',
};

// Slider range limits per property type
function getSliderRange(prop: string, canvasWidth: number, canvasHeight: number): [number, number] {
  switch (prop) {
    case 'x': return [0, canvasWidth];
    case 'y': return [0, canvasHeight];
    case 'fontSize': return [1, Math.max(200, Math.round(canvasHeight * 0.1))];
    case 'size': return [1, Math.max(500, Math.round(Math.min(canvasWidth, canvasHeight) * 0.15))];
    case 'radiusX': return [1, Math.max(500, Math.round(canvasWidth * 0.15))];
    case 'radiusY': return [1, Math.max(500, Math.round(canvasHeight * 0.15))];
    case 'width': return [1, canvasWidth];
    case 'height': return [1, canvasHeight];
    default: return [0, 1000];
  }
}

interface ElementPropertiesPanelProps {
  element: CanvasElementDef | null;
  values: Record<string, number>;
  colors: Record<string, string>;
  colorKeys: ColorKeyDef[];
  onChange: (newValues: Record<string, number>) => void;
  onColorChange: (key: string, value: string) => void;
  canvasWidth: number;
  canvasHeight: number;
  onResetElement?: () => void;
  copiedValues: Record<string, number> | null;
  onCopyPosition?: () => void;
  onPastePosition?: () => void;
  onPasteX?: () => void;
  onPasteY?: () => void;
}

// Combined slider + number input
function PropSliderInput({ label, prop, value, onChange, min, max, canvasSize }: {
  label: string;
  prop: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  canvasSize?: number;
}) {
  const showHelper = (prop === 'x' || prop === 'y') && canvasSize && canvasSize > 0;
  const pct = showHelper ? Math.round((value / canvasSize!) * 100) : 0;

  return (
    <div className="ce-prop-field">
      <label className="ce-prop-label">{label}</label>
      <div className="ce-prop-slider-row">
        <input
          type="range"
          className="ce-prop-slider"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <input
          type="number"
          className="ce-prop-input ce-prop-input-sm"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={prop === 'fontSize' || prop === 'size' || prop === 'radiusX' || prop === 'radiusY' || prop === 'width' || prop === 'height' ? 1 : undefined}
        />
      </div>
      {showHelper && (
        <span className="ce-prop-helper">
          {value}px ({pct}% from {prop === 'x' ? 'left' : 'top'})
        </span>
      )}
    </div>
  );
}

function ColorField({ ck, value, onColorChange }: {
  ck: ColorKeyDef;
  value: string;
  onColorChange: (key: string, value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  // Sync from parent (undo/redo, external changes)
  useEffect(() => { setDraft(value); }, [value]);

  const isValid = VALID_HEX.test(draft);

  function handlePickerChange(hexRgb: string) {
    // Preserve alpha suffix if current value is 8-char hex
    const alpha = (draft.length === 9 && VALID_HEX.test(draft)) ? draft.slice(7) : '';
    const newVal = hexRgb + alpha;
    setDraft(newVal);
    onColorChange(ck.key, newVal);
  }

  function handleTextChange(text: string) {
    if (!/^#[0-9a-fA-F]*$/.test(text)) return;
    setDraft(text);
    if (VALID_HEX.test(text)) {
      onColorChange(ck.key, text);
    }
  }

  return (
    <div className="ce-prop-field">
      <label className="ce-prop-label">{ck.label}</label>
      <div className="ce-color-row">
        <input
          type="color"
          className="ce-color-picker"
          value={(draft || ck.default).slice(0, 7)}
          onChange={(e) => handlePickerChange(e.target.value)}
        />
        <input
          type="text"
          className={`ce-prop-input ce-color-text ${!isValid ? 'ce-color-invalid' : ''}`}
          value={draft}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="#RRGGBB or #RRGGBBAA"
        />
      </div>
    </div>
  );
}

function ColorSection({ colorKeys, colors, onColorChange, defaultExpanded }: {
  colorKeys: ColorKeyDef[];
  colors: Record<string, string>;
  onColorChange: (key: string, value: string) => void;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Expand automatically when no element is selected (colors become primary content)
  useEffect(() => { setExpanded(defaultExpanded); }, [defaultExpanded]);

  if (colorKeys.length === 0) return null;

  return (
    <div className="ce-colors-section">
      <button className="ce-colors-toggle" onClick={() => setExpanded(!expanded)}>
        <span className={`ce-list-group-chevron ${!expanded ? 'ce-collapsed' : ''}`}>
          {'\u25B8'}
        </span>
        <span>Colors</span>
        <span className="ce-list-group-count">{colorKeys.length}</span>
      </button>
      {expanded && colorKeys.map((ck) => (
        <ColorField
          key={ck.key}
          ck={ck}
          value={colors[ck.key] || ck.default}
          onColorChange={onColorChange}
        />
      ))}
    </div>
  );
}

export default function ElementPropertiesPanel({
  element, values, colors, colorKeys, onChange, onColorChange,
  canvasWidth, canvasHeight, onResetElement,
  copiedValues, onCopyPosition, onPastePosition, onPasteX, onPasteY,
}: ElementPropertiesPanelProps) {
  if (!element) {
    return (
      <div className="ce-props-panel">
        <div className="ce-panel-title">Properties</div>
        <div className="ce-props-empty">Select an element to edit its position and size</div>
        <ColorSection
          colorKeys={colorKeys}
          colors={colors}
          onColorChange={onColorChange}
          defaultExpanded={true}
        />
      </div>
    );
  }

  function handlePropChange(prop: string, val: number) {
    onChange({ ...values, [prop]: val });
  }

  const hasCopied = copiedValues !== null;

  return (
    <div className="ce-props-panel">
      <div className="ce-panel-title">Properties</div>

      {/* Element header with name + reset */}
      <div className="ce-props-header">
        <div>
          <div className="ce-props-element-name">{element.label}</div>
          <div className="ce-props-element-type">{element.type}</div>
        </div>
        {onResetElement && (
          <button
            className="ce-props-reset-btn"
            onClick={onResetElement}
            title="Reset this element to defaults"
          >
            Reset
          </button>
        )}
      </div>

      {/* Copy/Paste bar */}
      <div className="ce-props-copy-bar">
        {onCopyPosition && (
          <button className="ce-props-copy-btn" onClick={onCopyPosition} title="Copy position values">
            Copy
          </button>
        )}
        {hasCopied && onPastePosition && (
          <button className="ce-props-copy-btn" onClick={onPastePosition} title="Paste all position values">
            Paste All
          </button>
        )}
        {hasCopied && onPasteX && (
          <button className="ce-props-copy-btn" onClick={onPasteX} title="Paste X position only">
            Paste X
          </button>
        )}
        {hasCopied && onPasteY && (
          <button className="ce-props-copy-btn" onClick={onPasteY} title="Paste Y position only">
            Paste Y
          </button>
        )}
      </div>

      {/* Property sliders */}
      <div className="ce-props-fields">
        {element.props.map((prop) => {
          const [min, max] = getSliderRange(prop, canvasWidth, canvasHeight);
          return (
            <PropSliderInput
              key={prop}
              label={PROP_LABELS[prop] || prop.charAt(0).toUpperCase() + prop.slice(1)}
              prop={prop}
              value={values[prop] ?? 0}
              onChange={(v) => handlePropChange(prop, v)}
              min={min}
              max={max}
              canvasSize={prop === 'x' ? canvasWidth : prop === 'y' ? canvasHeight : undefined}
            />
          );
        })}
      </div>

      <ColorSection
        colorKeys={colorKeys}
        colors={colors}
        onColorChange={onColorChange}
        defaultExpanded={false}
      />
    </div>
  );
}
