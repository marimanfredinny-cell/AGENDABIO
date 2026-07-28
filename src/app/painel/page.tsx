import { redirect } from 'next/navigation';
import { USE_SUPABASE } from '@/lib/config';
import { getCurrentProfessional } from '@/lib/auth';
import PanelView from '@/components/PanelView';

// Painel protegido: resolve o profissional pela sessão do Supabase.
// - Com Supabase: sem sessão -> /entrar; com sessão sem perfil -> /comecar.
// - Modo demo (sem Supabase): não há login, então redireciona para um exemplo.
export default async function PainelPage() {
  if (!USE_SUPABASE) redirect('/painel/dra-marina');

  const profile = await getCurrentProfessional();
  if (!profile) redirect('/entrar');
  return <PanelView profile={profile} />;
}
