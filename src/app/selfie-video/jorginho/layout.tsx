import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Santa Catarina vai continuar melhorando | Jorginho Mello',
  description:
    'Grave um vídeo curto com sua sugestão para o plano de governo e receba um vídeo de resposta.',
  openGraph: {
    title: 'Santa Catarina vai continuar melhorando',
    description:
      'Grave um vídeo curto com sua sugestão para o plano de governo e receba um vídeo de resposta.',
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Jorginho Mello',
  },
};

export default function JorginhoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden" style={{ backgroundColor: '#0D2256' }}>
      <style>{`html, body { background-color: #0D2256 !important; }`}</style>
      {children}
    </div>
  );
}
