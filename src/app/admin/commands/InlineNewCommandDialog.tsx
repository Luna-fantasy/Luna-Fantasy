'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Existing command ids + game-command keys — used to reject collisions */
  takenIds: Set<string>;
  /**
   * Called with a sanitized, unique id. Implementation decides how to persist
   * (add to the parent's `CommandsDoc` or POST to an API). Must be idempotent
   * if called twice with the same id.
   */
  onCreate: (id: string) => void;
  /** Called when the admin cancels or Escape-keys out. */
  onClose: () => void;
  /** Input placeholder */
  placeholder?: string;
}

/**
 * Shared "+ New command" inline input used on both /admin/commands and
 * /admin/games. Intentionally minimal — the real config editing (triggers,
 * roles, enabled) lives on the Commands page, which is where we send users
 * after creation via a toast.
 */
export default function InlineNewCommandDialog({ takenIds, onCreate, onClose, placeholder = 'new-command-id' }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const sanitized = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const disabled = !sanitized;
  const collision = sanitized && takenIds.has(sanitized);

  const commit = () => {
    if (!sanitized) return;
    if (collision) {
      setError(`"${sanitized}" already exists.`);
      return;
    }
    onCreate(sanitized);
  };

  return (
    <div className="av-commands-new-row">
      <input
        ref={inputRef}
        className="av-audit-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { setValue(e.target.value); setError(null); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') onClose();
        }}
        aria-invalid={Boolean(collision)}
        aria-describedby={error ? 'inline-new-cmd-error' : undefined}
      />
      <button type="button" className="av-btn av-btn-primary" onClick={commit} disabled={disabled || Boolean(collision)}>
        Add
      </button>
      <button type="button" className="av-btn av-btn-ghost" onClick={onClose}>
        Cancel
      </button>
      {(error || collision) && (
        <span id="inline-new-cmd-error" role="alert" className="av-commands-new-error">
          {error ?? `"${sanitized}" already exists.`}
        </span>
      )}
    </div>
  );
}
