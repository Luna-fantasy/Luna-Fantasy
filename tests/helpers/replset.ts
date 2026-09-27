import os from 'node:os';
import path from 'node:path';
import { MongoMemoryReplSet } from 'mongodb-memory-server-core';

// Same MongoDB version as Atlas; reuses the binary luna-backup already downloaded
const MONGOD_VERSION = '8.0.32';
const DOWNLOAD_DIR = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'luna-backup', 'mongod');

export interface TestReplSet {
  uri: string;
  stop: () => Promise<void>;
}

// Transactions need a replica set, so tests get a throwaway single-node one on 127.0.0.1
export async function startTestReplSet(): Promise<TestReplSet> {
  const rs = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    binary: { version: MONGOD_VERSION, downloadDir: DOWNLOAD_DIR },
    // Test commands allow fail points (see failpoint.ts); this is the throwaway server only
    instanceOpts: [{ args: ['--setParameter', 'enableTestCommands=1'] }],
  });
  const uri = rs.getUri();
  if (!/^mongodb:\/\/127\.0\.0\.1:/.test(uri)) throw new Error(`refusing to test against ${uri}`);
  return {
    uri,
    stop: async () => {
      await rs.stop({ doCleanup: true, force: true });
    },
  };
}
