'use client';

import { useEffect } from 'react';

/**
 * Initializes a CSRF token cookie for admin mutation requests.
 * Uses the double-submit cookie pattern — client generates the token,
 * sets it as a cookie, and sends it as a header on each request.
 * The server validates they match.
 */
export default function AdminCsrfInit() {
  useEffect(() => {
    if (!document.cookie.includes('bazaar_csrf=')) {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const token = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `bazaar_csrf=${token}; path=/; max-age=86400; SameSite=Strict${secure}`;
    }
  }, []);

  return null;
}
