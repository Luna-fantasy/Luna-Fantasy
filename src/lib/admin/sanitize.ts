import crypto from 'crypto';

/**
 * Recursively checks if any key in an object starts with '$' or contains '.'.
 * These are MongoDB operator injection vectors.
 * More thorough than string-based `json.includes('"$')` which misses nested keys.
 */
export function hasMongoOperator(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  if (Array.isArray(obj)) return obj.some(hasMongoOperator);
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (key.startsWith('$') || key.includes('.')) return true;
    if (hasMongoOperator((obj as Record<string, unknown>)[key])) return true;
  }
  return false;
}

/**
 * Strip sensitive data from error messages before returning to the client.
 * Prevents leaking MongoDB URIs, internal IPs, server paths, or module paths.
 */
export function sanitizeErrorMessage(msg: string): string {
  return msg
    .replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, '[DB]')
    .replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?/g, '[INTERNAL]')
    .replace(/\/root\/[^\s"')]+/g, '[PATH]')
    .replace(/[A-Z]:\\[^\s"')]+/gi, '[PATH]')
    .replace(/node_modules\/[^\s"')]+/g, '[MODULE]');
}

/**
 * Extract the real client IP from request headers.
 * Prefers x-real-ip (set by reverse proxy), falls back to last x-forwarded-for entry
 * (the one added by the proxy, not the client's claim).
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ??
    'unknown'
  );
}
