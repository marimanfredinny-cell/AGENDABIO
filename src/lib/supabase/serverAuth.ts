import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Cliente Supabase ligado aos cookies da requisição (para ler a sessão em
// Server Components / Route Handlers). Em Server Component, escrever cookie
// lança — por isso o try/catch; o refresh de sessão é feito no middleware.
export function supabaseServerAuth() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* chamado de um Server Component: ignorado (middleware cuida do refresh) */
          }
        },
      },
    },
  );
}
