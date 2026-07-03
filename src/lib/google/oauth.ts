// OAuth2 do Google Calendar. Constrói o client, a URL de consentimento e faz a
// troca de código por tokens. Os tokens ficam em professional_integration.

import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

// Escopos: ler agenda (freebusy) + criar/editar eventos (com Google Meet).
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

export function hasGoogleEnv(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function oauthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

// URL para o profissional autorizar. `state` carrega o professionalId para o
// callback saber de quem são os tokens.
export function consentUrl(professionalId: string): string {
  return oauthClient().generateAuthUrl({
    access_type: 'offline', // garante refresh_token
    prompt: 'consent', // força retorno do refresh_token
    scope: GOOGLE_SCOPES,
    state: professionalId,
  });
}

export async function exchangeCode(code: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  return tokens; // { access_token, refresh_token, expiry_date, scope, ... }
}
