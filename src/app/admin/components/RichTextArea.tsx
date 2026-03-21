'use client';

import { useId } from 'react';

interface RichTextAreaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  minHeight?: string;
  maxLength?: number;
  placeholder?: string;
  markdown?: boolean;
}

export default function RichTextArea({
  label, value, onChange, rows = 4, minHeight = '120px',
  maxLength, placeholder, markdown,
}: RichTextAreaProps) {
  const id = useId();

  return (
    <div className="admin-form-group">
      <label htmlFor={id} className="admin-form-label">{label}</label>
      <textarea
        id={id}
        className="admin-form-input admin-rich-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        dir="auto"
        placeholder={placeholder}
        maxLength={maxLength}
        style={{ minHeight }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        {markdown && (
          <span className="admin-form-description">Supports Discord formatting</span>
        )}
        {maxLength != null && (
          <span className="admin-form-description" style={{ marginLeft: 'auto' }}>
            {value.length.toLocaleString()} / {maxLength.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
