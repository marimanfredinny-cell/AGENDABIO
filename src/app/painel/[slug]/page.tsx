import { notFound } from 'next/navigation';
import { store } from '@/lib/store';
import PanelView from '@/components/PanelView';

// Painel por slug — usado no modo demo e para acesso direto.
// A rota protegida por sessão é /painel.
export default async function PainelSlugPage({ params }: { params: { slug: string } }) {
  const profile = await store.getPublicProfileBySlug(params.slug);
  if (!profile) notFound();
  return <PanelView profile={profile} />;
}
