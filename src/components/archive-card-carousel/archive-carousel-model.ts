export type ArchiveKind = 'luna' | 'grand' | 'faction';
export type ArchiveDirection = -1 | 1;
type Turn = { from: string; to: string; direction: ArchiveDirection; token: number };
type InspectRequest = { id: string; token: number };
export type ArchiveCarouselState = {
  ids: readonly string[];
  currentId: string | null;
  turn: Turn | null;
  pending: number;
  pendingInspect: boolean;
  inspection: InspectRequest | null;
  serial: number;
};
export type ArchiveAction =
  | { type: 'sync'; ids: readonly string[]; seedId?: string | null }
  | { type: 'step'; direction: ArchiveDirection; instant?: boolean }
  | { type: 'finish'; token: number }
  | { type: 'select'; id: string; direction: ArchiveDirection; instant?: boolean }
  | { type: 'inspect' };

const uniqueIds = (ids: readonly string[]) => Array.from(new Set(ids.filter(Boolean)));

export function createArchiveCarouselState(ids: readonly string[], seedId?: string | null): ArchiveCarouselState {
  const available = uniqueIds(ids);
  return {
    ids: available, currentId: seedId && available.includes(seedId) ? seedId : available[0] ?? null,
    turn: null, pending: 0, pendingInspect: false, inspection: null, serial: 0,
  };
}

export function archiveArrowDirection(key: string, rtl: boolean, modified = false): ArchiveDirection | null {
  if (modified || (key !== 'ArrowLeft' && key !== 'ArrowRight')) return null;
  return (key === 'ArrowRight') !== rtl ? 1 : -1;
}

function step(state: ArchiveCarouselState, direction: ArchiveDirection, instant = false): ArchiveCarouselState {
  if (!state.currentId || state.ids.length < 2) return state;
  if (state.turn) return { ...state, pending: Math.max(-9, Math.min(9, state.pending + direction)) };
  const index = state.ids.indexOf(state.currentId);
  const to = state.ids[(index + direction + state.ids.length) % state.ids.length];
  if (instant) return { ...state, currentId: to };
  const token = state.serial + 1;
  return { ...state, serial: token, turn: { from: state.currentId, to, direction, token } };
}

function requestInspection(state: ArchiveCarouselState): ArchiveCarouselState {
  if (!state.currentId) return state;
  if (state.turn) return { ...state, pendingInspect: true };
  const token = state.serial + 1;
  return { ...state, serial: token, pendingInspect: false, inspection: { id: state.currentId, token } };
}

export function archiveCarouselReducer(state: ArchiveCarouselState, action: ArchiveAction): ArchiveCarouselState {
  switch (action.type) {
    case 'sync': {
      const ids = uniqueIds(action.ids);
      if (state.ids.length === ids.length && state.ids.every((id, i) => id === ids[i])) return state;
      const currentId = state.currentId && ids.includes(state.currentId) ? state.currentId :
        !state.currentId && action.seedId && ids.includes(action.seedId) ? action.seedId : ids[0] ?? null;
      return { ...state, ids, currentId, turn: null, pending: 0, pendingInspect: false, inspection: null };
    }
    case 'step':
      return step(state, action.direction, action.instant);
    case 'select': {
      if (!state.currentId || !state.ids.includes(action.id) || (action.id === state.currentId && !state.turn)) return state;
      const serial = state.serial + 1;
      const jump = { ...state, serial, turn: null, pending: 0, pendingInspect: false, inspection: null };
      if (action.instant || action.id === state.currentId) return { ...jump, currentId: action.id };
      return { ...jump, turn: { from: state.currentId, to: action.id, direction: action.direction, token: serial } };
    }
    case 'inspect':
      return requestInspection(state);
    case 'finish': {
      if (!state.turn || state.turn.token !== action.token) return state;
      const settled = { ...state, currentId: state.turn.to, turn: null };
      if (state.pending) {
        const direction = state.pending > 0 ? 1 : -1;
        return step({ ...settled, pending: state.pending - direction }, direction);
      }
      return state.pendingInspect ? requestInspection(settled) : settled;
    }
  }
}

