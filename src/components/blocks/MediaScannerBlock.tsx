'use client';

import { useEffect, useState } from 'react';
import { ScanLine, Eye, Image, Film, Link, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaScannerBlockProps {
  data: {
    previews: { type: 'image' | 'video' | 'url'; preview?: string; name: string }[];
    phase?: string;
  };
}

const SCAN_LABELS = [
  'Identificando o que aparece na imagem...',
  'Lendo textos e legendas...',
  'Entendendo o contexto geral...',
  'Procurando figuras públicas...',
  'Analisando o tom da publicação...',
  'Extraindo informações relevantes...',
  'Preparando contexto para as personas...',
  'Quase pronto...',
];

function ScannerFrame({ src, name, type }: { src?: string; name: string; type: string }) {
  const [scanLabel, setScanLabel] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setScanLabel(prev => (prev + 1) % SCAN_LABELS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  const hasPreview = src && (type === 'image');
  const TypeIcon = type === 'image' ? Image : type === 'video' ? Film : Link;

  return (
    <div className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-white/[0.06] backdrop-blur-xl">
      {/* Image area */}
      <div className="relative w-full bg-zinc-950 overflow-hidden" style={{ maxHeight: '280px' }}>
        {hasPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            className="w-full h-auto max-h-[280px] object-contain opacity-70"
          />
        ) : (
          <div className="w-full h-40 flex items-center justify-center">
            <TypeIcon size={40} className="text-zinc-800" />
          </div>
        )}

        {/* Scan line sweeping top to bottom */}
        <div
          className="absolute left-0 right-0 h-[2px] z-10 pointer-events-none"
          style={{
            animation: 'scanner-sweep 2.5s ease-in-out infinite',
            background: 'linear-gradient(90deg, transparent 5%, rgba(139,92,246,0.5) 30%, rgba(236,72,153,0.3) 70%, transparent 95%)',
            boxShadow: '0 0 16px 3px rgba(139,92,246,0.15), 0 0 40px 6px rgba(139,92,246,0.08)',
          }}
        />

        {/* Grid overlay sutil */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(139,92,246,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '32px 32px',
            animation: 'scanner-grid-pulse 3s ease-in-out infinite',
          }}
        />

        {/* Corner brackets */}
        <div className="absolute top-2.5 left-2.5 w-4 h-4 border-t-[1.5px] border-l-[1.5px] border-violet-500/30 pointer-events-none" style={{ animation: 'bracket-pulse 2s ease-in-out infinite' }} />
        <div className="absolute top-2.5 right-2.5 w-4 h-4 border-t-[1.5px] border-r-[1.5px] border-violet-500/30 pointer-events-none" style={{ animation: 'bracket-pulse 2s ease-in-out infinite', animationDelay: '0.5s' }} />
        <div className="absolute bottom-2.5 left-2.5 w-4 h-4 border-b-[1.5px] border-l-[1.5px] border-violet-500/30 pointer-events-none" style={{ animation: 'bracket-pulse 2s ease-in-out infinite', animationDelay: '1s' }} />
        <div className="absolute bottom-2.5 right-2.5 w-4 h-4 border-b-[1.5px] border-r-[1.5px] border-violet-500/30 pointer-events-none" style={{ animation: 'bracket-pulse 2s ease-in-out infinite', animationDelay: '1.5s' }} />

        {/* Dark vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-zinc-950/40 pointer-events-none" />
      </div>

      {/* Bottom info */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-violet-500/10 border border-violet-500/15 shrink-0">
            <Eye size={13} className="text-violet-400 animate-glow-oscillate" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-zinc-400 truncate">{name}</p>
            <p className="text-[10px] text-violet-400/70 mt-0.5">
              {SCAN_LABELS[scanLabel]}
            </p>
          </div>
          <Sparkles size={12} className="text-fuchsia-400/40 animate-pulse shrink-0" />
        </div>

        {/* Progress shimmer bar */}
        <div className="h-[2px] rounded-full bg-zinc-900 overflow-hidden">
          <div
            className="h-full w-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.4), transparent)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function MediaScannerBlock({ data }: MediaScannerBlockProps) {
  const { previews, phase } = data;

  return (
    <div className="w-full max-w-md mx-auto space-y-3">
      {/* Phase header */}
      <div className="flex items-center justify-center gap-2">
        <ScanLine size={14} className="text-violet-400/60 animate-pulse" />
        <p className="text-xs font-semibold text-violet-400/80">
          {phase || 'Analisando mídia com IA...'}
        </p>
      </div>

      {/* Scanner frames */}
      <div className={cn(
        'grid gap-3',
        previews.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2',
      )}>
        {previews.map((item, idx) => (
          <ScannerFrame
            key={idx}
            src={item.preview}
            name={item.name}
            type={item.type}
          />
        ))}
      </div>
    </div>
  );
}
