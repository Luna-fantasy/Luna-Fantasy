import type { MongoClient } from 'mongodb';

// Makes the next commitTransaction fail once with a retryable error, so withTransaction runs the
// whole callback a second time after every write in it has already executed. A write that isn't
// part of the transaction is then applied twice, which the money checks in the tests catch.
export async function failNextCommit(client: MongoClient): Promise<void> {
  await client.db('admin').command({
    configureFailPoint: 'failCommand',
    mode: { times: 1 },
    data: { failCommands: ['commitTransaction'], errorCode: 112, errorLabels: ['TransientTransactionError'] },
  });
}

export async function clearFailPoints(client: MongoClient): Promise<void> {
  await client.db('admin').command({ configureFailPoint: 'failCommand', mode: 'off' });
}
