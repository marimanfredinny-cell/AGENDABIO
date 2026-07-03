import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/google/oauth';
import { store } from '@/lib/store';

export const runtime = 'nodejs';

// GET /api/google/callback?code=...&state=<professionalId>
// Troca o código por tokens e salva em professional_integration.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const professionalId = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');

  if (error) {
    return NextResponse.json({ error: `Autorização negada: ${error}` }, { status: 400 });
  }
  if (!code || !professionalId) {
    return NextResponse.json({ error: 'code/state ausentes' }, { status: 400 });
  }

  try {
    const tokens = await exchangeCode(code);
    await store.saveGoogleTokens(professionalId, {
      access_token: tokens.access_token ?? null,
      refresh_token: tokens.refresh_token ?? null,
      expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      calendar_id: 'primary',
    });
    // Numa app real, redirecione para o painel com um aviso de sucesso.
    return NextResponse.json({ ok: true, message: 'Google Calendar conectado.' });
  } catch (err) {
    console.error('[google/callback]', err);
    return NextResponse.json({ error: 'Falha ao conectar o Google Calendar.' }, { status: 500 });
  }
}
