// Arena PWA — Analysis Summary + Expandable Details

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Sparkles, TrendingUp, ArrowRight } from 'lucide-react';
import type { AnaliseData } from '../types';
import { ScoreRing } from './ScoreRing';
import { RadarChart } from './RadarChart';

interface AnalysisSummaryProps {
  analiseData: AnaliseData;
}

// ── Recommendation Row ──
function RecommendationRow({ rec, index }: { rec: AnaliseData['recommendations'][0]; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const priorityColors: Record<string, string> = {
    alta: '#fb7185',
    média: '#fbbf24',
    baixa: '#34d399',
  };

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left bg-white/[0.02] border border-white/[0.06] rounded-xl p-3.5 hover:bg-white/[0.04] transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          <span className="text-xs">{rec.icon || '💡'}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white leading-5">{rec.text}</p>
          <div className="flex items-center gap-2 mt-1.5">
            {rec.gain && (
              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                <TrendingUp size={10} /> {rec.gain}
              </span>
            )}
            {rec.priority && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: priorityColors[rec.priority.toLowerCase()] || '#fbbf24' }}
              >
                {rec.priority}
              </span>
            )}
          </div>
          <AnimatePresence>
            {expanded && rec.detail && (
              <motion.p
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="text-xs text-zinc-400 mt-2 leading-relaxed overflow-hidden"
              >
                {rec.detail}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </button>
  );
}

// ── Projected Score Card ──
function ProjectedScoreCard({ current, projected }: { current: number; projected: number }) {
  const diff = projected - current;
  const isGain = diff > 0;

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex items-center gap-4">
      <div className="flex-1">
        <p className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider mb-2">PROJEÇÃO DE NOTA</p>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black text-zinc-400 tabular-nums">{current.toFixed(1)}</span>
          <ArrowRight size={16} className="text-zinc-600" />
          <span className="text-2xl font-black text-emerald-400 tabular-nums">{projected.toFixed(1)}</span>
        </div>
      </div>
      {diff !== 0 && (
        <span className={`text-lg font-black tabular-nums ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isGain ? '+' : ''}{diff.toFixed(1)}
        </span>
      )}
    </div>
  );
}

// ── Main Component ──
export function AnalysisSummary({ analiseData }: AnalysisSummaryProps) {
  const [showFull, setShowFull] = useState(false);

  return (
    <>
      {/* Summary bubble */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-[88%] self-start rounded-2xl rounded-bl-sm p-3 bg-white/[0.03] border border-white/[0.06]"
      >
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles size={14} className="text-emerald-400" />
          <span className="text-[11px] font-bold text-emerald-400 tracking-wide">Análise pronta</span>
        </div>
        <p className="text-sm text-zinc-200 leading-relaxed">
          {analiseData.summary || analiseData.headline}
        </p>

        <button
          onClick={() => setShowFull(!showFull)}
          className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-white/[0.06] w-full"
        >
          {showFull ? <ChevronUp size={14} className="text-emerald-400" /> : <ChevronDown size={14} className="text-emerald-400" />}
          <span className="text-xs font-semibold text-emerald-400">
            {showFull ? 'Ocultar detalhes' : 'Ver análise completa'}
          </span>
        </button>
      </motion.div>

      {/* Full analysis */}
      <AnimatePresence>
        {showFull && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 ml-1 overflow-hidden"
          >
            {/* Hero Card */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <p className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[1.5px] mb-2">SUA ANÁLISE</p>
                  <h2 className="text-lg font-extrabold text-white tracking-tight leading-relaxed">{analiseData.headline}</h2>
                </div>
                <ScoreRing score={analiseData.score} />
              </div>

              {/* Stats */}
              {analiseData.stats?.length > 0 && (
                <div className="flex gap-2 mt-4">
                  {analiseData.stats.map((stat, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-xl p-2.5 text-center"
                    >
                      <p className={`text-base font-extrabold ${stat.value.startsWith('+') ? 'text-emerald-400' : 'text-white'}`}>{stat.value}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5 leading-tight">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Radar */}
            {analiseData.radar && (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                <p className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[1.5px] mb-2">DIAGNÓSTICO DO CONTEÚDO</p>
                <RadarChart radar={analiseData.radar} />
              </div>
            )}

            {/* Projected Score */}
            {analiseData.projectedScore > 0 && (
              <ProjectedScoreCard current={analiseData.score} projected={analiseData.projectedScore} />
            )}

            {/* Recommendations */}
            {analiseData.recommendations?.length > 0 && (
              <div>
                <p className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[1.5px] mb-3">EVOLUA SEU CONTEÚDO</p>
                <div className="space-y-2">
                  {analiseData.recommendations.map((rec, i) => (
                    <RecommendationRow key={i} rec={rec} index={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Insight */}
            {analiseData.insight && (
              <div className="bg-emerald-500/[0.04] border border-emerald-500/20 rounded-2xl p-4">
                <h3 className="text-sm font-extrabold text-emerald-400 mb-1">{analiseData.insight.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-1.5">{analiseData.insight.description}</p>
                <p className="text-xs font-semibold text-zinc-300">→ {analiseData.insight.action}</p>
              </div>
            )}

            {/* Next Steps */}
            {analiseData.nextSteps?.length > 0 && (
              <div>
                <p className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[1.5px] mb-3">PRÓXIMOS PASSOS</p>
                <div className="space-y-2">
                  {analiseData.nextSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-3 bg-zinc-900/40 border border-white/[0.06] rounded-xl p-3.5">
                      <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/[0.08] flex items-center justify-center shrink-0">
                        <span className="text-sm font-extrabold text-white">{i + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-bold text-white">{step.title}</p>
                        <p className="text-xs text-emerald-400 mt-0.5">{step.benefit}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
