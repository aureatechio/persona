// Arena PWA — Analysis Summary + Expandable Details
// With copy button on suggested phrases

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Sparkles, TrendingUp, ArrowRight, Copy, Check } from 'lucide-react';
import type { AnaliseData } from '../types';
import { ScoreRing } from './ScoreRing';
import { RadarChart } from './RadarChart';

interface AnalysisSummaryProps {
  analiseData: AnaliseData;
}

// ── Copy Button ──
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(50);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-1 rounded-lg active:scale-95 transition-all duration-200 shrink-0"
      style={{
        backgroundColor: copied ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)',
        border: `0.5px solid ${copied ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      {copied ? (
        <Check size={12} className="text-emerald-400" />
      ) : (
        <Copy size={12} className="text-zinc-400" />
      )}
      <span className={`text-[10px] font-semibold ${copied ? 'text-emerald-400' : 'text-zinc-500'}`}>
        {copied ? 'Copiado!' : 'Copiar'}
      </span>
    </button>
  );
}

// ── Copyable Text Block (for suggested phrases) ──
function CopyablePhrase({ text }: { text: string }) {
  return (
    <div
      className="flex items-start gap-2 mt-2 p-2.5 rounded-xl"
      style={{ backgroundColor: 'rgba(52,211,153,0.06)', border: '0.5px solid rgba(52,211,153,0.15)' }}
    >
      <p className="flex-1 text-xs text-emerald-300 leading-relaxed italic">
        &ldquo;{text}&rdquo;
      </p>
      <CopyButton text={text} />
    </div>
  );
}

// ── Extract quoted phrases from text ──
// Matches: "...", "...", «...», '...' (single quotes around phrases > 10 chars)
function extractPhrases(text: string): { before: string; phrases: string[]; after: string } {
  const patterns = [
    /[""«]([^""»]+)[""»]/g,           // double/smart quotes
    /(?<!\w)'([^']{10,}[?!.]?)'(?!\w)/g,  // single quotes (not contractions)
  ];
  const phrases: string[] = [];
  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const phrase = match[1].trim();
      if (phrase.length > 10 && !phrases.includes(phrase)) {
        phrases.push(phrase);
      }
    }
  }
  return { before: text, phrases, after: '' };
}

// ── Recommendation Row with copy on phrases ──
function RecommendationRow({ rec, index }: { rec: AnaliseData['recommendations'][0]; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const priorityColors: Record<string, string> = {
    alta: '#fb7185',
    prioridade: '#fb7185',
    média: '#fbbf24',
    importante: '#fbbf24',
    baixa: '#34d399',
    oportunidade: '#34d399',
  };

  const detailPhrases = rec.detail ? extractPhrases(rec.detail) : null;

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
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {detailPhrases && detailPhrases.phrases.length > 0 ? (
                  <>
                    <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{detailPhrases.before}</p>
                    {detailPhrases.phrases.map((phrase, i) => (
                      <CopyablePhrase key={i} text={phrase} />
                    ))}
                  </>
                ) : (
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{rec.detail}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <ChevronDown
          size={14}
          className="text-zinc-600 shrink-0 mt-1 transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}
        />
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

  // Extract copyable phrases from the summary text
  const summaryText = analiseData.summary || analiseData.headline || '';
  const { phrases: summaryPhrases } = extractPhrases(summaryText);

  return (
    <>
      {/* Summary bubble with copyable phrases */}
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
          {summaryText}
        </p>

        {/* Copyable phrases extracted from summary */}
        {summaryPhrases.length > 0 && (
          <div className="mt-3 space-y-2">
            {summaryPhrases.map((phrase, i) => (
              <CopyablePhrase key={i} text={phrase} />
            ))}
          </div>
        )}

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

            {/* Insight with copyable action */}
            {analiseData.insight && (
              <div className="bg-emerald-500/[0.04] border border-emerald-500/20 rounded-2xl p-4">
                <h3 className="text-sm font-extrabold text-emerald-400 mb-1">{analiseData.insight.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed mb-2">{analiseData.insight.description}</p>

                {/* Action with copy */}
                <div className="flex items-start gap-2 p-2.5 rounded-xl" style={{ backgroundColor: 'rgba(52,211,153,0.08)', border: '0.5px solid rgba(52,211,153,0.2)' }}>
                  <p className="flex-1 text-xs font-semibold text-emerald-300 leading-relaxed">
                    → {analiseData.insight.action}
                  </p>
                  <CopyButton text={analiseData.insight.action} />
                </div>
              </div>
            )}

            {/* Next Steps with copy on each */}
            {analiseData.nextSteps?.length > 0 && (
              <div>
                <p className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[1.5px] mb-3">PRÓXIMOS PASSOS</p>
                <div className="space-y-2">
                  {analiseData.nextSteps.map((step, i) => (
                    <div key={i} className="bg-zinc-900/40 border border-white/[0.06] rounded-xl p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/[0.08] flex items-center justify-center shrink-0">
                          <span className="text-sm font-extrabold text-white">{i + 1}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-[13px] font-bold text-white">{step.title}</p>
                          <p className="text-xs text-emerald-400 mt-0.5">{step.benefit}</p>
                        </div>
                      </div>
                      {/* Copy the full step as actionable text */}
                      <div className="flex justify-end mt-2">
                        <CopyButton text={`${step.title}: ${step.benefit}`} />
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
