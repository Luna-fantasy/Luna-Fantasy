'use client';

import { useState, type ReactNode } from 'react';

/**
 * StructuredEditor — auto-renders any JSON shape as a button-driven form.
 *
 *   string / number / boolean → labeled input or toggle
 *   array  → repeating section with Add / Remove buttons
 *   object → collapsible group with prettified field labels
 *   null   → empty slot with "Set value" buttons
 *
 * No JSON typing required by the user. Used by Bot Config + Shops.
 */

type AnyValue = string | number | boolean | null | AnyValue[] | { [k: string]: AnyValue };

interface EditorProps {
  value: AnyValue;
  onChange: (next: AnyValue) => void;
  label?: string;
  path?: string[];
  /** Top-level uses depth=0; recursive children incremented. Drives indent + collapsibility. */
  depth?: number;
}

function inferType(v: AnyValue): 'null' | 'string' | 'number' | 'boolean' | 'array' | 'object' {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') return 'object';
  if (typeof v === 'string')  return 'string';
  if (typeof v === 'number')  return 'number';
  if (typeof v === 'boolean') return 'boolean';
  return 'null';
}

function prettyLabel(key: string): string {
  // snake_case → Title Case;  camelCase → Title Case
  const spaced = key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/(\d+)/g, ' $1');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

type ValueType = ReturnType<typeof inferType>;

function defaultForType(t: ValueType): AnyValue {
  switch (t) {
    case 'string': return '';
    case 'number': return 0;
    case 'boolean': return false;
    case 'array': return [];
    case 'object': return {};
    case 'null':
    default: return null;
  }
}

function isPlainObject(v: AnyValue): v is { [k: string]: AnyValue } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/* ─────────────── Field renderers ─────────────── */

function StringField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const isUrl = /^https?:\/\//i.test(value);
  const isLong = value.length > 60;
  return (
    <div className="av-se-field">
      {label && <label className="av-se-label">{label}</label>}
      <div className="av-se-control">
        {isLong ? (
          <textarea className="av-se-input av-se-textarea" value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
        ) : (
          <input className="av-se-input" value={value} onChange={(e) => onChange(e.target.value)} />
        )}
        {isUrl && (
          <a className="av-se-action" href={value} target="_blank" rel="noreferrer" title="Open">↗</a>
        )}
      </div>
    </div>
  );
}

