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

  // Inicia a conversa ao montar.
  useEffect(() => {
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
        setMessages([
          { role: 'assistant', content: 'Profissional não encontrado.' },
        ]);
      }
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
    if (data.done) setDone(true);
    setLoading(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
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
                maxWidth: '80%',
                padding: '0.6rem 0.85rem',
                borderRadius: 16,
                background: m.role === 'user' ? '#c98a5e' : '#fff',
                color: m.role === 'user' ? '#fff' : '#1b1b1b',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                lineHeight: 1.4,
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </span>
          </div>
        ))}
        {loading && (
          <div style={{ color: '#999', fontSize: 14, padding: '0.35rem' }}>
            digitando…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {!done && (
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
              border: '1px solid #ddd',
              fontSize: 15,
            }}
          />
          <button
            onClick={send}
            disabled={loading}
            style={{
              padding: '0.7rem 1.1rem',
              borderRadius: 12,
              border: 'none',
              background: '#c98a5e',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Enviar
          </button>
        </div>
      )}
    </div>
  );
}
