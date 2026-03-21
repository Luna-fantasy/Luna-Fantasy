'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import AdminLightbox from '../components/AdminLightbox';

interface R2Object {
  key: string;
  size: number;
  lastModified: string;
  url: string;
}

interface BrowseResult {
  folders: string[];
  objects: R2Object[];
  truncated: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  'butler/': 'Butler Bot',
  'canvas-backgrounds/': 'Canvas Backgrounds',
  'cards/': 'CCG Cards',
  'games/': 'Game Assets',
  'LunaPairs/': 'Luna Pairs (Faction War)',
  'stickers/': 'Stickers',
  'stones/': 'Stones',
  'jester/': 'Jester Bot',
};

function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(key: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp|svg|ico)$/i.test(key);
}

function getFolderName(prefix: string): string {
  const parts = prefix.replace(/\/$/, '').split('/');
  return parts[parts.length - 1] || prefix;
}

function getBreadcrumbs(prefix: string): { label: string; prefix: string }[] {
  const crumbs: { label: string; prefix: string }[] = [{ label: 'Assets', prefix: '' }];
  if (!prefix) return crumbs;
  const parts = prefix.replace(/\/$/, '').split('/');
  let accumulated = '';
  for (const part of parts) {
    accumulated += part + '/';
    crumbs.push({ label: part, prefix: accumulated });
  }
  return crumbs;
}

