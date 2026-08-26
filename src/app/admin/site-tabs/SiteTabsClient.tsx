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
                    <button aria-label="Close" onClick={() => setError(null)} className="site-tabs-error-close">×</button>
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

        </div>
    );
}
