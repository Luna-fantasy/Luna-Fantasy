import type { ProfileMembership } from '@/types/gameData';

function recordedDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return null;

  const calendarDay = value.slice(0, 10);
  const midnight = new Date(calendarDay + 'T00:00:00Z');
  if (!Number.isFinite(midnight.getTime()) || !midnight.toISOString().startsWith(calendarDay)) return null;

  const instant = new Date(value);
  return Number.isFinite(instant.getTime()) ? instant : null;
}

/** Website registration and a Discord server join refer to different recorded events. */
export function registeredMembership(source: ProfileMembership['source'], value: unknown): ProfileMembership | null {
  const date = recordedDate(value);
  return date ? {source, at: date.toISOString()} : null;
}

export function formatMembershipMonth(joinedAt: string | null | undefined, locale: string): string | null {
  const date = recordedDate(joinedAt);
  if (!date) return null;
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-KW' : 'en-US', {
    year: 'numeric', month: 'long', calendar: 'gregory', timeZone: 'UTC',
  }).format(date);
}
