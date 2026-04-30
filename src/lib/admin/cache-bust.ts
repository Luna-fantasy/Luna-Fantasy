'use client';

import { useCallback, useState } from 'react';

/**
 * Append `?v=<version>` to a URL so the browser/Discord image proxy doesn't
 * serve a cached copy after we re-upload to the same R2 key. Skips data: and
 * blob: URLs (already unique). Replaces any existing `v=` so callers can
 * force-refresh by passing a fresh version.
 */
export function withBust(url: string | null | undefined, version: number | string): string {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;

    const [base, query = ''] = url.split('?', 2);
    if (!query) return `${base}?v=${version}`;

    const params = new URLSearchParams(query);
    params.set('v', String(version));
    return `${base}?${params.toString()}`;
}

/**
 * Stamp a URL with a per-mount cache-bust if it doesn't already have one.
 * Use this for read-only display: respects existing `?v=` from the DB but
 * adds a fresh stamp for legacy entries that have none.
 */
export function softBust(url: string | null | undefined, fallbackVersion: number | string): string {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    if (/[?&]v=/.test(url)) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}v=${fallbackVersion}`;
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
    const [bustVersion, setBustVersion] = useState<number>(() => Date.now());
    const bump = useCallback(() => setBustVersion(Date.now()), []);
    return { bustVersion, bump };
}
