// Arena PWA — Nested layout
// Injects PWA meta tags directly into head (more reliable than metadata export)

export default function ArenaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <head>
        {/* PWA manifest */}
        <link rel="manifest" href="/arena-manifest.json" />

        {/* iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Arena" />
        <link rel="apple-touch-icon" href="/arena-icons/icon-192.png" />

        {/* Android PWA */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#000000" />

        {/* Viewport for PWA */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </head>

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