export default function AssetsPage() {
  const [browseResult, setBrowseResult] = useState<BrowseResult>({ folders: [], objects: [], truncated: false });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [filterText, setFilterText] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<R2Object | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadKey, setUploadKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedKey, setCopiedKey] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inlineFileInputRef = useRef<HTMLInputElement>(null);
  const swapInputRef = useRef<HTMLInputElement>(null);
  const [swapTarget, setSwapTarget] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const fetchBrowse = useCallback(async (prefix: string) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ mode: 'browse' });
      if (prefix) params.set('prefix', prefix);
      const res = await fetch(`/api/admin/assets?${params}`);
      if (!res.ok) {
        const data = await res.json();
        if (data.configured === false) { setConfigured(false); return; }
        throw new Error(data.error || 'Failed to load');
      }
      const data: BrowseResult = await res.json();
      setBrowseResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBrowse(currentPrefix); }, [currentPrefix, fetchBrowse]);

  function navigateTo(prefix: string) {
    setFilterText('');
    setCurrentPrefix(prefix);
  }

  async function handleUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large (max 10MB)');
      return;
    }

    const customKey = uploadKey.trim();
    const key = customKey
      ? (currentPrefix && !customKey.startsWith(currentPrefix) ? currentPrefix + customKey : customKey)
      : currentPrefix + file.name;

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('key', key);

      const res = await fetch('/api/admin/assets/upload', {
        method: 'POST',
        headers: { 'x-csrf-token': getCsrfToken() },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      const data = await res.json();
      setSuccess(`Uploaded: ${data.url}`);
      setUploadKey('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchBrowse(currentPrefix);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSwap(file: File, existingKey: string) {
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large (max 10MB)');
      return;
    }

    setSwapping(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('key', existingKey);

      const res = await fetch('/api/admin/assets/upload', {
        method: 'POST',
        headers: { 'x-csrf-token': getCsrfToken() },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Swap failed');
      }

      setSuccess(`Replaced: ${existingKey}`);
      fetchBrowse(currentPrefix);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSwapping(false);
      setSwapTarget(null);
      if (swapInputRef.current) swapInputRef.current.value = '';
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setError('');
    try {
      const res = await fetch('/api/admin/assets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ key: deleteConfirm.key }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }
      setBrowseResult((prev) => ({
        ...prev,
        objects: prev.objects.filter((o) => o.key !== deleteConfirm.key),
      }));
      setSuccess(`Deleted: ${deleteConfirm.key}`);
      setDeleteConfirm(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  }

  function copyUrl(url: string, key: string) {
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      setError('Folder name can only contain letters, numbers, hyphens, and underscores');
      return;
    }
    setCreatingFolder(true);
    setError('');
    try {
      const prefix = currentPrefix + name + '/';
      const res = await fetch('/api/admin/assets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': getCsrfToken() },
        body: JSON.stringify({ action: 'create_folder', prefix }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create folder');
      }
      setSuccess(`Folder "${name}" created`);
      setNewFolderName('');
      setShowNewFolder(false);
      fetchBrowse(currentPrefix);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingFolder(false);
    }
  }

  const filteredFolders = filterText
    ? browseResult.folders.filter((f) => getFolderName(f).toLowerCase().includes(filterText.toLowerCase()))
    : browseResult.folders;

  const filteredObjects = filterText
    ? browseResult.objects.filter((o) => {
        const name = o.key.split('/').pop() ?? o.key;
        return name.toLowerCase().includes(filterText.toLowerCase());
      })
    : browseResult.objects;

  const breadcrumbs = getBreadcrumbs(currentPrefix);

  if (!configured) {
    return (
      <>
        <div className="admin-page-header">
          <h1 className="admin-page-title"><span className="emoji-float">📁</span> Assets (R2)</h1>
          <p className="admin-page-subtitle">Image manager for Cloudflare R2 bucket</p>
        </div>
        <div className="admin-alert admin-alert-error">
          R2 is not configured. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY to your .env.local file.
        </div>
      </>
    );
  }

  return (
    <>
      <div className="admin-page-header">
        <h1 className="admin-page-title"><span className="emoji-float">📁</span> Assets (R2)</h1>
        <p className="admin-page-subtitle">Image manager for Cloudflare R2 bucket</p>
      </div>

      {error && <div className="admin-alert admin-alert-error">{error}</div>}
      {success && <div className="admin-alert admin-alert-success">{success}</div>}

      {/* Upload section */}
      <div className="admin-card" style={{ marginBottom: '24px' }}>
        <h3 className="admin-card-title" style={{ marginBottom: '16px' }}>Upload</h3>
        <div
          className={`admin-upload-zone ${dragOver ? 'admin-upload-zone-active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
            borderRadius: '8px',
            padding: '32px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'border-color 0.2s',
            marginBottom: '12px',
          }}
        >
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Drop file here or click to browse (max 10MB)
          </p>
          {currentPrefix && (
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
              Uploads to: {currentPrefix}
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label">Custom key (optional — defaults to {currentPrefix || ''}filename)</label>
          <input
            className="admin-form-input"
            value={uploadKey}
            onChange={(e) => setUploadKey(e.target.value)}
            placeholder={currentPrefix ? `${currentPrefix}my-image.png` : 'e.g. cards/legendary/luna-sentinel.png'}
          />
        </div>
        {uploading && <p style={{ color: 'var(--accent-primary)', marginTop: '8px' }}>Uploading...</p>}
      </div>

      {/* Browse section */}
      <div className="admin-card">
        {/* Breadcrumbs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.prefix} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {i > 0 && <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>/</span>}
              {i === breadcrumbs.length - 1 ? (
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{crumb.label}</span>
              ) : (
                <button
                  onClick={() => navigateTo(crumb.prefix)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    padding: '2px 4px',
                    borderRadius: '4px',
                  }}
                >
                  {crumb.label}
                </button>
              )}
            </span>
          ))}
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            className="admin-form-input"
            style={{ flex: 1 }}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="🔍 Filter by name..."
          />
          <button
            className="admin-btn admin-btn-primary admin-btn-sm"
            onClick={() => inlineFileInputRef.current?.click()}
          >
            + Add File
          </button>
          <input
            ref={inlineFileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              if (inlineFileInputRef.current) inlineFileInputRef.current.value = '';
            }}
          />
          <button
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => setShowNewFolder(!showNewFolder)}
          >
            + New Folder
          </button>
          {currentPrefix && (
            <button
              className="admin-btn admin-btn-ghost"
              onClick={() => navigateTo('')}
            >
              Back to root
            </button>
          )}
        </div>

        {showNewFolder && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
            <input
              className="admin-form-input"
              style={{ maxWidth: '300px' }}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="folder-name"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
              autoFocus
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              in {currentPrefix || '/'}
            </span>
            <button
              className="admin-btn admin-btn-primary admin-btn-sm"
              onClick={handleCreateFolder}
              disabled={creatingFolder || !newFolderName.trim()}
            >
              {creatingFolder ? 'Creating...' : 'Create'}
            </button>
            <button
              className="admin-btn admin-btn-ghost admin-btn-sm"
              onClick={() => { setShowNewFolder(false); setNewFolderName(''); }}
            >
              Cancel
            </button>
          </div>
        )}

        {loading ? (
          <div className="admin-empty"><p>Loading...</p></div>
        ) : filteredFolders.length === 0 && filteredObjects.length === 0 ? (
          <div className="admin-empty"><p>No items found{currentPrefix ? ` in "${currentPrefix}"` : ''}</p></div>
        ) : (
          <>
            {/* Folders */}
            {filteredFolders.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Folders ({filteredFolders.length})
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                  {filteredFolders.map((folder) => {
                    const name = getFolderName(folder);
                    const label = CATEGORY_LABELS[folder] || name;
                    return (
                      <button
                        key={folder}
                        onClick={() => navigateTo(folder)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '12px 14px',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          background: 'var(--bg-deep)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--accent-primary)';
                          e.currentTarget.style.background = 'var(--bg-void)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border-subtle)';
                          e.currentTarget.style.background = 'var(--bg-deep)';
                        }}
                      >
                        <span style={{ fontSize: '22px', flexShrink: 0 }}>&#128193;</span>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
                          {label !== name && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{name}/</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Files */}
            {filteredObjects.length > 0 && (
              <>
                <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Files ({filteredObjects.length})
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {filteredObjects.map((obj) => {
                    const fileName = obj.key.split('/').pop() ?? obj.key;
                    return (
                      <div
                        key={obj.key}
                        style={{
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          background: 'var(--bg-deep)',
                        }}
                      >
                        <div
                          style={{
                            height: '120px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--bg-void)',
                            cursor: isImage(obj.key) ? 'pointer' : 'default',
                          }}
                          onClick={() => isImage(obj.key) && setPreviewUrl(obj.url)}
                        >
                          {isImage(obj.key) ? (
                            <img
                              src={obj.url}
                              alt={fileName}
                              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                              loading="lazy"
                            />
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '32px' }}>&#128196;</span>
                          )}
                        </div>
                        <div style={{ padding: '8px' }}>
                          <p style={{ fontSize: '12px', fontWeight: 500, wordBreak: 'break-all', marginBottom: '4px' }} title={obj.key}>
                            {fileName.length > 30 ? '...' + fileName.slice(-27) : fileName}
                          </p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {formatSize(obj.size)}
                          </p>
                          <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                            <button
                              className="admin-btn admin-btn-ghost admin-btn-sm"
                              onClick={() => copyUrl(obj.url, obj.key)}
                              style={{ fontSize: '11px', flex: 1 }}
                            >
                              {copiedKey === obj.key ? 'Copied!' : '📋 Copy URL'}
                            </button>
                            <button
                              className="admin-btn admin-btn-ghost admin-btn-sm"
                              onClick={() => { setSwapTarget(obj.key); swapInputRef.current?.click(); }}
                              disabled={swapping}
                              title={`Replace ${obj.key} with a new file`}
                              style={{ fontSize: '11px' }}
                            >
                              {swapping && swapTarget === obj.key ? '...' : '🔄 Swap'}
                            </button>
                            <button
                              className="admin-btn admin-btn-danger admin-btn-sm"
                              onClick={() => setDeleteConfirm(obj)}
                              style={{ fontSize: '11px' }}
                            >
                              🗑️ Del
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {browseResult.truncated && (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '12px', textAlign: 'center' }}>
                Showing first {browseResult.objects.length} files. Narrow your search to see more.
              </p>
            )}
          </>
        )}
      </div>

      {/* Image preview modal */}
      <AdminLightbox isOpen={previewUrl !== null} onClose={() => setPreviewUrl(null)} size="xl">
        {previewUrl && (
          <div style={{ textAlign: 'center' }}>
            <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '8px' }} />
            <div style={{ marginTop: '8px' }}>
              <button className="admin-btn admin-btn-ghost" onClick={() => setPreviewUrl(null)}>Close</button>
            </div>
          </div>
        )}
      </AdminLightbox>

      <input
        ref={swapInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && swapTarget) handleSwap(f, swapTarget);
          if (swapInputRef.current) swapInputRef.current.value = '';
        }}
      />

      {deleteConfirm && (
        <ConfirmModal
          title="Delete Asset"
          message={`Are you sure you want to delete "${deleteConfirm.key}"? This cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </>
  );
}
