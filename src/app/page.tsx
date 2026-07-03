export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>AgendaBio</h1>
      <p style={{ color: '#555', lineHeight: 1.6 }}>
        O link na bio que conversa, qualifica o lead e agenda — em vez de só
        listar botões soltos.
      </p>
      <p style={{ marginTop: '2rem', color: '#777' }}>
        Protótipo. Acesse um profissional em <code>/seu-slug</code> (ex.:{' '}
        <code>/dra-marina</code>) depois de cadastrá-lo no Supabase.
      </p>
    </main>
  );
}
