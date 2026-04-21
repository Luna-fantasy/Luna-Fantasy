/**
 * Canvas element IDs use dotted paths (e.g. "top3.1.avatar") that map to
 * nested layout objects like `layout.top3[1].avatar`. These helpers
 * traverse the dotted path so the editor reads and writes the correct
 * nested shape without mutating the DB-side structure.
 */

export function getAtPath(obj: any, path: string): any {
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function setAtPath(obj: any, path: string, value: any): any {
  const parts = path.split('.');
  const result = { ...(obj ?? {}) };
  let cur = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    cur[key] = { ...(cur[key] ?? {}) };
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
  return result;
}
