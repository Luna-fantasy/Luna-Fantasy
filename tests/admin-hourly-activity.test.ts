import assert from 'node:assert/strict';
import test from 'node:test';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { getHourlyTransactions } from '../src/lib/admin/hourly-transactions';

test('overview counts every transaction in the 24h window using UTC and legacy timestamps', async () => {
  const server = await MongoMemoryServer.create();
  const client = new MongoClient(server.getUri());
  try {
    const collection = client.db('dashboard_test').collection('transactions');
    const now = new Date('2026-11-22T13:30:00Z');
    const documents = Array.from({ length: 120 }, () => ({ createdAt: new Date('2026-11-22T03:00:00Z') }));
    await collection.insertMany([
      ...documents, { createdAt: '2026-11-22T10:00:00+03:00' }, { timestamp: new Date('2026-11-21T13:31:00Z') },
      { timestamp: '2026-11-22T12:00:00Z' }, { createdAt: now.getTime() }, { createdAt: now, timestamp: now },
      { createdAt: new Date('2026-11-21T13:29:59Z') }, { createdAt: new Date(now.getTime() + 1) },
      { timestamp: 'unknown' }, { username: 'undated' },
    ]);
    const bins = await getHourlyTransactions(collection, now);
    assert.equal(bins.length, 24);
    assert.equal(bins[3], 120);
    assert.equal(bins[7], 1);
    assert.equal(bins[12], 1);
    assert.equal(bins[13], 3);
    assert.equal(bins.reduce((sum, count) => sum + count, 0), 125);
  } finally {
    await client.close();
    await server.stop();
  }
});
