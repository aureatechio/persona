import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Grave seu depoimento | Maria do Carmo',
  description: 'Grave um vídeo curto e receba uma resposta personalizada de Maria do Carmo no WhatsApp.',
};

export default function MariaDoCarmoV3Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
