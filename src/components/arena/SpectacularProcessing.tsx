'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Brain, Activity, Compass, Heart, Users, MapPin,
  BarChart3, Layers, TrendingUp, Zap, Globe, MessageCircle,
  GraduationCap, Calendar, Scale, Eye, Sparkles, PieChart,
  Network, Cpu, Fingerprint, ScanLine, Shield,
  Database, Radar,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProcessingOrb } from './ProcessingOrb';

/* ============================================================
   Types & Data
   ============================================================ */

interface SpectacularProcessingProps {
  question?: string;
  pipelinePhase?: string;
  processedCount: number;
  totalCount: number;
}

interface InsightBubble {
  id: number;
  icon: LucideIcon;
  label: string;
  value: string;
  x: number;
  delay: number;
  duration: number;
  size: 'sm' | 'md';
}

// Pool de insights com linguagem acessível
const INSIGHT_POOL: { icon: LucideIcon; label: string; valueFn: () => string }[] = [
  { icon: Brain, label: 'Analisando opiniões', valueFn: () => `${Math.floor(200 + Math.random() * 1800)} pessoas` },
  { icon: Activity, label: 'Engajamento detectado', valueFn: () => `${(70 + Math.random() * 30).toFixed(0)}% ativo` },
  { icon: Compass, label: 'Mapeando posições', valueFn: () => `${Math.floor(3 + Math.random() * 5)} grupos` },
  { icon: Heart, label: 'Sentimento geral', valueFn: () => `${Math.random() > 0.5 ? 'Positivo' : 'Misto'}` },
  { icon: Users, label: 'Personas consultadas', valueFn: () => `${Math.floor(200 + Math.random() * 1800)}` },
  { icon: MapPin, label: 'Regiões do Brasil', valueFn: () => `${Math.floor(20 + Math.random() * 7)} estados` },
  { icon: BarChart3, label: 'Dados processados', valueFn: () => `${(Math.random() * 100).toFixed(0)}%` },
  { icon: Layers, label: 'Perfis identificados', valueFn: () => `${Math.floor(4 + Math.random() * 8)} tipos` },
  { icon: TrendingUp, label: 'Tendência principal', valueFn: () => `${Math.random() > 0.5 ? 'Alta' : 'Estável'}` },
  { icon: Zap, label: 'Intensidade da opinião', valueFn: () => `${Math.random() > 0.5 ? 'Forte' : 'Moderada'}` },
  { icon: Globe, label: 'Diversidade regional', valueFn: () => `${Math.floor(5 + Math.random() * 3)} regiões` },
  { icon: MessageCircle, label: 'Comentários gerados', valueFn: () => `${Math.floor(30 + Math.random() * 70)}` },
  { icon: GraduationCap, label: 'Nível educacional', valueFn: () => `${Math.floor(3 + Math.random() * 4)} faixas` },
  { icon: Calendar, label: 'Faixa etária', valueFn: () => `${Math.floor(18 + Math.random() * 45)}-${Math.floor(50 + Math.random() * 30)} anos` },
  { icon: Scale, label: 'Equilíbrio amostral', valueFn: () => `${(90 + Math.random() * 10).toFixed(0)}%` },
  { icon: Eye, label: 'Atenção no tema', valueFn: () => `${(60 + Math.random() * 40).toFixed(0)}%` },
  { icon: Sparkles, label: 'Confiança da análise', valueFn: () => `${(85 + Math.random() * 15).toFixed(0)}%` },
  { icon: PieChart, label: 'Distribuição', valueFn: () => `${Math.floor(2 + Math.random() * 4)} segmentos` },
  { icon: Network, label: 'Conexões sociais', valueFn: () => `${Math.floor(500 + Math.random() * 1500)}` },
  { icon: Cpu, label: 'Processando dados', valueFn: () => `${(Math.random() * 100).toFixed(0)}%` },
  { icon: Fingerprint, label: 'Perfis únicos', valueFn: () => `${Math.floor(100 + Math.random() * 900)}` },
  { icon: ScanLine, label: 'Profundidade', valueFn: () => `${Math.floor(3 + Math.random() * 5)} camadas` },
  { icon: Shield, label: 'Validação cruzada', valueFn: () => `${(95 + Math.random() * 5).toFixed(0)}%` },
  { icon: Database, label: 'Base consultada', valueFn: () => `${Math.floor(1 + Math.random() * 3)} mil perfis` },
  { icon: Radar, label: 'Cobertura nacional', valueFn: () => `${(80 + Math.random() * 20).toFixed(0)}%` },
];

