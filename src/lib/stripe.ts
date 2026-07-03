import Stripe from 'stripe';

export const USE_STRIPE = !!process.env.STRIPE_SECRET_KEY;

// Cliente Stripe (só use quando USE_STRIPE). Sem a chave, o onboarding roda em
// modo stub (simula pagamento aprovado) para prototipagem.
export const stripe: Stripe | null = USE_STRIPE
  ? new Stripe(process.env.STRIPE_SECRET_KEY!)
  : null;

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}
