'use strict';

const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const { mkdir, readFile, rename, rm, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { randomUUID } = require('node:crypto');
const expected = require('../src/lib/cinematic/native-art-expected.json');
const exact = require('../src/lib/cinematic/native-art-available.json');
const reviewed = require('../src/lib/cinematic/native-art-v19-reviewed.json');

const releases = { ...exact, ...reviewed };
const extensions = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' };
const cdn = 'https://assets.lunarian.app/luna-v19-native/';

function matches(bytes, row) {
  return bytes.length === row.bytes && createHash('sha256').update(bytes).digest('hex') === row.sha256;
}

async function hydrate(root, id) {
  const row = releases[id];
  const ext = extensions[row.mime];
  const folder = join(root, expected[id].surface);
  const target = join(folder, id + '.' + ext);
  await mkdir(folder, { recursive: true });
  try {
    if (matches(await readFile(target), row)) return;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const url = cdn + row.sha256 + '.' + ext;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(90000) });
      if (!response.ok) throw Error('HTTP ' + response.status);
      const data = Buffer.from(await response.arrayBuffer());
      if (!matches(data, row)) throw Error('Unexpected image bytes');
      const temp = target + '.' + randomUUID() + '.tmp';
      try {
        await writeFile(temp, data, { flag: 'wx' });
        await rename(temp, target);
      } finally {
        await rm(temp, { force: true });
      }
      return;
    } catch (error) {
      if (attempt === 3) throw Error(id + ': ' + error.message, { cause: error });
      await new Promise(done => setTimeout(done, attempt * 1000));
    }
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!['build', 'start', 'verify'].includes(command)) throw Error('Expected build, start or verify');
  process.env.NEXT_PUBLIC_LUNA_ART_RELEASE = 'v19';
  if (!process.env.LUNA_NATIVE_ART_ROOT) {
    const root = join(__dirname, '..', '.luna-native');
    const ids = Object.keys(expected);
    let next = 0;
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (next < ids.length) await hydrate(root, ids[next++]);
    }));
    process.env.LUNA_NATIVE_ART_ROOT = root;
  }
  if (command === 'verify') {
    require('./check-v19-native-artwork.cjs').assertCompleteV19ArtworkRelease();
    console.log('Verified the full V19 image manifest');
    return;
  }
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), command, ...args], { stdio: 'inherit' });
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => child.kill(signal));
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
