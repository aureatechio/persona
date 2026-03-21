import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Grave seu depoimento | PL',
  description: 'Grave um vídeo curto e receba uma resposta personalizada do PL no seu WhatsApp.',
  openGraph: {
    title: 'PL - Partido Liberal',
    description: 'Grave seu depoimento e receba uma resposta personalizada do PL.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
    locale: 'pt_BR',
    siteName: 'PL - Partido Liberal',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PL - Partido Liberal',
    description: 'Grave seu depoimento e receba uma resposta personalizada do PL.',
    images: ['/og-image.png'],
  },
};

export default function SelfieVideoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden" style={{ backgroundColor: '#1B3A8C' }}>
      <style>{`html, body { background-color: #1B3A8C !important; overscroll-behavior: none; overflow-x: hidden; }`}</style>
      {children}
    </div>
  );
}
