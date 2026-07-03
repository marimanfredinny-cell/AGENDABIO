import { createClient } from '@supabase/supabase-js';

// Cliente Supabase para uso EXCLUSIVO no backend (route handlers, cron).
// Usa a service_role key -> bypassa RLS. NUNCA exponha isso no browser.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no ambiente.',
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
