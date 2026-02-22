import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { creditLunari, addToBankReserve, isStripeSessionProcessed, getBalance } from '@/lib/bazaar/lunari-ops';
import clientPromise from '@/lib/mongodb';

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { discordId, packageId, lunariAmount } = session.metadata || {};

    if (!discordId || !lunariAmount) {
      console.error('Missing metadata in Stripe session:', session.id);
      return NextResponse.json({ received: true });
    }

    // Idempotency check
    const alreadyProcessed = await isStripeSessionProcessed(session.id);
    if (alreadyProcessed) {
      console.log('Stripe session already processed:', session.id);
      return NextResponse.json({ received: true });
    }

    const amount = parseInt(lunariAmount, 10);

    try {
      const client = await clientPromise;
      const db = client.db('Database');
      const balanceBefore = await getBalance(discordId);

      // Insert transaction FIRST with pending status (idempotency marker)
      const txnData = {
        discordId,
        type: 'stripe_purchase',
        amount,
        balanceBefore,
        balanceAfter: balanceBefore, // placeholder until credit succeeds
        metadata: {
          stripeSessionId: session.id,
          stripePaymentIntentId: session.payment_intent as string,
          packageId: packageId || undefined,
        },
        createdAt: new Date(),
        source: 'web',
        status: 'pending',
      };
      const insertResult = await db.collection('lunari_transactions').insertOne(txnData);

      try {
        const { balanceAfter } = await creditLunari(discordId, amount);
        await addToBankReserve(amount);
        await db.collection('lunari_transactions').updateOne(
          { _id: insertResult.insertedId },
          { $set: { status: 'completed', balanceAfter } }
        );
      } catch (creditErr) {
        // Credit failed — remove the pending transaction so it can be retried
        await db.collection('lunari_transactions').deleteOne({ _id: insertResult.insertedId });
        throw creditErr;
      }
    } catch (err) {
      console.error('Error processing Stripe webhook:', err);
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
