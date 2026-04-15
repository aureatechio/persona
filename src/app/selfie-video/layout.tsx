import type { Viewport } from 'next';

// Shared viewport config for every /selfie-video/[politician] screen.
// Theme-specific background and OG metadata live in each politician's
// own layout (e.g. /selfie-video/flavio/layout.tsx) so each one can
// ship its own colors, logo, and social-share image.

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function SelfieVideoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden">
      <style>{`html, body { overscroll-behavior: none; overflow-x: hidden; }`}</style>
      {children}
    </div>
  );
}
