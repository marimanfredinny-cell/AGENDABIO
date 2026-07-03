import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { handleMessage } from '@/agents/orchestrator';

export const runtime = 'nodejs';

// POST /api/chat
//   body sem conversationId  -> inicia conversa para um `slug` e devolve saudação
//   body com conversationId  -> processa a mensagem no orquestrador
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const db = supabaseAdmin();

    // --- Início de conversa ---
    if (!body.conversationId) {
      const { slug } = body as { slug: string };
      const { data: prof } = await db
        .from('professional')
        .select('id, display_name, headline, niche')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();
      if (!prof) {
        return NextResponse.json(
          { error: 'Profissional não encontrado' },
          { status: 404 },
        );
      }

      const greeting = `Oi! Sou o assistente de ${prof.display_name}. Me conta rapidinho o que você precisa que eu te ajudo. 🙂`;
      const { data: conv } = await db
        .from('conversation')
        .insert({
          professional_id: prof.id,
          stage: 'triagem',
          messages: [{ role: 'assistant', content: greeting }],
          visitor_ref: body.visitorRef ?? null,
        })
        .select('id')
        .single();

      return NextResponse.json({
        conversationId: conv!.id,
        reply: greeting,
        stage: 'triagem',
        done: false,
      });
    }

    // --- Mensagem em conversa existente ---
    const { conversationId, message } = body as {
      conversationId: string;
      message: string;
    };
    if (!message?.trim()) {
      return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 });
    }

    const out = await handleMessage({ conversationId, userMessage: message });
    return NextResponse.json(out);
  } catch (err) {
    console.error('[/api/chat]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
