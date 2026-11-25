import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { nextPillar, pillars } from '../src/app/[locale]/about/pillars';

test('each original pillar links to its section and uses its own local artwork',()=>{
  assert.deepEqual(pillars.map(p=>p.href),['/story','/luna-fantasy','/bazaar','/members']);
  assert.equal(new Set(pillars.map(p=>p.art)).size,4);
  for(const p of pillars) assert.ok(existsSync(path.join('public',p.art)));
});

test('physical arrows mirror in Arabic, wrap at the edge, and preserve native Tab and Enter',()=>{
  assert.equal(nextPillar(0,'ArrowRight',false),1);
  assert.equal(nextPillar(0,'ArrowLeft',true),1);
  assert.equal(nextPillar(0,'ArrowRight',true),3);
  assert.equal(nextPillar(2,'Home',true),0);
  assert.equal(nextPillar(1,'End',false),3);
  assert.equal(nextPillar(2,'Tab',false),undefined);
  assert.equal(nextPillar(2,'Enter',true),undefined);
});
