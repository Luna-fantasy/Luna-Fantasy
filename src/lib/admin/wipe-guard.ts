/**
 * Last-line-of-defence guard for any endpoint that overwrites an array of
 * items in the shared MongoDB collections (cards_config, luna_pairs_config,
 * characters, etc.).
 *
 * Rationale: 2026-04-30 incident. A client-side bug in CardEditDialog
 * caused `getRarityItems` to return [] (it was reading the wrong response
 * shape). The dialog then PUT [editedCard] back, which the server happily
 * persisted, wiping 24 of 25 COMMON cards in one go. The fix to that
 * specific dialog is necessary but not sufficient — the same anti-pattern
 * (read-modify-write where the read silently returns empty) could re-emerge
 * anywhere. This guard catches it at the API layer regardless of cause.
 *
 * Rules:
 *   - if `before >= 3` AND (`after === 0` OR `removed >= ceil(before/2)`)
 *     and !opts.confirmShrink → REJECT
 *   - otherwise allow
 *
 * Genuine mass-deletion (an admin actually wants to drop a rarity to 0)
 * passes `confirmShrink: true` from the client; that's the explicit opt-in.
 *
 * The check is conservative: it allows shrinks <50% (typical edit removes 1
 * card) and any growth. It only triggers on the catastrophic-loss pattern.
 */

export interface WipeGuardOptions {
    /** Human-readable label for error messages, e.g. "COMMON cards". */
    label: string;
    /** Caller explicitly confirmed the shrink is intentional (mass delete). */
    confirmShrink?: boolean;
    /** Override the default 0.5 ratio. Pass 1.0 to allow any shrink. */
    shrinkThreshold?: number;
    /** Minimum size below which the guard doesn't apply. Default 3. */
    minSize?: number;
}

export interface WipeGuardResult {
    ok: boolean;
    /** Present only when ok=false. */
    error?: {
        message: string;
        before: number;
        after: number;
    };
}

export function assertNoWipe(
    beforeCount: number,
    afterCount: number,
    opts: WipeGuardOptions,
): WipeGuardResult {
    const minSize = opts.minSize ?? 3;
    const threshold = opts.shrinkThreshold ?? 0.5;

    if (beforeCount < minSize) {
        // Tiny collections (or empty before — first seed) are not subject to
        // the guard. Going from 1 → 0 is just "delete the last card",
        // legitimate behaviour for small datasets.
        return { ok: true };
    }

    const removed = beforeCount - afterCount;
    const wipeFloor = Math.ceil(beforeCount * threshold);
    const wouldWipe = afterCount === 0 || removed >= wipeFloor;

    if (wouldWipe && !opts.confirmShrink) {
        return {
            ok: false,
            error: {
                message:
                    `Refusing to shrink ${opts.label} from ${beforeCount} → ${afterCount} ` +
                    `(removed ${removed}). This looks like a runaway client that lost the ` +
                    `existing items. Pass confirmShrink: true if intentional.`,
                before: beforeCount,
                after: afterCount,
            },
        };
    }

    return { ok: true };
}

/**
 * Convenience wrapper that throws if the guard fails. Useful inside a
 * try/catch where you want a single error path.
 */
export function enforceNoWipe(
    beforeCount: number,
    afterCount: number,
    opts: WipeGuardOptions,
): void {
    const r = assertNoWipe(beforeCount, afterCount, opts);
    if (!r.ok && r.error) {
        const err: any = new Error(r.error.message);
        err.statusCode = 409;
        err.beforeCount = r.error.before;
        err.afterCount = r.error.after;
        throw err;
    }
}
