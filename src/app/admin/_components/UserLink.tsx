'use client';

import type { ReactNode } from 'react';
import { usePeek } from './PeekProvider';

interface UserLinkProps {
  userId: string;
  children?: ReactNode;
  className?: string;
  asCode?: boolean;
}

/**
 * UserLink — click wraps any Discord ID / username and opens the PlayerPeek side panel.
 * Use anywhere a user ID is rendered in the UI.
 */
export default function UserLink({ userId, children, className, asCode }: UserLinkProps) {
  const { openPeek } = usePeek();
  if (!userId) return <>{children}</>;
  const content = children ?? (asCode ? <code>{userId}</code> : userId);
  return (
    <button
      type="button"
      className={`av-user-link${className ? ' ' + className : ''}`}
      onClick={(e) => { e.stopPropagation(); openPeek(userId); }}
      title="Open player peek"
    >
      {content}
    </button>
  );
}
