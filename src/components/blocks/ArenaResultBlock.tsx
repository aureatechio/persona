'use client';

import { useState, useMemo } from 'react';
import { Users, Zap, Eye, ChevronDown, ChevronUp, Layers, Image, Film, Link, Sparkles } from 'lucide-react';
import type { EnhancedSimulationResult, Sentiment } from '@/lib/arena';
import { HeroSentimentBar } from '@/components/arena/HeroSentimentBar';
import { IdeologyPanel } from '@/components/arena/IdeologyPanel';
import { CommentBubble } from '@/components/arena/CommentBubble';
import { RegionBreakdown } from '@/components/arena/RegionBreakdown';
import { GenerationBreakdown } from '@/components/arena/GenerationBreakdown';
import { EducationAnalysis } from '@/components/arena/EducationAnalysis';
import { PoliticalFigurePanel } from '@/components/arena/PoliticalFigurePanel';

interface MediaItem {
  type: 'image' | 'video' | 'url';
  preview?: string;
  name: string;
}

interface ArenaResultBlockProps {
  data: {
    question: string;
    simulation: EnhancedSimulationResult | null;
    totalPersonas: number;
    error?: string;
    media?: MediaItem[];
    mediaContext?: string;
  };
}

export function ArenaResultBlock({ data }: ArenaResultBlockProps) {
  const { question, simulation, totalPersonas } = data;
  const [expanded, setExpanded] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [commentsToShow, setCommentsToShow] = useState(30);
  const [commentFilter, setCommentFilter] = useState<'all' | Sentiment>('all');

  if (!simulation) {
    return (
      <div className="bg-white/[0.03] border border-red-500/20 rounded-2xl p-6 text-center">
        <p className="text-sm text-red-400">{data.error || 'Erro ao processar analise'}</p>
        <p className="text-xs text-zinc-600 mt-2">&ldquo;{question}&rdquo;</p>
      </div>
    );
  }

  const pct = (n: number) =>
    simulation.total > 0 ? Math.round((n / simulation.total) * 100) : 0;

  const filteredComments = commentFilter === 'all'
    ? simulation.comments
    : simulation.comments.filter(c => c.sentiment === commentFilter);
  const visibleComments = filteredComments.slice(0, commentsToShow);

  const hasDetailedAnalysis =
    simulation.regions.length > 0 ||
    simulation.generations.length > 0 ||
    simulation.educationLevels.length > 0 ||
    simulation.politicalFigures.length > 0;

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors duration-200"
      >
        <div className="text-left">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-1">Arena • Analise de Sentimento</p>
          <p className="text-sm font-semibold text-white leading-relaxed">&ldquo;{question}&rdquo;</p>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1"><Users size={10} /> {totalPersonas.toLocaleString('pt-BR')} personas</span>
            <span className="flex items-center gap-1"><Zap size={10} /> {simulation.processingTime.toFixed(0)}ms</span>
            <span className="text-emerald-400 font-bold">{pct(simulation.positive)}% a favor</span>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
      </button>

      {expanded && (
        <div className="px-5 pb-6 space-y-5">
          {/* 1. Hero Sentiment Bar */}
          <HeroSentimentBar
            positive={simulation.positive}
            negative={simulation.negative}
            neutral={simulation.neutral}
            total={simulation.total}
          />

          {/* 2. Three stat cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-emerald-500/10 text-center">
              <p className="text-3xl sm:text-4xl font-black text-emerald-400 tabular-nums">{pct(simulation.positive)}%</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80 mt-1">Concordam</p>
              <p className="text-[10px] text-zinc-600 tabular-nums mt-0.5">{simulation.positive.toLocaleString('pt-BR')}</p>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-rose-500/10 text-center">
              <p className="text-3xl sm:text-4xl font-black text-rose-400 tabular-nums">{pct(simulation.negative)}%</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-rose-400/80 mt-1">Discordam</p>
              <p className="text-[10px] text-zinc-600 tabular-nums mt-0.5">{simulation.negative.toLocaleString('pt-BR')}</p>
            </div>
            <div className="p-4 rounded-2xl bg-zinc-950/80 border border-amber-500/10 text-center">
              <p className="text-3xl sm:text-4xl font-black text-amber-400 tabular-nums">{pct(simulation.neutral)}%</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-400/80 mt-1">Neutros</p>
              <p className="text-[10px] text-zinc-600 tabular-nums mt-0.5">{simulation.neutral.toLocaleString('pt-BR')}</p>
            </div>
          </div>

          {/* 3. Ideology Panel: Quadrants + Cluster Breakdown */}
          {(simulation.quadrants.length > 0 || simulation.clusterResults.length > 0) && (
            <IdeologyPanel
              quadrants={simulation.quadrants}
              clusterResults={simulation.clusterResults}
              total={simulation.total}
            />
          )}

          {/* 4. Expandable detailed analysis */}
          {hasDetailedAnalysis && (
            <div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-200 text-xs font-bold text-zinc-400 hover:text-zinc-200"
              >
                <Layers size={14} />
                {showDetails ? 'Ocultar Analise Detalhada' : 'Ver Analise Detalhada'}
                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showDetails && (
                <div className="mt-4 space-y-6 animate-fade-in-up">
                  {simulation.politicalFigures.length > 0 && <PoliticalFigurePanel figures={simulation.politicalFigures} />}
                  {simulation.regions.length > 0 && <RegionBreakdown regions={simulation.regions} />}
                  {simulation.generations.length > 0 && <GenerationBreakdown generations={simulation.generations} />}
                  {simulation.educationLevels.length > 0 && <EducationAnalysis educationLevels={simulation.educationLevels} />}
                </div>
              )}
            </div>
          )}

          {/* 5. Comments */}
          {simulation.comments.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3 px-1">
                <Eye size={14} className="text-zinc-500" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Reacoes das Personas</p>
                <span className="text-[10px] text-zinc-600 font-bold ml-2">{simulation.comments.length.toLocaleString('pt-BR')} comentarios</span>
              </div>

              {/* Filter tabs */}
              <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                {([
                  { key: 'all' as const, label: 'Todos', active: 'bg-white/10 text-white border-white/20' },
                  { key: 'positive' as const, label: 'A Favor', active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                  { key: 'neutral' as const, label: 'Neutros', active: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                  { key: 'negative' as const, label: 'Contra', active: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
                ]).map(({ key, label, active }) => {
                  const count = key === 'all' ? simulation.comments.length : simulation.comments.filter(c => c.sentiment === key).length;
                  return (
                    <button
                      key={key}
                      onClick={() => { setCommentFilter(key); setCommentsToShow(30); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 ${
                        commentFilter === key ? active : 'text-zinc-500 border-zinc-800/50 hover:text-zinc-300 hover:border-zinc-700/50'
                      }`}
                    >
                      {label} ({count.toLocaleString('pt-BR')})
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {visibleComments.map((comment, idx) => (
                  <CommentBubble key={`comment-${commentFilter}-${idx}`} comment={comment} index={idx} />
                ))}
              </div>

              {filteredComments.length > commentsToShow && (
                <div className="text-center mt-5">
                  <button
                    onClick={() => setCommentsToShow(prev => prev + 30)}
                    className="px-6 py-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/50 text-sm font-bold text-zinc-400 hover:text-white hover:border-zinc-700/50 transition-all duration-200"
                  >
                    Carregar mais {Math.min(30, filteredComments.length - commentsToShow)}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 6. Referência da mídia analisada */}
          <MediaReference media={data.media} mediaContext={data.mediaContext} />
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Media Reference — card compacto e bonito no final
   ============================================================ */

function MediaReference({ media, mediaContext }: { media?: MediaItem[]; mediaContext?: string }) {
  const [expanded, setExpanded] = useState(false);

  const cleanedContext = useMemo(() => {
    if (!mediaContext) return '';
    return cleanMediaContext(mediaContext);
  }, [mediaContext]);

  if (!media || media.length === 0) return null;

  const hasContext = cleanedContext.length > 0;
  // Show first ~200 chars as preview
  const previewText = cleanedContext.length > 200 ? cleanedContext.slice(0, 200) + '...' : cleanedContext;
  const needsExpand = cleanedContext.length > 200;

  return (
    <div className="pt-1">
      <div className="h-px bg-gradient-to-r from-transparent via-zinc-800/50 to-transparent mb-5" />

      <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
        {/* Imagem(ns) */}
        <div className="flex gap-2 p-3 pb-0">
          {media.map((item, idx) => {
            const TypeIcon = item.type === 'image' ? Image : item.type === 'video' ? Film : Link;
            return (
              <div key={idx} className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-zinc-900 border border-white/[0.06] shrink-0">
                {item.preview && item.type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.preview} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <TypeIcon size={24} className="text-zinc-700" />
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex flex-col justify-center ml-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles size={11} className="text-violet-400/60 shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Mídia analisada</p>
            </div>
            <p className="text-[10px] text-zinc-600 truncate">
              {media.map(m => m.name).join(', ')}
            </p>
          </div>
        </div>

        {/* Contexto da IA */}
        {hasContext && (
          <div className="px-3 pt-2.5 pb-3">
            <p className="text-xs text-zinc-400 leading-relaxed">
              {expanded ? cleanedContext : previewText}
            </p>
            {needsExpand && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-2 text-[10px] font-semibold text-violet-400/70 hover:text-violet-400 transition-colors duration-200"
              >
                {expanded ? 'Ver menos' : 'Ver tudo'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Limpeza robusta de contexto de mídia
   ============================================================ */

function cleanMediaContext(raw: string): string {
  let text = raw;

  // 1. Remove code fences: ```json ... ``` ou ``` ... ```
  text = text.replace(/```(?:json|JSON)?\s*/gi, '');
  text = text.replace(/```/g, '');

  // 2. Tenta parse JSON para extrair o campo "context"
  //    Pode estar em vários formatos:
  //    - {"context": "texto"}
  //    - {"context": "texto", "generated_question": "..."}
  //    - Texto puro sem JSON
  let extracted = false;

  // Tenta JSON.parse primeiro (mais confiável)
  try {
    const trimmed = text.trim();
    // Encontra a primeira { e última }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const jsonStr = trimmed.slice(start, end + 1);
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed.context === 'string') {
        text = parsed.context;
        extracted = true;
      }
    }
  } catch {
    // JSON.parse falhou
  }

  // Se JSON.parse não funcionou, tenta regex manual
  if (!extracted) {
    // Remove wrapper {"context": "..."} manualmente
    text = text
      .replace(/^\s*\{?\s*"context"\s*:\s*"?/i, '')
      .replace(/"?\s*,?\s*"generated_question"\s*:[\s\S]*$/i, '')
      .replace(/"\s*\}\s*$/g, '')
      .replace(/^\s*\{/, '')
      .replace(/\}\s*$/, '');
  }

  // 3. Limpa escapes e formatação residual
  text = text
    .replace(/\\n/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\t/g, ' ')
    .replace(/\\\\/g, '\\')
    .replace(/\*\*/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return text;
}
