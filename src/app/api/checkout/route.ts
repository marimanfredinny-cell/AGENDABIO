import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { PLANS, annualPrice } from '@/lib/plans';
import { stripe, USE_STRIPE, appUrl } from '@/lib/stripe';

export const runtime = 'nodejs';

// POST /api/checkout
// Recebe o cadastro do onboarding, cria o profissional e devolve a URL para
// onde o cliente deve ir:
//   - com Stripe: URL do Stripe Checkout (assinatura) -> paga -> success_url.
//   - sem Stripe (stub): URL da página de sucesso (confirmação instantânea).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      plan: planId,
      billing,
      display_name,
      email,
      whatsapp,
      specialty_slug,
      registration_number,
    } = body as {
      plan: string;
      billing: 'mensal' | 'anual';
      display_name: string;
      email: string;
      whatsapp?: string;
      specialty_slug: string;
      registration_number?: string;
    };

    const plan = PLANS.find((p) => p.id === planId) ?? PLANS[1];
    if (!display_name || !email || !specialty_slug) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // Cria o profissional (gera slug + monta a página a partir da especialidade).
    const { slug } = await store.createProfessional({
      display_name,
      specialty_slug,
      registration_number,
      email,
      phone: whatsapp,
      plan: plan.id,
      billing,
    });

    // ---- Modo stub (sem Stripe): confirmação instantânea ----
    if (!USE_STRIPE || !stripe) {
      return NextResponse.json({ url: `/comecar/sucesso?slug=${slug}` });
    }

    // ---- Stripe Checkout (assinatura), com Link habilitado no painel ----
    const isAnual = billing === 'anual';
    const amount = (isAnual ? annualPrice(plan.monthly) : plan.monthly) * 100;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'brl',
            unit_amount: amount,
            recurring: { interval: isAnual ? 'year' : 'month' },
            product_data: { name: `AgendaBio ${plan.name} (${billing})` },
          },
        },
      ],
      // Ativa a conta na volta, sem esperar o webhook.
      success_url: `${appUrl()}/comecar/sucesso?slug=${slug}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/comecar?cancelado=1`,
      metadata: { slug, plan: plan.id, billing },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[/api/checkout]', err);
    return NextResponse.json({ error: 'Erro ao processar' }, { status: 500 });
  }
}
