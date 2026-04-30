// One-shot rename: Valecroft → Valecroft across the whole project.
// Replaces all 3 case variants in source files (UTF-8 safe — no sed).
// Does NOT move directories or files; that's done in a separate shell step.
//
// Usage: node scripts/rename-valecroft-to-valecroft.mjs

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, sep } from 'path';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', '.turbo']);
const ALLOWED_EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.css', '.md']);

function* walk(dir) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
            if (SKIP_DIRS.has(entry)) continue;
            yield* walk(full);
        } else {
            const dot = entry.lastIndexOf('.');
            if (dot < 0) continue;
            const ext = entry.substring(dot);
            if (ALLOWED_EXTS.has(ext)) yield full;
        }
    }
}

let filesChanged = 0;
let totalReplacements = 0;

for (const file of walk(ROOT)) {
    const buf = readFileSync(file);
    const original = buf.toString('utf8');
    let next = original;
    let count = 0;

    // Order matters: longer/case-distinct first so case-insensitive variants don't collide.
    const before = next;
    next = next.split('VALECROFT').join('VALECROFT');
    if (next !== before) count += (before.match(/VALECROFT/g) || []).length;

    const before2 = next;
    next = next.split('Valecroft').join('Valecroft');
    if (next !== before2) count += (before2.match(/Valecroft/g) || []).length;

    const before3 = next;
    next = next.split('valecroft').join('valecroft');
    if (next !== before3) count += (before3.match(/valecroft/g) || []).length;

    if (next !== original) {
        writeFileSync(file, next, 'utf8');
        const rel = file.substring(ROOT.length + 1).split(sep).join('/');
        console.log(`  ${rel}  (${count})`);
        filesChanged++;
        totalReplacements += count;
    }
}

console.log(`\nrenamed ${totalReplacements} occurrences in ${filesChanged} files.`);
