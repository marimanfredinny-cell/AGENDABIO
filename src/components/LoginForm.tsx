'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    setLoading(true);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    if (error) {
      setError('E-mail ou senha inválidos.');
      setLoading(false);
      return;
    }
    window.location.href = '/painel';
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <label style={label}>E-mail</label>
        <input style={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
      </div>
      <div>
        <label style={label}>Senha</label>
        <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" />
      </div>
      {error && <p style={{ color: '#c0392b', fontSize: 14, margin: 0 }}>{error}</p>}
      <button
        onClick={submit}
        disabled={loading}
        style={{
          padding: '0.9rem', borderRadius: 14, border: 'none',
          background: loading ? '#999' : '#111', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer',
        }}
      >
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
      <p style={{ textAlign: 'center', color: '#888', fontSize: 14 }}>
        Não tem conta? <a href="/comecar" style={{ color: '#111' }}>Criar minha página</a>
      </p>
    </div>
  );
}

const label: React.CSSProperties = { display: 'block', fontWeight: 600, margin: '0 2px 0.35rem' };
const input: React.CSSProperties = {
  width: '100%', padding: '0.85rem 1rem', borderRadius: 12, border: '1px solid #ddd',
  fontSize: 15, outline: 'none', boxSizing: 'border-box',
};
