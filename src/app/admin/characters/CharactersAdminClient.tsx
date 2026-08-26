'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useToast } from '../_components/Toast';
import { usePendingAction } from '../_components/PendingActionProvider';
import { withBust, useBustVersion } from '@/lib/admin/cache-bust';
import { adminPost, adminPatch, adminDelete } from '@/lib/admin/http';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from '@/lib/admin/upload';

interface FactionLite {
    id: string;
    name: { en: string; ar: string };
}

interface AdminCharacter {
    _id: string | null;
    id: string;
    name: { en: string; ar: string };
    lore: { en: string; ar: string } | null;
    faction: string;
    imageUrl: string;
    isMainCharacter: boolean;
    cardId: string | null;
}

interface Props {
    initialCharacters: AdminCharacter[];
    factions: FactionLite[];
}

function emptyChar(): AdminCharacter {
    return {
        _id: null, id: '', name: { en: '', ar: '' }, lore: null,
        faction: '', imageUrl: '', isMainCharacter: false, cardId: null,
    };
}

export default function CharactersAdminClient({ initialCharacters, factions }: Props) {
    const toast = useToast();
    const pending = usePendingAction();
    const [characters, setCharacters] = useState<AdminCharacter[]>(initialCharacters);
    const [activeFaction, setActiveFaction] = useState<string>('all');
    const [search, setSearch] = useState('');
    const [editor, setEditor] = useState<{ char: AdminCharacter; mode: 'create' | 'edit' } | null>(null);
    const [busy, setBusy] = useState(false);
    const { bustVersion, bump } = useBustVersion();

    const filtered = useMemo(() => {
        let out = characters;
        if (activeFaction === 'main') {
            out = out.filter(c => c.isMainCharacter);
        } else if (activeFaction !== 'all') {
            out = out.filter(c => c.faction === activeFaction);
        }
        const q = search.trim().toLowerCase();
        if (q) {
            out = out.filter(c =>
                c.id.toLowerCase().includes(q) ||
                c.name.en.toLowerCase().includes(q) ||
                c.name.ar.toLowerCase().includes(q),
            );
        }
        return out;
    }, [characters, activeFaction, search]);

    const counts = useMemo(() => {
        const m: Record<string, number> = { all: characters.length, main: 0 };
        for (const c of characters) {
            m[c.faction] = (m[c.faction] ?? 0) + 1;
            if (c.isMainCharacter) m.main = (m.main ?? 0) + 1;
        }
        return m;
    }, [characters]);

    const save = useCallback(async (char: AdminCharacter, mode: 'create' | 'edit') => {
        setBusy(true);
        try {
            // adminPost/adminPatch check res.ok before parsing, so a 5xx with an
            // HTML body no longer surfaces as "Unexpected token < in JSON" — the
            // toast now shows the server's error string (or the HTTP status).
            const data = mode === 'create'
                ? await adminPost<{ _id?: string; retryAfterMs?: number }>('/api/admin/characters', char)
                : await adminPatch<{ _id?: string; retryAfterMs?: number }>('/api/admin/characters', char);
            setCharacters(prev => {
                if (mode === 'create') return [...prev, { ...char, _id: data?._id ?? null }];
                return prev.map(c => c.id === char.id ? char : c);
            });
            bump();
            toast.show({ tone: 'success', title: mode === 'create' ? 'Character added' : 'Character updated', message: char.name.en });
            setEditor(null);
        } catch (err) {
            const e = err as Error & { status?: number };
            const msg = e.status === 429 ? 'Rate limited — wait a moment before saving again' : e.message;
            toast.show({ tone: 'error', title: 'Save failed', message: msg });
        } finally {
            setBusy(false);
        }
    }, [toast, bump]);

    const remove = useCallback(async (char: AdminCharacter) => {
        // Themed 5s countdown with cancel instead of the native confirm() popup
        // — matches every other destructive action in the dashboard.
        setEditor(null);
        await pending.queue({
            label: `Delete "${char.name.en}"`,
            detail: 'Removes the character from the public page. This cannot be undone.',
            delayMs: 5000,
            tone: 'danger',
            run: async () => {
                setBusy(true);
                try {
                    await adminDelete(`/api/admin/characters?id=${encodeURIComponent(char.id)}`);
                    setCharacters(prev => prev.filter(c => c.id !== char.id));
                    toast.show({ tone: 'success', title: 'Character deleted', message: char.name.en });
                } catch (err) {
                    toast.show({ tone: 'error', title: 'Delete failed', message: (err as Error).message });
                } finally {
                    setBusy(false);
                }
            },
        });
    }, [toast, pending]);

    return (
        <div className="chr-admin">
            <header className="chr-head">
                <div>
                    <h1>Characters</h1>
                    <p>Manage the public Characters page on lunarian.app/<code>characters</code>. Edits go live within seconds — Mongo collection: <code>characters</code>.</p>
                </div>
                <button className="chr-btn chr-btn-primary" onClick={() => setEditor({ char: emptyChar(), mode: 'create' })}>
                    + New character
                </button>
            </header>

            <div className="chr-filters">
                <input
                    className="chr-search"
                    placeholder="Search by id or name…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <div className="chr-tabs">
                    {[{ id: 'all', name: { en: 'All', ar: '' } }, { id: 'main', name: { en: 'Main', ar: '' } }, ...factions.filter(f => f.id !== 'all' && f.id !== 'main')].map(f => (
                        <button
                            key={f.id}
                            className={`chr-tab${activeFaction === f.id ? ' active' : ''}`}
                            onClick={() => setActiveFaction(f.id)}
                        >
                            {f.name.en}
                            <span className="chr-tab-count">{counts[f.id] ?? 0}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="chr-grid">
                {filtered.length === 0 && (
                    <div className="chr-empty">No characters match. Try clearing search or pick another faction.</div>
                )}
                {filtered.map(c => (
                    <button
                        key={c.id}
                        className="chr-card"
                        onClick={() => setEditor({ char: { ...c }, mode: 'edit' })}
                    >
                        <div className="chr-card-img">
                            {c.imageUrl ? (
                                <img
                                    src={withBust(c.imageUrl, bustVersion)}
                                    alt={c.name.en}
                                    onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
                                />
                            ) : (
                                <div className="chr-card-placeholder">{c.name.en.charAt(0)}</div>
                            )}
                            {c.isMainCharacter && <span className="chr-pin-main">Main</span>}
                        </div>
                        <div className="chr-card-body">
                            <div className="chr-card-name">{c.name.en}</div>
                            <div className="chr-card-meta">
                                <span className="chr-card-id">{c.id}</span>
                                <span className="chr-card-faction">{c.faction}</span>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {editor && (
                <CharacterEditor
                    initial={editor.char}
                    mode={editor.mode}
                    factions={factions}
                    busy={busy}
                    onSave={(c) => save(c, editor.mode)}
                    onDelete={editor.mode === 'edit' ? () => remove(editor.char) : undefined}
                    onCancel={() => setEditor(null)}
                />
            )}

        </div>
    );
}

function ImageDropZone({ imageUrl, bustVersion, uploading, dragActive, idMissing, onClear, onBrowse }: {
    imageUrl: string;
    bustVersion: number;
    uploading: boolean;
    dragActive: boolean;
    idMissing: boolean;
    onClear: () => void;
    onBrowse: () => void;
}) {
    // Drag handlers live on the modal root (see CharacterEditor) so a drop
    // anywhere inside the dialog uploads. Clicking the zone opens the file
    // picker — it used to be visual-only, which read as "no way to upload
    // without dragging".
    return (
        <div
            className={`chr-dropzone${dragActive ? ' chr-dropzone-drag' : ''}${uploading ? ' chr-dropzone-busy' : ''}`}
            role="button"
            tabIndex={0}
            style={{ cursor: uploading ? 'wait' : 'pointer' }}
            onClick={() => { if (!uploading) onBrowse(); }}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !uploading) { e.preventDefault(); onBrowse(); } }}
            aria-label="Choose a character image"
        >
            {imageUrl ? (
                <div className="chr-dropzone-preview">
                    <img
                        src={withBust(imageUrl, bustVersion)}
                        alt=""
                        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                    />
                    <div className="chr-dropzone-overlay">
                        <strong>{dragActive ? 'Drop to replace' : 'Click or drag a new image to replace'}</strong>
                        <span>or use the buttons below</span>
                    </div>
                    <button type="button" className="chr-dropzone-clear" onClick={(e) => { e.stopPropagation(); onClear(); }} disabled={uploading} aria-label="Clear image">✕</button>
                </div>
            ) : (
                <div className="chr-dropzone-empty">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                    <strong>{dragActive ? 'Drop image to upload' : 'Click to choose an image — or drag it here'}</strong>
                    <span>{idMissing ? 'Set an ID first — it names the stored file' : 'PNG / JPG / WEBP, up to 100MB'}</span>
                </div>
            )}
        </div>
    );
}

function CharacterEditor({ initial, mode, factions, busy, onSave, onDelete, onCancel }: {
    initial: AdminCharacter;
    mode: 'create' | 'edit';
    factions: FactionLite[];
    busy: boolean;
    onSave: (c: AdminCharacter) => void;
    onDelete?: () => void;
    onCancel: () => void;
}) {
    const toast = useToast();
    const [c, setC] = useState<AdminCharacter>(initial);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const { bustVersion, bump } = useBustVersion();
    const fileRef = useRef<HTMLInputElement | null>(null);
    // dragOver fires constantly while a drag is over the surface. We use a
    // keep-alive timer so dragActive stays true between consecutive dragOver
    // ticks, and only clears when the cursor truly leaves (no events for
    // ~150ms). Counter-based enter/leave bookkeeping was unreliable when the
    // cursor crossed sibling children quickly — flipping dragActive off
    // mid-drag and "cancelling" the visual replace state.
    const dragTimeoutRef = useRef<number | null>(null);
    // Each upload bumps this id; if a stale upload finishes after a newer one
    // started, we ignore its setC/onSave so we don't overwrite the latest
    // image with the older one. Without this, rapid drops while a previous
    // upload was still in-flight could write the wrong URL or get stuck with
    // uploading=true on an unmounted/superseded run.
    const uploadIdRef = useRef(0);

    // Some browsers swallow the next drop event when a file drop fires while
    // the document body has a stale `dragover` registration. Pinning a
    // window-level dragover/drop preventDefault while the modal is open keeps
    // the drop on our handler and stops the browser from navigating to the
    // dropped file when a drop happens *just outside* our backdrop bounds.
    useEffect(() => {
        const handler = (e: DragEvent) => { e.preventDefault(); };
        window.addEventListener('dragover', handler);
        window.addEventListener('drop', handler);
        return () => {
            window.removeEventListener('dragover', handler);
            window.removeEventListener('drop', handler);
            if (dragTimeoutRef.current) window.clearTimeout(dragTimeoutRef.current);
        };
    }, []);

    const handleUpload = async (file: File) => {
        if (!c.id.trim()) {
            toast.show({ tone: 'error', title: 'Set an ID first', message: 'Character ID is part of the upload key.' });
            return;
        }
        if (file.size > MAX_UPLOAD_BYTES) {
            toast.show({ tone: 'error', title: 'Too large', message: `Image must be under ${MAX_UPLOAD_LABEL}.` });
            return;
        }
        const myId = ++uploadIdRef.current;
        setUploading(true);
        try {
            const ext = (file.name.split('.').pop() ?? 'png').toLowerCase();
            const key = `characters/${c.id}.${ext}`;
            let presignData: { presignedUrl?: string; publicUrl?: string; retryAfterMs?: number };
            try {
                presignData = await adminPost<{ presignedUrl?: string; publicUrl?: string; retryAfterMs?: number }>(
                    '/api/admin/assets/presign',
                    { key, contentType: file.type || 'image/png', size: file.size },
                );
            } catch (err) {
                const e = err as Error & { status?: number };
                if (e.status === 429) throw new Error('Rate limited — wait a few seconds before next upload');
                throw new Error(`Presign failed: ${e.message}`);
            }
            if (!presignData?.presignedUrl || !presignData?.publicUrl) {
                throw new Error('Presign response missing URLs');
            }
            const putRes = await fetch(presignData.presignedUrl, {
                method: 'PUT',
                headers: { 'Content-Type': file.type || 'image/png' },
                body: file,
            });
            if (!putRes.ok) throw new Error(`Upload to R2 failed: ${putRes.status}`);
            // Discard if a newer upload superseded this one — its result is the
            // one the user wants, not ours.
            if (myId !== uploadIdRef.current) return;
            const cacheBust = `${presignData.publicUrl}?v=${Date.now()}`;
            const updated = { ...c, imageUrl: cacheBust };
            setC(updated);
            bump();
            // Auto-save in edit mode so the user can bulk-replace 250 characters
            // by drag-dropping without a separate Save click. In create mode the
            // character record doesn't exist yet, so we still wait for the Save
            // button (id/faction/name need to be filled in first).
            if (mode === 'edit') {
                onSave(updated);
            } else {
                toast.show({ tone: 'success', title: 'Uploaded', message: 'Click Create to add this character.' });
            }
        } catch (err: any) {
            if (myId === uploadIdRef.current) {
                toast.show({ tone: 'error', title: 'Upload failed', message: err?.message ?? 'Unknown error' });
            }
        } finally {
            // Only clear the busy flag if we're the latest upload — a stale run
            // finishing after a newer one started must not flip uploading off
            // and let a third drop sneak through against the in-flight upload.
            if (myId === uploadIdRef.current) setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        if (!e.dataTransfer.types?.includes('Files')) return;
        e.dataTransfer.dropEffect = 'copy';
        if (!dragActive) setDragActive(true);
        if (dragTimeoutRef.current) window.clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = window.setTimeout(() => setDragActive(false), 150);
    };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (dragTimeoutRef.current) { window.clearTimeout(dragTimeoutRef.current); dragTimeoutRef.current = null; }
        setDragActive(false);
        // Don't gate on `uploading` — a fast second drop must still start a
        // fresh upload. handleUpload's myId/uploadIdRef pair guarantees only
        // the latest one applies state.
        const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
        if (file) void handleUpload(file);
    };

    return (
        <div
            className="chr-modal-bg"
            onClick={onCancel}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <div
                className="chr-modal"
                onClick={e => e.stopPropagation()}
            >
                <header className="chr-modal-head">
                    <h3>{mode === 'create' ? 'New character' : `Edit "${initial.name.en}"`}</h3>
                    <button aria-label="Close" onClick={onCancel} className="chr-btn chr-btn-secondary chr-btn-x">×</button>
                </header>
                <div className="chr-modal-body">
                    <div className="chr-form-row">
                        <label>
                            <span>ID (slug)</span>
                            <input
                                value={c.id}
                                onChange={e => setC(p => ({ ...p, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 60) }))}
                                placeholder="e.g. luna_thief"
                                disabled={mode === 'edit'}
                                title={mode === 'edit' ? "IDs can't be changed after creation — delete and recreate the character to rename its ID" : undefined}
                            />
                        </label>
                        <label>
                            <span>Faction</span>
                            <select value={c.faction} onChange={e => setC(p => ({ ...p, faction: e.target.value }))}>
                                <option value="">— pick one —</option>
                                {factions.filter(f => f.id !== 'all' && f.id !== 'main').map(f => (
                                    <option key={f.id} value={f.id}>{f.name.en}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div className="chr-form-row">
                        <label>
                            <span>Name (English)</span>
                            <input value={c.name.en} onChange={e => setC(p => ({ ...p, name: { ...p.name, en: e.target.value } }))} placeholder="Luna Thief" />
                        </label>
                        <label>
                            <span>Name (Arabic)</span>
                            <input value={c.name.ar} onChange={e => setC(p => ({ ...p, name: { ...p.name, ar: e.target.value } }))} dir="rtl" />
                        </label>
                    </div>
                    <label className="chr-form-full">
                        <span>Lore (English)</span>
                        <textarea rows={3} value={c.lore?.en ?? ''} onChange={e => setC(p => ({ ...p, lore: { en: e.target.value, ar: p.lore?.ar ?? '' } }))} />
                    </label>
                    <label className="chr-form-full">
                        <span>Lore (Arabic)</span>
                        <textarea rows={3} dir="rtl" value={c.lore?.ar ?? ''} onChange={e => setC(p => ({ ...p, lore: { en: p.lore?.en ?? '', ar: e.target.value } }))} />
                    </label>
                    <label className="chr-form-full">
                        <span>Character image</span>
                        <ImageDropZone
                            imageUrl={c.imageUrl}
                            bustVersion={bustVersion}
                            uploading={uploading}
                            dragActive={dragActive}
                            idMissing={!c.id.trim()}
                            onClear={() => { setC(prev => ({ ...prev, imageUrl: '' })); bump(); }}
                            onBrowse={() => fileRef.current?.click()}
                        />
                    </label>
                    <div className="chr-upload-row">
                        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void handleUpload(f); }} />
                        <button className="chr-btn chr-btn-secondary" disabled={uploading || !c.id.trim()} onClick={() => fileRef.current?.click()}>
                            {uploading ? 'Uploading…' : (c.imageUrl ? '⟲ Replace from file' : '↑ Upload from file')}
                        </button>
                        <input
                            className="chr-search"
                            style={{ flex: 1, marginLeft: 8 }}
                            placeholder="…or paste an image URL"
                            value={c.imageUrl}
                            onChange={e => setC(p => ({ ...p, imageUrl: e.target.value }))}
                        />
                    </div>
                    <div className="chr-form-row">
                        <label className="chr-form-checkbox">
                            <input type="checkbox" checked={c.isMainCharacter} onChange={e => setC(p => ({ ...p, isMainCharacter: e.target.checked }))} />
                            <span>Featured as Main Character</span>
                        </label>
                        <label>
                            <span>Linked Card ID (optional)</span>
                            <input value={c.cardId ?? ''} onChange={e => setC(p => ({ ...p, cardId: e.target.value || null }))} placeholder="card slug" />
                        </label>
                    </div>
                </div>
                <footer className="chr-modal-foot">
                    {onDelete && (
                        <button className="chr-btn chr-btn-danger" onClick={onDelete} disabled={busy}>Delete</button>
                    )}
                    <span style={{ flex: 1 }} />
                    <button className="chr-btn chr-btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
                    <button className="chr-btn chr-btn-primary" onClick={() => onSave(c)} disabled={busy || uploading || !c.id || !c.faction || !c.name.en || !c.imageUrl}>
                        {busy ? 'Saving…' : (mode === 'create' ? 'Create' : 'Save')}
                    </button>
                </footer>
            </div>
        </div>
    );
}
