// Arena PWA — Layout (standalone, doesn't inherit from root)

import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import Script from 'next/script';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  title: 'Arena - Análise Eleitoral',
  description: 'Simulação de impacto eleitoral com 20.000 personas de IA',
  manifest: '/arena-manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Arena',
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
    <html lang="pt-BR" className={manrope.variable} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/arena-icons/icon-192.png" />
      </head>
      <body className="bg-black text-white font-[family-name:var(--font-manrope)] antialiased overscroll-none">
        <div className="min-h-[100dvh] flex flex-col">
          {children}
        </div>

        {/* Register service worker */}
        <Script id="arena-sw" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/arena-sw.js', { scope: '/arena' })
              .catch(err => console.warn('[SW] Registration failed:', err));
          }
        `}</Script>
      </body>
    </html>
  );
}
