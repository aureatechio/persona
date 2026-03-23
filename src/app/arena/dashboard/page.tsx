// Arena PWA — Dashboard (exact match of mobile dashboard.tsx)

'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, MessageCircle, Users, Vote, Brain } from 'lucide-react';

import { useArenaStore } from '../store';
import { useAuthStore } from '../authStore';
import type { SegmentItem, CommentResult } from '../types';
import { scoreToHex, scoreToEmoji } from '../constants';

import { ArenaNav } from '../components/ArenaNav';
import { ScoreHero } from '../components/ScoreHero';
import { ScoreBar } from '../components/ScoreBar';
import { SegmentCard } from '../components/SegmentCard';
import { CommentCard } from '../components/CommentCard';
import { SentimentBars } from '../components/SentimentBars';

// ── Tab definitions (exact match of mobile) ──

type TabKey = 'demo' | 'eleitoral' | 'ideologico' | 'reacoes';

const TABS: { key: TabKey; label: string; icon: typeof Users }[] = [
  { key: 'demo', label: 'Demográfico', icon: Users },
  { key: 'eleitoral', label: 'Eleitoral', icon: Vote },
  { key: 'ideologico', label: 'Ideológico', icon: Brain },
  { key: 'reacoes', label: 'Reações', icon: MessageCircle },
];

const SEGMENTS_DEMO = [
  { key: 'gender', title: 'Gênero', accent: 'violet' },
  { key: 'race', title: 'Etnia', accent: 'cyan' },
  { key: 'generation', title: 'Faixa Etária', accent: 'sky' },
  { key: 'religion', title: 'Religião', accent: 'amber' },
  { key: 'region', title: 'Região', accent: 'emerald' },
  { key: 'socialClass', title: 'Classe Social', accent: 'rose' },
  { key: 'education', title: 'Escolaridade', accent: 'fuchsia' },
] as const;

const SEGMENTS_ELEITORAL = [
  { key: 'voto2022', title: 'Voto 2022', accent: 'violet' },
  { key: 'voto2026', title: 'Intenção 2026', accent: 'emerald' },
  { key: 'aprovacaoLula', title: 'Aprovação Lula', accent: 'orange' },
  { key: 'politicalLeaning', title: 'Pos. Política', accent: 'sky' },
] as const;

const SEGMENTS_IDEOLOGICO = [
  { key: 'scoreEco', title: 'Espectro Econômico', accent: 'sky' },
  { key: 'scoreCost', title: 'Espectro Comportamental', accent: 'pink' },
  { key: 'archetype', title: 'Arquétipos', accent: 'orange' },
  { key: 'clusterMacro', title: 'Cluster Macro', accent: 'indigo' },
] as const;

// ── VoterGauge (exact match of mobile VoterGauge) ──

function VoterGauge({ item, partyLabel, isLive }: { item: SegmentItem; partyLabel: string; isLive?: boolean }) {
  const total = item.count || 0;
  const isEmpty = total === 0;
  const baseScore = isEmpty ? 0 : Math.round((item.avgScore ?? 0) * 10) / 10;
  const [jitter, setJitter] = useState(0);

  useEffect(() => {
    if (!isLive || isEmpty) { setJitter(0); return; }
    const freq = 1000 + Math.random() * 1000;
    const i = setInterval(() => setJitter((Math.random() - 0.5) * 0.5), freq);
    return () => clearInterval(i);
  }, [isLive, isEmpty]);

  const display = Math.max(0, Math.min(10, baseScore + (isLive && !isEmpty ? jitter : 0)));
  const hex = scoreToHex(display);
  const emoji = scoreToEmoji(display);
  const barPos = (display / 10) * 100;

  const concordance = isEmpty ? null
    : display > 6 ? { text: 'Maioria concorda', color: '#34d399' }
      : display < 4 ? { text: 'Maioria discorda', color: '#fb7185' }
        : { text: 'Opinião dividida', color: '#fbbf24' };

  let positivePct = 0, negativePct = 0;
  if (total > 0) {
    const pos = item.positive || 0;
    const neg = item.negative || 0;
    if (pos + neg > 0) {
      positivePct = Math.round((pos / total) * 100);
      negativePct = Math.round((neg / total) * 100);
    } else {
      positivePct = Math.round((display / 10) * 100);
      negativePct = 100 - positivePct;
    }
  }

  return (
    <div className="flex-1 overflow-hidden rounded-[14px]" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
        <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
        <span className="text-[9px] font-black text-violet-500/80 uppercase tracking-wider truncate flex-1">
          Eleitores de {item.label} ({partyLabel})
        </span>
      </div>
      {/* Body */}
      <div className="flex flex-col items-center px-2.5 py-2.5 gap-1">
        <span className="text-xl">{isEmpty ? '' : emoji}</span>
        <span className="text-[28px] font-black tabular-nums" style={{ color: isEmpty ? '#52525b' : hex }}>{display.toFixed(1)}</span>
        {concordance && <span className="text-[10px] font-semibold" style={{ color: concordance.color }}>{concordance.text}</span>}
        {/* Mini bar with gradient */}
        <div className="w-full h-1.5 rounded-full overflow-hidden relative" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
          <div className="absolute inset-0 rounded-full opacity-20" style={{ background: 'linear-gradient(to right, #fb7185, #fb923c, #fbbf24, #34d399, #6ee7b7)' }} />
          {!isEmpty && (
            <div className="absolute top-0 w-1.5 h-full rounded-full -ml-[3px] transition-all duration-500" style={{ left: `${barPos}%`, backgroundColor: hex, boxShadow: `0 0 3px ${hex}99` }} />
          )}
        </div>
        {!isEmpty && (
          <span className="text-[9px] text-zinc-600 mt-0.5">{positivePct}% concordam · {negativePct}% discordam</span>
        )}
      </div>
    </div>
  );
}

