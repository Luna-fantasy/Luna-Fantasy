import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { stripe, getLunariPackage } from '@/lib/stripe';
import { checkRateLimit, RATE_LIMITS } from '@/lib/bazaar/rate-limit';
import { validateCsrf } from '@/lib/bazaar/csrf';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.discordId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const discordId = session.user.discordId;

  // CSRF validation
  const csrfValid = await validateCsrf(request);
  if (!csrfValid) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  // Rate limit
  const rl = checkRateLimit('stripe', discordId, RATE_LIMITS.stripe.maxRequests, RATE_LIMITS.stripe.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many checkout attempts. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  try {
    const { packageId } = await request.json();
    const pkg = getLunariPackage(packageId);

    if (!pkg) {
      return NextResponse.json({ error: 'Invalid package' }, { status: 400 });
    }

    if (!pkg.stripePriceId) {
      return NextResponse.json({ error: 'Package not configured' }, { status: 500 });
    }

    const origin = request.headers.get('origin') || 'https://lunarian.app';

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: pkg.stripePriceId, quantity: 1 }],
      metadata: {
        discordId: session.user.discordId,
        packageId: pkg.id,
        lunariAmount: String(pkg.lunari),
      },
      success_url: `${origin}/bazaar?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/bazaar?purchase=cancelled`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}
