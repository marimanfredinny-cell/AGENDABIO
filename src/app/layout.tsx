import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'AgendaBio',
  description: 'Link na bio conversacional com agendamento inteligente.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, sans-serif',
          background: '#f6f5f2',
          color: '#1b1b1b',
        }}
      >
        {children}
      </body>
    </html>
  );
}
