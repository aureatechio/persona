'use client';

import { useEffect, useState } from 'react';
import { ScanLine, Eye, Image, Film, Link, Sparkles, Play, Globe, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaScannerBlockProps {
  data: {
    previews: { type: 'image' | 'video' | 'url'; preview?: string; name: string }[];
    phase?: string;
  };
}

const SCAN_LABELS_MEDIA = [
  'Identificando o que aparece na midia...',
  'Lendo textos e legendas...',
  'Entendendo o contexto geral...',
  'Procurando figuras publicas...',
  'Analisando o tom da publicacao...',
  'Extraindo informacoes relevantes...',
  'Preparando contexto para as personas...',
  'Quase pronto...',
];

const SCAN_LABELS_URL = [
  'Acessando o conteudo do link...',
  'Lendo o conteudo da pagina...',
  'Extraindo informacoes principais...',
  'Entendendo o contexto do conteudo...',
  'Analisando o tom e as opinioes...',
  'Preparando contexto para as personas...',
  'Quase pronto...',
];

function ScannerFrame({ src, name, type }: { src?: string; name: string; type: string }) {
  const isUrl = type === 'url';
  const labels = isUrl ? SCAN_LABELS_URL : SCAN_LABELS_MEDIA;
  const [scanLabel, setScanLabel] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setScanLabel(prev => (prev + 1) % labels.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [labels.length]);

  const hasPreview = !!src && !isUrl;

  return (
    <div className="relative rounded-2xl overflow-hidden bg-zinc-950 border border-white/[0.06] backdrop-blur-xl">
      {/* Image/preview area */}
      <div className="relative w-full bg-zinc-950 overflow-hidden" style={{ maxHeight: '280px' }}>
        {hasPreview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={name}
              className="w-full h-auto max-h-[280px] object-contain opacity-70"
            />
            {type === 'video' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                  <Play size={18} className="text-white ml-0.5" />
                </div>
              </div>
            )}
          </div>
        ) : isUrl ? (
          <div className="w-full h-36 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-sky-500/[0.06] to-zinc-950">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <Globe size={22} className="text-sky-400/80" />
            </div>
            <p className="text-[11px] text-zinc-500 font-medium max-w-[200px] truncate">{name}</p>
          </div>
        ) : type === 'video' ? (
          <div className="w-full h-36 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-violet-500/[0.06] to-zinc-950">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Play size={22} className="text-violet-400/80 ml-0.5" />
            </div>
            <p className="text-[11px] text-zinc-500 font-medium">Transcrevendo audio do video...</p>
          </div>
        ) : (
          <div className="w-full h-36 flex items-center justify-center">
            <Link size={32} className="text-zinc-800" />
          </div>
        )}

        {/* Scan line sweeping top to bottom */}
        <div
          className="absolute left-0 right-0 h-[2px] z-10 pointer-events-none"
          style={{
            animation: 'scanner-sweep 2.5s ease-in-out infinite',
            background: isUrl
              ? 'linear-gradient(90deg, transparent 5%, rgba(56,189,248,0.5) 30%, rgba(139,92,246,0.3) 70%, transparent 95%)'
              : 'linear-gradient(90deg, transparent 5%, rgba(139,92,246,0.5) 30%, rgba(236,72,153,0.3) 70%, transparent 95%)',
            boxShadow: isUrl
              ? '0 0 16px 3px rgba(56,189,248,0.15), 0 0 40px 6px rgba(56,189,248,0.08)'
              : '0 0 16px 3px rgba(139,92,246,0.15), 0 0 40px 6px rgba(139,92,246,0.08)',
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
            <p className={cn('text-[10px] mt-0.5', isUrl ? 'text-sky-400/70' : 'text-violet-400/70')}>
              {labels[scanLabel]}
            </p>
          </div>
          <Sparkles size={12} className="text-fuchsia-400/40 animate-pulse shrink-0" />
        </div>

        {/* Progress shimmer bar */}
        <div className="h-[2px] rounded-full bg-zinc-900 overflow-hidden">
          <div
            className="h-full w-full rounded-full"
            style={{
              background: isUrl
                ? 'linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)'
                : 'linear-gradient(90deg, transparent, rgba(139,92,246,0.4), transparent)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Full-screen intuitive analyzing overlay */
function AnalyzingOverlay({ phase, hasUrl }: { phase?: string; hasUrl: boolean }) {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const t = setInterval(() => setDotCount(p => (p % 3) + 1), 600);
    return () => clearInterval(t);
  }, []);

  const dots = '.'.repeat(dotCount);

  return (
    <div className="flex flex-col items-center gap-3 mb-4 animate-fade-in-up">
      <div className="relative">
        <div className={cn(
          'w-12 h-12 rounded-2xl flex items-center justify-center',
          hasUrl ? 'bg-sky-500/10 border border-sky-500/20' : 'bg-violet-500/10 border border-violet-500/20',
        )}>
          <Loader2 size={20} className={cn('animate-spin', hasUrl ? 'text-sky-400' : 'text-violet-400')} />
        </div>
        <div className={cn(
          'absolute -inset-3 rounded-3xl blur-xl opacity-40',
          hasUrl ? 'bg-sky-500/10' : 'bg-violet-500/10',
        )} />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-zinc-200">
          {phase || 'Estamos analisando seu arquivo'}{dots}
        </p>
        <p className="text-[11px] text-zinc-500 mt-1">
          Isso pode levar alguns segundos
        </p>
      </div>
    </div>
  );
}

export function MediaScannerBlock({ data }: MediaScannerBlockProps) {
  const { previews, phase } = data;
  const hasUrl = previews.some(p => p.type === 'url');

  return (
    <div className="w-full max-w-sm mx-auto space-y-3">
      {/* Intuitive analyzing message */}
      <AnalyzingOverlay phase={phase} hasUrl={hasUrl} />

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
