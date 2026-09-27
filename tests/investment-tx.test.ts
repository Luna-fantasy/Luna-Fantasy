import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';
import { startTestReplSet, type TestReplSet } from './helpers/replset';
import { holdDocument } from './helpers/hold';
import { failNextCommit, clearFailPoints } from './helpers/failpoint';
import { investmentStartMs, withdrawInvestmentTx, depositInvestmentTx, type InvestmentTerms } from '../src/lib/bank/investment-tx';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 1, 12, 0, 0);
const USER = '444444444444444444';
const TERMS: InvestmentTerms = { maturityMs: 30 * DAY, profitRate: 0.3, earlyFee: 5000, depositLockMs: 7 * DAY };

let rs: TestReplSet;
let client: MongoClient;
const db = () => client.db('Database');
const bank = () => db().collection<any>('bank');
const points = () => db().collection<any>('points');
const balance = async () => (await points().findOne({ _id: USER }))?.balance;
const reserve = async () => (await db().collection<any>('system').findOne({ _id: 'luna_bank_reserve' }))?.value ?? 0;
const inv = async () => (await bank().findOne({ _id: USER }))?.investment;

function deposit(amount: number, startDate: number | string, extra: Record<string, unknown> = {}) {
  return { amount, startDate, lastDepositDate: startDate, depositLocked: false, active: true, ...extra };
}

before(async () => {
  rs = await startTestReplSet();
  client = new MongoClient(rs.uri);
  await client.connect();
});

after(async () => {
  await client?.close();
  await rs?.stop();
});

beforeEach(async () => {
  await clearFailPoints(client);
  await db().dropDatabase();
});

test('investmentStartMs reads ISO strings and epoch ms', () => {
  assert.equal(investmentStartMs('2026-02-23T21:39:00.000Z'), Date.UTC(2026, 1, 23, 21, 39));
  assert.equal(investmentStartMs(NOW), NOW);
  assert.equal(investmentStartMs(new Date(NOW)), NOW);
  assert.equal(investmentStartMs(String(NOW)), NOW);
  for (const bad of [undefined, null, '', 'nope', 0, -1, '1', '2001', 5, 1_700_000_000, 'Feb 23 2026']) {
    assert.equal(investmentStartMs(bad as any), null, String(bad));
  }
});

test('a matured deposit is paid once and cleared entirely (0.1)', async () => {
  await points().insertOne({ _id: USER, balance: 1000 });
  await bank().insertOne({ _id: USER, loans: [{ amount: 7 }], investment: deposit(100000, new Date(NOW - 31 * DAY).toISOString()) });
  const r = await withdrawInvestmentTx(client, USER, TERMS, NOW);
  assert.ok(r);
  assert.deepEqual({ payout: r.payout, profit: r.profit, early: r.early, balanceAfter: r.balanceAfter }, { payout: 130000, profit: 30000, early: false, balanceAfter: 131000 });
  const doc = await bank().findOne({ _id: USER });
  assert.equal(doc.investment, null, 'no inactive record with an amount is left for Butler to pay again');
  assert.deepEqual(doc.loans, [{ amount: 7 }]);
  assert.equal(await withdrawInvestmentTx(client, USER, TERMS, NOW), null);
  assert.equal(await balance(), 131000);
});

test('a deposit Butler created (epoch ms start) is handled the same way', async () => {
  await bank().insertOne({ _id: USER, investment: deposit(20000, NOW - 31 * DAY) });
  const r = await withdrawInvestmentTx(client, USER, TERMS, NOW);
  assert.equal(r?.payout, 26000);
  assert.equal(await balance(), 26000);
});

test('ten simultaneous withdrawals pay exactly once', async () => {
  await points().insertOne({ _id: USER, balance: 0 });
  await bank().insertOne({ _id: USER, investment: deposit(15_000_000, NOW - 31 * DAY) });
  const results = await Promise.all(Array.from({ length: 10 }, () => withdrawInvestmentTx(client, USER, TERMS, NOW)));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await balance(), 19_500_000);
});

