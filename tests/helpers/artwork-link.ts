import assert from 'node:assert/strict';
import { lstatSync, realpathSync, symlinkSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

// Keep the source file in its own directory, separate from the link being tested.
export function linkArtworkFixture(sourceFile: string, linkPath: string): string {
  let linkedFile = linkPath;
  try {
    symlinkSync(sourceFile, linkPath, 'file');
  } catch (error) {
    if (process.platform !== 'win32' || (error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
    // A junction links the source directory on Windows hosts that restrict file symlinks.
    symlinkSync(dirname(sourceFile), linkPath, 'junction');
    linkedFile = join(linkPath, basename(sourceFile));
  }
  assert.ok(lstatSync(linkPath).isSymbolicLink());
  assert.equal(realpathSync(linkedFile), realpathSync(sourceFile));
  return linkedFile;
}
