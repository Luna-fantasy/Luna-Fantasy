'use client';

import { useState } from 'react';
import AdminLightbox from './AdminLightbox';

interface DiffEntry {
  label: string;
  before: string;
  after: string;
}

interface SaveDeployBarProps {
  hasChanges: boolean;
  saving: boolean;
  deploying?: boolean;
  onSave: () => void;
  onSaveAndDeploy?: () => void;
  onDiscard?: () => void;
  projectName?: string;
  validationErrors?: boolean;
  diff?: DiffEntry[];
}

export default function SaveDeployBar({
  hasChanges,
  saving,
  onSave,
  onDiscard,
  projectName,
  validationErrors,
  diff,
}: SaveDeployBarProps) {
  const [showDiff, setShowDiff] = useState(false);

  if (!hasChanges) return null;

  return (
    <>
      <div className="admin-save-bar">
        <div className="admin-save-bar-info">
          You have unsaved changes{projectName ? ` to ${projectName}` : ''}
        </div>
        <div className="admin-save-bar-actions">
          {onDiscard && (
            <button
              className="admin-btn admin-btn-ghost"
              onClick={onDiscard}
              disabled={saving}
            >
              Discard
            </button>
          )}
          {diff && diff.length > 0 && (
            <button
              className="admin-btn admin-btn-ghost"
              onClick={() => setShowDiff(true)}
              disabled={saving}
            >
              Review Changes
            </button>
          )}
          <button
            className={`admin-btn admin-btn-primary ${saving ? 'admin-btn-loading' : ''}`}
            onClick={onSave}
            disabled={saving || validationErrors}
            title={validationErrors ? 'Fix validation errors before saving' : undefined}
          >
            {saving ? 'Saving...' : '💾 Save'}
          </button>
        </div>
      </div>

      {showDiff && diff && diff.length > 0 && (
        <AdminLightbox isOpen={showDiff} onClose={() => setShowDiff(false)} title="Review Changes" size="md">
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Setting</th>
                  <th style={{ textAlign: 'left' }}>Before</th>
                  <th style={{ textAlign: 'left' }}>After</th>
                </tr>
              </thead>
              <tbody>
                {diff.map((d, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, fontSize: '13px' }}>{d.label}</td>
                    <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{d.before}</td>
                    <td style={{ fontSize: '13px', color: 'var(--accent-primary)' }}>{d.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <button className="admin-btn admin-btn-ghost" onClick={() => setShowDiff(false)}>
              Close
            </button>
            <button
              className={`admin-btn admin-btn-primary ${saving ? 'admin-btn-loading' : ''}`}
              onClick={() => { setShowDiff(false); onSave(); }}
              disabled={saving || validationErrors}
            >
              {saving ? 'Saving...' : '💾 Save Changes'}
            </button>
          </div>
        </AdminLightbox>
      )}
    </>
  );
}
