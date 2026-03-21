import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import clientPromise from '@/lib/mongodb';

const DB_NAME = 'Database';

// Cache overrides for 60 seconds to avoid hitting MongoDB on every request
let overrideCache: Record<string, Record<string, string>> = {};
let cacheTimestamp = 0;
const CACHE_TTL = 60_000;

export function invalidateOverrideCache() {
  cacheTimestamp = 0;
}

async function getOverrides(locale: string): Promise<Record<string, string>> {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL && overrideCache[locale]) {
    return overrideCache[locale];
  }

  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const doc = await db.collection('translation_overrides').findOne({ _id: locale as any });
    const result = doc?.overrides ?? {};

    overrideCache[locale] = result;
    cacheTimestamp = now;
    return result;
  } catch {
    return overrideCache[locale] ?? {};
  }
}

function deepMergeOverrides(
  messages: Record<string, any>,
  overrides: Record<string, string>
): Record<string, any> {
  const result = { ...messages };

  for (const [dotKey, value] of Object.entries(overrides)) {
    const parts = dotKey.split('.');
    let target: any = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (typeof target[key] !== 'object' || target[key] === null) {
        target[key] = {};
      } else {
        target[key] = { ...target[key] };
      }
      target = target[key];
    }

    target[parts[parts.length - 1]] = value;
  }

  return result;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as 'en' | 'ar')) {
    locale = routing.defaultLocale;
  }

  const staticMessages = (await import(`../../messages/${locale}.json`)).default;
  const overrides = await getOverrides(locale);

  const messages = Object.keys(overrides).length > 0
    ? deepMergeOverrides(staticMessages, overrides)
    : staticMessages;

  return {
    locale,
    messages,
  };
});
