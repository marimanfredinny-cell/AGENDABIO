import { IS_DEMO } from '@/lib/config';
import LoginForm from '@/components/LoginForm';

export default function EntrarPage() {
  return (
    <main style={{ maxWidth: 400, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <h1 style={{ fontSize: '1.8rem', margin: '0 0 1.5rem' }}>Entrar</h1>
      {IS_DEMO ? (
        <div
          style={{
            background: '#fff',
            border: '1px solid #eee',
            borderRadius: 14,
            padding: '1rem',
            color: '#7a8a80',
            lineHeight: 1.6,
          }}
        >
          O login por e-mail/senha exige o Supabase configurado. No modo demo,
          acesse o painel de exemplo em{' '}
          <a href="/painel/dra-marina" style={{ color: '#111' }}>/painel/dra-marina</a>.
        </div>
      ) : (
        <LoginForm />
      )}
    </main>
  );
}
