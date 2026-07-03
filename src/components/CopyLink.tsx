'use client';

import { useState } from 'react';

export default function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignore */
        }
      }}
      style={{
        border: '1px solid #d5ddd7',
        background: '#fff',
        borderRadius: 10,
        padding: '0.4rem 0.7rem',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        color: '#2e5b48',
      }}
    >
      {copied ? '✓ Copiado' : 'Copiar link'}
    </button>
  );
}
