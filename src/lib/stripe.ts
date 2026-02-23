import Stripe from 'stripe';
import type { LunariPackage } from '@/types/bazaar';

// Server-side Stripe client — lazy init to avoid build-time errors
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
    _stripe = new Stripe(key, { apiVersion: '2026-01-28.clover' });
  }
  return _stripe;
}

// Keep `stripe` export for convenience (will throw at runtime if key missing, not at build)
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  },
});

// Lunari packages — update stripePriceId values after creating products in Stripe Dashboard
export const LUNARI_PACKAGES: LunariPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    lunari: 5_000,
    usd: 0.99,
    stripePriceId: process.env.STRIPE_PRICE_STARTER || '',
  },
  {
    id: 'explorer',
    name: 'Explorer',
    lunari: 25_000,
    usd: 3.99,
    stripePriceId: process.env.STRIPE_PRICE_EXPLORER || '',
  },
  {
    id: 'champion',
    name: 'Champion',
    lunari: 60_000,
    usd: 7.99,
    stripePriceId: process.env.STRIPE_PRICE_CHAMPION || '',
  },
  {
    id: 'legend',
    name: 'Legend',
    lunari: 150_000,
    usd: 14.99,
    stripePriceId: process.env.STRIPE_PRICE_LEGEND || '',
  },
  {
    id: 'mythic',
    name: 'Mythic',
    lunari: 500_000,
    usd: 39.99,
    stripePriceId: process.env.STRIPE_PRICE_MYTHIC || '',
  },
];

export function getLunariPackage(id: string): LunariPackage | undefined {
  return LUNARI_PACKAGES.find((p) => p.id === id);
}
