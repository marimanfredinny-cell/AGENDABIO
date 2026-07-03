// Planos (adaptados ao contexto SAÚDE). Preços são placeholder — ajuste depois.
// A cobrança em si ainda não está ligada (só a UI); Stripe entra trocando o
// handler do botão de "Criar conta".

export interface Plan {
  id: 'essencial' | 'pro' | 'clinica';
  name: string;
  tagline: string;
  monthly: number; // R$/mês
  popular?: boolean;
  features: string[];
  highlight?: string; // benefício em destaque (negrito)
}

export const PLANS: Plan[] = [
  {
    id: 'essencial',
    name: 'Essencial',
    tagline: 'Sua bio profissional pronta pra agendar',
    monthly: 97,
    features: [
      'Página de bio com concierge de triagem',
      'Captura e qualificação de leads',
      'Setup guiado em minutos',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'A IA qualifica e agenda por você, 24h',
    monthly: 147,
    popular: true,
    highlight: 'Triagem que se adapta à sua especialidade',
    features: [
      'Tudo do Essencial',
      'Triagem que se adapta à sua especialidade',
      'Agenda integrada ao Google Calendar',
      'Confirmações e lembretes por e-mail',
    ],
  },
  {
    id: 'clinica',
    name: 'Clínica',
    tagline: 'Sua agenda rodando no automático',
    monthly: 197,
    highlight: 'Vários profissionais na mesma conta',
    features: [
      'Tudo do Pro',
      'Vários profissionais na mesma conta',
      'IA turbinada (limites ampliados)',
      'Insights avançados + suporte VIP',
    ],
  },
];

// Anual = 2 meses grátis (10x o mensal).
export function annualPrice(monthly: number): number {
  return monthly * 10;
}
