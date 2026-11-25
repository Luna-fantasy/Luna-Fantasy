// Textura / GetLayers, next16-claude-starter, Unlicense.
// Source revision 4ce3ade04ed0c21f38d9b476e079f02a18273463, src/lib/scene/per-frame.ts
export const MAX_FRAME_DT = 0.1;

/**
 * The fraction of the gap a per-frame ease `k` (authored at 60 fps) closes over
 * `dt` seconds: `x += (target - x) * perFrame(k, dt)` feels at every frame rate
 * the way `x += (target - x) * k` felt at 60 fps.
 */
export const perFrame = (k: number, dt: number): number =>
  1 - Math.pow(1 - k, Math.max(0, dt) * 60);

/**
 * Exponential damping toward `target` with a rate in 1/s — the time-based
 * form of the same ease (`lambda` ≈ 60·k for small k).
 */
export const damp = (
  current: number,
  target: number,
  lambda: number,
  dt: number,
): number => current + (target - current) * (1 - Math.exp(-lambda * dt));

export interface FrameClock {
  /**
   * Call once per frame with the rAF timestamp (ms). Returns `dt`, the clamped
   * step since the last frame, and `t`, the time since the first frame — both
   * in seconds.
   */
  tick(nowMs: number): { dt: number; t: number };
  /** Forget the last frame (after a pause) so the next `dt` is 0, not the pause. */
  reset(): void;
}

/** One time source in seconds, shared by every path that draws the scene. */
export const createFrameClock = (): FrameClock => {
  let first = -1;
  let last = -1;
  return {
    tick(nowMs) {
      if (first < 0) first = nowMs;
      const dt = last < 0 ? 0 : Math.min(MAX_FRAME_DT, (nowMs - last) / 1000);
      last = nowMs;
      return { dt: Math.max(0, dt), t: (nowMs - first) / 1000 };
    },
    reset() {
      last = -1;
    },
  };
};

