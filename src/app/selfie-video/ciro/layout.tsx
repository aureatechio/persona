import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Grave seu depoimento | Ciro Nogueira',
  description:
    'Grave um vídeo curto e receba uma resposta personalizada no WhatsApp.',
  openGraph: {
    title: 'Ciro Nogueira — Progressistas',
    description:
      'Grave um vídeo curto e receba uma resposta personalizada no WhatsApp.',
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Progressistas',
  },
};

// #0A1F3F = dark navy base. Chosen because it's darker than the
// Progressistas logo's text color, so both the light-blue "P" and the
// navy "Progressistas" wordmark remain visible against this background
// without needing a white card.
export default function CiroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden" style={{ backgroundColor: '#0A1F3F' }}>
      <style>{`html, body { background-color: #0A1F3F !important; }`}</style>
      {children}
    </div>
  );
}
