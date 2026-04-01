// Arena PWA — Analysis Summary + Expandable Details
// With per-platform summaries, dashboard highlights, and copy buttons

'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronUp, Sparkles, TrendingUp, ArrowRight, Copy, Check,
  MessageCircle, Target, Globe, Video, Mic, Image, Layout, MapPin, Lightbulb,
  Instagram, Youtube, Tv, Radio, Megaphone, FileText, Search, Twitter,
  Crosshair, Church, Brain, ShieldCheck, Users,
} from 'lucide-react';

// Map icon names from API to Lucide components
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  video: Video,
  message: MessageCircle,
  map: MapPin,
  sparkles: Sparkles,
  globe: Globe,
  target: Target,
  trending: TrendingUp,
  mic: Mic,
  image: Image,
  layout: Layout,
};

// Platform display config
const PLATFORM_CONFIG: Record<string, { label: string; color: string; Icon: React.ComponentType<any> }> = {
  instagram: { label: 'Instagram', color: '#e879f9', Icon: Instagram },
  youtube: { label: 'YouTube', color: '#f87171', Icon: Youtube },
  tiktok: { label: 'TikTok', color: '#22d3ee', Icon: Video },
  tv: { label: 'TV', color: '#38bdf8', Icon: Tv },
  radio: { label: 'Rádio', color: '#fbbf24', Icon: Radio },
  outdoor: { label: 'Outdoor', color: '#34d399', Icon: Megaphone },
  impresso: { label: 'Impresso', color: '#a1a1aa', Icon: FileText },
  x: { label: 'X (Twitter)', color: '#a3a3a3', Icon: Twitter },
};

import type { AnaliseData, SpecialistInsight, SpecialistPanel } from '../types';
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
      if (navigator.vibrate) navigator.vibrate(50);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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
function extractPhrases(text: string): { before: string; phrases: string[]; after: string } {
  const patterns = [
    /["\u201C\u201D\u00AB]([^"\u201C\u201D\u00BB]+)["\u201C\u201D\u00BB]/g,
    /(?<!\w)'([^']{10,}[?!.]?)'(?!\w)/g,
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

