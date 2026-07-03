import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/server';
import Chat from '@/components/Chat';

// Página pública do link na bio: /dra-marina
export default async function BioPage({
  params,
}: {
  params: { slug: string };
}) {
  const db = supabaseAdmin();
  const { data: prof } = await db
    .from('professional')
    .select('display_name, headline, avatar_url')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single();

  if (!prof) notFound();

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '2rem 1.25rem' }}>
      <header style={{ textAlign: 'center', marginBottom: '1rem' }}>
        {prof.avatar_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={prof.avatar_url}
            alt={prof.display_name}
            width={72}
            height={72}
            style={{ borderRadius: '50%', objectFit: 'cover' }}
          />
        )}
        <h1 style={{ fontSize: '1.4rem', margin: '0.5rem 0 0.15rem' }}>
          {prof.display_name}
        </h1>
        {prof.headline && (
          <p style={{ color: '#666', margin: 0 }}>{prof.headline}</p>
        )}
      </header>

      <div
        style={{
          background: '#efe9e1',
          borderRadius: 20,
          padding: '1rem',
        }}
      >
        <Chat slug={params.slug} />
      </div>
    </main>
  );
}
