import assert from 'node:assert/strict';
import test from 'node:test';
import { mountStoryScene } from '../src/lib/cinematic/story-scene.js';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((ok, bad) => { resolve = ok; reject = bad; });
  return { promise, resolve, reject };
}

const nextTurn = () => new Promise<void>(resolve => setImmediate(resolve));

function storyHarness() {
  const restore = new Map<string, PropertyDescriptor | undefined>();
  const install = (key: string, value: unknown) => {
    restore.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  const windowTarget = new EventTarget();
  const reduced = Object.assign(new EventTarget(), { matches: false });
  const marks = Array.from({ length: 3 }, () => new Map<string, string>());
  const frames = new Map<number, () => void>();
  let frameId = 0;
  install('window', windowTarget);
  install('matchMedia', (query: string) => query.includes('prefers-reduced-motion') ? reduced : { matches: false });
  install('document', Object.assign(new EventTarget(), { hidden: false }));
  install('requestAnimationFrame', (fn: () => void) => { frames.set(++frameId, fn); return frameId; });
  install('cancelAnimationFrame', (id: number) => frames.delete(id));
  install('IntersectionObserver', undefined);

  const source = deferred();
  let staged = true;
  let thirdDecodeCalls = 0;
  const image = (decode: () => Promise<void>) => Object.assign(new EventTarget(), { decode, loading: 'lazy' });
  const plates = [
    image(async () => {}),
    image(async () => {}),
    image(() => { thirdDecodeCalls++; return staged ? source.promise : Promise.resolve(); }),
  ];
  const style = () => ({ setProperty() {}, removeProperty() {} });
  const root = {
    dataset: {} as Record<string, string>,
    style: style(),
    offsetHeight: 2000,
    getBoundingClientRect: () => ({ top: -1000 }),
    querySelector: () => ({ offsetHeight: 800 }),
    querySelectorAll: (selector: string) => selector === '.chron-plane'
      ? plates.map(plate => ({ querySelector: () => plate, style: style() }))
      : marks.map(mark => ({ setAttribute: (k: string, v: string) => mark.set(k, v), removeAttribute: (k: string) => mark.delete(k) })),
  };
  const stop = mountStoryScene(root);
  return {
    root, source, plates, reduced, marks, stop,
    useFallback() { staged = false; },
    count() { return thirdDecodeCalls; },
    paint() {
      for (const [id, fn] of Array.from(frames.entries())) { frames.delete(id); fn(); }
    },
    cleanup() {
      stop();
      restore.forEach((old, key) => {
        if (old) Object.defineProperty(globalThis, key, old);
        else Reflect.deleteProperty(globalThis, key);
      });
    },
  };
}

test('stage resumes on the same fallback image after V19 finale decode fails', async () => {
  const h = storyHarness();
  try {
    h.source.reject(new Error('staged image failed'));
    await nextTurn();
    assert.equal(h.root.dataset.chronReady, undefined, 'do not reveal pinned motion before all three images decode');

    h.useFallback(); // React changes src on the same image element.
    h.plates[2].dispatchEvent(new Event('load'));
    await nextTurn();
    h.paint();
    assert.equal(h.root.dataset.chronReady, 'true', 'good fallback must restore motion');
    assert.equal(h.root.dataset.chronBeat, '2', 'render current scroll position rather than rewinding');
    assert.equal(h.marks[2].get('aria-current'), 'step');
    h.plates[2].dispatchEvent(new Event('load'));
    await nextTurn();
    assert.equal(h.count(), 2, 'do not set up repeatedly after the same load');
  } finally { h.cleanup(); }
});

test('fallback readiness does not turn on paused/reduced motion or outlive disposal', async () => {
  const h = storyHarness();
  try {
    h.source.reject(new Error('staged image failed'));
    await nextTurn();
    h.reduced.matches = true;
    h.reduced.dispatchEvent(new Event('change'));
    h.useFallback();
    h.plates[2].dispatchEvent(new Event('load'));
    await nextTurn();
    h.paint();
    assert.equal(h.root.dataset.chronReady, undefined);
    assert.equal(h.count(), 1);

    h.stop();
    h.reduced.matches = false;
    h.reduced.dispatchEvent(new Event('change'));
    h.plates[2].dispatchEvent(new Event('load'));
    await nextTurn();
    assert.equal(h.root.dataset.chronReady, undefined);
    assert.equal(h.count(), 1);
  } finally { h.cleanup(); }
});
