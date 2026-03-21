'use client';

import { useState } from 'react';

interface ConfigSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export default function ConfigSection({ title, description, defaultOpen = true, children }: ConfigSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`admin-config-section ${!open ? 'admin-config-section-collapsed' : ''}`}>
      <button
        type="button"
        className="admin-config-section-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 'inherit', font: 'inherit', color: 'inherit' }}
      >
        <div>
          <div className="admin-config-section-title">{title}</div>
          {description && <div className="admin-config-section-desc">{description}</div>}
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: '18px', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          &#9662;
        </span>
      </button>
      <div className="admin-config-section-body">
        {children}
      </div>
    </div>
  );
}
