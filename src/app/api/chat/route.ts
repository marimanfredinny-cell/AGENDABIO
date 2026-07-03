import { NextRequest, NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { USE_CLAUDE } from '@/lib/config';
import { handleMessage } from '@/agents/orchestrator';
import { demoGreeting } from '@/lib/demo/engine';

export const runtime = 'nodejs';

// POST /api/chat
//   { slug }                       -> inicia conversa, devolve saudação
//   { conversationId, message }    -> processa no orquestrador
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.conversationId) {
      const profile = await store.getPublicProfileBySlug(body.slug);
      if (!profile) {
        return NextResponse.json({ error: 'Profissional não encontrado' }, { status: 404 });
      }
      // Saudação: no modo demo já inclui a 1ª pergunta do template; com Claude,
      // o agente de triagem faz a 1ª pergunta na primeira resposta do visitante.
      const greeting = USE_CLAUDE
        ? `Oi! Sou o concierge de ${profile.professional.display_name}. Me conta rapidinho o que você precisa que eu te ajudo. 🙂`
        : demoGreeting(profile);
      const conv = await store.createConversation(profile.professional.id, greeting);
      return NextResponse.json({
        conversationId: conv.id,
        reply: greeting,
        stage: 'triagem',
        done: false,
      });
    }

    const { conversationId, message } = body as {
      conversationId: string;
      message: string;
    };
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 });
    }
    const out = await handleMessage(conversationId, message);
    return NextResponse.json(out);
  } catch (err) {
    console.error('[/api/chat]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
