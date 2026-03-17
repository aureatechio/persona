import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Grave seu depoimento | PL — Partido Liberal',
  description: 'Grave um vídeo curto e receba uma resposta personalizada do presidente do Partido Liberal no seu WhatsApp.',
  openGraph: {
    title: 'PL — Partido Liberal',
    description: 'Grave seu depoimento e receba uma resposta personalizada do presidente do PL.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Partido Liberal',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PL — Partido Liberal',
    description: 'Grave seu depoimento e receba uma resposta personalizada do presidente do PL.',
    images: ['/og-image.png'],
  },
};

export default function SelfieVideoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
