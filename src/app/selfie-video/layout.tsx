import type { Viewport } from 'next';

// Shared viewport config for every /selfie-video/[politician] screen.
// O tema padrão (cores e logo do PL) vive em [slug]/SelfieCapture.tsx.

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
