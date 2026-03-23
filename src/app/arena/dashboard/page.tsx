// Arena PWA — Dashboard Screen

'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, MessageCircle, Users, Vote, Brain } from 'lucide-react';

import { useArenaStore } from '../store';
import { useAuthStore } from '../authStore';
import type { SegmentItem, CommentResult } from '../types';
import { scoreToHex, scoreToEmoji } from '../constants';

import { ArenaNav } from '../components/ArenaNav';
import { SegmentCard } from '../components/SegmentCard';
import { CommentCard } from '../components/CommentCard';
import { SentimentBars } from '../components/SentimentBars';

// ── Tab definitions ──

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

// ── Score Hero (animated large score) ──

function ScoreHero({ avgScore, isLive }: { avgScore: number; isLive: boolean }) {
  const [jitter, setJitter] = useState(0);
  const display = avgScore + jitter;
  const hex = scoreToHex(display);
  const emoji = scoreToEmoji(display);

  useEffect(() => {
    if (!isLive) { setJitter(0); return; }
    const i = setInterval(() => setJitter((Math.random() - 0.5) * 0.6), 600);
    return () => clearInterval(i);
  }, [isLive]);

  return (
    <div className="flex flex-col items-center gap-1 py-4">
      <span className="text-4xl">{emoji}</span>
      <span className="text-5xl font-black tabular-nums tracking-tight" style={{ color: hex }}>
        {display.toFixed(1)}
      </span>
      <span className="text-xs text-zinc-500 font-semibold">/10 Nota geral</span>
    </div>
  );
}

// ── Voter Gauge ──

