import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const launcher = '../scripts/stage-v19-visual-overlay.cjs';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPgk88AAADUAJazp7vjAAAAAElFTkSuQmCC', 'base64');
const id = 'LUNA-0001', second = 'LUNA-0002';

test('combining V19 with reviewed inspectors is deliberate and all three exact review flags travel together', () => {
  const { parsePreviewArgs } = require(launcher);
  const original = ['overlay.json', 'C:\\QA Workspace\\V19', 'a'.repeat(64)];
  assert.equal(parsePreviewArgs(original).reviewed, undefined);
  assert.throws(() => parsePreviewArgs([...original, '--reviewed-root=review']), /all three|together/i);
  assert.throws(() => parsePreviewArgs([...original, '--reviewed-bogus=review']), /usage|flag/i);
  const flags = ['--reviewed-ledger=reviewed.json', '--reviewed-root=C:\\QA Workspace\\reviewed', '--reviewed-sha256=' + 'b'.repeat(64)];
  assert.deepEqual(parsePreviewArgs([...original, ...flags, '--serve=3095']).reviewed,
    { ledger:'reviewed.json', root:'C:\\QA Workspace\\reviewed', sha256:'b'.repeat(64) });
  assert.throws(() => parsePreviewArgs([...original, ...flags, '--reviewed-root=other']), /duplicate/i);
});

test('only a complete authenticated reviewed ledger adds separate route and client pins to the combined dev run', (t) => {
  const { prepareCombinedReview, reviewedChildEnv } = require(launcher);
  const dir = mkdtempSync(join(tmpdir(), 'luna-combine-test-'));
  t.after(() => rmSync(dir, { recursive:true, force:true }));
  const historical = {
    [id]: { sha256:'a'.repeat(64), width:1, height:1 },
    [second]: { sha256:'b'.repeat(64), width:1, height:1 },
  };
  const row = { id, historical_sha256:historical[id].sha256, replacement_sha256:sha(png), dimensions:[1,1],
    file:id+'.png', origin:'new-reconstruction', status:'reviewed-locally-not-published' };
  const data = Buffer.from(JSON.stringify([row]));
  const pin = { ledger:join(dir, 'reviewed.json'), root:dir, sha256:sha(data) };
  writeFileSync(pin.ledger,data);
  writeFileSync(join(dir,id+'.png'),png);
  assert.throws(() => prepareCombinedReview({...pin, sha256:'9'.repeat(64)}, historical, {}), /SHA-256|pin/i);
  assert.throws(() => prepareCombinedReview(pin, historical, {}), /incomplete.*LUNA-0002/i);
  const stage = prepareCombinedReview(pin,historical,{[second]:historical[second]});
  assert.deepEqual(stage.summary,{ expected:2, exact:1, reviewed:1, uncovered:[] });
  assert.deepEqual(reviewedChildEnv(undefined,dir),{});
  const env = reviewedChildEnv(stage,dir);
  assert.equal(env.LUNA_DEV_RECONSTRUCTION_PREVIEW,'1');
  assert.equal(env.NEXT_PUBLIC_LUNA_DEV_RECONSTRUCTION_INSPECTORS,'1');
  assert.deepEqual(JSON.parse(env.NEXT_PUBLIC_LUNA_DEV_RECONSTRUCTION_INSPECTOR_SHA256S),{[id]:sha(png)});
  const persisted = readFileSync(env.LUNA_DEV_RECONSTRUCTION_MANIFEST);
  assert.equal(sha(persisted),env.LUNA_DEV_RECONSTRUCTION_MANIFEST_SHA256);
  assert.equal(JSON.parse(persisted.toString()).kind,'luna-reviewed-reconstruction-staging-v1');
  assert.deepEqual(Object.keys(JSON.parse(persisted.toString()).entries),[id]);
});