type Effect = { frames: Keyframe[]; duration: number; easing: string };
type MotionPlan = { outgoing: Effect; incoming: Effect; shutters: Effect[] };
const effect = (frames: Keyframe[], duration: number, easing = 'linear'): Effect => ({ frames, duration, easing });

export function planArchiveMotion(kind: ArchiveKind, direction: ArchiveDirection, rtl: boolean, stageWidth: number): MotionPlan {
  if (kind === 'luna') {
    const travel = direction * (rtl ? -1 : 1);
    const unit = Math.min(54, Math.max(19, (stageWidth || 306) * .094));
    const shift = (x: number, y: number, z: number, angle: number, tilt: number, scale = 1) =>
      `translate3d(${Math.round(travel * unit * x)}px,${Math.round(unit * y)}px,${z}px) rotateZ(${travel * angle}deg) rotateY(${travel * tilt}deg) scale(${scale})`;
    const rest = 'translate3d(0px,0px,0px) rotateZ(0deg) rotateY(0deg) scale(1)';
    const settle = 'cubic-bezier(.20,.72,.26,1)';
    return {
      outgoing: effect([
        { offset: 0, transform: rest, opacity: 1, zIndex: 3, easing: settle },
        { offset: .30, transform: shift(-.18, -.25, 18, -3, 5, 1.019), opacity: 1, zIndex: 3, easing: 'cubic-bezier(.38,.04,.40,.96)' },
        { offset: .73, transform: shift(-1.48, .51, 11, -13, 14, .96), opacity: .88, zIndex: 3, easing: 'cubic-bezier(.46,.04,.68,.41)' },
        { offset: 1, transform: shift(-2.42, 1.07, -2, -18, 19, .91), opacity: 0, zIndex: 3 },
      ], 458),
      incoming: effect([
        { offset: 0, transform: shift(1.03, .49, -16, 9, -13, .944), opacity: .96, zIndex: 2 },
        { offset: .22, transform: shift(.90, .51, -11, 7, -10, .958), opacity: 1, zIndex: 2, easing: 'cubic-bezier(.35,.04,.15,.96)' },
        { offset: .65, transform: shift(-.09, -.17, 7, -1.65, 2.8, 1.008), opacity: 1, zIndex: 2, easing: settle },
        { offset: .85, transform: shift(.034, .052, 1, .48, -.5, 1.001), opacity: 1, zIndex: 2, easing: settle },
        { offset: 1, transform: rest, opacity: 1, zIndex: 2 },
      ], 640),
      shutters: [],
    };
  }

  if (kind === 'faction') {
    const westLeads = (direction === 1) !== rtl;
    const steel = 'cubic-bezier(.26,.72,.18,1)';
    const lock = 'cubic-bezier(.69,.07,.8,.49)';
    const recoil = 'cubic-bezier(.13,.71,.29,1)';
    const offset = (x: number, y: number) => `translate3d(${x}%,${y}%,0)`;
    const closed = offset(0, 0);
    const blade = (x: number, y: number, delay: number, draw: number, release: number, bound: number) => {
      const away = offset(x, y);
      return effect([
        { offset: 0, transform: away, opacity: 1 },
        { offset: delay, transform: away, opacity: 1, easing: steel },
        { offset: draw, transform: closed, opacity: 1 },
        { offset: release, transform: closed, opacity: 1, easing: recoil },
        { offset: bound, transform: offset(x * 1.13, y * 1.13), opacity: 1 },
        { offset: 1, transform: away, opacity: 0 },
      ], 760);
    };
    const face = (from: number, to: number) => effect([
      { offset: 0, opacity: from }, { offset: .408, opacity: from },
      { offset: .468, opacity: to }, { offset: 1, opacity: to },
    ], 760);
    return {
      outgoing: face(1, 0),
      incoming: face(0, 1),
      shutters: [
        westLeads ? blade(-112, -9, .015, .29, .59, .89) : blade(-130, -9, .047, .35, .53, .89),
        westLeads ? blade(130, 9, .055, .35, .53, .91) : blade(112, 9, .012, .29, .59, .91),
        effect([
          { offset: 0, transform: offset(0, -125), opacity: 0 },
          { offset: .09, transform: offset(0, -114), opacity: 1, easing: lock },
          { offset: .388, transform: closed, opacity: 1, easing: 'ease' },
          { offset: .425, transform: closed, opacity: 1, filter: 'brightness(1.27)' },
          { offset: .535, transform: closed, opacity: 1, filter: 'brightness(1)', easing: recoil },
          { offset: .92, transform: offset(0, -130), opacity: 1 },
          { offset: 1, transform: offset(0, -130), opacity: 0 },
        ], 760),
      ],
    };
  }

  // RTL changes the controls, not the Grand mechanism's vertical travel.
  const plate = (y: number, z: number, rx: number, scale = 1) =>
    `translate3d(0,${y}%,${z}px) rotateX(${rx}deg) scale(${scale})`;
  const shutters = [true, false].map(top => {
    const sign = top ? -1 : 1;
    const leading = top === (direction === 1);
    const fold = (travel: number, angle: number) => `translateY(${sign * travel}%) rotateX(${sign * angle}deg)`;
    return effect([
      { transform: fold(105, 46), offset: 0 },
      { transform: fold(105, 46), offset: leading ? .04 : .12 },
      { transform: fold(0, 2), offset: leading ? .39 : .47 },
      { transform: fold(0, 2), offset: leading ? .55 : .50 },
      { transform: fold(105, 51), offset: leading ? .90 : .83 },
      { transform: fold(106, 51), offset: 1 },
    ], 880, 'cubic-bezier(.24,.06,.31,1)');
  });
  return {
    outgoing: effect([
      { transform: plate(0, 0, 0), opacity: 1, offset: 0 },
      { transform: plate(-3 * direction, -35, -13 * direction, .98), opacity: 1, offset: .19 },
      { transform: plate(-20 * direction, -116, -60 * direction, .94), opacity: .35, offset: .43 },
      { transform: plate(-27 * direction, -146, -69 * direction, .90), opacity: 0, offset: .51 },
      { transform: plate(-27 * direction, -146, -69 * direction, .90), opacity: 0, offset: 1 },
    ], 880, 'cubic-bezier(.36,.05,.29,.99)'),
    incoming: effect([
      { transform: plate(18 * direction, -145, 58 * direction, .9), opacity: 0, offset: 0 },
      { transform: plate(18 * direction, -145, 58 * direction, .9), opacity: 0, offset: .37 },
      { transform: plate(8 * direction, -68, 27 * direction, .97), opacity: 1, offset: .58 },
      { transform: plate(-direction, 11, -4 * direction, 1.014), opacity: 1, offset: .80 },
      { transform: plate(0, 0, 0), opacity: 1, offset: 1 },
    ], 880, 'cubic-bezier(.26,.15,.44,.99)'),
    shutters,
  };
}

