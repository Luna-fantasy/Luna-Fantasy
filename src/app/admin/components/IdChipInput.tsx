'use client';

import { useState } from 'react';

interface IdChipInputProps {
  label: string;
  description?: string;
  ids: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  maxIds?: number;
}

const SNOWFLAKE_REGEX = /^\d{17,20}$/;

export default function IdChipInput({
  label,
  description,
  ids,
  onChange,
  placeholder = 'Enter a Discord ID and press Enter',
  maxIds,
}: IdChipInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const trimmed = inputValue.trim();
    if (!trimmed) return;

    if (!SNOWFLAKE_REGEX.test(trimmed)) {
      setError('Must be a valid Discord ID (17-20 digits)');
      return;
    }

    if (ids.includes(trimmed)) {
      setError('This ID is already added');
      return;
    }

    if (maxIds !== undefined && ids.length >= maxIds) {
      setError(`Maximum of ${maxIds} ID${maxIds !== 1 ? 's' : ''} allowed`);
      return;
    }

    setError('');
    onChange([...ids, trimmed]);
    setInputValue('');
  }

  function removeId(id: string) {
    onChange(ids.filter((i) => i !== id));
  }

  return (
    <div className="admin-number-input-wrap" style={{ gridColumn: '1 / -1' }}>
      <label className="admin-number-input-label">{label}</label>
      {description && <span className="admin-number-input-desc" style={{ marginBottom: '8px', display: 'block' }}>{description}</span>}

      {ids.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          {ids.map((id) => (
            <span
              key={id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '16px',
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                fontFamily: 'monospace',
              }}
            >
              {id}
              <button
                type="button"
                onClick={() => removeId(id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0',
                  fontSize: '16px',
                  lineHeight: '1',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Remove"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        className="admin-number-input"
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          if (error) setError('');
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{ width: '100%' }}
      />

      {error && (
        <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>
          {error}
        </span>
      )}
    </div>
  );
}
