// Arena PWA — Nested layout (no html/body — those come from root layout)

import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Arena - Análise Eleitoral',
  description: 'Simulação de impacto eleitoral com 20.000 personas de IA',
  manifest: '/arena-manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Arena',
  },
  other: {
    'mobile-web-app-capable': 'yes',
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
      <link rel="apple-touch-icon" href="/arena-icons/icon-192.png" />
      {children}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/arena-sw.js')
                .catch(function(err) { console.warn('[SW] Registration failed:', err); });
            }
          `,
        }}
      />
    </>
  );
}
