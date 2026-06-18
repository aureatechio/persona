import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Grave seu depoimento | Ricardo Marques',
  description: 'Grave um vídeo curto e receba uma resposta personalizada de Ricardo Marques no WhatsApp.',
};

export default function RicardoMarquesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
