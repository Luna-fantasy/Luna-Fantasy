'use client';

import { useMobileNav } from './MobileNavProvider';

export default function MobileNavOverlay() {
  const { open, setOpen } = useMobileNav();
  return (
    <div
      className={`av-mobile-overlay${open ? ' av-mobile-overlay--open' : ''}`}
      aria-hidden={!open}
      onClick={() => setOpen(false)}
    />
  );
}
