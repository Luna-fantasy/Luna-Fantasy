'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import ToggleCard from '../games/fields/ToggleCard';
import { onButtonKey } from '../_components/a11y';
import type { MusicTrack, VoiceMusic } from './types';

interface Props {
  data: VoiceMusic;
  onChange: (next: VoiceMusic) => void;
}

interface R2Track {
  key: string;
  url: string;
  title: string;
  sizeBytes: number;
  lastModified: string;
}

async function fetchCsrf(): Promise<string> {
  const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
  return (await res.json()).token;
}

function formatSize(n?: number): string {
  if (!n) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return '—'; }
}

export default function MusicPanel({ data, onChange }: Props) {
  const toast = useToast();
  const pending = usePendingAction();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewingKey, setPreviewingKey] = useState<string | null>(null);

  const [r2Tracks, setR2Tracks] = useState<R2Track[]>([]);
  const [r2Loading, setR2Loading] = useState(false);
  const [r2Scanned, setR2Scanned] = useState(false);

  // Migration state for the "Migrate local library" flow
  type MigrationStatus = 'uploaded' | 'skipped' | 'failed';
  interface MigrationRow { name: string; status: MigrationStatus; reason?: string }
  const [migrating, setMigrating] = useState(false);
  const [migrationRows, setMigrationRows] = useState<MigrationRow[]>([]);
  const [migrationTotal, setMigrationTotal] = useState(0);
  // Keep the actual File objects for any failed row so the Retry button can
  // re-upload without asking the admin to pick files again.
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const migrateInputRef = useRef<HTMLInputElement | null>(null);

  const tracks = Array.isArray(data?.tracks) ? data.tracks : [];
  const enabled = !!data?.enabled;
  // Defaults to true — older docs without this field stay in legacy "merge
  // local + R2" mode until an admin explicitly flips it off.
  const localEnabled = data?.localEnabled !== false;

  const trackedKeys = new Set(tracks.map((t) => t.key));
  const orphanedTracks = r2Tracks.filter((t) => !trackedKeys.has(t.key));

  const scanR2 = useCallback(async () => {
    setR2Loading(true);
    try {
      const res = await fetch('/api/admin/oracle/music/scan', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setR2Tracks(body.tracks ?? []);
      setR2Scanned(true);
    } catch (e) {
      toast.show({ tone: 'error', title: 'R2 scan failed', message: (e as Error).message });
    } finally {
      setR2Loading(false);
    }
  }, [toast]);

  useEffect(() => { void scanR2(); }, [scanR2]);

  const adoptTrack = (r2: R2Track) => {
    const newTrack: MusicTrack = {
      key: r2.key,
      url: r2.url,
      title: r2.title,
      sizeBytes: r2.sizeBytes,
      contentType: 'audio/mpeg',
      uploadedAt: r2.lastModified,
    };
    onChange({ ...data, tracks: [...tracks, newTrack] });
    toast.show({ tone: 'success', title: 'Adopted', message: r2.title });
  };

  const adoptAll = () => {
    const newTracks = orphanedTracks.map((r2) => ({
      key: r2.key,
      url: r2.url,
      title: r2.title,
      sizeBytes: r2.sizeBytes,
      contentType: 'audio/mpeg' as const,
      uploadedAt: r2.lastModified,
    }));
    onChange({ ...data, tracks: [...tracks, ...newTracks] });
    toast.show({ tone: 'success', title: 'Adopted all', message: `${newTracks.length} tracks imported` });
  };

  const upload = async (files: FileList | File[]) => {
    const filesArr = Array.from(files).filter((f) => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|opus|webm)$/i.test(f.name));
    if (filesArr.length === 0) {
      toast.show({ tone: 'error', title: 'Unsupported', message: 'Drop .mp3, .wav, .ogg, .opus, or .webm files.' });
      return;
    }
    setUploading(true);
    const uploadedTracks: MusicTrack[] = [];
    try {
      for (const file of filesArr) {
        if (file.size > 15 * 1024 * 1024) {
          toast.show({ tone: 'warn', title: 'Skipped (too large)', message: `${file.name} > 15 MB` });
          continue;
        }
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const r = String(reader.result ?? '');
            const comma = r.indexOf(',');
            resolve(comma >= 0 ? r.slice(comma + 1) : r);
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        const token = await fetchCsrf();
        const res = await fetch('/api/admin/oracle/music/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
          credentials: 'include',
          body: JSON.stringify({
            title: file.name.replace(/\.[^.]+$/, ''),
            filename: file.name,
            contentType: file.type || 'audio/mpeg',
            data: base64,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.show({ tone: 'error', title: 'Upload failed', message: `${file.name}: ${body?.error || res.status}` });
          continue;
        }
        uploadedTracks.push({
          key: body.key,
          url: body.url,
          title: body.title,
          sizeBytes: body.sizeBytes,
          contentType: body.contentType,
          uploadedAt: new Date().toISOString(),
        });
      }
      if (uploadedTracks.length > 0) {
        onChange({ ...data, tracks: [...tracks, ...uploadedTracks] });
        toast.show({ tone: 'success', title: 'Uploaded', message: `${uploadedTracks.length} track${uploadedTracks.length === 1 ? '' : 's'} added` });
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Collect MP3/etc entries from a File[] and upload them one at a time,
  // skipping any whose title already exists in the library or on R2. Feeds
  // into a visible per-row progress panel so the admin can tell what
  // succeeded, what was skipped, and what failed during a bulk migration.
  const runMigration = async (files: File[]) => {
    const audioFiles = files.filter((f) => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|opus|webm)$/i.test(f.name));
    if (audioFiles.length === 0) {
      toast.show({ tone: 'error', title: 'No audio files', message: 'No MP3 / WAV / OGG / OPUS files found in that folder.' });
      return;
    }

    const existingTitles = new Set([
      ...tracks.map((t) => t.title.toLowerCase()),
      ...r2Tracks.map((t) => t.title.toLowerCase()),
    ]);

    setMigrating(true);
    setMigrationRows([]);
    setMigrationTotal(audioFiles.length);
    setFailedFiles([]);
    const uploadedTracks: MusicTrack[] = [];
    const nextFailedFiles: File[] = [];
    // Upload endpoint rate-limits at 10/min per admin. Throttle to 1 upload
    // every 6.2s (≈ 9.6/min) so we stay under the cap and don't need to
    // retry. Small files (<3 MB) bypass the throttle since they're cheap.
    const MIN_SPACING_MS = 6_200;
    let lastUploadAt = 0;

    try {
      for (const file of audioFiles) {
        const title = file.name.replace(/\.[^.]+$/, '');

        if (existingTitles.has(title.toLowerCase())) {
          setMigrationRows((prev) => [...prev, { name: title, status: 'skipped', reason: 'already in library' }]);
          continue;
        }
        if (file.size > 15 * 1024 * 1024) {
          setMigrationRows((prev) => [...prev, { name: title, status: 'failed', reason: '> 15 MB cap' }]);
          nextFailedFiles.push(file);
          continue;
        }

        // Pace the upload to stay under the admin rate-limit
        const elapsed = Date.now() - lastUploadAt;
        if (lastUploadAt > 0 && elapsed < MIN_SPACING_MS) {
          await new Promise((r) => setTimeout(r, MIN_SPACING_MS - elapsed));
        }

        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const r = String(reader.result ?? '');
              const comma = r.indexOf(',');
              resolve(comma >= 0 ? r.slice(comma + 1) : r);
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
          });

          const token = await fetchCsrf();
          const res = await fetch('/api/admin/oracle/music/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
            credentials: 'include',
            body: JSON.stringify({
              title,
              filename: file.name,
              contentType: file.type || 'audio/mpeg',
              data: base64,
            }),
          });
          lastUploadAt = Date.now();
          const body = await res.json().catch(() => ({}));
          if (!res.ok) {
            setMigrationRows((prev) => [...prev, { name: title, status: 'failed', reason: body?.error || `HTTP ${res.status}` }]);
            nextFailedFiles.push(file);
            continue;
          }

          uploadedTracks.push({
            key: body.key,
            url: body.url,
            title: body.title,
            sizeBytes: body.sizeBytes,
            contentType: body.contentType,
            uploadedAt: new Date().toISOString(),
          });
          existingTitles.add(title.toLowerCase());
          setMigrationRows((prev) => [...prev, { name: title, status: 'uploaded' }]);
        } catch (err) {
          setMigrationRows((prev) => [...prev, { name: title, status: 'failed', reason: (err as Error).message }]);
          nextFailedFiles.push(file);
        }
      }

      setFailedFiles(nextFailedFiles);

      if (uploadedTracks.length > 0) {
        onChange({ ...data, tracks: [...tracks, ...uploadedTracks] });
        toast.show({
          tone: 'success',
          title: 'Migration complete',
          message: `${uploadedTracks.length} uploaded${nextFailedFiles.length > 0 ? ` · ${nextFailedFiles.length} failed (retry below)` : ''} · click Save to publish the library.`,
        });
      } else if (nextFailedFiles.length > 0) {
        toast.show({
          tone: 'warn',
          title: 'Every file failed',
          message: `${nextFailedFiles.length} failed. Wait ~60 s for the rate-limit window to reset, then click Retry failed.`,
        });
      } else {
        toast.show({
          tone: 'info',
          title: 'Nothing new to migrate',
          message: 'Every file was already in the library.',
        });
      }
    } finally {
      setMigrating(false);
    }
  };

  const retryFailed = useCallback(() => {
    if (failedFiles.length === 0 || migrating) return;
    const toRetry = failedFiles;
    void runMigration(toRetry);
  }, [failedFiles, migrating, runMigration]);

  const startMigration = useCallback(() => {
    // Plain multi-file picker — opens the standard Windows/macOS Open dialog
    // where MP3s render normally. We intentionally do NOT use
    // `showDirectoryPicker` or `webkitdirectory` because Windows 11's
    // folder-picker uses its Music Library view on any folder it classifies
    // as music, which hides files lacking ID3 metadata and surfaces an
    // empty "No items match your search" state instead of the real list.
    migrateInputRef.current?.click();
  }, []);

  const remove = (track: MusicTrack) => {
    pending.queue({
      label: `Delete "${track.title}"`,
      detail: 'Removes from R2 · Oracle stops playing on next sync',
      delayMs: 5000,
      tone: 'danger',
      run: async () => {
        try {
          const token = await fetchCsrf();
          const res = await fetch('/api/admin/oracle/music/upload', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
            credentials: 'include',
            body: JSON.stringify({ key: track.key }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            toast.show({ tone: 'error', title: 'Delete failed', message: body?.error || `HTTP ${res.status}` });
            return;
          }
          onChange({ ...data, tracks: tracks.filter((t) => t.key !== track.key) });
          toast.show({ tone: 'success', title: 'Removed', message: track.title });
        } catch (e) {
          toast.show({ tone: 'error', title: 'Delete failed', message: (e as Error).message });
        }
      },
    });
  };

  const rename = (track: MusicTrack, nextTitle: string) => {
    onChange({
      ...data,
      tracks: tracks.map((t) => t.key === track.key ? { ...t, title: nextTitle } : t),
    });
  };

  const totalSize = tracks.reduce((s, t) => s + (t.sizeBytes ?? 0), 0);

  return (
    <section className="av-voice-panel">
      {/* ───── Summary stats ───── */}
      <div className="av-voice-stat-summary">
        <div><strong>{tracks.length}</strong><span>Library tracks</span></div>
        <div><strong>{formatSize(totalSize)}</strong><span>Total size</span></div>
        <div><strong>{r2Scanned ? r2Tracks.length : '…'}</strong><span>On R2 CDN</span></div>
        <div><strong>{localEnabled ? 'On' : 'Off'}</strong><span>VPS local loading</span></div>
      </div>

      {/* ───── One-click migration: VPS-local MP3s → R2 ───── */}
      <article className="av-commands-card av-music-migrate-card">
        <header className="av-commands-card-head">
          <h4 className="av-sage-card-title">Migrate local library → R2</h4>
          <div style={{ display: 'flex', gap: 8 }}>
            {failedFiles.length > 0 && !migrating && (
              <button
                type="button"
                className="av-btn av-btn-ghost"
                onClick={retryFailed}
                title="Re-upload files that failed — wait ~60 s between attempts to avoid the rate limit"
              >
                ↻ Retry failed ({failedFiles.length})
              </button>
            )}
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => startMigration()}
              disabled={migrating}
            >
              {migrating
                ? `Migrating… (${migrationRows.length} / ${migrationTotal})`
                : '↗ Migrate local library'}
            </button>
          </div>
        </header>

        <div className="av-commands-banner">
          <strong>One-time pull from disk</strong>
          <span>
            Click <strong>Migrate local library</strong>, navigate to <code>LunaOracle/Music</code>, press <kbd>Ctrl+A</kbd> to select every MP3, then Open.
            Uploads are paced at ~9/min to stay under the rate limit; anything that still fails (network hiccup, server error) gets a <strong>Retry failed</strong> button.
            Duplicates are skipped. After Save and confirming playback in Discord, flip <em>Load local VPS MP3s</em> off below.
          </span>
        </div>

        {migrationRows.length > 0 && (() => {
          const counts = migrationRows.reduce(
            (acc, r) => { acc[r.status]++; return acc; },
            { uploaded: 0, skipped: 0, failed: 0 } as Record<MigrationStatus, number>,
          );
          return (
            <>
              <div className="av-music-migrate-summary" role="status">
                <span className="av-music-migrate-summary-dot" data-tone="uploaded" /> <strong>{counts.uploaded}</strong> uploaded
                <span className="av-music-migrate-summary-dot" data-tone="skipped" /> <strong>{counts.skipped}</strong> skipped
                <span className="av-music-migrate-summary-dot" data-tone="failed" /> <strong>{counts.failed}</strong> failed
                <span className="av-music-migrate-summary-total">of {migrationTotal}</span>
              </div>

              <div className="av-music-migrate-list">
                {migrationRows.map((row, i) => (
                  <div
                    key={`${row.name}-${i}`}
                    className="av-music-migrate-row"
                    data-migration-status={row.status}
                  >
                    <span className="av-music-migrate-idx">{String(i + 1).padStart(2, '0')}</span>
                    <span className="av-music-migrate-name" title={row.name}>{row.name}</span>
                    <span className="av-music-migrate-status">
                      {row.status === 'uploaded' ? '✓ uploaded' : row.status === 'skipped' ? `⤹ ${row.reason}` : `✗ ${row.reason}`}
                    </span>
                  </div>
                ))}
              </div>
            </>
          );
        })()}

        {/* Hidden multi-file picker — opens the standard OS Open dialog so
            MP3s show in a normal file list (avoids Windows 11 Music Library
            column-view quirk that hides files without ID3 tags). */}
        <input
          ref={migrateInputRef}
          type="file"
          accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/opus,audio/webm,.mp3,.wav,.ogg,.opus,.webm"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            if (files.length > 0) void runMigration(files);
            if (migrateInputRef.current) migrateInputRef.current.value = '';
          }}
        />
      </article>

      {/* ───── Migration verification banner ───── */}
      {tracks.length >= 19 && localEnabled && (
        <div className="av-commands-banner" data-tone="warn" role="status">
          <strong>Migration candidate — R2 has {tracks.length} tracks</strong>
          <span>
            Play any track from Discord (<code>!music</code>) to confirm it streams from R2.
            Then turn off <em>Load local VPS MP3s</em> below to hand music control fully to the dashboard. Files on the VPS stay as rollback.
          </span>
        </div>
      )}

      {/* ───── Orphaned R2 tracks (on CDN but not tracked) ───── */}
      {r2Scanned && orphanedTracks.length > 0 && (
        <article className="av-commands-card av-music-orphans-card">
          <header className="av-commands-card-head">
            <h4 className="av-sage-card-title">Found on R2 — not in library</h4>
            <button type="button" className="av-btn av-btn-primary" onClick={adoptAll}>
              Import all {orphanedTracks.length}
            </button>
          </header>
          <div className="av-commands-banner" data-tone="warn">
            <strong>{orphanedTracks.length} song{orphanedTracks.length === 1 ? '' : 's'}</strong>
            <span>
              {orphanedTracks.length === 1 ? 'exists' : 'exist'} on R2 CDN but {orphanedTracks.length === 1 ? "isn't" : "aren't"} tracked in the music library.
              Click <strong>Import</strong> to adopt {orphanedTracks.length === 1 ? 'it' : 'them'} — or <strong>Import all</strong> to grab everything.
            </span>
          </div>
          <div className="av-music-list">
            {orphanedTracks.map((track, i) => (
              <div key={track.key} className="av-music-row av-music-row--orphan">
                <span className="av-music-row-idx">{String(i + 1).padStart(2, '0')}</span>
                <span className="av-music-row-title av-music-row-title--static">{track.title}</span>
                <span className="av-music-row-size">{formatSize(track.sizeBytes)}</span>
                <span className="av-music-row-date">{formatDate(track.lastModified)}</span>
                <a className="av-music-row-link" href={track.url} target="_blank" rel="noreferrer" title="Open CDN URL">↗</a>
                <button
                  type="button"
                  className="av-btn av-btn-ghost av-music-adopt-btn"
                  onClick={() => adoptTrack(track)}
                >Import</button>
              </div>
            ))}
          </div>
        </article>
      )}

      {/* ───── Main library ───── */}
      <article className="av-commands-card">
        <header className="av-commands-card-head">
          <h4 className="av-sage-card-title">MP3 Music Library</h4>
          <div className="av-commands-controls" style={{ margin: 0, padding: 0, gap: 8 }}>
            <button type="button" className="av-btn av-btn-ghost" onClick={scanR2} disabled={r2Loading}>
              {r2Loading ? 'Scanning…' : '↻ Scan R2'}
            </button>
          </div>
        </header>

        <div className="av-sage-toggle-row" style={{ padding: '0 16px 12px' }}>
          <div><strong>Music enabled</strong><span>Oracle can play from this library in voice rooms.</span></div>
          <ToggleCard value={enabled} onChange={(v) => onChange({ ...data, enabled: v })} onLabel="On" offLabel="Off" />
        </div>

        <div className="av-sage-toggle-row" style={{ padding: '0 16px 12px' }}>
          <div>
            <strong>Load local VPS MP3s (fallback)</strong>
            <span>
              Keep reading <code>LunaOracle/Music/*.mp3</code> from the VPS disk.
              Turn off once migration is verified — Oracle will then play only the R2 tracks listed below.
              Flipping back on in an emergency restores local playback within ~60 s.
            </span>
          </div>
          <ToggleCard value={localEnabled} onChange={(v) => onChange({ ...data, localEnabled: v })} onLabel="On" offLabel="Off" />
        </div>

        <div className="av-commands-banner">
          <strong>How it works</strong>
          <span>
            Drag &amp; drop MP3/WAV/OGG/OPUS files here (up to 15 MB each). Uploads go to R2 at <code>oracle-music/</code>.
            Click <strong>Save</strong> to publish the library — Oracle picks it up within ~30 s via bot_config cache.
          </span>
        </div>

        <div
          className={`av-music-drop${dragOver ? ' av-music-drop--over' : ''}${uploading ? ' av-music-drop--busy' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!uploading) void upload(e.dataTransfer.files); }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onKeyDown={onButtonKey(() => { if (!uploading) fileInputRef.current?.click(); })}
          role="button"
          tabIndex={0}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/opus,audio/webm,.mp3,.wav,.ogg,.opus,.webm"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => e.target.files && upload(e.target.files)}
          />
          <div className="av-music-drop-icon">🎵</div>
          <div className="av-music-drop-title">
            {uploading ? 'Uploading…' : 'Drop MP3 files here or click to browse'}
          </div>
          <div className="av-music-drop-sub">
            Supported: MP3, WAV, OGG, OPUS, WEBM · Max 15 MB per file
          </div>
        </div>

        <div className="av-music-list-head">
          <strong>{tracks.length} track{tracks.length === 1 ? '' : 's'} in library</strong>
          {tracks.length > 0 && (
            <span className="av-music-list-total">
              {formatSize(totalSize)} total
            </span>
          )}
        </div>

        {tracks.length === 0 && (
          <div className="av-commands-empty">
            {orphanedTracks.length > 0
              ? `The library is empty — but ${orphanedTracks.length} song${orphanedTracks.length === 1 ? '' : 's'} found on R2 above. Import them to get started.`
              : 'The music library is silent — upload a song to begin.'}
          </div>
        )}

        {tracks.length > 0 && (
          <div className="av-music-list">
            {tracks.map((track, i) => (
              <div key={track.key} className="av-music-row">
                <span className="av-music-row-idx">{String(i + 1).padStart(2, '0')}</span>
                <button
                  type="button"
                  className="av-music-row-play"
                  onClick={() => setPreviewingKey(previewingKey === track.key ? null : track.key)}
                  title={previewingKey === track.key ? 'Stop preview' : 'Preview track'}
                >
                  {previewingKey === track.key ? '❙❙' : '▶'}
                </button>
                <input
                  className="av-shopf-input av-music-row-title"
                  value={track.title}
                  onChange={(e) => rename(track, e.target.value)}
                />
                <span className="av-music-row-size">{formatSize(track.sizeBytes)}</span>
                <span className="av-music-row-date">{formatDate(track.uploadedAt)}</span>
                <a className="av-music-row-link" href={track.url} target="_blank" rel="noreferrer" title="Open CDN URL">↗</a>
                <button
                  type="button"
                  className="av-commands-delete"
                  onClick={() => remove(track)}
                  title="Delete track"
                  aria-label={`Delete ${track.title}`}
                >🗑</button>
                {previewingKey === track.key && (
                  <audio
                    className="av-music-row-player"
                    src={track.url}
                    controls
                    autoPlay
                    onEnded={() => setPreviewingKey(null)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}