function VoterGauge({ item, partyLabel, isLive }: { item: SegmentItem; partyLabel: string; isLive?: boolean }) {
  const total = item.count || 0;
  const isEmpty = total === 0;
  const baseScore = isEmpty ? 0 : Math.round((item.avgScore ?? 0) * 10) / 10;
  const [jitter, setJitter] = useState(0);

  useEffect(() => {
    if (!isLive || isEmpty) { setJitter(0); return; }
    const i = setInterval(() => setJitter((Math.random() - 0.5) * 0.6), 800);
    return () => clearInterval(i);
  }, [isLive, isEmpty]);

  const display = Math.max(0, Math.min(10, baseScore + jitter));
  const hex = scoreToHex(display);
  const emoji = scoreToEmoji(display);
  const barPos = (display / 10) * 100;

  const concordance = isEmpty ? null
    : display > 6 ? { text: 'Maioria concorda', color: '#34d399' }
    : display < 4 ? { text: 'Maioria discorda', color: '#fb7185' }
    : { text: 'Opinião dividida', color: '#fbbf24' };

  return (
    <div className="flex-1 bg-white/[0.03] rounded-xl border border-white/[0.06] overflow-hidden">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-white/[0.04]">
        <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
        <span className="text-[9px] font-black text-violet-500/80 uppercase tracking-wider truncate">
          Eleitores de {item.label} ({partyLabel})
        </span>
      </div>
      <div className="flex flex-col items-center px-2.5 py-2.5 gap-1">
        <span className="text-xl">{isEmpty ? '' : emoji}</span>
        <span className="text-[28px] font-black tabular-nums" style={{ color: isEmpty ? '#52525b' : hex }}>
          {display.toFixed(1)}
        </span>
        {concordance && <span className="text-[10px] font-semibold" style={{ color: concordance.color }}>{concordance.text}</span>}
        <div className="w-full h-1.5 rounded-full bg-white/[0.03] relative overflow-hidden mt-1">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-rose-400/20 via-amber-400/20 to-emerald-400/20" />
          {!isEmpty && (
            <div
              className="absolute top-0 w-1.5 h-full rounded-full -ml-[3px] transition-all duration-500"
              style={{ left: `${barPos}%`, backgroundColor: hex, boxShadow: `0 0 4px ${hex}80` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Waiting state ──

function Waiting() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 pb-20">
      <motion.div
        className="relative w-44 h-44 flex items-center justify-center"
      >
        <motion.div
          className="absolute inset-0 rounded-full border-[1.5px] border-emerald-400/20"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-5 rounded-full border border-emerald-400/10 border-dashed"
          animate={{ rotate: -360 }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-10 rounded-full border-[0.5px] border-emerald-400/15"
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        />
        <BarChart3 size={40} className="text-emerald-400" />
      </motion.div>
      <h2 className="text-[22px] font-extrabold text-white tracking-tight">Dashboard</h2>
      <p className="text-[13px] text-zinc-600">Aguardando dados...</p>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-emerald-400/60"
            animate={{ y: [-8, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse', delay: i * 0.15 }}
          />
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
      <div className="flex flex-col h-[100dvh] bg-black">
        <Waiting />
        <ArenaNav />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-black">
      {/* Status bar */}
      <div className="flex items-center px-4 h-11 border-b border-white/[0.04] shrink-0 gap-2">
        {isLive ? (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/30 flex items-center justify-center">
              <div className="w-[6px] h-[6px] rounded-full bg-emerald-400" />
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
            <div className="w-20 h-1 rounded bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded bg-emerald-400 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-bold text-zinc-400 tabular-nums">{processedCount}/{totalCount}</span>
            <span className="text-[13px] font-black text-emerald-400 tabular-nums">{progress}%</span>
          </div>
        ) : total > 0 ? (
          <span className="text-[13px] font-bold text-zinc-400 tabular-nums">{total.toLocaleString('pt-BR')}</span>
        ) : null}
      </div>

      {/* Thin progress bar */}
      {isLive && processedCount > 0 && (
        <div className="h-[3px] bg-zinc-900">
          <div className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20 overscroll-contain">
        <div className="px-4 py-2 space-y-4">
          {/* Score hero */}
          <ScoreHero avgScore={avgScore ?? 0} isLive={isLive} />

          {/* Sentiment */}
          {total > 0 && <SentimentBars positive={positive} negative={negative} neutral={neutral} total={total} />}

          {/* Voter gauges */}
          <div className="flex gap-2.5">
            {lulaVoters ? (
              <VoterGauge item={lulaVoters} partyLabel="PT" isLive={isLive} />
            ) : (
              <div className="flex-1 bg-white/[0.02] rounded-xl border border-white/[0.06] flex items-center justify-center py-6">
                <span className="text-[10px] text-zinc-600">Eleitores de Lula</span>
              </div>
            )}
            {bolsonaroVoters ? (
              <VoterGauge item={bolsonaroVoters} partyLabel="PL" isLive={isLive} />
            ) : (
              <div className="flex-1 bg-white/[0.02] rounded-xl border border-white/[0.06] flex items-center justify-center py-6">
                <span className="text-[10px] text-zinc-600">Eleitores de Bolsonaro</span>
              </div>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-white/[0.06]">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex-1 flex items-center justify-center gap-1 py-3 relative"
                >
                  <Icon size={14} className={isActive ? 'text-emerald-400' : 'text-zinc-600'} />
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${isActive ? 'text-white' : 'text-zinc-600'}`}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="dashboard-tab"
                      className="absolute bottom-0 left-[15%] right-[15%] h-0.5 rounded bg-emerald-400"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {activeTab === 'demo' && (
            <div className="space-y-3">
              {SEGMENTS_DEMO.map((seg) => (
                <SegmentCard key={seg.key} items={(segments as any)?.[seg.key]} title={seg.title} accentColor={seg.accent} maxItems={10} isLive={isLive} />
              ))}
            </div>
          )}

          {activeTab === 'eleitoral' && (
            <div className="space-y-3">
              {SEGMENTS_ELEITORAL.map((seg) => (
                <SegmentCard key={seg.key} items={(segments as any)?.[seg.key]} title={seg.title} accentColor={seg.accent} maxItems={10} isLive={isLive} />
              ))}
            </div>
          )}

          {activeTab === 'ideologico' && (
            <div className="space-y-3">
              {SEGMENTS_IDEOLOGICO.map((seg) => (
                <SegmentCard key={seg.key} items={(segments as any)?.[seg.key]} title={seg.title} accentColor={seg.accent} maxItems={10} isLive={isLive} />
              ))}
            </div>
          )}

          {activeTab === 'reacoes' && (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 py-1">
                <MessageCircle size={14} className="text-zinc-500" />
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider flex-1">Reações</span>
                <span className="text-[11px] text-zinc-600 tabular-nums">{comments.length}</span>
              </div>
              {commentsSlice.length > 0 ? (
                <div className="space-y-2.5">
                  {commentsSlice.map((c, i) => <CommentCard key={`${c.personaName}-${i}`} comment={c} />)}
                </div>
              ) : (
                <div className="flex flex-col items-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900/50 flex items-center justify-center mb-3">
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
