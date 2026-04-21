'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * InlineEdit — click-to-edit text/number field with optimistic save and undo.
 * Consumer passes `initial`, `onSave(next)` (async) — component handles:
 *   - toggle edit/view
 *   - Enter saves, Escape cancels
 *   - optimistic state with rollback on error
 *   - parent-provided `format()` for display rendering
 */

interface InlineEditProps<T extends string | number> {
  initial: T;
  type?: 'text' | 'number';
  format?: (v: T) => string;
  validate?: (v: T) => string | null; // returns error message or null
  onSave: (next: T) => Promise<void>;
  'aria-label'?: string;
}

export default function InlineEdit<T extends string | number>({
  initial, type = 'text', format, validate, onSave,
  'aria-label': ariaLabel,
}: InlineEditProps<T>) {
  const [value, setValue] = useState<T>(initial);
  const [draft, setDraft] = useState<string>(String(initial));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setValue(initial); setDraft(String(initial)); }, [initial]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const parse = (s: string): T => (type === 'number' ? Number(s) : s) as T;

  const commit = async () => {
    const parsed = parse(draft);
    if (type === 'number' && !Number.isFinite(parsed as number)) {
      setError('Invalid number'); return;
    }
    const err = validate?.(parsed);
    if (err) { setError(err); return; }
    if (parsed === value) { setEditing(false); return; }

    const prev = value;
    setValue(parsed);
    setEditing(false);
    setSaving(true);
    try {
      await onSave(parsed);
      setError(null);
    } catch (e) {
      setValue(prev);
      setDraft(String(prev));
      setError((e as Error).message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(String(value));
    setEditing(false);
    setError(null);
  };

  if (!editing) {
    return (
      <button
        type="button"
        className={`av-inline${saving ? ' av-inline--saving' : ''}${error ? ' av-inline--error' : ''}`}
        onClick={() => setEditing(true)}
        aria-label={ariaLabel}
        title={error ?? 'Click to edit'}
      >
        <span>{format ? format(value) : String(value)}</span>
        {saving && <span className="av-inline-spinner" aria-hidden="true" />}
      </button>
    );
  }

  return (
    <span className="av-inline av-inline--editing">
      <input
        ref={inputRef}
        type={type}
        className="av-inline-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') cancel();
        }}
        onBlur={commit}
        aria-label={ariaLabel}
      />
    </span>
  );
}
