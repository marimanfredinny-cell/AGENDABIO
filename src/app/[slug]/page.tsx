import { notFound } from 'next/navigation';
import { store } from '@/lib/store';
import Chat from '@/components/Chat';

// Página pública gerada automaticamente a partir do cadastro do profissional.
// A especialidade define o template de triagem usado pelo concierge.
export default async function BioPage({ params }: { params: { slug: string } }) {
  const profile = await store.getPublicProfileBySlug(params.slug);
  if (!profile) notFound();

  const { professional, specialty } = profile;
  const credential = professional.registration_number
    ? professional.registration_number
    : specialty.council;

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '2rem 1.25rem' }}>
      <header style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: '50%',
            margin: '0 auto',
            background: '#cfe3d8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: 700,
            color: '#2e5b48',
          }}
        >
          {professional.display_name.charAt(0)}
        </div>
        <h1 style={{ fontSize: '1.4rem', margin: '0.6rem 0 0.15rem' }}>
          {professional.display_name}
        </h1>
        <p style={{ color: '#5a6b62', margin: 0 }}>
          {specialty.label} · {credential}
        </p>
      </header>

      <div style={{ background: '#e7efe9', borderRadius: 20, padding: '1rem' }}>
        <Chat slug={params.slug} />
      </div>

      <p style={{ textAlign: 'center', color: '#95a49b', fontSize: 12, marginTop: 12 }}>
        powered by AgendaBio
      </p>
    </main>
  );
}