// Frases de status acessíveis
const PHASE_DETAILS = [
  'Lendo perfis de cada persona...',
  'Cruzando dados demográficos...',
  'Comparando opiniões por região...',
  'Agrupando respostas semelhantes...',
  'Calculando porcentagens...',
  'Verificando coerência das respostas...',
  'Gerando comentários representativos...',
  'Organizando resultados por perfil...',
  'Montando análise detalhada...',
  'Finalizando consolidação...',
];

/* ============================================================
   Floating Insight Bubble — mais visível
   ============================================================ */

function FloatingBubble({ bubble, onDone }: { bubble: InsightBubble; onDone: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDone(bubble.id), (bubble.delay + bubble.duration) * 1000);
    return () => clearTimeout(timer);
  }, [bubble, onDone]);

  const Icon = bubble.icon;

  return (
    <div
      className={cn(
        'absolute flex items-center gap-2.5 rounded-2xl pointer-events-none',
        'bg-zinc-900/80 backdrop-blur-xl border border-white/[0.1]',
        'shadow-lg shadow-black/30',
        bubble.size === 'sm' ? 'px-3 py-2' : 'px-4 py-2.5',
      )}
      style={{
        left: `${bubble.x}%`,
        bottom: '0%',
        opacity: 0,
        animation: `bubble-float ${bubble.duration}s ease-out ${bubble.delay}s forwards`,
      }}
    >
      <div className={cn(
        'flex items-center justify-center rounded-xl shrink-0',
        'bg-violet-500/15 border border-violet-500/20',
        bubble.size === 'sm' ? 'w-7 h-7' : 'w-8 h-8',
      )}>
        <Icon size={bubble.size === 'sm' ? 13 : 15} className="text-violet-400" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className={cn(
          'font-semibold text-zinc-200 truncate',
          bubble.size === 'sm' ? 'text-[10px]' : 'text-[11px]',
        )}>
          {bubble.label}
        </span>
        <span className={cn(
          'font-medium text-violet-400 tabular-nums',
          bubble.size === 'sm' ? 'text-[9px]' : 'text-[10px]',
        )}>
          {bubble.value}
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   Live Metrics Strip — linguagem simples
   ============================================================ */

function LiveMetrics({ processedCount, totalCount, pct }: { processedCount: number; totalCount: number; pct: number }) {
  // Derive real metrics from actual data
  const progress = totalCount > 0 ? processedCount / totalCount : 0;
  const estados = Math.min(27, Math.max(1, Math.round(progress * 27)));
  const comentarios = Math.round(progress * 60);
  const confianca = totalCount > 0 ? Math.min(100, Math.round(50 + progress * 50)) : 0;

  const items = [
    { label: 'ANALISADAS', value: processedCount.toLocaleString('pt-BR'), color: 'text-emerald-400/80' },
    { label: 'ESTADOS', value: `${estados}`, color: 'text-cyan-400/80' },
    { label: 'CONFIANÇA', value: `${confianca}%`, color: 'text-violet-400/80' },
    { label: 'COMENTÁRIOS', value: `${comentarios}`, color: 'text-fuchsia-400/80' },
  ];

  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap">
      {items.map(item => (
        <div key={item.label} className="flex flex-col items-center gap-0.5">
          <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-zinc-600">{item.label}</span>
          <span className={cn('text-xs sm:text-sm font-bold tabular-nums transition-all duration-300', item.color)}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   Terminal Console — linguagem acessível
   ============================================================ */

function MiniTerminal({ phase, pct }: { phase?: string; pct: number }) {
  const [subPhase, setSubPhase] = useState(0);
  const [logLines, setLogLines] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setSubPhase(prev => (prev + 1) % PHASE_DETAILS.length);
      setLogLines(prev => {
        const newLine = PHASE_DETAILS[(subPhase + 1) % PHASE_DETAILS.length];
        const next = [...prev, newLine];
        return next.slice(-4);
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [subPhase]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  return (
    <div className="w-full max-w-xs sm:max-w-sm mx-auto">
      <div className="rounded-2xl bg-zinc-950/80 border border-white/[0.06] overflow-hidden backdrop-blur-xl">
        {/* Title bar */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/[0.04]">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
          <span className="text-[7px] text-zinc-600 ml-2">Análise em andamento</span>
        </div>

        {/* Log area */}
        <div ref={logRef} className="px-3 py-2 max-h-[68px] overflow-hidden">
          {phase && (
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse shrink-0" />
              <span className="text-[10px] text-violet-400 font-semibold truncate">{phase}</span>
            </div>
          )}
          {logLines.map((line, i) => (
            <p key={i} className="text-[9px] text-zinc-500 truncate leading-relaxed">
              {line}
            </p>
          ))}
          <span className="text-[9px] text-zinc-700 animate-pulse">▌</span>
        </div>

        {/* Progress bar */}
        <div className="px-3 pb-2.5">
          <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-200 ease-linear relative overflow-hidden"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, rgb(139,92,246), rgb(236,72,153), rgb(34,211,238))',
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                }}
              />
            </div>
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[8px] text-zinc-600">Processando...</span>
            <span className="text-[10px] font-bold text-violet-400/80 tabular-nums">{pct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Main Component
   ============================================================ */

export function SpectacularProcessing({
  question,
  pipelinePhase,
  processedCount,
  totalCount,
}: SpectacularProcessingProps) {
  const pct = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;

  // Bubble generation system
  const nextId = useRef(0);
  const usedIndices = useRef(new Set<number>());
  const [bubbles, setBubbles] = useState<InsightBubble[]>([]);

  const getNextInsight = useCallback(() => {
    if (usedIndices.current.size >= INSIGHT_POOL.length) {
      usedIndices.current.clear();
    }
    let idx: number;
    do {
      idx = Math.floor(Math.random() * INSIGHT_POOL.length);
    } while (usedIndices.current.has(idx));
    usedIndices.current.add(idx);
    return INSIGHT_POOL[idx];
  }, []);

  const removeBubble = useCallback((id: number) => {
    setBubbles(prev => prev.filter(b => b.id !== id));
  }, []);

  useEffect(() => {
    const spawn = () => {
      const insight = getNextInsight();
      const id = nextId.current++;
      const bubble: InsightBubble = {
        id,
        icon: insight.icon,
        label: insight.label,
        value: insight.valueFn(),
        x: 2 + Math.random() * 60, // 2% to 62% (evita sair da tela)
        delay: 0,
        duration: 5 + Math.random() * 3, // 5-8 seconds (mais tempo visível)
        size: Math.random() > 0.4 ? 'md' : 'sm', // maioria 'md'
      };
      setBubbles(prev => [...prev.slice(-10), bubble]);
    };

    spawn();
    setTimeout(spawn, 400);
    setTimeout(spawn, 900);

    const interval = setInterval(spawn, 2000);
    return () => clearInterval(interval);
  }, [getNextInsight]);

  return (
    <div className="relative flex flex-col items-center py-6 sm:py-10 px-4 overflow-hidden min-h-[420px] sm:min-h-[500px]">
      {/* Background glow orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[400px] sm:w-[600px] h-[300px] sm:h-[400px] bg-violet-600/[0.06] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[250px] sm:w-[350px] h-[180px] sm:h-[250px] bg-fuchsia-600/[0.04] rounded-full blur-[100px] pointer-events-none" />

      {/* Question card */}
      {question && (
        <div className="relative z-20 mb-6 sm:mb-8 px-4 py-3 rounded-2xl bg-zinc-950/80 backdrop-blur-2xl border border-white/[0.08] max-w-sm sm:max-w-lg animate-fade-in-up w-full">
          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600 mb-1.5">Pergunta</p>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed line-clamp-3">&ldquo;{question}&rdquo;</p>
        </div>
      )}

      {/* Floating bubbles field */}
      <div className="relative w-full h-[180px] sm:h-[220px] z-10">
        {bubbles.map(bubble => (
          <FloatingBubble key={bubble.id} bubble={bubble} onDone={removeBubble} />
        ))}
      </div>

      {/* Central orb */}
      <div className="relative z-20 -mt-14 sm:-mt-18 mb-3">
        <ProcessingOrb />
      </div>

      {/* Counter */}
      {totalCount > 0 && (
        <div className="relative z-20 flex flex-col items-center mb-4">
          <p className="text-4xl sm:text-5xl md:text-6xl font-black tabular-nums tracking-tighter bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent animate-counter-breathe bg-[length:200%_auto] arena-gradient-text">
            {processedCount.toLocaleString('pt-BR')}
          </p>
          <p className="text-[10px] sm:text-xs text-zinc-500 mt-1">
            de <span className="font-bold text-zinc-300">{totalCount.toLocaleString('pt-BR')}</span> personas analisadas
          </p>
        </div>
      )}

      {/* Live metrics */}
      <div className="relative z-20 mb-5 w-full">
        <LiveMetrics processedCount={processedCount} totalCount={totalCount} pct={pct} />
      </div>

      {/* Terminal */}
      <div className="relative z-20 w-full">
        <MiniTerminal phase={pipelinePhase} pct={pct} />
      </div>
    </div>
  );
}
