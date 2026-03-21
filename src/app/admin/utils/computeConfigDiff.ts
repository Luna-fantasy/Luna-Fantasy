interface DiffEntry {
  label: string;
  before: string;
  after: string;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '(empty)';
  if (typeof v === 'boolean') return v ? 'Enabled' : 'Disabled';
  if (typeof v === 'number') return v.toLocaleString();
  if (typeof v === 'string') return v || '(empty)';
  if (Array.isArray(v)) return `[${v.length} items]`;
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 80);
  return String(v);
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Recursively compares two config objects and returns human-readable diff entries.
 */
export function computeConfigDiff(
  before: Record<string, any>,
  after: Record<string, any>,
  prefix = '',
): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  for (const key of allKeys) {
    const b = before[key];
    const a = after[key];
    const label = prefix ? `${prefix} > ${humanizeKey(key)}` : humanizeKey(key);

    if (JSON.stringify(b) === JSON.stringify(a)) continue;

    // Recurse into nested objects (but not arrays)
    if (
      b && a &&
      typeof b === 'object' && typeof a === 'object' &&
      !Array.isArray(b) && !Array.isArray(a)
    ) {
      entries.push(...computeConfigDiff(b, a, label));
    } else {
      entries.push({ label, before: formatValue(b), after: formatValue(a) });
    }
  }

  return entries;
}