// ── Platform Summary Bubble ──
function PlatformSummaryBubble({ platform, summary }: { platform: string; summary: string }) {
  const config = PLATFORM_CONFIG[platform] || { label: platform, color: '#a1a1aa', Icon: Globe };
  const { label, color, Icon } = config;
  const { phrases } = extractPhrases(summary);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-[88%] self-start rounded-2xl rounded-bl-sm p-3 bg-white/[0.03] border border-white/[0.06]"
    >
      {/* Platform badge */}
      <div className="flex items-center gap-1.5 mb-2">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ backgroundColor: `${color}15`, border: `0.5px solid ${color}30` }}
        >
          <Icon size={12} style={{ color }} />
          <span className="text-[11px] font-bold tracking-wide" style={{ color }}>
            {label}
          </span>
        </div>
      </div>

      {/* Summary text */}
      <p className="text-sm text-zinc-200 leading-relaxed">
        {summary}
      </p>

      {/* Copyable phrases */}
      {phrases.length > 0 && (
        <div className="mt-3 space-y-2">
          {phrases.map((phrase, i) => (
            <CopyablePhrase key={i} text={phrase} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Dashboard Highlights Section ──
function DashboardHighlights({ highlights }: { highlights: AnaliseData['dashboardHighlights'] }) {
  if (!highlights || highlights.length === 0) return null;

  const typeColors: Record<string, string> = {
    high_approval: '#34d399',
    high_rejection: '#fb7185',
    high_neutrality: '#fbbf24',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="max-w-[88%] self-start rounded-2xl rounded-bl-sm p-3 bg-white/[0.03] border border-white/[0.06]"
    >
      <div className="flex items-center gap-1.5 mb-2.5">
        <Search size={13} className="text-amber-400" />
        <span className="text-[11px] font-bold text-amber-400 tracking-wide">Pontos de Destaque</span>
      </div>
      <div className="space-y-2">
        {highlights.map((h, i) => {
          const dotColor = typeColors[h.type] || '#fbbf24';
          return (
            <div key={i} className="flex items-start gap-2.5">
              <div
                className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: dotColor }}
              />
              <p className="text-xs text-zinc-300 leading-relaxed">
                {h.description}
              </p>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Recommendation Row with copy on phrases ──
function RecommendationRow({ rec, index }: { rec: AnaliseData['recommendations'][0]; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const priorityColors: Record<string, string> = {
    alta: '#fb7185',
    prioridade: '#fb7185',
    'média': '#fbbf24',
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
          {(() => { const Icon = ICON_MAP[rec.icon] || Lightbulb; return <Icon size={14} className="text-zinc-400" />; })()}
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

// ── Specialist Icon Map ──
const SPECIALIST_ICON_MAP: Record<string, React.ComponentType<any>> = {
  bullseye: Crosshair,
  church: Church,
  'trending-up': TrendingUp,
  brain: Brain,
  'shield-check': ShieldCheck,
};

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  baixo: { bg: 'rgba(52,211,153,0.1)', text: '#34d399', border: 'rgba(52,211,153,0.2)' },
  medio: { bg: 'rgba(251,191,36,0.1)', text: '#fbbf24', border: 'rgba(251,191,36,0.2)' },
  alto: { bg: 'rgba(251,113,133,0.1)', text: '#fb7185', border: 'rgba(251,113,133,0.2)' },
  critico: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
};

const RISK_LABELS: Record<string, string> = {
  baixo: 'BAIXO',
  medio: 'MEDIO',
  alto: 'ALTO',
  critico: 'CRITICO',
};

// ── Risk level bar (visual indicator) ──
function RiskBar({ level }: { level: string }) {
  const segments = ['baixo', 'medio', 'alto', 'critico'];
  const activeIdx = segments.indexOf(level);
  return (
    <div className="flex gap-0.5 mt-1">
      {segments.map((seg, i) => (
        <div
          key={seg}
          className="h-[3px] flex-1 rounded-full transition-all duration-300"
          style={{
            backgroundColor: i <= activeIdx
              ? RISK_COLORS[seg]?.text || '#52525b'
              : 'rgba(255,255,255,0.04)',
            opacity: i <= activeIdx ? 1 : 0.5,
          }}
        />
      ))}
    </div>
  );
}

// ── Specialist Card (expandable, redesigned) ──
function SpecialistCard({ specialist, index }: { specialist: SpecialistInsight; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = SPECIALIST_ICON_MAP[specialist.emoji] || Users;
  const risk = RISK_COLORS[specialist.riskLevel] || RISK_COLORS.medio;
  const riskLabel = RISK_LABELS[specialist.riskLevel] || specialist.riskLevel;

  const priorityConfig: Record<string, { color: string; label: string }> = {
    urgente: { color: '#fb7185', label: 'URGENTE' },
    importante: { color: '#fbbf24', label: 'IMPORTANTE' },
    oportunidade: { color: '#34d399', label: 'OPORTUNIDADE' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left rounded-2xl border transition-all duration-300 overflow-hidden"
        style={{
          backgroundColor: expanded ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)',
          borderColor: expanded ? `${risk.text}25` : 'rgba(255,255,255,0.06)',
        }}
      >
        {/* Compact header */}
        <div className="flex items-center gap-3 p-3.5">
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative"
            style={{ backgroundColor: risk.bg, border: `1px solid ${risk.border}` }}
          >
            <Icon size={18} style={{ color: risk.text }} />
            {/* Risk dot */}
            <div
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-zinc-950"
              style={{ backgroundColor: risk.text }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[13px] font-bold text-white leading-tight truncate">{specialist.name}</p>
              <span
                className="text-[8px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
                style={{ backgroundColor: risk.bg, color: risk.text, border: `0.5px solid ${risk.border}` }}
              >
                {riskLabel}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-snug line-clamp-2">{specialist.verdict}</p>
            <RiskBar level={specialist.riskLevel} />
          </div>

          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0"
          >
            <ChevronDown size={14} className="text-zinc-600" />
          </motion.div>
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-3.5 pb-3.5 pt-0 space-y-3">
                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-zinc-800/60 to-transparent" />

                {/* Key Points */}
                {specialist.keyPoints?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Pontos-chave</p>
                    {specialist.keyPoints.map((point, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div
                          className="w-1 h-1 rounded-full mt-[7px] shrink-0"
                          style={{ backgroundColor: risk.text }}
                        />
                        <p className="text-[11px] text-zinc-300 leading-relaxed">{point}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommendations */}
                {specialist.recommendations?.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">O que fazer</p>
                    {specialist.recommendations.map((rec, i) => {
                      const prio = priorityConfig[rec.priority] || priorityConfig.importante;
                      return (
                        <div
                          key={i}
                          className="flex items-start gap-2 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                        >
                          <ArrowRight size={12} style={{ color: prio.color }} className="shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] text-zinc-300 leading-relaxed">{rec.text}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className="text-[8px] font-extrabold uppercase tracking-wider"
                                style={{ color: prio.color }}
                              >
                                {prio.label}
                              </span>
                              {rec.segment && (
                                <span className="text-[9px] text-zinc-600">· {rec.segment}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Data Highlight */}
                {specialist.dataHighlight && (
                  <div
                    className="p-3 rounded-xl"
                    style={{ backgroundColor: risk.bg, border: `0.5px solid ${risk.border}` }}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Lightbulb size={11} style={{ color: risk.text }} />
                      <p className="text-[9px] font-extrabold uppercase tracking-widest" style={{ color: risk.text }}>
                        Dado em destaque
                      </p>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">{specialist.dataHighlight}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </motion.div>
  );
}

// ── Specialist Panel Section (redesigned) ──
function SpecialistPanelSection({ panel }: { panel: SpecialistPanel }) {
  if (!panel?.specialists?.length) return null;

  // Compute overall risk (highest among specialists)
  const riskOrder = ['baixo', 'medio', 'alto', 'critico'];
  const highestRisk = panel.specialists.reduce((max, s) => {
    const idx = riskOrder.indexOf(s.riskLevel);
    const maxIdx = riskOrder.indexOf(max);
    return idx > maxIdx ? s.riskLevel : max;
  }, 'baixo' as string);
  const overallRisk = RISK_COLORS[highestRisk] || RISK_COLORS.medio;

  return (
    <div className="space-y-3">
      {/* Section header with glow */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: overallRisk.bg, border: `0.5px solid ${overallRisk.border}` }}
          >
            <ShieldCheck size={13} style={{ color: overallRisk.text }} />
          </div>
          <p className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-[1.5px]">PAINEL DE ESPECIALISTAS</p>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-zinc-800/60 to-transparent" />
        <span
          className="text-[9px] font-extrabold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: overallRisk.bg, color: overallRisk.text, border: `0.5px solid ${overallRisk.border}` }}
        >
          {panel.specialists.length} analistas
        </span>
      </div>

      {/* Consensus + Divergence row */}
      <div className="grid grid-cols-1 gap-2">
        {panel.consensus && (
          <div className="bg-emerald-500/[0.04] border border-emerald-500/15 rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Check size={12} className="text-emerald-400" />
              <p className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-widest">Consenso da equipe</p>
            </div>
            <p className="text-[12px] text-zinc-200 leading-relaxed">{panel.consensus}</p>
          </div>
        )}

        {panel.divergences && (
          <div className="bg-amber-500/[0.04] border border-amber-500/15 rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Target size={12} className="text-amber-400" />
              <p className="text-[9px] font-extrabold text-amber-400 uppercase tracking-widest">Ponto de divergencia</p>
            </div>
            <p className="text-[12px] text-zinc-200 leading-relaxed">{panel.divergences}</p>
          </div>
        )}
      </div>

      {/* Specialist Cards */}
      <div className="space-y-2">
        {panel.specialists.map((specialist, i) => (
          <SpecialistCard key={specialist.id} specialist={specialist} index={i} />
        ))}
      </div>
    </div>
  );
}

// ── Main Component ──
export function AnalysisSummary({ analiseData }: AnalysisSummaryProps) {
  const [showFull, setShowFull] = useState(false);

  const hasPlatformSummaries = analiseData.platformSummaries && analiseData.platformSummaries.length > 0;

  // Fallback: extract copyable phrases from the generic summary
  const summaryText = analiseData.summary || analiseData.headline || '';
  const { phrases: summaryPhrases } = extractPhrases(summaryText);

  return (
    <>
      {/* Platform-specific summaries OR generic fallback */}
      {hasPlatformSummaries ? (
        <div className="space-y-2">
          {analiseData.platformSummaries!.map((ps, i) => (
            <PlatformSummaryBubble key={i} platform={ps.platform} summary={ps.summary} />
          ))}
        </div>
      ) : (
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
          {summaryPhrases.length > 0 && (
            <div className="mt-3 space-y-2">
              {summaryPhrases.map((phrase, i) => (
                <CopyablePhrase key={i} text={phrase} />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Dashboard Highlights */}
      <DashboardHighlights highlights={analiseData.dashboardHighlights} />

      {/* Expand/Collapse button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="max-w-[88%] self-start"
      >
        <button
          onClick={() => setShowFull(!showFull)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all duration-200"
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

            {/* Specialist Panel */}
            {analiseData.specialistPanel && (
              <SpecialistPanelSection panel={analiseData.specialistPanel} />
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
