import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic(); // lê ANTHROPIC_API_KEY do ambiente

// Opus 4.8 = máxima qualidade de conversa/qualificação. Para alto volume,
// 'claude-sonnet-5' (conversa) ou 'claude-haiku-4-5' (triagem) reduzem custo
// sem mudar a arquitetura. A escolha é sua.
export const AGENT_MODEL = 'claude-opus-4-8';
