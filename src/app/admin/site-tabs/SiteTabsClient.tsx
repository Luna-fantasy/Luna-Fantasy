'use client';

import { useState, useCallback } from 'react';
import { TAB_GROUPS, TAB_LABELS, type SiteTabsMap, type TabKey, type TabState } from '@/lib/admin/site-tabs-shared';

async function fetchCsrf(): Promise<string> {
    const res = await fetch('/api/admin/csrf', { cache: 'no-store' });
    if (!res.ok) return '';
    const data = await res.json().catch(() => ({}));
    return data?.token ?? '';
}

function fmtRelative(d: Date | null): string {
    if (!d) return '';
    const ms = Date.now() - new Date(d).getTime();
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return `${days}d ago`;
}

interface Props {
    initialTabs: SiteTabsMap;
}

export default function SiteTabsClient({ initialTabs }: Props) {
    const [tabs, setTabs] = useState<SiteTabsMap>(initialTabs);
    const [busyKey, setBusyKey] = useState<TabKey | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reasonModal, setReasonModal] = useState<{ key: TabKey; closing: boolean } | null>(null);
    const [reasonInput, setReasonInput] = useState('');

    const apply = useCallback(async (key: TabKey, closed: boolean, reason: string | null) => {
        setBusyKey(key);
        setError(null);
        const prev = tabs[key];
        const optimistic: TabState = closed
            ? { closed: true, closedAt: new Date(), closedBy: 'self', closedByName: 'You', reason }
            : { closed: false, closedAt: null, closedBy: null, closedByName: null, reason: null };
        setTabs(t => ({ ...t, [key]: optimistic }));

        try {
            const token = await fetchCsrf();
            const res = await fetch('/api/admin/site-tabs', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
                body: JSON.stringify({ key, closed, reason }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error ?? `HTTP ${res.status}`);
            }
            const data = await res.json();
            setTabs(t => ({ ...t, [key]: data.state }));
        } catch (err: any) {
            setError(err?.message ?? 'Update failed');
            setTabs(t => ({ ...t, [key]: prev }));
        } finally {
            setBusyKey(null);
        }
    }, [tabs]);

    const onToggle = (key: TabKey) => {
        const current = tabs[key];
        if (current.closed) {
            void apply(key, false, null);
        } else {
            setReasonInput('');
            setReasonModal({ key, closing: true });
        }
    };

    const closedCount = Object.values(tabs).filter(t => t.closed).length;

    return (
        <div className="site-tabs-page">
            <div className="av-page-header">
                <h1>Site Tabs</h1>
                <p>Toggle public visibility of website tabs. Masterminds always see closed tabs with a banner. Changes apply within ~1 second — no Railway deploy required.</p>
                <div className="site-tabs-summary">
                    <span className="site-tabs-stat">
                        <span className="site-tabs-stat-num">{closedCount}</span>
                        <span className="site-tabs-stat-lbl">closed</span>
                    </span>
                    <span className="site-tabs-stat">
                        <span className="site-tabs-stat-num">{Object.keys(tabs).length - closedCount}</span>
                        <span className="site-tabs-stat-lbl">open</span>
                    </span>
                </div>
            </div>

            {error && (
                <div className="site-tabs-error" role="alert">
                    {error}
                    <button onClick={() => setError(null)} className="site-tabs-error-close">×</button>
                </div>
            )}

            {Object.entries(TAB_GROUPS).map(([groupId, group]) => (
                <section key={groupId} className="site-tabs-group">
                    <h2 className="site-tabs-group-title">{group.label}</h2>
                    <div className="site-tabs-list">
                        {group.keys.map((key) => {
                            const state = tabs[key];
                            const isParent = group.parent === key;
                            const isBusy = busyKey === key;
                            return (
                                <div key={key} className={`site-tabs-row ${isParent ? 'is-parent' : ''} ${state.closed ? 'is-closed' : ''}`}>
                                    <div className="site-tabs-row-main">
                                        <div className="site-tabs-row-name">
                                            {isParent && <span className="site-tabs-parent-pill">Group</span>}
                                            {TAB_LABELS[key]}
                                        </div>
                                        <div className="site-tabs-row-meta">
                                            {state.closed ? (
                                                <>
                                                    <span className="site-tabs-status closed">CLOSED</span>
                                                    {state.closedByName && <span> by <strong>{state.closedByName}</strong></span>}
                                                    {state.closedAt && <span> · {fmtRelative(state.closedAt)}</span>}
                                                </>
                                            ) : (
                                                <span className="site-tabs-status open">OPEN</span>
                                            )}
                                        </div>
                                        {state.reason && (
                                            <div className="site-tabs-row-reason">"{state.reason}"</div>
                                        )}
                                    </div>
                                    <button
                                        className={`site-tabs-toggle ${state.closed ? 'on' : 'off'}`}
                                        onClick={() => onToggle(key)}
                                        disabled={isBusy}
                                        aria-label={state.closed ? `Open ${TAB_LABELS[key]}` : `Close ${TAB_LABELS[key]}`}
                                    >
                                        <span className="site-tabs-toggle-thumb" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </section>
            ))}

            {reasonModal && (
                <div className="site-tabs-modal-backdrop" onClick={() => setReasonModal(null)}>
                    <div className="site-tabs-modal" onClick={e => e.stopPropagation()}>
                        <h3>Close {TAB_LABELS[reasonModal.key]}</h3>
                        <p>Optional: a short reason shown to public visitors and logged in audit history.</p>
                        <textarea
                            autoFocus
                            value={reasonInput}
                            onChange={e => setReasonInput(e.target.value.slice(0, 500))}
                            placeholder="e.g. Updating card art — back in 30 minutes"
                            rows={3}
                            maxLength={500}
                        />
                        <div className="site-tabs-modal-meta">{reasonInput.length}/500</div>
                        <div className="site-tabs-modal-actions">
                            <button
                                className="site-tabs-btn-secondary"
                                onClick={() => setReasonModal(null)}
                            >Cancel</button>
                            <button
                                className="site-tabs-btn-danger"
                                onClick={() => {
                                    const k = reasonModal.key;
                                    const r = reasonInput.trim() || null;
                                    setReasonModal(null);
                                    void apply(k, true, r);
                                }}
                            >Close tab</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .site-tabs-page { padding: 24px 32px 80px; max-width: 980px; margin: 0 auto; }
                .av-page-header h1 { font-family: 'Cinzel', serif; font-size: 30px; margin: 0 0 8px; color: #f1f5ff; }
                .av-page-header p { color: #b9c4e0; font-size: 14px; line-height: 1.6; margin: 0 0 24px; max-width: 720px; }
                .site-tabs-summary { display: flex; gap: 18px; margin-bottom: 32px; }
                .site-tabs-stat { display: flex; flex-direction: column; gap: 2px; padding: 12px 18px; background: rgba(20, 24, 48, 0.5); border: 1px solid rgba(140, 200, 255, 0.12); border-radius: 10px; }
                .site-tabs-stat-num { font-size: 22px; font-weight: 700; color: #f1f5ff; }
                .site-tabs-stat-lbl { font-size: 11px; color: #88a0c8; text-transform: uppercase; letter-spacing: 0.08em; }
                .site-tabs-error { background: rgba(220, 50, 70, 0.12); border: 1px solid rgba(220, 50, 70, 0.4); padding: 12px 16px; border-radius: 10px; color: #ffb0b8; margin-bottom: 24px; display: flex; align-items: center; }
                .site-tabs-error-close { margin-left: auto; background: none; border: none; color: #ffb0b8; font-size: 22px; cursor: pointer; padding: 0 8px; }
                .site-tabs-group { margin-bottom: 32px; }
                .site-tabs-group-title { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #88a0c8; margin: 0 0 12px; font-family: inherit; }
                .site-tabs-list { display: flex; flex-direction: column; gap: 8px; }
                .site-tabs-row { display: flex; align-items: center; gap: 16px; padding: 14px 18px; background: rgba(20, 24, 48, 0.5); border: 1px solid rgba(140, 200, 255, 0.12); border-radius: 10px; transition: border-color 0.15s, background 0.15s; }
                .site-tabs-row.is-parent { background: rgba(120, 80, 200, 0.08); border-color: rgba(120, 80, 200, 0.22); }
                .site-tabs-row.is-closed { border-color: rgba(220, 80, 100, 0.45); background: rgba(220, 80, 100, 0.07); }
                .site-tabs-row-main { flex: 1; min-width: 0; }
                .site-tabs-row-name { font-size: 15px; color: #f1f5ff; font-weight: 600; display: flex; align-items: center; gap: 8px; }
                .site-tabs-parent-pill { font-size: 10px; padding: 2px 7px; background: rgba(120, 80, 200, 0.3); border-radius: 4px; color: #d8c0ff; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 700; }
                .site-tabs-row-meta { font-size: 12px; color: #88a0c8; margin-top: 4px; }
                .site-tabs-row-reason { font-size: 12px; color: #a0b4d8; margin-top: 6px; font-style: italic; }
                .site-tabs-status { font-size: 11px; padding: 2px 7px; border-radius: 4px; font-weight: 700; letter-spacing: 0.05em; }
                .site-tabs-status.open { background: rgba(80, 200, 120, 0.15); color: #7fdf9c; }
                .site-tabs-status.closed { background: rgba(220, 80, 100, 0.18); color: #ff97a8; }
                .site-tabs-toggle { width: 52px; height: 28px; border-radius: 14px; border: none; cursor: pointer; padding: 2px; background: rgba(80, 100, 130, 0.4); transition: background 0.18s; flex-shrink: 0; }
                .site-tabs-toggle.on { background: linear-gradient(90deg, #ff5566, #c8344b); }
                .site-tabs-toggle-thumb { display: block; width: 24px; height: 24px; border-radius: 50%; background: #fff; transform: translateX(0); transition: transform 0.2s ease; }
                .site-tabs-toggle.on .site-tabs-toggle-thumb { transform: translateX(24px); }
                .site-tabs-toggle:disabled { opacity: 0.5; cursor: wait; }
                .site-tabs-modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.55); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(4px); }
                .site-tabs-modal { background: linear-gradient(180deg, #1a1d35, #0f1226); border: 1px solid rgba(140, 200, 255, 0.18); border-radius: 14px; padding: 28px; max-width: 480px; width: 90%; }
                .site-tabs-modal h3 { margin: 0 0 8px; font-family: 'Cinzel', serif; font-size: 20px; color: #f1f5ff; }
                .site-tabs-modal p { color: #b9c4e0; font-size: 13px; margin: 0 0 16px; line-height: 1.5; }
                .site-tabs-modal textarea { width: 100%; padding: 12px 14px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(140, 200, 255, 0.18); border-radius: 8px; color: #f1f5ff; font-family: inherit; font-size: 13px; line-height: 1.5; resize: vertical; box-sizing: border-box; }
                .site-tabs-modal textarea:focus { outline: none; border-color: rgba(140, 200, 255, 0.4); }
                .site-tabs-modal-meta { text-align: right; font-size: 11px; color: #88a0c8; margin-top: 4px; }
                .site-tabs-modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 18px; }
                .site-tabs-btn-secondary, .site-tabs-btn-danger { padding: 10px 18px; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
                .site-tabs-btn-secondary { background: rgba(140, 200, 255, 0.1); color: #b9c4e0; }
                .site-tabs-btn-secondary:hover { background: rgba(140, 200, 255, 0.18); }
                .site-tabs-btn-danger { background: linear-gradient(90deg, #ff5566, #c8344b); color: #fff; }
                .site-tabs-btn-danger:hover { opacity: 0.92; }
            `}</style>
        </div>
    );
}
