import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Grave seu depoimento | Maria do Carmo',
  description: 'Envie sua ideia para o plano de governo da Maria do Carmo e receba uma resposta personalizada no WhatsApp.',
  openGraph: {
    title: 'Maria do Carmo — Pré-candidata ao Governo do Amazonas',
    description: 'Grave seu depoimento e receba uma resposta personalizada da Maria do Carmo.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Maria do Carmo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Maria do Carmo — Pré-candidata ao Governo do Amazonas',
    description: 'Grave seu depoimento e receba uma resposta personalizada da Maria do Carmo.',
    images: ['/og-image.png'],
  },
};

export default function MariadoCarmoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden" style={{ backgroundColor: '#1B3A8C' }}>
      <style>{`html, body { background-color: #1B3A8C !important; }`}</style>
      {children}
    </div>
  );
}
