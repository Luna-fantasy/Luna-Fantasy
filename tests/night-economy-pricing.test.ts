import test from 'node:test';
import assert from 'node:assert/strict';
import { projectTrade } from '../src/lib/cinematic/night-economy-pricing';

test('trade previews follow the supplied terms and floor each possible outcome separately', () => {
  assert.deepEqual(projectTrade(5_000, { winRate: .2, lossRate: .3 }), { win: 1_000, loss: 1_500 });
  assert.deepEqual(projectTrade(23, { winRate: .17, lossRate: .46 }), { win: 3, loss: 10 });
  assert.deepEqual(projectTrade(1, { winRate: .2, lossRate: .3 }), { win: 0, loss: 0 });
});
