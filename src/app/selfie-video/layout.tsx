import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Grave seu depoimento | Progressistas',
  description: 'Grave um vídeo curto e receba uma resposta personalizada do Progressistas no seu WhatsApp.',
  openGraph: {
    title: 'Progressistas',
    description: 'Grave seu depoimento e receba uma resposta personalizada do Progressistas.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Progressistas',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Progressistas',
    description: 'Grave seu depoimento e receba uma resposta personalizada do Progressistas.',
    images: ['/og-image.png'],
  },
};

export default function SelfieVideoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
