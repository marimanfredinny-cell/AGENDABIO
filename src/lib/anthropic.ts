import Anthropic from '@anthropic-ai/sdk';

// Cliente único da API da Claude (Anthropic).
// A chave vem de ANTHROPIC_API_KEY no ambiente (.env.local / Vercel).
export const anthropic = new Anthropic();

// Modelo padrão dos agentes conversacionais.
// Opus 4.8 = máxima qualidade de conversa/qualificação. Para alto volume e
// custo mais baixo, troque por 'claude-sonnet-5' (ou 'claude-haiku-4-5' na
// triagem simples) — a escolha é sua; a arquitetura não muda.
export const AGENT_MODEL = 'claude-opus-4-8';
