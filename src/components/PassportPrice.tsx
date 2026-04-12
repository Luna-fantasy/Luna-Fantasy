'use client';

import LunariIcon from './LunariIcon';

const DISCOUNT_RATE = 0.10;

interface PassportPriceProps {
  price: number;
  hasPassport: boolean;
  iconSize?: number;
  showLabel?: boolean;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * Renders a price with passport discount indicator.
 * Shows the discounted price + strikethrough original when the user holds a passport.
 */
export default function PassportPrice({ price, hasPassport, iconSize = 14, showLabel = false }: PassportPriceProps) {
  if (!hasPassport) {
    return (
      <>
        <LunariIcon size={iconSize} />
        {formatNumber(price)}
      </>
    );
  }

  const discounted = Math.floor(price * (1 - DISCOUNT_RATE));

  return (
    <span className="passport-price-wrap">
      <LunariIcon size={iconSize} />
      <span className="passport-price-discounted">{formatNumber(discounted)}</span>
      <span className="passport-price-original">{formatNumber(price)}</span>
      {showLabel && <span className="passport-price-badge">-10%</span>}
    </span>
  );
}

/**
 * Compute the discounted price for logic (balance checks, affordability).
 */
export function applyPassportDiscount(price: number, hasPassport: boolean): number {
  return hasPassport ? Math.floor(price * (1 - DISCOUNT_RATE)) : price;
}
