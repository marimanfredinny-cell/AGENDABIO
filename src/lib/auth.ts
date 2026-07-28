import { USE_SUPABASE } from '@/lib/config';
import { store } from '@/lib/store';
import type { PublicProfile } from '@/lib/store/types';

// Retorna o profissional logado (via sessão Supabase) ou null.
// No modo demo (sem Supabase) sempre null — o painel usa fallback por slug.
export async function getCurrentProfessional(): Promise<PublicProfile | null> {
  if (!USE_SUPABASE) return null;
  const { supabaseServerAuth } = await import('@/lib/supabase/serverAuth');
  const { data } = await supabaseServerAuth().auth.getUser();
  if (!data.user) return null;
  return store.getProfessionalByAuthId(data.user.id);
}
