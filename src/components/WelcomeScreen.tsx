'use client';

import { Sparkles } from 'lucide-react';

interface WelcomeScreenProps {
  personaCount: number;
}

export function WelcomeScreen({ personaCount }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 max-w-2xl mx-auto text-center">
      {/* Decorative glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-violet-600/[0.04] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-[300px] h-[200px] bg-fuchsia-600/[0.03] rounded-full blur-[100px] pointer-events-none" />

      {/* Badge */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 mb-8 animate-fade-in-up">
        <Sparkles size={13} className="text-violet-400" />
        <span className="text-[10px] font-black text-violet-400 uppercase tracking-[0.2em]">
          Inteligencia Coletiva Sintetica
        </span>
      </div>

      {/* Title */}
      <h1
        className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-4 leading-[1.05] animate-fade-in-up"
        style={{ animationDelay: '100ms' }}
      >
        <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          Como posso ajudar?
        </span>
      </h1>

      {/* Subtitle */}
      <p
        className="text-zinc-500 text-sm md:text-base max-w-md mx-auto mb-4 animate-fade-in-up leading-relaxed"
        style={{ animationDelay: '200ms' }}
      >
        Escolha uma funcionalidade abaixo ou digite diretamente para consultar{' '}
        <span className="text-zinc-300 font-semibold">{personaCount.toLocaleString('pt-BR')}</span>{' '}
        personas sinteticas.
      </p>
    </div>
  );
}
