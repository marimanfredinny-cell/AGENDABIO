import Link from 'next/link';
import { store } from '@/lib/store';
import { hasGoogleEnv } from '@/lib/google/oauth';
import { USE_SUPABASE } from '@/lib/config';
import CopyLink from '@/components/CopyLink';
import LogoutButton from '@/components/LogoutButton';
import type { PublicProfile } from '@/lib/store/types';

// Renderiza o painel a partir de um perfil já resolvido (por sessão ou slug).
export default async function PanelView({ profile }: { profile: PublicProfile }) {
  const { professional, specialty } = profile;
  const [leads, appointments, google] = await Promise.all([
    store.listLeads(professional.id),
    store.listAppointments(professional.id),
    store.getGoogleIntegration(professional.id),
  ]);

  const googleConnected = !!google?.refresh_token;
  const publicUrl = `agendabio.com.br/${professional.slug}`;
  const upcoming = appointments.filter((a) => a.status === 'confirmado');
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      timeZone: professional.timezone,
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem 1.25rem 3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={avatar}>{professional.display_name.charAt(0)}</div>
          <div>
            <h1 style={{ fontSize: '1.4rem', margin: 0 }}>{professional.display_name}</h1>
            <p style={{ color: '#5a6b62', margin: 0 }}>
              {specialty.label}
              {professional.registration_number ? ` · ${professional.registration_number}` : ''}
            </p>
          </div>
        </div>
        {USE_SUPABASE && <LogoutButton />}
      </div>

      <div style={{ ...card, marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={caption}>Sua página</div>
          <code style={{ fontSize: 15 }}>{publicUrl}</code>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <CopyLink url={`https://${publicUrl}`} />
          <Link href={`/${professional.slug}`} style={btnDark}>Abrir</Link>
        </div>
      </div>

      <div style={{ ...card, marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={caption}>Google Calendar</div>
          <span style={{ fontWeight: 700, color: googleConnected ? '#2e8b6a' : '#9a6b16' }}>
            {googleConnected ? '● Conectado' : '○ Não conectado'}
          </span>
          {!googleConnected && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7a8a80' }}>
              Sem conexão, a agenda usa horários simulados.
            </p>
          )}
        </div>
        {googleConnected ? (
          <span style={{ color: '#2e8b6a', fontWeight: 600 }}>Agenda sincronizada</span>
        ) : hasGoogleEnv() ? (
          <a href={`/api/google/connect?professionalId=${professional.id}`} style={btnDark}>Conectar</a>
        ) : (
          <span style={{ fontSize: 13, color: '#9a6b16' }}>Configure o Google OAuth no .env</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <Stat label="Leads captados" value={leads.length} />
        <Stat label="Consultas agendadas" value={upcoming.length} />
      </div>

      <h2 style={h2}>Leads</h2>
      {leads.length === 0 ? (
        <Empty text="Ainda sem leads. Quando alguém conversar com o concierge, aparece aqui." />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {leads.map((l) => (
            <div key={l.id} style={{ ...card, display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{l.full_name ?? 'Sem nome'}</strong>
                <div style={{ display: 'flex', gap: 6 }}>
                  {l.urgency === 'urgente' && <Badge color="#c0392b" bg="#fdecea">urgente</Badge>}
                  <Badge color="#2e5b48" bg="#e7efe9">{l.status}</Badge>
                </div>
              </div>
              <div style={{ fontSize: 14, color: '#5a6b62' }}>
                {[l.phone, l.email].filter(Boolean).join(' · ') || '—'}
              </div>
              {l.reason && <div style={{ fontSize: 13, color: '#7a8a80' }}>{l.reason}</div>}
            </div>
          ))}
        </div>
      )}

      <h2 style={h2}>Agenda</h2>
      {upcoming.length === 0 ? (
        <Empty text="Nenhuma consulta agendada ainda." />
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {upcoming.map((a) => (
            <div key={a.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{a.lead_name ?? 'Paciente'}</strong>
                <div style={{ fontSize: 14, color: '#5a6b62' }}>
                  {a.service_name ?? 'Consulta'} · {a.modality}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 600 }}>{fmt(a.starts_at)}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ ...card, textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
      <div style={caption}>{label}</div>
    </div>
  );
}
function Badge({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span style={{ background: bg, color, borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
      {children}
    </span>
  );
}
function Empty({ text }: { text: string }) {
  return <div style={{ ...card, color: '#8aa398', textAlign: 'center' }}>{text}</div>;
}

const avatar: React.CSSProperties = {
  width: 56, height: 56, borderRadius: '50%', background: '#cfe3d8',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 22, fontWeight: 700, color: '#2e5b48',
};
const card: React.CSSProperties = { background: '#fff', border: '1px solid #e7ece9', borderRadius: 16, padding: '0.9rem 1rem' };
const caption: React.CSSProperties = { fontSize: 12, color: '#8aa398', textTransform: 'uppercase', letterSpacing: 0.4 };
const h2: React.CSSProperties = { fontSize: '1.1rem', margin: '1.5rem 0 0.6rem' };
const btnDark: React.CSSProperties = { background: '#111', color: '#fff', borderRadius: 10, padding: '0.45rem 0.85rem', fontWeight: 600, fontSize: 13, textDecoration: 'none' };
