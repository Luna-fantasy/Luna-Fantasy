'use client';

// Shared fetch helpers for admin dashboard client code.
//
// The dashboard historically had ~15 call sites shaped like:
//   const res = await fetch(url, { ... });
//   const data = await res.json();   // <-- called before res.ok check
//   if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
//
// That order is wrong: if the server responds with a 5xx HTML page (Next.js
// error boundary, Railway proxy timeout, etc.), `res.json()` throws before
// the caller ever reaches its own `if (!res.ok)` guard. The user then sees
// "Unknown error" instead of the actual server message.
//
// These helpers enforce the correct order (ok-check, then parse, or read a
// server error string on failure) and centralise CSRF handling so mutation
// call sites can't accidentally send an empty token.

function readCsrfCookie(): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/(?:^|;\s*)bazaar_csrf=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : '';
}

let csrfInFlight: Promise<string> | null = null;

async function fetchCsrfToken(): Promise<string> {
  const cookie = readCsrfCookie();
  if (cookie) return cookie;
  if (csrfInFlight) return csrfInFlight;
  csrfInFlight = (async () => {
    try {
      const res = await fetch('/api/admin/csrf', { cache: 'no-store', credentials: 'include' });
      if (!res.ok) return '';
      const body = (await res.json().catch(() => null)) as { token?: unknown } | null;
      return typeof body?.token === 'string' ? body.token : '';
    } finally {
      csrfInFlight = null;
    }
  })();
  return csrfInFlight;
}

// Force-refresh: skips the cookie read entirely. Used when a mutation comes
// back 403 (stale/rotated token) — the endpoint re-sets the cookie too.
async function refreshCsrfToken(): Promise<string> {
  try {
    const res = await fetch('/api/admin/csrf', { cache: 'no-store', credentials: 'include' });
    if (!res.ok) return '';
    const body = (await res.json().catch(() => null)) as { token?: unknown } | null;
    return typeof body?.token === 'string' ? body.token : '';
  } catch {
    return '';
  }
}

async function readErrorMessage(res: Response): Promise<string> {
  // Try JSON first; fall back to text; finally fall back to status.
  const ctype = res.headers.get('content-type') ?? '';
  if (ctype.includes('application/json')) {
    try {
      const body = await res.json();
      if (body && typeof body.error === 'string' && body.error.trim()) return body.error;
      if (body && typeof body.message === 'string' && body.message.trim()) return body.message;
    } catch {
      // fallthrough to status
    }
  } else {
    try {
      const text = await res.text();
      if (text && text.length < 300) return text;
    } catch {
      // fallthrough to status
    }
  }
  return `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`;
}

export interface AdminFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;      // JSON.stringify'd when not a string
  skipCsrf?: boolean;  // opt-out for the CSRF endpoint itself
}

export async function adminFetch<T = unknown>(
  url: string,
  opts: AdminFetchOptions = {},
): Promise<T> {
  const { body, skipCsrf, headers, method, ...rest } = opts;
  const verb = (method ?? (body != null ? 'POST' : 'GET')).toUpperCase();
  const finalHeaders: Record<string, string> = {
    ...(headers as Record<string, string> | undefined),
  };
  if (body !== undefined && finalHeaders['Content-Type'] == null) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  const isMutating = verb !== 'GET' && verb !== 'HEAD';
  if (isMutating && !skipCsrf && !finalHeaders['x-csrf-token']) {
    finalHeaders['x-csrf-token'] = await fetchCsrfToken();
  }
  const init: RequestInit = {
    ...rest,
    method: verb,
    headers: finalHeaders,
    cache: rest.cache ?? 'no-store',
    credentials: rest.credentials ?? 'include',
    body:
      body === undefined ? undefined
      : typeof body === 'string' ? body
      : JSON.stringify(body),
  };
  let res = await fetch(url, init);
  let retriedCsrf = false;
  if (res.status === 403 && isMutating && !skipCsrf && !retriedCsrf) {
    // Likely a stale/rotated CSRF token (e.g. cookie outlived the server
    // secret). Fetch a fresh token — this also re-sets the cookie — and
    // re-issue the request exactly once.
    retriedCsrf = true;
    const fresh = await refreshCsrfToken();
    if (fresh) {
      finalHeaders['x-csrf-token'] = fresh;
      res = await fetch(url, { ...init, headers: finalHeaders });
    }
  }
  if (!res.ok) {
    const message = await readErrorMessage(res);
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  const ctype = res.headers.get('content-type') ?? '';
  if (!ctype.includes('application/json')) {
    // A successful non-JSON response is legal but useless to typed callers.
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const adminGet = <T = unknown>(url: string, opts: AdminFetchOptions = {}) =>
  adminFetch<T>(url, { ...opts, method: 'GET' });

export const adminPost = <T = unknown>(url: string, body?: unknown, opts: AdminFetchOptions = {}) =>
  adminFetch<T>(url, { ...opts, method: 'POST', body });

export const adminPut = <T = unknown>(url: string, body?: unknown, opts: AdminFetchOptions = {}) =>
  adminFetch<T>(url, { ...opts, method: 'PUT', body });

export const adminPatch = <T = unknown>(url: string, body?: unknown, opts: AdminFetchOptions = {}) =>
  adminFetch<T>(url, { ...opts, method: 'PATCH', body });

export const adminDelete = <T = unknown>(url: string, opts: AdminFetchOptions = {}) =>
  adminFetch<T>(url, { ...opts, method: 'DELETE' });

// Non-throwing variant for call sites that want a switch on ok without try/catch.
export interface AdminResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
  status: number;
}

export async function adminTry<T = unknown>(
  url: string,
  opts: AdminFetchOptions = {},
): Promise<AdminResult<T>> {
  try {
    const data = await adminFetch<T>(url, opts);
    return { ok: true, data, error: null, status: 200 };
  } catch (e) {
    const err = e as Error & { status?: number };
    return { ok: false, data: null, error: err.message || 'Network error', status: err.status ?? 0 };
  }
}
