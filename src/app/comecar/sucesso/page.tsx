import Link from 'next/link';
import { stripe, USE_STRIPE } from '@/lib/stripe';
import { store } from '@/lib/store';

// Página de sucesso = confirmação instantânea.
// Com Stripe: confere payment_status na hora (não espera webhook).
// Sem Stripe (stub): já chega confirmado.
export default async function SucessoPage({
  searchParams,
}: {
  searchParams: { slug?: string; session_id?: string };
}) {
  const slug = searchParams.slug;
  let paid = true;

  if (USE_STRIPE && stripe && searchParams.session_id) {
    try {
      const s = await stripe.checkout.sessions.retrieve(searchParams.session_id);
      paid = s.payment_status === 'paid' || s.status === 'complete';
    } catch {
      paid = false;
    }
  }

  // Ativa a conta na hora quando o pagamento confirma (não espera o webhook).
  if (paid && slug) {
    await store.activateProfessional(slug);
  }

  return (
    <main
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '4rem 1.5rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: paid ? '#111' : '#eee',
          color: '#fff',
          fontSize: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem',
        }}
      >
        {paid ? '✓' : '…'}
      </div>

      {paid ? (
        <>
          <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.4rem' }}>Conta confirmada!</h1>
          <p style={{ color: '#555', lineHeight: 1.6 }}>
            Sua página já está no ar. O concierge de triagem foi montado
            automaticamente para a sua especialidade.
          </p>
          {slug && (
            <div style={{ marginTop: '1.5rem', display: 'grid', gap: 10 }}>
              <Link
                href={`/${slug}`}
                style={{
                  display: 'block',
                  padding: '0.9rem',
                  borderRadius: 14,
                  background: '#111',
                  color: '#fff',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Ver minha página →
              </Link>
              <Link
                href={`/painel/${slug}`}
                style={{
                  display: 'block',
                  padding: '0.8rem',
                  borderRadius: 14,
                  border: '1px solid #ddd',
                  color: '#111',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Ir para o painel
              </Link>
              <Link
                href={`/painel/${slug}`}
                style={{
                  display: 'block',
                  padding: '0.8rem',
                  borderRadius: 14,
                  border: '1px solid #ddd',
                  color: '#111',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Ir para o painel
              </Link>
              <code style={{ color: '#888', fontSize: 13 }}>agendabio.com.br/{slug}</code>
            </div>
          )}
        </>
      ) : (
        <>
          <h1 style={{ fontSize: '1.4rem' }}>Pagamento não confirmado</h1>
          <p style={{ color: '#555' }}>
            Não conseguimos confirmar o pagamento. Tente novamente.
          </p>
          <Link href="/comecar">Voltar</Link>
        </>
      )}
    </main>
  );
}
