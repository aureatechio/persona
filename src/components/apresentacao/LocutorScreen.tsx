'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePresentationData } from '@/hooks/usePresentationData';

/* ─── Simple Markdown Renderer ──────────────────────────────────────── */

function RenderMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-2xl font-bold text-white tracking-tight mt-6 mb-3 flex items-center gap-3">
          <div className="w-1 h-8 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-full" />
          {line.slice(3).replace(/\*\*/g, '')}
        </h2>
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <h1 key={i} className="text-3xl font-bold bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent tracking-tight mt-4 mb-4">
          {line.slice(2).replace(/\*\*/g, '')}
        </h1>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      // Process inline bold and render paragraph
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      elements.push(
        <p key={i} className="text-lg text-zinc-300 leading-relaxed mb-2">
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              const inner = part.slice(2, -2);
              // Color keywords
              if (inner.toLowerCase().includes('rejeic') || inner.toLowerCase().includes('negativ') || inner.toLowerCase().includes('contra') || inner.toLowerCase().includes('devastador') || inner.toLowerCase().includes('critic')) {
                return <span key={j} className="font-bold text-rose-400">{inner}</span>;
              }
              if (inner.toLowerCase().includes('favor') || inner.toLowerCase().includes('positiv') || inner.toLowerCase().includes('aprovac') || inner.toLowerCase().includes('oportunidade')) {
                return <span key={j} className="font-bold text-emerald-400">{inner}</span>;
              }
              if (inner.toLowerCase().includes('recomend') || inner.toLowerCase().includes('estrateg') || inner.toLowerCase().includes('urgente') || inner.toLowerCase().includes('sugest')) {
                return <span key={j} className="font-bold text-amber-400">{inner}</span>;
              }
              return <span key={j} className="font-semibold text-white">{inner}</span>;
            }
            return part;
          })}
        </p>
      );
    }
  }

  return <>{elements}</>;
}

/* ─── Animated Waiting Screen ───────────────────────────────────────── */

