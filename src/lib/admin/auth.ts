import { auth } from '@/auth';
import { MASTERMIND_IDS } from './constants';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import type { Session } from 'next-auth';

/**
 * Check if a Discord ID belongs to a Mastermind.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function isMastermind(discordId: string | undefined | null): boolean {
  if (!discordId) return false;
  const input = Buffer.from(discordId);
  return MASTERMIND_IDS.some(id => {
    const target = Buffer.from(id);
    return input.length === target.length && timingSafeEqual(input, target);
  });
}

/**
 * Server component guard — redirects non-masterminds to /.
 * Call at the top of admin server components/layouts.
 */
export async function requireMastermind() {
  const session = await auth();
  if (!session?.user?.discordId || !isMastermind(session.user.discordId)) {
    redirect('/');
  }
  return session;
}

/**
 * API route guard — returns 401 for non-masterminds.
 * Call at the top of every admin API route handler.
 * Returns the session on success, or a NextResponse on failure.
 */
export async function requireMastermindApi(): Promise<
  | { authorized: true; session: Session }
  | { authorized: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.discordId || !isMastermind(session.user.discordId)) {
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { authorized: true, session };
}
