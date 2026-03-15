'use client';

interface SaveDeployBarProps {
  hasChanges: boolean;
  saving: boolean;
  deploying?: boolean;
  onSave: () => void;
  onSaveAndDeploy?: () => void;
  projectName?: string;
}

export default function SaveDeployBar({
  hasChanges,
  saving,
  onSave,
  projectName,
}: SaveDeployBarProps) {
  if (!hasChanges) return null;

  return (
    <div className="admin-save-bar">
      <div className="admin-save-bar-info">
        You have unsaved changes{projectName ? ` to ${projectName}` : ''}
      </div>
      <div className="admin-save-bar-actions">
        <button
          className="admin-btn admin-btn-primary"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