function NumberField({ value, onChange, label }: { value: number; onChange: (v: number) => void; label?: string }) {
  return (
    <div className="av-se-field">
      {label && <label className="av-se-label">{label}</label>}
      <input
        className="av-se-input av-se-input--num"
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function BooleanField({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div className="av-se-field av-se-field--inline">
      {label && <label className="av-se-label av-se-label--inline">{label}</label>}
      <button
        type="button"
        className={`av-se-toggle${value ? ' av-se-toggle--on' : ''}`}
        onClick={() => onChange(!value)}
        aria-pressed={value}
      >
        <span className="av-se-toggle-knob" />
        <span className="av-se-toggle-text">{value ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}

function NullField({ onChange, label }: { onChange: (v: AnyValue) => void; label?: string }) {
  return (
    <div className="av-se-field">
      {label && <label className="av-se-label">{label}</label>}
      <div className="av-se-null-actions">
        <span className="av-se-null-text">empty</span>
        <button type="button" className="av-se-action" onClick={() => onChange('')} title="Set as text">Aa</button>
        <button type="button" className="av-se-action" onClick={() => onChange(0)} title="Set as number">123</button>
        <button type="button" className="av-se-action" onClick={() => onChange(false)} title="Set as toggle">⊙</button>
        <button type="button" className="av-se-action" onClick={() => onChange([])} title="Set as list">[ ]</button>
        <button type="button" className="av-se-action" onClick={() => onChange({})} title="Set as group">{'{ }'}</button>
      </div>
    </div>
  );
}

function ArrayField({ value, onChange, label, path, depth }: {
  value: AnyValue[];
  onChange: (v: AnyValue[]) => void;
  label?: string;
  path: string[];
  depth: number;
}) {
  const itemType = value.length > 0 ? inferType(value[0]) : 'null';
  const addItem = (t?: ValueType) => {
    const type = t ?? (itemType !== 'null' ? itemType : 'string');
    const head = value[0];
    const newItem = type === 'object' && isPlainObject(head)
      ? Object.fromEntries(Object.keys(head).map((k) => [k, defaultForType(inferType(head[k]))]))
      : defaultForType(type);
    onChange([...value, newItem]);
  };
  const removeItem = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const updateItem = (i: number, next: AnyValue) => onChange(value.map((v, idx) => idx === i ? next : v));
  const moveItem = (i: number, dir: -1 | 1) => {
    const next = [...value];
    const target = i + dir;
    if (target < 0 || target >= next.length) return;
    [next[i], next[target]] = [next[target], next[i]];
    onChange(next);
  };

  return (
    <div className={`av-se-block av-se-block--array av-se-depth-${Math.min(depth, 4)}`}>
      <div className="av-se-block-head">
        {label && <span className="av-se-block-label">{label}</span>}
        <span className="av-se-block-count">{value.length} {value.length === 1 ? 'item' : 'items'}</span>
        <div className="av-se-block-actions">
          <button type="button" className="av-se-add" onClick={() => addItem()}>+ Add</button>
        </div>
      </div>

      {value.length === 0 && (
        <div className="av-se-empty av-se-empty--cta">
          <div className="av-se-empty-icon" aria-hidden="true">≡</div>
          <div className="av-se-empty-text">
            <strong>Empty list</strong>
            <span>Add the first item — pick the kind below.</span>
          </div>
          <div className="av-se-empty-buttons">
            <button type="button" className="av-se-add-inline" onClick={() => addItem('string')}>+ Text</button>
            <button type="button" className="av-se-add-inline" onClick={() => addItem('number')}>+ Number</button>
            <button type="button" className="av-se-add-inline" onClick={() => addItem('boolean')}>+ Toggle</button>
            <button type="button" className="av-se-add-inline" onClick={() => addItem('object')}>+ Group</button>
          </div>
        </div>
      )}

      <div className="av-se-list">
        {value.map((item, i) => (
          <div key={i} className="av-se-list-row">
            <div className="av-se-list-row-grip">
              <button type="button" onClick={() => moveItem(i, -1)} disabled={i === 0} title="Move up">↑</button>
              <span className="av-se-list-idx">{i + 1}</span>
              <button type="button" onClick={() => moveItem(i, 1)} disabled={i === value.length - 1} title="Move down">↓</button>
            </div>
            <div className="av-se-list-row-body">
              <StructuredEditor
                value={item}
                onChange={(next) => updateItem(i, next)}
                path={[...path, String(i)]}
                depth={depth + 1}
              />
            </div>
            <button
              type="button"
              className="av-se-remove"
              onClick={() => removeItem(i)}
              title="Remove this item"
            >×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ObjectField({ value, onChange, label, path, depth }: {
  value: { [k: string]: AnyValue };
  onChange: (v: { [k: string]: AnyValue }) => void;
  label?: string;
  path: string[];
  depth: number;
}) {
  const [collapsed, setCollapsed] = useState(depth >= 2 && Object.keys(value).length > 6);
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState('');

  const setKey = (key: string, next: AnyValue) => onChange({ ...value, [key]: next });
  const removeKey = (key: string) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };
  const renameKey = (oldKey: string, newKey: string) => {
    if (!newKey.trim() || newKey === oldKey || (newKey in value)) return;
    const next: { [k: string]: AnyValue } = {};
    for (const k of Object.keys(value)) {
      if (k === oldKey) next[newKey] = value[oldKey];
      else next[k] = value[k];
    }
    onChange(next);
  };

  const addField = () => {
    // Auto-slug human-typed names: "Daily Reward" → "daily_reward"
    const slug = newKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!slug || slug in value) return;
    onChange({ ...value, [slug]: '' });
    setNewKey('');
    setAdding(false);
  };

  const keys = Object.keys(value);

  return (
    <div className={`av-se-block av-se-block--object av-se-depth-${Math.min(depth, 4)}`}>
      <div className="av-se-block-head">
        <button
          type="button"
          className="av-se-collapse"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >{collapsed ? '▸' : '▾'}</button>
        {label && <span className="av-se-block-label">{label}</span>}
        <span className="av-se-block-count">{keys.length} {keys.length === 1 ? 'field' : 'fields'}</span>
        {!collapsed && (
          <div className="av-se-block-actions">
            <button type="button" className="av-se-add" onClick={() => setAdding((a) => !a)}>
              {adding ? 'Cancel' : '+ Add field'}
            </button>
          </div>
        )}
      </div>

      {!collapsed && adding && (
        <div className="av-se-add-row">
          <div className="av-se-add-row-input">
            <span className="av-se-add-row-hint">Field name</span>
            <input
              className="av-se-input"
              placeholder="e.g. Daily reward"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addField(); if (e.key === 'Escape') { setAdding(false); setNewKey(''); } }}
              autoFocus
            />
            {newKey && newKey !== newKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') && (
              <span className="av-se-add-row-slug">stored as <code>{newKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}</code></span>
            )}
          </div>
          <button type="button" className="av-se-add" onClick={addField} disabled={!newKey.trim() || (newKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') in value)}>Add field</button>
          <button type="button" className="av-btn av-btn-ghost" onClick={() => { setAdding(false); setNewKey(''); }}>Cancel</button>
        </div>
      )}

      {!collapsed && keys.length === 0 && !adding && (
        <div className="av-se-empty av-se-empty--cta">
          <div className="av-se-empty-icon" aria-hidden="true">＋</div>
          <div className="av-se-empty-text">
            <strong>Empty group</strong>
            <span>Add a field to get started — like a price, a name, or a setting.</span>
          </div>
          <button type="button" className="av-se-add" onClick={() => setAdding(true)}>+ Add first field</button>
        </div>
      )}

      {!collapsed && keys.length > 0 && (
        <div className="av-se-fields">
          {keys.map((key) => (
            <FieldRow
              key={key}
              fieldKey={key}
              value={value[key]}
              onChange={(next) => setKey(key, next)}
              onRename={(nk) => renameKey(key, nk)}
              onRemove={() => removeKey(key)}
              path={[...path, key]}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  string: 'Text',
  number: 'Number',
  boolean: 'Toggle',
  array: 'List',
  object: 'Group',
  null: 'Empty',
};

function FieldRow({ fieldKey, value, onChange, onRename, onRemove, path, depth }: {
  fieldKey: string;
  value: AnyValue;
  onChange: (next: AnyValue) => void;
  onRename: (nk: string) => void;
  onRemove: () => void;
  path: string[];
  depth: number;
}) {
  const [renaming, setRenaming] = useState(false);
  const [tempKey, setTempKey] = useState(fieldKey);
  const type = inferType(value);
  const isComplex = type === 'object' || type === 'array';

  const labelEl = renaming ? (
    <input
      className="av-se-key-edit"
      value={tempKey}
      onChange={(e) => setTempKey(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { onRename(tempKey); setRenaming(false); }
        if (e.key === 'Escape') { setTempKey(fieldKey); setRenaming(false); }
      }}
      onBlur={() => { onRename(tempKey); setRenaming(false); }}
      autoFocus
    />
  ) : (
    <button type="button" className="av-se-key" onClick={() => { setTempKey(fieldKey); setRenaming(true); }} title="Click to rename">
      <span className="av-se-key-pretty">{prettyLabel(fieldKey)}</span>
      <span className={`av-se-type-pill av-se-type-pill--${type}`}>{TYPE_LABELS[type]}</span>
    </button>
  );

  return (
    <div className={`av-se-row av-se-row--${type}${isComplex ? ' av-se-row--complex' : ''}`}>
      <div className="av-se-row-head">
        {labelEl}
        <button type="button" className="av-se-remove av-se-remove--small" onClick={onRemove} title="Remove this field">×</button>
      </div>
      <div className="av-se-row-body">
        <StructuredEditor value={value} onChange={onChange} path={path} depth={depth} />
      </div>
    </div>
  );
}

/* ─────────────── Top-level dispatcher ─────────────── */

export default function StructuredEditor({ value, onChange, label, path = [], depth = 0 }: EditorProps) {
  const type = inferType(value);

  switch (type) {
    case 'null':    return <NullField label={label} onChange={onChange} />;
    case 'string':  return <StringField  label={label} value={value as string}  onChange={onChange as (v: string) => void} />;
    case 'number':  return <NumberField  label={label} value={value as number}  onChange={onChange as (v: number) => void} />;
    case 'boolean': return <BooleanField label={label} value={value as boolean} onChange={onChange as (v: boolean) => void} />;
    case 'array':   return <ArrayField   label={label} value={value as AnyValue[]} onChange={onChange as (v: AnyValue[]) => void} path={path} depth={depth} />;
    case 'object':  return <ObjectField  label={label} value={value as { [k: string]: AnyValue }} onChange={onChange as (v: { [k: string]: AnyValue }) => void} path={path} depth={depth} />;
  }
}
