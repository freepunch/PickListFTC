import Stripe from 'stripe';
import { NextResponse } from 'next/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
});

export async function POST(request: Request) {
  const { amount } = await request.json();

  // Validate: positive number, $1 minimum, $100 maximum
  const cents = Math.round(Number(amount) * 100);
  if (!cents || cents < 100 || cents > 10000) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  try {
    const origin = request.headers.get('origin') ?? 'https://picklistftc.com';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Support PickListFTC',
              description:
                'One-time donation to help keep PickListFTC free for the FTC community',
            },
            unit_amount: cents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${origin}/donate/thanks`,
      cancel_url: `${origin}/donate`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[STRIPE] Checkout session failed:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