test('an inactive record left by the old withdraw is not paid again', async () => {
  await points().insertOne({ _id: USER, balance: 10 });
  await bank().insertOne({ _id: USER, investment: deposit(50000, NOW - 40 * DAY, { active: false }) });
  assert.equal(await withdrawInvestmentTx(client, USER, TERMS, NOW), null);
  assert.equal(await balance(), 10);
});

test('an early withdrawal pays the amount minus the fee', async () => {
  await bank().insertOne({ _id: USER, investment: deposit(40000, new Date(NOW - 2 * DAY).toISOString()) });
  const r = await withdrawInvestmentTx(client, USER, TERMS, NOW);
  assert.deepEqual({ payout: r?.payout, profit: r?.profit, early: r?.early }, { payout: 35000, profit: -5000, early: true });
  assert.equal(await balance(), 35000);
});

test('if crediting fails the withdrawal is rolled back, without showing the raw database error', async () => {
  await points().insertOne({ _id: USER, balance: 'broken' });
  await bank().insertOne({ _id: USER, investment: deposit(100000, NOW - 31 * DAY) });
  await assert.rejects(withdrawInvestmentTx(client, USER, TERMS, NOW), (e: Error) => /^Internal/.test(e.message) && !/\$inc/.test(e.message));
  assert.equal((await inv()).active, true);
  assert.equal(await balance(), 'broken');
});

test('a new deposit takes the money, adds it to the reserve and uses an ISO start date', async () => {
  await points().insertOne({ _id: USER, balance: 50000 });
  const r = await depositInvestmentTx(client, USER, 20000, TERMS, NOW);
  assert.equal(r.balanceAfter, 30000);
  const iso = new Date(NOW).toISOString();
  assert.deepEqual(await inv(), { amount: 20000, startDate: iso, lastDepositDate: iso, depositLocked: false, active: true });
  assert.deepEqual(r.investment, await inv());
  assert.equal(await reserve(), 20000);
});

test('a top-up within the window adds to the running deposit', async () => {
  await points().insertOne({ _id: USER, balance: 50000 });
  await bank().insertOne({ _id: USER, investment: deposit(20000, NOW - 2 * DAY) });
  const r = await depositInvestmentTx(client, USER, 25000, TERMS, NOW);
  assert.equal(r.investment.amount, 45000);
  const stored = await inv();
  assert.equal(stored.amount, 45000);
  assert.equal(stored.startDate, NOW - 2 * DAY, 'start date is kept');
  assert.equal(stored.lastDepositDate, new Date(NOW).toISOString());
  assert.equal(await balance(), 25000);
});

test('a top-up after the window closes is refused and changes nothing', async () => {
  await points().insertOne({ _id: USER, balance: 50000 });
  await bank().insertOne({ _id: USER, investment: deposit(20000, NOW - 8 * DAY) });
  await assert.rejects(depositInvestmentTx(client, USER, 20000, TERMS, NOW), /Deposit window has closed/);
  assert.equal(await balance(), 50000);
  assert.equal((await inv()).amount, 20000);
});

test('not enough balance is refused and changes nothing', async () => {
  await points().insertOne({ _id: USER, balance: 19999 });
  await assert.rejects(depositInvestmentTx(client, USER, 20000, TERMS, NOW), /Insufficient balance/);
  assert.equal(await balance(), 19999);
  assert.equal(await inv(), undefined);
  assert.equal(await reserve(), 0);
});

test('simultaneous deposits never lose money: one deposit holding every accepted amount', async () => {
  await points().insertOne({ _id: USER, balance: 70000 });
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => depositInvestmentTx(client, USER, 20000, TERMS, NOW)));
  const accepted = results.filter((r) => r.status === 'fulfilled').length;
  assert.equal(accepted, 3, 'the balance covers three');
  assert.equal(await balance(), 10000);
  assert.equal((await inv()).amount, 60000);
  assert.equal(await reserve(), 60000);
});

