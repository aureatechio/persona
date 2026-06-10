import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Grave seu depoimento | Maria do Carmo',
  description: 'Grave um vídeo curto e receba uma resposta personalizada de Maria do Carmo no WhatsApp.',
};

export default function MariaDoCarmoNewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden">
      <style>{`html, body { overscroll-behavior: none; overflow-x: hidden; }`}</style>
      {children}
    </div>
  );
}