// ── Waiting state (exact match of mobile Waiting) ──

function Waiting() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 pb-24 relative">
      {/* Orbs */}
      <motion.div className="absolute rounded-full" style={{ width: 200, height: 200, backgroundColor: 'rgba(52,211,153,0.06)', top: '20%', left: '10%' }} animate={{ x: [0, 30, 0, -30, 0], y: [0, 20, 0, -20, 0] }} transition={{ duration: 8, repeat: Infinity }} />
      <motion.div className="absolute rounded-full" style={{ width: 180, height: 180, backgroundColor: 'rgba(139,92,246,0.05)', bottom: '25%', right: '10%' }} animate={{ x: [0, -25, 0, 25, 0], y: [0, -15, 0, 15, 0] }} transition={{ duration: 9, repeat: Infinity }} />

      {/* Rings */}
      <div className="relative w-44 h-44 flex items-center justify-center">
        <motion.div className="absolute w-44 h-44 rounded-full" style={{ border: '1.5px solid rgba(52,211,153,0.2)' }} animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} />
        <motion.div className="absolute w-[140px] h-[140px] rounded-full" style={{ border: '1px dashed rgba(52,211,153,0.12)' }} animate={{ rotate: -360 }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }} />
        <motion.div className="absolute w-[100px] h-[100px] rounded-full" style={{ border: '0.5px solid rgba(52,211,153,0.15)' }} animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }} />
        <motion.div animate={{ scale: [1, 1.1, 0.95, 1], opacity: [0.7, 1, 0.5, 0.7] }} transition={{ duration: 3, repeat: Infinity }}>
          <BarChart3 size={40} className="text-emerald-400" />
        </motion.div>
      </div>

      <h2 className="text-[22px] font-extrabold text-white tracking-tight mt-2">Dashboard</h2>
      <p className="text-[13px] text-zinc-600">Aguardando dados...</p>
      <div className="flex gap-2 mt-3">
        {[0, 1, 2].map((i) => (
          <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" animate={{ y: [-8, 0] }} transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse', delay: i * 0.2 }} />
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('demo');

  const avgScore = useArenaStore((s) => s.data.avgScore);
  const processedCount = useArenaStore((s) => s.data.processedCount);
  const totalCount = useArenaStore((s) => s.data.totalCount);
  const phase = useArenaStore((s) => s.data.phase);
  const positive = useArenaStore((s) => s.data.positive) || 0;
  const negative = useArenaStore((s) => s.data.negative) || 0;
  const neutral = useArenaStore((s) => s.data.neutral) || 0;
  const segments = useArenaStore((s) => s.data.segments);
  const liveComments = useArenaStore((s) => s.data.liveComments);
  const simulation = useArenaStore((s) => s.data.simulation);
  const hasEverReceived = useArenaStore((s) => s.hasEverReceived);

  const initAuth = useAuthStore((s) => s.initialize);
  useEffect(() => { initAuth(); }, [initAuth]);

  const isLive = phase !== 'complete';
  const total = positive + negative + neutral;
  const progress = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;

  const comments = useMemo(() => {
    const sim = simulation?.comments;
    return (sim && sim.length > 0) ? sim : (liveComments ?? []);
  }, [simulation?.comments, liveComments]);

  const commentsSlice = useMemo(() => comments.slice(0, 30), [comments]);

  const voto2022 = (segments as any)?.voto2022 || [];
  const lulaVoters = voto2022.find?.((s: SegmentItem) => s.label === 'Lula');
  const bolsonaroVoters = voto2022.find?.((s: SegmentItem) => s.label === 'Bolsonaro');

  if (!hasEverReceived) {
    return (
      <div className="flex flex-col h-[100dvh] bg-black" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <Waiting />
        <ArenaNav />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-black" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* ═══ STATUS BAR (exact match of mobile) ═══ */}
      <div className="flex items-center px-4 h-11 gap-2 shrink-0" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
        {isLive ? (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(52,211,153,0.3)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <span className="text-[11px] font-black text-emerald-400 tracking-[1.5px]">AO VIVO</span>
          </div>
        ) : (
          <span className="text-[11px] font-black text-emerald-400 tracking-[1.5px]">COMPLETO</span>
        )}
        <div className="flex-1" />
        <Users size={14} className="text-zinc-500" />
        {isLive && processedCount > 0 ? (
          <div className="flex items-center gap-1.5">
            <div className="w-20 h-1 rounded overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded bg-emerald-400 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-bold text-zinc-400 tabular-nums">{processedCount}/{totalCount}</span>
            <span className="text-[13px] font-black text-emerald-400 tabular-nums">{progress}%</span>
          </div>
        ) : isLive && processedCount === 0 ? (
          <div className="flex items-center gap-1.5">
            <div className="w-20 h-1 rounded overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
              <div className="w-1/3 h-full rounded opacity-60" style={{ backgroundColor: 'rgba(52,211,153,0.4)' }} />
            </div>
            <span className="text-xs font-medium text-zinc-400">Preparando...</span>
          </div>
        ) : total > 0 ? (
          <span className="text-[13px] font-bold text-zinc-400 tabular-nums">{total.toLocaleString('pt-BR')}</span>
        ) : null}
      </div>

      {/* Thin progress bar */}
      {isLive && processedCount > 0 && (
        <div className="h-[3px]" style={{ backgroundColor: 'rgba(24,24,27,1)' }}>
          <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* ═══ CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: 100 }}>
        <div className="px-4 py-4 space-y-4">

          {/* ScoreHero + ScoreBar (exact match) */}
          <ScoreHero avgScore={avgScore ?? 0} processedCount={processedCount} isLive={isLive} />
          <ScoreBar avgScore={avgScore ?? 0} totalCount={total} isLive={isLive} />

          {/* SentimentBars */}
          {total > 0 && <SentimentBars positive={positive} negative={negative} neutral={neutral} total={total} isLive={isLive} />}

          {/* Voter Gauges (exact match) */}
          <div className="flex gap-2.5">
            {lulaVoters ? (
              <VoterGauge item={lulaVoters} partyLabel="PT" isLive={isLive} />
            ) : (
              <div className="flex-1 rounded-[14px] flex items-center justify-center py-6" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                <span className="text-[10px] text-zinc-600">Eleitores de Lula</span>
              </div>
            )}
            {bolsonaroVoters ? (
              <VoterGauge item={bolsonaroVoters} partyLabel="PL" isLive={isLive} />
            ) : (
              <div className="flex-1 rounded-[14px] flex items-center justify-center py-6" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                <span className="text-[10px] text-zinc-600">Eleitores de Bolsonaro</span>
              </div>
            )}
          </div>

          {/* Tab bar (exact match) */}
          <div className="flex" style={{ borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)} className="flex-1 flex items-center justify-center gap-1 py-3 relative">
                  <Icon size={14} className={isActive ? 'text-emerald-400' : 'text-zinc-600'} />
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${isActive ? 'text-white' : 'text-zinc-600'}`}>{tab.label}</span>
                  {isActive && <div className="absolute bottom-0 left-[15%] right-[15%] h-0.5 rounded bg-emerald-400" />}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {activeTab === 'demo' && (
            <div className="space-y-3">
              {SEGMENTS_DEMO.map((seg) => <SegmentCard key={seg.key} items={(segments as any)?.[seg.key]} title={seg.title} accentColor={seg.accent} maxItems={10} isLive={isLive} />)}
            </div>
          )}
          {activeTab === 'eleitoral' && (
            <div className="space-y-3">
              {SEGMENTS_ELEITORAL.map((seg) => <SegmentCard key={seg.key} items={(segments as any)?.[seg.key]} title={seg.title} accentColor={seg.accent} maxItems={10} isLive={isLive} />)}
            </div>
          )}
          {activeTab === 'ideologico' && (
            <div className="space-y-3">
              {SEGMENTS_IDEOLOGICO.map((seg) => <SegmentCard key={seg.key} items={(segments as any)?.[seg.key]} title={seg.title} accentColor={seg.accent} maxItems={10} isLive={isLive} />)}
            </div>
          )}
          {activeTab === 'reacoes' && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 py-1">
                <MessageCircle size={14} className="text-zinc-500" />
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider flex-1">REAÇÕES</span>
                <span className="text-[11px] text-zinc-600 tabular-nums">{comments.length}</span>
              </div>
              {commentsSlice.length > 0 ? (
                <div className="space-y-2.5">
                  {commentsSlice.map((c, i) => <CommentCard key={`${c.personaName}-${i}`} comment={c} />)}
                </div>
              ) : (
                <div className="flex flex-col items-center py-16">
                  <div className="w-16 h-16 rounded-[20px] flex items-center justify-center mb-3" style={{ backgroundColor: 'rgba(39,39,42,0.5)' }}>
                    <MessageCircle size={32} className="text-zinc-700" />
                  </div>
                  <p className="text-[13px] text-zinc-600">Aguardando reações...</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <ArenaNav />
    </div>
  );
}
