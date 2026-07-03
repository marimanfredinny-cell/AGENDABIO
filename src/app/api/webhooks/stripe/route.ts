import { NextRequest, NextResponse } from 'next/server';
import { stripe, USE_STRIPE } from '@/lib/stripe';

export const runtime = 'nodejs';

// POST /api/webhooks/stripe
// Fonte da verdade da assinatura (renovação, cancelamento, falha de cobrança).
// A liberação de acesso já acontece na success_url; aqui atualizamos o status
// da assinatura ao longo do tempo. Configure STRIPE_WEBHOOK_SECRET.
export async function POST(req: NextRequest) {
  if (!USE_STRIPE || !stripe) {
    return NextResponse.json({ skipped: 'Stripe não configurado' });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get('stripe-signature');
  const raw = await req.text();

  let event;
  try {
    event = secret && sig
      ? stripe.webhooks.constructEvent(raw, sig, secret)
      : JSON.parse(raw);
  } catch (err) {
    return NextResponse.json({ error: `Assinatura inválida: ${err}` }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed':
      // Assinatura criada. O acesso já foi liberado na success_url.
      // TODO: persistir subscription_id/customer_id no professional (via metadata.slug).
      break;
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      // TODO: refletir status (ativo/cancelado/inadimplente) no professional.
      break;
    case 'invoice.payment_failed':
      // TODO: marcar pendência / notificar profissional.
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
