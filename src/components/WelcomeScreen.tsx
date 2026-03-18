'use client';

import { Sparkles } from 'lucide-react';

interface WelcomeScreenProps {
  personaCount: number;
}

export function WelcomeScreen({ personaCount }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 pt-8 pb-2 max-w-2xl mx-auto text-center">
      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 mb-6 animate-fade-in-up">
        <Sparkles size={13} className="text-violet-400" />
        <span className="text-[10px] font-black text-violet-400 uppercase tracking-[0.2em]">
          Inteligencia Coletiva Sintetica
        </span>
      </div>

      {/* Title */}
      <h1
        className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-3 leading-[1.05] animate-fade-in-up"
        style={{ animationDelay: '100ms' }}
      >
        <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          Analise seu material
        </span>
      </h1>

      {/* Subtitle */}
      <p
        className="text-zinc-500 text-sm max-w-md mx-auto mb-2 animate-fade-in-up leading-relaxed"
        style={{ animationDelay: '200ms' }}
      >
        Envie uma imagem, video ou grave direto.{' '}
        <span className="text-zinc-300 font-semibold">{personaCount.toLocaleString('pt-BR')}</span>{' '}
        personas vao analisar a performance.
      </p>
    </div>
  );
}
