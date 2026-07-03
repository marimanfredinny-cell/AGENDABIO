import { NextRequest, NextResponse } from 'next/server';
import { consentUrl, hasGoogleEnv } from '@/lib/google/oauth';

export const runtime = 'nodejs';

// GET /api/google/connect?professionalId=...
// Inicia o OAuth do Google Calendar para o profissional.
// (Numa versão com auth, o professionalId vem da sessão, não da query.)
export async function GET(req: NextRequest) {
  if (!hasGoogleEnv()) {
    return NextResponse.json(
      { error: 'Google OAuth não configurado (defina GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI).' },
      { status: 501 },
    );
  }
  const professionalId = req.nextUrl.searchParams.get('professionalId');
  if (!professionalId) {
    return NextResponse.json({ error: 'professionalId obrigatório' }, { status: 400 });
  }
  return NextResponse.redirect(consentUrl(professionalId));
}
