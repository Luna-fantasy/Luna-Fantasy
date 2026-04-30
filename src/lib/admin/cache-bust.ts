'use client';

import { useCallback, useState } from 'react';

// Stable initial value for `useBustVersion` so SSR and client hydration
// produce identical output. We seed with 0 (deterministic on the server)
// and only flip to Date.now() inside `bump()` which runs after a user
// action — never during initial render. Without this, `useState(() => Date.now())`
// returned a different number on the server and on the client, and any
// component that included it in JSX (key props, query strings) would
// trigger React's "Text content does not match server-rendered HTML"
// hydration error.

/**
 * Pass-through. The dashboard previously synthesised a `?v=<bustVersion>`
 * suffix for URLs that didn't already have one, but Cloudflare's edge cache
 * keyed on full URL-including-query and ended up serving cached 404s for
 * the synthesised cache keys (404 with `cf-cache-status: HIT`). Once stuck,
 * those cached 404s never expired because the URL never appeared on R2 —
 * only the bare key did. Result: every card except the one most-recently
 * uploaded rendered as a placeholder.
 *
 * The correct cache-busting layer is server-side: the cards-config and
 * faction-card POST handlers stamp `?v=<Date.now()>` into MongoDB on every
 * upload, so re-uploaded files get a unique URL automatically. The client
 * just renders whatever the DB stores, untouched.
 *
 * Kept as a no-op for now so the existing call sites don't have to change.
 * The `version` arg is ignored.
 */
export function withBust(url: string | null | undefined, _version?: number | string): string {
    if (!url) return '';
    return url;
}

/**
 * Like withBust but UNCONDITIONALLY rewrites the `v=` query param. Use only
 * after an explicit user action (clicking Save / Replace), never on every
 * render — calling this in JSX will cause infinite img-fetch aborts.
 */
export function forceBust(url: string | null | undefined, version: number | string): string {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    const [base, query = ''] = url.split('?', 2);
    if (!query) return `${base}?v=${version}`;
    const params = new URLSearchParams(query);
    params.set('v', String(version));
    return `${base}?${params.toString()}`;
}

/**
 * No-op for backwards compatibility. See withBust() for why client-side
 * stamping was removed. Kept so existing call sites don't break.
 */
export function softBust(url: string | null | undefined, _fallbackVersion?: number | string): string {
    if (!url) return '';
    return url;
}

/**
 * Provides a `bustVersion` (initialised to mount time) and a `bump()` function
 * that increments it. Use after a successful upload/save so any cached image
 * URLs displayed elsewhere on the page refresh on next render.
 *
 * Usage:
 *   const { bustVersion, bump } = useBustVersion();
 *   <img src={withBust(card.imageUrl, bustVersion)} />
 *   await save(...); bump();  // forces all bust-stamped URLs to refetch
 */
export function useBustVersion(): { bustVersion: number; bump: () => void } {
    const [bustVersion, setBustVersion] = useState<number>(0);
    const bump = useCallback(() => setBustVersion(Date.now()), []);
    return { bustVersion, bump };
}
