'use client';

import Link from 'next/link';

interface Props {
  where: string;
  summary: string;
  href?: string;
}

export default function LockedNestedNotice({ where, summary, href }: Props) {
  return (
    <div className="av-games-locked">
      <span className="av-games-locked-glyph" aria-hidden="true">🔒</span>
      <div className="av-games-locked-body">
        <strong className="av-games-locked-where">{where}</strong>
        <span className="av-games-locked-summary">{summary}</span>
      </div>
      {href && (
        <Link href={href} className="av-games-locked-link">Open →</Link>
      )}
    </div>
  );
}
