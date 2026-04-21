/**
 * Canonical Jester vendor registry. The set of 5 vendors is fixed by the bot
 * (Brimor / Broker / Mells Selvair / Kael Vandar / Stonebox), so we keep their
 * display labels, default metadata, and accent tones as code rather than DB —
 * they need to render correctly even before any admin saves an override.
 *
 * Anything in `VENDOR_DEFAULTS` is only used as a fallback when the live
 * `vendor_config` document doesn't have a value for that field.
 */

export const VENDOR_LABELS: Record<string, string> = {
  brimor: 'Brimor',
  broker: 'Broker',
  mells_selvair: 'Mells Selvair',
  luckbox: 'Kael Vandar',
  stonebox: 'Stonebox',
};

// Canonical Seluna defaults — mirror of LunaJesterMain/config.ts:688-691.
// Used by the Seluna editor and API so fields never render blank when the
// admin hasn't saved overrides yet.
export const SELUNA_DEFAULTS = {
  title: 'Seluna - The Moonlight Merchant',
  description:
    'Greetings, traveler. I am Seluna, keeper of rare treasures beneath the moonlight. My shop appears only once each month for 24 hours. Choose wisely.',
  image: 'https://assets.lunarian.app/jester/icons/seluna.png',
  imageVersion: 20260414,
} as const;

// Canonical Zoldar defaults — mirror of LunaJesterMain/config.ts:633-644.
export const ZOLDAR_DEFAULTS = {
  title: 'Mooncarver',
  description:
    "I'm Zoldar the Mooncarver. Here I serve fine meats and super potions so you can continue dominating Jester's Playground.",
  image: 'https://assets.lunarian.app/jester/shops/zoldar_mooncarver.png',
  imageVersion: 20260418,
} as const;

// Canonical Meluna defaults — portrait at jester/icons/meluna.png, from
// LunaJesterMain/config.ts moon_stones.box + hardcoded persona.
export const MELUNA_DEFAULTS = {
  title: 'Meluna',
  description: 'Moon Stone merchant. Pay Lunari, pull a random stone. Misses refund half the price.',
  image: 'https://assets.lunarian.app/jester/icons/meluna.png',
  imageVersion: 20260418,
} as const;

export interface VendorDefaults {
  title: string;
  description: string;
  image: string;
}

export const VENDOR_DEFAULTS: Record<string, VendorDefaults> = {
  luckbox: {
    title: 'Kael Vandar',
    description: 'Welcome to The Crescent Exchange — I am Kael Vandar, the only Luna Fantasy card seller in Lunvor.',
    image: 'https://assets.lunarian.app/jester/shops/kael_vandar.png',
  },
  brimor: {
    title: 'Brimor',
    description: '',
    image: 'https://assets.lunarian.app/jester/shops/brimor.png',
  },
  broker: {
    title: 'Broker',
    description: '',
    image: '',
  },
  mells_selvair: {
    title: 'Mells Selvair',
    description: '',
    image: '',
  },
  stonebox: {
    title: 'Stonebox',
    description: '',
    image: '',
  },
};

export const VENDOR_TONES: Record<string, string> = {
  brimor: '#fbbf24',
  broker: '#a855f7',
  mells_selvair: '#06b6d4',
  luckbox: '#22c55e',
  stonebox: '#3b82f6',
};
