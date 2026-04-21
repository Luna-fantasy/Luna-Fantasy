'use client';

/**
 * JsonDiff — side-by-side JSON diff with + / - / = line marks.
 *
 * Strategy: stringify both sides with stable key order, then do a line-level
 * LCS diff. Cheap, no dependency, good enough for audit before/after (≤ a few KB).
 */

function stableStringify(value: unknown, indent = 2): string {
  if (value == null) return 'null';
  const seen = new WeakSet();
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v as object)) return '[Circular]';
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(walk);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      out[k] = walk((v as Record<string, unknown>)[k]);
    }
    return out;
  };
  return JSON.stringify(walk(value), null, indent);
}

type Op = 'eq' | 'add' | 'del';
interface DiffLine { op: Op; text: string; }

/** Simple LCS over line arrays. */
function diffLines(a: string[], b: string[]): DiffLine[] {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ op: 'eq', text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ op: 'del', text: a[i] }); i++; }
    else { out.push({ op: 'add', text: b[j] }); j++; }
  }
  while (i < n) out.push({ op: 'del', text: a[i++] });
  while (j < m) out.push({ op: 'add', text: b[j++] });
  return out;
}

export default function JsonDiff({ before, after }: { before: unknown; after: unknown }) {
  const beforeStr = stableStringify(before);
  const afterStr = stableStringify(after);

  if (beforeStr === afterStr) {
    return (
      <div className="av-jd-empty">
        <span>No changes</span>
        <pre className="av-audit-json">{beforeStr}</pre>
      </div>
    );
  }

  const lines = diffLines(beforeStr.split('\n'), afterStr.split('\n'));
  let adds = 0, dels = 0;
  for (const l of lines) {
    if (l.op === 'add') adds++;
    else if (l.op === 'del') dels++;
  }

  return (
    <div className="av-jd">
      <div className="av-jd-head">
        <span className="av-jd-stat av-jd-stat-add">+{adds}</span>
        <span className="av-jd-stat av-jd-stat-del">−{dels}</span>
      </div>
      <pre className="av-jd-body">
        {lines.map((l, i) => (
          <div key={i} className={`av-jd-line av-jd-line-${l.op}`}>
            <span className="av-jd-gutter">{l.op === 'add' ? '+' : l.op === 'del' ? '−' : ' '}</span>
            <code>{l.text}</code>
          </div>
        ))}
      </pre>
    </div>
  );
}
