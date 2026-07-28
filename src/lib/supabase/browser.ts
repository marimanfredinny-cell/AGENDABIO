'use client';

import { createBrowserClient } from '@supabase/ssr';

// Cliente Supabase para o browser (anon key). Guarda a sessão em cookies para
// o servidor conseguir ler. Só faz sentido quando Supabase está configurado.
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
