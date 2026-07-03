// Flags de ambiente que ligam/desligam as integrações reais.
// Sem elas, o app roda em MODO DEMO (dados em memória + concierge determinístico),
// útil para ver o protótipo sem configurar Supabase/Claude.

export const USE_SUPABASE = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const USE_CLAUDE = !!process.env.ANTHROPIC_API_KEY;

export const USE_RESEND = !!process.env.RESEND_API_KEY;

export const IS_DEMO = !USE_SUPABASE;
