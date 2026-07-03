import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'AgendaBio',
  description: 'O link na bio que conversa, qualifica e agenda — para a saúde.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#f3f6f4',
          color: '#16241d',
        }}
      >
        {children}
      </body>
    </html>
  );
}