function WaitingScreen() {
  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden relative">
      {/* Animated background orbs */}
      <div className="absolute w-[500px] h-[500px] bg-violet-500/[0.04] rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'float1 8s ease-in-out infinite' }} />
      <div className="absolute w-[400px] h-[400px] bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'float2 10s ease-in-out infinite' }} />
      <div className="absolute w-[300px] h-[300px] bg-sky-500/[0.03] rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'float3 12s ease-in-out infinite' }} />

      {/* Central element */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Animated rings */}
        <div className="relative w-32 h-32">
          <div className="absolute inset-0 rounded-full border-2 border-violet-500/20"
            style={{ animation: 'spin 8s linear infinite' }} />
          <div className="absolute inset-3 rounded-full border-2 border-dashed border-emerald-500/15"
            style={{ animation: 'spin 12s linear infinite reverse' }} />
          <div className="absolute inset-6 rounded-full border border-sky-500/10"
            style={{ animation: 'spin 6s linear infinite' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles size={40} className="text-violet-400/60" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
          </div>
          {/* Orbiting dots */}
          <div className="absolute inset-[-8px]" style={{ animation: 'spin 4s linear infinite' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-lg shadow-emerald-500/50" />
          </div>
          <div className="absolute inset-[-16px]" style={{ animation: 'spin 6s linear infinite reverse' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-violet-400 rounded-full shadow-lg shadow-violet-500/50" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <p className="text-xl font-semibold text-white tracking-tight">Consultora IA</p>
          <p className="text-sm text-zinc-500">Aguardando dados para analise...</p>
        </div>

        {/* Animated dots */}
        <div className="flex gap-2">
          {[0, 200, 400].map(delay => (
            <div key={delay} className="w-2 h-2 bg-violet-400/60 rounded-full"
              style={{ animation: `bounce 1.4s ease-in-out ${delay}ms infinite` }} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes float1 { 0%, 100% { transform: translate(-100px, -50px); } 50% { transform: translate(100px, 50px); } }
        @keyframes float2 { 0%, 100% { transform: translate(80px, 60px); } 50% { transform: translate(-120px, -40px); } }
        @keyframes float3 { 0%, 100% { transform: translate(50px, -80px); } 50% { transform: translate(-60px, 100px); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      `}</style>
    </div>
  );
}

/* ─── Main Locutor Screen ───────────────────────────────────────────── */

export function LocutorScreen() {
  const { data, hasEverReceived } = usePresentationData();
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const hasCalledPartial = useRef(false);
  const hasCalledFinal = useRef(false);
  const lastQuestion = useRef('');
  const charIndex = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset when new question arrives
  useEffect(() => {
    if (data?.question && data.question !== lastQuestion.current) {
      lastQuestion.current = data.question;
      hasCalledPartial.current = false;
      hasCalledFinal.current = false;
      setText('');
      setDisplayedText('');
      charIndex.current = 0;
      if (typingTimer.current) clearInterval(typingTimer.current);
      if (abortRef.current) abortRef.current.abort();
    }
  }, [data?.question]);

  const callLocutor = useCallback(async (phase: string) => {
    if (!hasEverReceived) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsTyping(true);
    setText('');
    setDisplayedText('');
    charIndex.current = 0;
    if (typingTimer.current) clearInterval(typingTimer.current);

    let accumulated = '';

    try {
      const res = await fetch('/api/arena/locutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: data.question,
          positive: data.positive,
          negative: data.negative,
          neutral: data.neutral,
          totalPersonas: data.totalPersonas,
          segments: data.segments,
          phase,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error('Failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const payload = trimmed.slice(6);
          if (payload === '[DONE]') break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) {
              accumulated += parsed.text;
              setText(accumulated);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') console.error('[Locutor] Error:', err);
    } finally {
      setIsTyping(false);
    }
  }, [data]);

  // Trigger at ~30% progress
  useEffect(() => {
    if (!data || hasCalledPartial.current) return;
    if (data.phase === 'streaming' && data.totalCount > 0) {
      const progress = data.processedCount / data.totalCount;
      if (progress >= 0.3 && data.segments) {
        hasCalledPartial.current = true;
        callLocutor('partial');
      }
    }
  }, [data, callLocutor]);

  // Trigger at complete
  useEffect(() => {
    if (!data || hasCalledFinal.current) return;
    if (data.phase === 'complete' && data.segments) {
      hasCalledFinal.current = true;
      callLocutor('complete');
    }
  }, [data, callLocutor]);

  // Typing animation
  useEffect(() => {
    if (!text) return;
    if (typingTimer.current) clearInterval(typingTimer.current);

    typingTimer.current = setInterval(() => {
      if (charIndex.current < text.length) {
        const charsToAdd = Math.min(3, text.length - charIndex.current);
        charIndex.current += charsToAdd;
        setDisplayedText(text.slice(0, charIndex.current));
      } else {
        if (typingTimer.current) clearInterval(typingTimer.current);
      }
    }, 15);

    return () => { if (typingTimer.current) clearInterval(typingTimer.current); };
  }, [text]);

  // Auto-scroll as text appears
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedText]);

  // No data yet — animated waiting
  if (!hasEverReceived) return <WaitingScreen />;

  const total = (data.positive || 0) + (data.negative || 0) + (data.neutral || 0);
  const pctPos = total > 0 ? Math.round((data.positive / total) * 100) : 0;
  const pctNeg = total > 0 ? Math.round((data.negative / total) * 100) : 0;
  const pctNeu = total > 0 ? Math.round((data.neutral / total) * 100) : 0;

  const isProcessing = !displayedText && !isTyping && data.phase !== 'complete';

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative flex flex-col">
      {/* Background effects */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'float1 8s ease-in-out infinite' }} />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-500/[0.03] rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'float2 10s ease-in-out infinite' }} />

      {/* Top bar: Question + sentiment summary */}
      <div className="shrink-0 px-8 pt-6 pb-3 flex items-center gap-4">
        <div className="flex-1 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.06] rounded-2xl px-6 py-4 flex items-center gap-4">
          <div className={cn(
            'p-2.5 rounded-xl shrink-0',
            isTyping ? 'bg-violet-500/10' : 'bg-white/[0.04]'
          )}>
            <Sparkles size={20} className={cn(isTyping ? 'text-violet-400 animate-pulse' : 'text-zinc-500')} />
          </div>
          <p className="text-lg text-zinc-300 font-medium flex-1 truncate">{data.question}</p>

          {/* Live sentiment pills + progress */}
          {total > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400">{pctPos}%</span>
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-400">{pctNeg}%</span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-400">{pctNeu}%</span>
            </div>
          )}
          {data.question && data.phase !== 'complete' && (() => {
            const isCollecting = data.phase === 'collecting';
            const locProgress = data.totalCount > 0 ? Math.round((data.processedCount / data.totalCount) * 100) : 0;
            return (
              <div className="flex items-center gap-2 shrink-0 ml-1">
                <div className="w-24 h-[6px] rounded-full bg-white/[0.06] overflow-hidden">
                  {isCollecting ? (
                    <div className="h-full w-1/3 bg-gradient-to-r from-violet-500/60 to-emerald-400/60 rounded-full animate-pulse" />
                  ) : (
                    <div className="h-full bg-gradient-to-r from-violet-500 to-emerald-400 rounded-full transition-all duration-[2s] ease-out" style={{ width: `${locProgress}%` }} />
                  )}
                </div>
                <span className="text-xs font-bold text-zinc-400 tabular-nums">
                  {isCollecting ? 'Preparando...' : `${data.processedCount}/${data.totalCount}`}
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Main content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-8 pb-6">
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" style={{ animation: 'spin 6s linear infinite' }} />
              <div className="absolute inset-3 rounded-full border-2 border-dashed border-emerald-500/15" style={{ animation: 'spin 10s linear infinite reverse' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles size={32} className="text-violet-400/60 animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg text-zinc-400">Analisando reacoes...</p>
              <div className="w-48 h-1.5 bg-zinc-900 rounded-full overflow-hidden mx-auto">
                <div className="h-full bg-gradient-to-r from-violet-600 to-emerald-400 rounded-full transition-all duration-1000"
                  style={{ width: `${data.totalCount > 0 ? (data.processedCount / data.totalCount) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {/* Glass card for the analysis */}
            <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-8 mt-4">
              <RenderMarkdown text={displayedText} />
              {(isTyping || charIndex.current < text.length) && (
                <span className="inline-block w-0.5 h-5 bg-violet-400 ml-1 animate-pulse" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom sentiment bar */}
      {total > 0 && (
        <div className="shrink-0 px-8 pb-5">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.04] rounded-2xl p-3 flex items-center gap-4">
            <div className="flex-1 h-2.5 rounded-full overflow-hidden flex bg-zinc-900/80">
              <div className="h-full bg-emerald-500 transition-all duration-[2000ms]" style={{ width: `${pctPos}%` }} />
              <div className="h-full bg-amber-500 transition-all duration-[2000ms]" style={{ width: `${pctNeu}%` }} />
              <div className="h-full bg-rose-500 transition-all duration-[2000ms]" style={{ width: `${pctNeg}%` }} />
            </div>
            <span className="text-[10px] text-zinc-600 shrink-0">{total.toLocaleString()} personas</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes float1 { 0%, 100% { transform: translate(-60px, -30px); } 50% { transform: translate(60px, 30px); } }
        @keyframes float2 { 0%, 100% { transform: translate(40px, 40px); } 50% { transform: translate(-80px, -20px); } }
      `}</style>
    </div>
  );
}
