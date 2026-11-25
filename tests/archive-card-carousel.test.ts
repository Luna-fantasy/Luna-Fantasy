import test from 'node:test';
import assert from 'node:assert/strict';
import {
  archiveArrowDirection, archiveCarouselReducer as reduce, createArchiveCarouselState as init,
  planArchiveMotion, playArchiveMotion,
} from '../src/components/archive-card-carousel/archive-carousel-model';

test('resolve the approved seed without inventing unavailable records or duplicating an ID', () => {
  assert.deepEqual(init(['one', 'two', 'two', '', 'three'], 'two').ids, ['one', 'two', 'three']);
  assert.equal(init(['one', 'two'], 'two').currentId, 'two');
  assert.equal(init(['one', 'two'], 'old-image').currentId, 'one');
  assert.equal(init([], 'one').currentId, null);
});

test('manual navigation wraps in either direction while preserving the visible old card until finished', () => {
  let s = init(['one', 'two', 'three'], 'one');
  s = reduce(s, { type: 'step', direction: -1 });
  assert.equal(s.currentId, 'one');
  assert.equal(s.turn?.to, 'three');
  s = reduce(s, { type: 'finish', token: s.turn!.token });
  assert.equal(s.currentId, 'three');
  s = reduce(s, { type: 'step', direction: 1, instant: true });
  assert.equal(s.currentId, 'one');
  assert.equal(s.turn, null);
});

test('keyboard left and right map to physical direction in either language; modified keys pass through', () => {
  assert.equal(archiveArrowDirection('ArrowRight', false), 1);
  assert.equal(archiveArrowDirection('ArrowLeft', false), -1);
  assert.equal(archiveArrowDirection('ArrowRight', true), -1);
  assert.equal(archiveArrowDirection('ArrowLeft', true), 1);
  assert.equal(archiveArrowDirection('ArrowLeft', true, true), null);
  assert.equal(archiveArrowDirection('Space', true), null);
});

test('rapid turns queue bounded orders and deferred inspect targets the final displayed approved card once', () => {
  let s = reduce(init(['one', 'two', 'three'], 'one'), { type: 'step', direction: 1 });
  const first = s.turn!.token;
  s = reduce(s, { type: 'step', direction: 1 });
  s = reduce(s, { type: 'inspect' });
  assert.equal(s.inspection, null);
  s = reduce(s, { type: 'finish', token: first });
  assert.equal(s.currentId, 'two');
  assert.equal(s.turn?.to, 'three');
  const second = s.turn!.token;
  s = reduce(s, { type: 'finish', token: first });
  assert.equal(s.turn?.token, second);
  s = reduce(s, { type: 'finish', token: second });
  assert.equal(s.currentId, 'three');
  assert.equal(s.inspection?.id, 'three');
  const request = s.inspection;
  assert.equal(reduce(s, { type: 'finish', token: second }).inspection, request);
  let q = reduce(s, { type: 'step', direction: 1 });
  for (let i = 0; i < 20; ++i) q = reduce(q, { type: 'step', direction: 1 });
  assert.equal(q.pending, 9);
});

test('a changed filter retains a still-visible card, clears stale turns, and selects the first valid new result', () => {
  let s = reduce(init(['one', 'two', 'three'], 'two'), { type: 'step', direction: 1 });
  const stale = s.turn!.token;
  s = reduce(reduce(s, { type: 'inspect' }), { type: 'sync', ids: ['three', 'two', 'four'] });
  assert.equal(s.currentId, 'two');
  assert.equal(s.turn, null);
  assert.equal(s.inspection, null);
  assert.equal(reduce(s, { type: 'finish', token: stale }), s);
  s = reduce(s, { type: 'sync', ids: ['one', 'four'] });
  assert.equal(s.currentId, 'one');
  s = reduce(s, { type: 'sync', ids: [] });
  assert.equal(reduce(s, { type: 'inspect' }).inspection, null);
  assert.equal(reduce(s, { type: 'step', direction: 1 }), s);
  s = reduce(s, { type: 'sync', ids: ['one', 'two'], seedId: 'two' });
  assert.equal(s.currentId, 'two');
});

test('Luna is a mirrored lift-and-deal; Grand is a vertical shutter and not another folding book', () => {
  const moon = planArchiveMotion('luna', 1, false, 440);
  const moonRTL = planArchiveMotion('luna', 1, true, 440);
  const previousLTR = planArchiveMotion('luna', -1, false, 440);
  assert.equal(moon.incoming.duration, 640);
  assert.equal(moon.outgoing.duration, 458);
  assert.match(String(moon.outgoing.frames[2].transform), /translate3d\(-\d+px,.*rotateY/);
  assert.deepEqual(moonRTL, previousLTR);
  assert.equal(moon.shutters.length, 0);

  const grand = planArchiveMotion('grand', 1, false, 440);
  const back = planArchiveMotion('grand', -1, false, 440);
  assert.equal(grand.outgoing.duration, 880);
  assert.match(String(grand.outgoing.frames[2].transform), /translate3d\(0,-20%,-116px\) rotateX\(-60deg\)/);
  assert.match(String(back.outgoing.frames[2].transform), /translate3d\(0,20%,-116px\) rotateX\(60deg\)/);
  assert.deepEqual(grand, planArchiveMotion('grand', 1, true, 440));
  assert.equal(grand.shutters.length, 2);
});

test('reduced motion starts no animations and abort cancels each independent effect', async () => {
  const gate = new AbortController();
  const calls: { canceled: number }[] = [];
  const el = {
    animate() {
      const ref = { canceled: 0 };
      calls.push(ref);
      let end: () => void = () => {};
      return { finished: new Promise<void>((resolve) => { end = resolve; }), cancel() { ++ref.canceled; end(); } };
    },
  } as unknown as Element;
  const plan = planArchiveMotion('grand', 1, false, 300);
  await playArchiveMotion(plan, { outgoing: el, incoming: el, shutters: [el, el] }, { signal: gate.signal, reduced: true });
  assert.equal(calls.length, 0);
  const work = playArchiveMotion(plan, { outgoing: el, incoming: el, shutters: [el, el] }, { signal: gate.signal });
  assert.equal(calls.length, 4);
  gate.abort();
  await work;
  assert.deepEqual(calls.map(c => c.canceled), [1, 1, 1, 1]);
});
