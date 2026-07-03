'use client';

import { useEffect, useRef, useState } from 'react';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

export default function Chat({ slug }: { slug: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      setLoading(true);
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (data.conversationId) {
        setConversationId(data.conversationId);
        setMessages([{ role: 'assistant', content: data.reply }]);
      } else {
        setMessages([{ role: 'assistant', content: 'Profissional não encontrado.' }]);
      }
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    if (!input.trim() || !conversationId || loading || done) return;
    const text = input.trim();
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, message: text }),
    });
    const data = await res.json();
    setMessages((m) => [...m, { role: 'assistant', content: data.reply ?? 'Erro.' }]);
    if (data.done) setDone(true);
    setLoading(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '68vh' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              margin: '0.35rem 0',
            }}
          >
            <span
              style={{
                maxWidth: '82%',
                padding: '0.6rem 0.85rem',
                borderRadius: 16,
                background: m.role === 'user' ? '#2e8b6a' : '#fff',
                color: m.role === 'user' ? '#fff' : '#16241d',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                lineHeight: 1.45,
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </span>
          </div>
        ))}
        {loading && (
          <div style={{ color: '#8aa398', fontSize: 14, padding: '0.35rem' }}>digitando…</div>
        )}
        <div ref={endRef} />
      </div>

      {!done ? (
        <div style={{ display: 'flex', gap: 8, paddingTop: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Escreva aqui…"
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.7rem 0.9rem',
              borderRadius: 12,
              border: '1px solid #cdd9d1',
              fontSize: 15,
              outline: 'none',
            }}
          />
          <button
            onClick={send}
            disabled={loading}
            style={{
              padding: '0.7rem 1.1rem',
              borderRadius: 12,
              border: 'none',
              background: '#2e8b6a',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Enviar
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#2e8b6a', fontWeight: 600, padding: 8 }}>
          ✓ Atendimento concluído
        </div>
      )}
    </div>
  );
}
