'use client';

import { supabaseBrowser } from '@/lib/supabase/browser';

export default function LogoutButton() {
  return (
    <button
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        window.location.href = '/entrar';
      }}
      style={{
        border: '1px solid #d5ddd7',
        background: '#fff',
        borderRadius: 10,
        padding: '0.4rem 0.7rem',
        cursor: 'pointer',
        fontSize: 13,
        color: '#5a6b62',
      }}
    >
      Sair
    </button>
  );
}
