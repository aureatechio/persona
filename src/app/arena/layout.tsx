// Arena PWA — Nested layout
// Uses Next.js metadata API for merge with root layout

import type { Metadata, Viewport } from 'next';
import { PwaHead } from './components/PwaHead';

export const metadata: Metadata = {
  title: 'VOTIA - Análise Eleitoral',
  description: 'Simulação de impacto eleitoral com 20.000 personas de IA',
  manifest: '/arena-manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VOTIA',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  icons: {
    apple: '/arena-icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function ArenaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PwaHead />
      {children}
    </>
  );
}
