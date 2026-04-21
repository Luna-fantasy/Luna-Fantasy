'use client';

interface AvPageFooterProps {
  variant?: 'scroll' | 'sigil';
  showBuildBadge?: boolean;
}

const BUILD_SHA = (process.env.NEXT_PUBLIC_BUILD_SHA ?? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7);

export default function AvPageFooter({ variant = 'scroll', showBuildBadge = true }: AvPageFooterProps) {
  return (
    <footer className="av-page-footer" data-variant={variant} aria-hidden="true">
      <div className="av-page-footer-line" />
      <div className="av-page-footer-sigil">
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="17" cy="17" r="10" stroke="currentColor" strokeWidth="0.75" opacity="0.55" />
          <path d="M17 8 L18.4 15.6 L26 17 L18.4 18.4 L17 26 L15.6 18.4 L8 17 L15.6 15.6 Z" fill="currentColor" opacity="0.65" />
          <circle cx="17" cy="17" r="2" fill="currentColor" />
        </svg>
      </div>
      <div className="av-page-footer-line" />
      <span className="av-page-footer-text">— end of scroll —</span>
      {showBuildBadge && (
        <span className="av-page-footer-build" title="Build commit">
          v2 · {BUILD_SHA}
        </span>
      )}
    </footer>
  );
}
