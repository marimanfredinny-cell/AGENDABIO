'use client';

import { useMemo, useState } from 'react';
import type { Plan } from '@/lib/plans';

interface SpecialtyOpt {
  slug: string;
  label: string;
  council: string;
}

const brl = (n: number) => `R$${n.toLocaleString('pt-BR')}`;

export default function Onboarding({
  plans,
  specialties,
}: {
  plans: Plan[];
  specialties: SpecialtyOpt[];
}) {
  const [step, setStep] = useState(1);
  const [billing, setBilling] = useState<'mensal' | 'anual'>('mensal');
  const [planId, setPlanId] = useState<string>(plans.find((p) => p.popular)?.id ?? plans[0].id);
  const [form, setForm] = useState({
    display_name: '',
    email: '',
    whatsapp: '',
    password: '',
    specialty_slug: specialties[0]?.slug ?? '',
    registration_number: '',
  });
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const plan = plans.find((p) => p.id === planId)!;
  const spec = specialties.find((s) => s.slug === form.specialty_slug);
  const price = useMemo(
    () => (billing === 'anual' ? plan.monthly * 10 : plan.monthly),
    [billing, plan],
  );

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function finish() {
    setError('');
    if (!form.display_name || !form.email) return setError('Preencha nome e e-mail.');
    if (!agree) return setError('É preciso aceitar os termos.');
    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, billing, ...form }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error ?? 'Erro ao processar.');
    } catch {
      setError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 460, margin: '0 auto', padding: '1.5rem 1.25rem 3rem' }}>
      <Stepper step={step} />

      {step === 1 && (
        <>
          <h1 style={{ fontSize: '2rem', margin: '1rem 0 0.25rem' }}>Escolha seu plano</h1>
          <p style={{ color: '#666', marginTop: 0 }}>
            Já tem conta? <a href="#" style={{ color: '#111' }}>Entre aqui</a>
          </p>

          <Toggle billing={billing} setBilling={setBilling} />

          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            {plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                billing={billing}
                selected={p.id === planId}
                onSelect={() => setPlanId(p.id)}
              />
            ))}
          </div>

          <CTA onClick={() => setStep(2)}>
            Continuar com {plan.name} — {brl(price)}/{billing === 'anual' ? 'ano' : 'mês'}
          </CTA>
          <p style={{ textAlign: 'center', color: '#999', fontSize: 13, marginTop: 12 }}>
            Acesso imediato · Cancele quando quiser · Sem fidelidade
          </p>
        </>
      )}

      {step === 2 && (
        <>
          <BackHead onBack={() => setStep(1)} title="Crie sua conta" subtitle="Seus dados de acesso" />
          <PlanChip plan={plan} price={price} billing={billing} />
          <Field label="Seu nome" value={form.display_name} onChange={(v) => set('display_name', v)} placeholder="Dra. Marina Souza" />
          <Field label="E-mail" value={form.email} onChange={(v) => set('email', v)} placeholder="seu@email.com" type="email" />
          <Field label="WhatsApp" value={form.whatsapp} onChange={(v) => set('whatsapp', v)} placeholder="(11) 99999-9999" />
          <Field label="Senha" value={form.password} onChange={(v) => set('password', v)} placeholder="Mínimo 8 caracteres" type="password" />
          <CTA onClick={() => setStep(3)}>Continuar</CTA>
        </>
      )}

      {step === 3 && (
        <>
          <BackHead onBack={() => setStep(2)} title="Sua página" subtitle="A triagem se adapta à sua especialidade" />
          <PlanChip plan={plan} price={price} billing={billing} />

          <label style={labelStyle}>Especialidade</label>
          <select
            value={form.specialty_slug}
            onChange={(e) => set('specialty_slug', e.target.value)}
            style={inputStyle}
          >
            {specialties.map((s) => (
              <option key={s.slug} value={s.slug}>{s.label}</option>
            ))}
          </select>

          <Field
            label={`Registro profissional${spec ? ` (${spec.council})` : ''}`}
            value={form.registration_number}
            onChange={(v) => set('registration_number', v)}
            placeholder={spec ? `${spec.council} 00/000000` : 'Seu registro'}
          />

          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '10px 2px', fontSize: 14, color: '#444' }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>Li e concordo com a <b>Política de Privacidade</b> e os <b>Termos de Uso</b>.</span>
          </label>

          {error && <p style={{ color: '#c0392b', fontSize: 14 }}>{error}</p>}

          <CTA onClick={finish} disabled={loading}>
            {loading ? 'Processando…' : `🔒 Criar conta e pagar ${brl(price)}/${billing === 'anual' ? 'ano' : 'mês'}`}
          </CTA>
          <p style={{ textAlign: 'center', color: '#999', fontSize: 13, marginTop: 12 }}>
            🔒 Pagamento seguro via Stripe · confirmação instantânea
          </p>
        </>
      )}
    </main>
  );
}

