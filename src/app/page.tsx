import { IS_DEMO } from '@/lib/config';

export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>AgendaBio</h1>
      <p style={{ color: '#4a5b53', lineHeight: 1.6 }}>
        O link na bio da saúde que <strong>conversa</strong>, qualifica o lead e
        agenda — em vez de só listar botões. A triagem se adapta à especialidade
        do profissional.
      </p>
      <p style={{ marginTop: '2rem' }}>
        <a
          href="/comecar"
          style={{
            display: 'inline-block',
            padding: '0.8rem 1.4rem',
            borderRadius: 14,
            background: '#111',
            color: '#fff',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Criar minha página →
        </a>
      </p>

      <p style={{ marginTop: '1.5rem' }}>
        Exemplos ({IS_DEMO ? 'modo demo' : 'via Supabase'}):{' '}
        <a href="/dra-marina">/dra-marina</a> (psicóloga)
        {IS_DEMO && (
          <>
            {' · '}
            <a href="/dr-nutri">/dr-nutri</a> (nutricionista)
          </>
        )}
      </p>
    </main>
  );
}