type Targets = { outgoing: Element; incoming: Element; shutters?: readonly Element[] };

export async function playArchiveMotion(plan: MotionPlan, targets: Targets, options: {
  signal: AbortSignal; reduced?: boolean;
}): Promise<void> {
  const { signal } = options;
  if (options.reduced || signal.aborted) return;
  const bindings: { element: Element; effect: Effect }[] = [
    { element: targets.outgoing, effect: plan.outgoing }, { element: targets.incoming, effect: plan.incoming },
  ];
  for (let i = 0; i < plan.shutters.length; ++i) {
    const element = targets.shutters?.[i];
    if (!element) return;
    bindings.push({ element, effect: plan.shutters[i] });
  }
  if (bindings.some(({element}) => typeof element.animate !== 'function')) return;
  const animations: Animation[] = [];
  const jobs: Promise<unknown>[] = [];
  let canceled = false;
  const stop = () => {
    if (canceled) return;
    canceled = true;
    animations.forEach(animation => animation.cancel());
  };
  signal.addEventListener('abort', stop, { once: true });
  try {
    for (const { element, effect: { frames, duration, easing } } of bindings) {
      const animation = element.animate(frames, { duration, easing, fill: 'both' });
      animations.push(animation);
      jobs.push(animation.finished.catch(() => undefined));
    }
    if (signal.aborted) stop();
    await Promise.all(jobs);
  } finally {
    signal.removeEventListener('abort', stop);
    stop();
  }
}
