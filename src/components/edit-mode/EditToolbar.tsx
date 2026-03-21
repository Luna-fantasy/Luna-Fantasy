'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useEditMode } from '@/lib/edit-mode/context';

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export function EditToolbar() {
  const { editMode, locale, changes, clearChanges } = useEditMode();

  if (!editMode) return null;
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const changeCount = changes.size;
  const otherLocale = locale === 'en' ? 'ar' : 'en';

  const handleSave = useCallback(async () => {
    if (changeCount === 0) return;
    setSaving(true);
    setStatusMessage('');

    try {
      const formData = new FormData();

      // Collect translation changes
      const translations: { locale: string; key: string; value: string }[] = [];
      const dbFields: { collection: string; id: string; field: string; value: string }[] = [];

      changes.forEach((change) => {
        if (change.type === 'translation') {
          translations.push({ locale: change.locale, key: change.key, value: change.value });
        } else if (change.type === 'db_field') {
          dbFields.push({
            collection: change.collection,
            id: change.id,
            field: change.field,
            value: change.value,
          });
        } else if (change.type === 'image') {
          formData.append(`image_${change.id}`, change.file);
          formData.append(`image_meta_${change.id}`, JSON.stringify({
            id: change.id,
            source: change.source,
            dbCollection: change.dbCollection,
            dbId: change.dbId,
            dbField: change.dbField,
          }));
        }
      });

      if (translations.length > 0) {
        formData.append('translations', JSON.stringify(translations));
      }
      if (dbFields.length > 0) {
        formData.append('dbFields', JSON.stringify(dbFields));
      }

      const res = await fetch('/api/admin/content/save', {
        method: 'POST',
        headers: { 'x-csrf-token': getCsrfToken() },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Save failed' }));
        throw new Error(data.error || 'Save failed');
      }

      clearChanges();
      setStatusMessage('Saved successfully');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [changes, changeCount, clearChanges]);

  const handleDiscard = useCallback(() => {
    clearChanges();
    setShowDiscard(false);
    router.push('/admin/content');
  }, [clearChanges, router]);

  const handleLocaleSwitch = useCallback(() => {
    router.push(`/${otherLocale}?editMode=1`);
  }, [otherLocale, router]);

  return (
    <>
      <div className="edit-toolbar">
        <div className="edit-toolbar-left">
          <a href="/admin/content" className="edit-toolbar-back">
            &larr; Dashboard
          </a>
          <span className="edit-toolbar-label">Edit Mode</span>
          <span className="edit-locale-badge">{locale.toUpperCase()}</span>
          <button className="edit-locale-toggle" onClick={handleLocaleSwitch}>
            Switch to {otherLocale.toUpperCase()}
          </button>
        </div>

        <div className="edit-toolbar-center">
          <div className={`edit-change-badge ${changeCount > 0 ? 'has-changes' : ''}`}>
            {changeCount > 0 && <span className="edit-change-count">{changeCount}</span>}
            {changeCount === 0 ? 'No changes' : `${changeCount} unsaved change${changeCount === 1 ? '' : 's'}`}
          </div>
          {statusMessage && (
            <span style={{ fontSize: 13, color: statusMessage.startsWith('Error') ? '#f43f5e' : '#4ade80' }}>
              {statusMessage}
            </span>
          )}
        </div>

        <div className="edit-toolbar-right">
          <button
            className="edit-btn-discard"
            onClick={() => changeCount > 0 ? setShowDiscard(true) : router.push('/admin/content')}
          >
            {changeCount > 0 ? 'Discard' : 'Exit'}
          </button>
          <button
            className="edit-btn-save"
            onClick={handleSave}
            disabled={saving || changeCount === 0}
          >
            {saving ? 'Saving...' : 'Save & Publish'}
          </button>
        </div>
      </div>

      {showDiscard && (
        <div className="edit-save-overlay" onClick={() => setShowDiscard(false)}>
          <div className="edit-save-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Discard Changes?</h3>
            <p>You have {changeCount} unsaved change{changeCount === 1 ? '' : 's'}. This cannot be undone.</p>
            <div className="edit-modal-actions">
              <button className="edit-btn-discard" onClick={() => setShowDiscard(false)}>
                Cancel
              </button>
              <button
                className="edit-btn-save"
                style={{ background: '#f43f5e' }}
                onClick={handleDiscard}
              >
                Discard All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