test('a top-up racing a withdrawal can never bring the paid-out deposit back', async () => {
  for (let round = 0; round < 15; round++) {
    await db().dropDatabase();
    await points().insertOne({ _id: USER, balance: 50000 });
    await bank().insertOne({ _id: USER, investment: deposit(20000, NOW - DAY) });
    await Promise.allSettled([withdrawInvestmentTx(client, USER, TERMS, NOW), depositInvestmentTx(client, USER, 20000, TERMS, NOW)]);
    const stored = await inv();
    const held = (await balance()) + (stored?.active ? stored.amount : 0);
    // 50,000 + 20,000 in the deposit, less the 5,000 early fee, whichever order the two ran in
    assert.equal(held, 65000, `round ${round}: balance plus deposit is ${held}`);
  }
});

test('a record with an amount but no active flag is never overwritten by a new deposit', async () => {
  await points().insertOne({ _id: USER, balance: 50000 });
  await bank().insertOne({ _id: USER, investment: { amount: 80000, startDate: NOW - 5 * DAY } });
  await assert.rejects(depositInvestmentTx(client, USER, 20000, TERMS, NOW), /already have an active deposit/);
  assert.equal((await inv()).amount, 80000);
  assert.equal(await balance(), 50000);
  assert.equal(await reserve(), 0);
});

test('a withdrawal forced to retry by a write conflict pays once', async () => {
  await points().insertOne({ _id: USER, balance: 0 });
  await bank().insertOne({ _id: USER, investment: deposit(100000, NOW - 31 * DAY) });
  const { released } = await holdDocument(client, 'points', USER, 300);
  const r = await withdrawInvestmentTx(client, USER, TERMS, NOW);
  await released;
  assert.equal(r?.payout, 130000);
  assert.equal(await balance(), 130000);
  assert.equal(await inv(), null);
});

test('a top-up forced to retry by a write conflict moves the money once', async () => {
  await points().insertOne({ _id: USER, balance: 50000 });
  await bank().insertOne({ _id: USER, investment: deposit(20000, NOW - DAY) });
  const { released } = await holdDocument(client, 'system', 'luna_bank_reserve', 300);
  await depositInvestmentTx(client, USER, 20000, TERMS, NOW);
  await released;
  assert.equal(await balance(), 30000);
  assert.equal((await inv()).amount, 40000);
  assert.equal(await reserve(), 20000);
});

test('a new deposit forced to retry by a write conflict moves the money once', async () => {
  await points().insertOne({ _id: USER, balance: 50000 });
  const { released } = await holdDocument(client, 'system', 'luna_bank_reserve', 300);
  await depositInvestmentTx(client, USER, 20000, TERMS, NOW);
  await released;
  assert.equal(await balance(), 30000);
  assert.equal((await inv()).amount, 20000);
  assert.equal(await reserve(), 20000);
});

test('a withdrawal replayed after a failed commit pays once', async () => {
  await points().insertOne({ _id: USER, balance: 0 });
  await bank().insertOne({ _id: USER, investment: deposit(100000, NOW - 31 * DAY) });
  await failNextCommit(client);
  const r = await withdrawInvestmentTx(client, USER, TERMS, NOW);
  assert.equal(r?.payout, 130000);
  assert.equal(await balance(), 130000);
  assert.equal(await inv(), null);
});

test('a top-up replayed after a failed commit moves the money once', async () => {
  await points().insertOne({ _id: USER, balance: 50000 });
  await bank().insertOne({ _id: USER, investment: deposit(20000, NOW - DAY) });
  await failNextCommit(client);
  await depositInvestmentTx(client, USER, 20000, TERMS, NOW);
  assert.equal(await balance(), 30000);
  assert.equal((await inv()).amount, 40000);
  assert.equal(await reserve(), 20000);
});

test('a new deposit replayed after a failed commit moves the money once', async () => {
  await points().insertOne({ _id: USER, balance: 50000 });
  await failNextCommit(client);
  await depositInvestmentTx(client, USER, 20000, TERMS, NOW);
  assert.equal(await balance(), 30000);
  assert.equal((await inv()).amount, 20000);
  assert.equal(await reserve(), 20000);
});