// ---- Subcomponentes -------------------------------------------------------

function Stepper({ step }: { step: number }) {
  const dot = (n: number, label: string) => {
    const active = step >= n;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            width: 26, height: 26, borderRadius: '50%',
            background: active ? '#111' : '#e3e3e3',
            color: active ? '#fff' : '#999',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700,
          }}
        >
          {step > n ? '✓' : n}
        </div>
        <span style={{ fontSize: 14, color: active ? '#111' : '#999', fontWeight: active ? 600 : 400 }}>
          {label}
        </span>
      </div>
    );
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
      {dot(1, 'Plano')}
      <div style={{ flex: 1, height: 1, background: '#ddd' }} />
      {dot(2, 'Conta')}
      <div style={{ flex: 1, height: 1, background: '#ddd' }} />
      {dot(3, 'Página')}
    </div>
  );
}

function Toggle({ billing, setBilling }: { billing: string; setBilling: (b: 'mensal' | 'anual') => void }) {
  const pill = (v: 'mensal' | 'anual', label: string, extra?: string) => (
    <button
      onClick={() => setBilling(v)}
      style={{
        border: 'none', cursor: 'pointer', borderRadius: 999, padding: '0.5rem 1rem',
        background: billing === v ? '#fff' : 'transparent',
        boxShadow: billing === v ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
        fontWeight: 600, color: billing === v ? '#111' : '#888',
      }}
    >
      {label} {extra && <span style={{ color: '#2e8b6a', fontSize: 12 }}>{extra}</span>}
    </button>
  );
  return (
    <div style={{ marginTop: 18, background: '#ececec', borderRadius: 999, padding: 4, display: 'inline-flex' }}>
      {pill('mensal', 'Mensal')}
      {pill('anual', 'Anual', '2 meses grátis')}
    </div>
  );
}

function PlanCard({
  plan, billing, selected, onSelect,
}: { plan: Plan; billing: string; selected: boolean; onSelect: () => void }) {
  const price = billing === 'anual' ? plan.monthly * 10 : plan.monthly;
  const dark = plan.popular;
  return (
    <button
      onClick={onSelect}
      style={{
        textAlign: 'left', cursor: 'pointer', width: '100%',
        border: selected ? '2px solid #111' : '1px solid #e3e3e3',
        background: dark ? '#111' : '#fafafa',
        color: dark ? '#fff' : '#111',
        borderRadius: 18, padding: '1rem 1.1rem', position: 'relative',
      }}
    >
      {plan.popular && (
        <span style={{
          position: 'absolute', top: -11, left: 14, background: '#fff', color: '#111',
          border: '1px solid #ddd', borderRadius: 999, fontSize: 11, fontWeight: 700,
          padding: '2px 10px',
        }}>MAIS POPULAR</span>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{plan.name}</div>
          <div style={{ opacity: 0.7, fontSize: 14 }}>{plan.tagline}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{brl(price)}</div>
          <div style={{ opacity: 0.6, fontSize: 12 }}>/{billing === 'anual' ? 'ano' : 'mês'}</div>
        </div>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'grid', gap: 6 }}>
        {plan.features.map((f) => (
          <li key={f} style={{ fontSize: 14, display: 'flex', gap: 8, opacity: 0.95 }}>
            <span style={{ color: dark ? '#7ee0b8' : '#2e8b6a' }}>✓</span>
            <span style={{ fontWeight: f === plan.highlight ? 700 : 400 }}>{f}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}

function CTA({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', marginTop: 20, padding: '1rem', borderRadius: 16, border: 'none',
        background: disabled ? '#999' : '#111', color: '#fff', fontWeight: 700, fontSize: 16,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function BackHead({ onBack, title, subtitle }: { onBack: () => void; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '1.25rem 0 0.5rem' }}>
      <button onClick={onBack} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>←</button>
      <div>
        <h1 style={{ fontSize: '1.7rem', margin: 0 }}>{title}</h1>
        <p style={{ color: '#888', margin: 0 }}>{subtitle}</p>
      </div>
    </div>
  );
}

function PlanChip({ plan, price, billing }: { plan: Plan; price: number; billing: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      border: '1px solid #e3e3e3', borderRadius: 14, padding: '0.8rem 1rem', margin: '0.75rem 0 1rem',
    }}>
      <span style={{ fontWeight: 700 }}>⚡ {plan.name} · {billing}</span>
      <span style={{ fontWeight: 800 }}>{brl(price)}/{billing === 'anual' ? 'ano' : 'mês'}</span>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontWeight: 600, margin: '0.5rem 2px 0.35rem' };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.85rem 1rem', borderRadius: 999, border: '1px solid #ddd',
  fontSize: 15, outline: 'none', boxSizing: 'border-box', background: '#fafafa',
};

function Field({
  label, value, onChange, placeholder, type = 'text',
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}
