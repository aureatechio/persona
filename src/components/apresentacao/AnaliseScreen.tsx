'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, CheckCircle, AlertTriangle, Target, Zap, Instagram, Youtube, Tv, Radio, Megaphone, Newspaper, MonitorPlay } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePresentationData } from '@/hooks/usePresentationData';

/* ─── Parse sections from AI response ──────────────────────────────── */

function parseSections(text: string) {
  const sections = { headline: '', acertos: '', erros: '', sugestoes: '' };
  const parts = text.split(/## /);
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower.startsWith('headline')) sections.headline = part.replace(/^headline\s*\n?/i, '').trim();
    else if (lower.startsWith('acertos')) sections.acertos = part.replace(/^acertos\s*\n?/i, '').trim();
    else if (lower.startsWith('erros')) sections.erros = part.replace(/^erros\s*\n?/i, '').trim();
    else if (lower.startsWith('sugest')) sections.sugestoes = part.replace(/^sugesto?e?s[^\n]*\n?/i, '').trim();
  }
  return sections;
}

/* ─── Render bullet points with bold highlighting ──────────────────── */

function RenderBullets({ text, accentColor }: { text: string; accentColor: 'emerald' | 'rose' | 'amber' }) {
  if (!text) return null;
  const lines = text.split('\n').filter(l => l.trim());

  const dotColor = {
    emerald: 'bg-emerald-400/40',
    rose: 'bg-rose-400/40',
    amber: 'bg-amber-400/40',
  }[accentColor];

  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        const clean = line.replace(/^[-*]\s*/, '');
        const parts = clean.split(/(\*\*[^*]+\*\*)/g);
        return (
          <div key={i} className="flex gap-3 items-start">
            <div className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-2', dotColor)} />
            <p className="text-sm text-zinc-300 leading-relaxed">
              {parts.map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <span key={j} className="font-semibold text-white">{part.slice(2, -2)}</span>;
                }
                return part;
              })}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Animated Waiting Screen ───────────────────────────────────────── */

function WaitingScreen() {
  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden relative">
      <div className="absolute w-[500px] h-[500px] bg-emerald-500/[0.04] rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'float1 8s ease-in-out infinite' }} />
      <div className="absolute w-[400px] h-[400px] bg-rose-500/[0.03] rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'float2 10s ease-in-out infinite' }} />

      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="relative w-32 h-32">
          <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20"
            style={{ animation: 'spin 8s linear infinite' }} />
          <div className="absolute inset-3 rounded-full border-2 border-dashed border-rose-500/15"
            style={{ animation: 'spin 12s linear infinite reverse' }} />
          <div className="absolute inset-6 rounded-full border border-amber-500/10"
            style={{ animation: 'spin 6s linear infinite' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles size={40} className="text-emerald-400/60" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
          </div>
          <div className="absolute inset-[-8px]" style={{ animation: 'spin 4s linear infinite' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-lg shadow-emerald-500/50" />
          </div>
          <div className="absolute inset-[-16px]" style={{ animation: 'spin 6s linear infinite reverse' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-rose-400 rounded-full shadow-lg shadow-rose-500/50" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <p className="text-xl font-semibold text-white tracking-tight">Análise IA</p>
          <p className="text-sm text-zinc-500">Aguardando dados completos para análise...</p>
        </div>

        <div className="flex gap-2">
          {[0, 200, 400].map(delay => (
            <div key={delay} className="w-2 h-2 bg-emerald-400/60 rounded-full"
              style={{ animation: `bounce 1.4s ease-in-out ${delay}ms infinite` }} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes float1 { 0%, 100% { transform: translate(-100px, -50px); } 50% { transform: translate(100px, 50px); } }
        @keyframes float2 { 0%, 100% { transform: translate(80px, 60px); } 50% { transform: translate(-120px, -40px); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      `}</style>
    </div>
  );
}

/* ─── Platform badge config ────────────────────────────────────────── */

const platformConfig: Record<string, { label: string; icon: typeof Instagram; color: string; bg: string; border: string }> = {
  instagram: { label: 'Instagram', icon: Instagram, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  tiktok: { label: 'TikTok', icon: MonitorPlay, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  youtube: { label: 'YouTube', icon: Youtube, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  tv: { label: 'TV', icon: Tv, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  radio: { label: 'Rádio', icon: Radio, color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  outdoor: { label: 'Outdoor', icon: Megaphone, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  impresso: { label: 'Impresso', icon: Newspaper, color: 'text-zinc-300', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
};

/* ─── Main Analise Screen ───────────────────────────────────────────── */

export function AnaliseScreen() {
  const { data, hasEverReceived } = usePresentationData();
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const hasCalledRef = useRef(false);
  const lastQuestion = useRef('');
  const charIndex = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when new question arrives (or question clears on "novo chat")
  useEffect(() => {
    if (data.question !== lastQuestion.current) {
      lastQuestion.current = data.question;
      hasCalledRef.current = false;
      setText('');
      setDisplayedText('');
      charIndex.current = 0;
      if (typingTimer.current) clearInterval(typingTimer.current);
      if (abortRef.current) abortRef.current.abort();
    }
  }, [data.question]);

  const callAnalise = useCallback(async () => {
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
      const res = await fetch('/api/arena/analise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: data.question,
          positive: data.positive,
          negative: data.negative,
          neutral: data.neutral,
          totalPersonas: data.totalPersonas,
          segments: data.segments,
          phase: 'complete',
          contentMeta: data.contentMeta,
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
      if (err?.name !== 'AbortError') console.error('[Analise] Error:', err);
    } finally {
      setIsTyping(false);
    }
  }, [data]);

  // Trigger ONLY when complete
  useEffect(() => {
    if (!data || hasCalledRef.current) return;
    if (data.phase === 'complete' && data.segments) {
      hasCalledRef.current = true;
      callAnalise();
    }
  }, [data, callAnalise]);

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

  // No data yet
  if (!hasEverReceived) return <WaitingScreen />;

  const total = (data.positive || 0) + (data.negative || 0) + (data.neutral || 0);
  const pctPos = total > 0 ? Math.round((data.positive / total) * 100) : 0;
  const pctNeg = total > 0 ? Math.round((data.negative / total) * 100) : 0;
  const pctNeu = total > 0 ? Math.round((data.neutral / total) * 100) : 0;

  const sections = parseSections(displayedText);
  const isProcessing = !displayedText && !isTyping && data.phase !== 'complete';
  const isWaitingForComplete = !displayedText && !isTyping && data.phase !== 'complete';

  const platform = platformConfig[data.contentMeta?.mediaType || ''];
  const PlatformIcon = platform?.icon;

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative flex flex-col">
      {/* Background effects */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/[0.03] rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'float1 8s ease-in-out infinite' }} />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-rose-500/[0.03] rounded-full blur-3xl pointer-events-none"
        style={{ animation: 'float2 10s ease-in-out infinite' }} />

      {/* ═══ TOP BAR ═══ */}
      <div className="shrink-0 px-8 pt-5 pb-3 flex items-center gap-4">
        <div className="flex-1 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.06] rounded-2xl px-6 py-4 flex items-center gap-4">
          <div className={cn(
            'p-2.5 rounded-xl shrink-0',
            isTyping ? 'bg-emerald-500/10' : 'bg-white/[0.04]'
          )}>
            <Sparkles size={20} className={cn(isTyping ? 'text-emerald-400 animate-pulse' : 'text-zinc-500')} />
          </div>

          {platform && PlatformIcon && (
            <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-xl border shrink-0', platform.bg, platform.border)}>
              <PlatformIcon size={16} className={platform.color} />
              <span className={cn('text-xs font-bold uppercase tracking-wider', platform.color)}>{platform.label}</span>
            </div>
          )}

          <div className="flex-1" />

          {total > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400">{pctPos}%</span>
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-400">{pctNeg}%</span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-400">{pctNeu}%</span>
            </div>
          )}
          {data.question && data.phase !== 'complete' && (() => {
            const anlProgress = data.totalCount > 0 ? Math.round((data.processedCount / data.totalCount) * 100) : 0;
            return (
              <div className="flex items-center gap-2 shrink-0 ml-1">
                <div className="w-24 h-[6px] rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-sky-400 rounded-full" style={{ width: `${anlProgress}%`, transition: anlProgress <= 2 ? 'none' : 'width 2s ease-out' }} />
                </div>
                <span className="text-xs font-bold text-zinc-400 tabular-nums">
                  {data.processedCount > 0 ? `${data.processedCount}/${data.totalCount}` : 'Preparando...'}
                </span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto px-8 pb-4">
        {isWaitingForComplete ? (
          /* Waiting for simulation to complete */
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20" style={{ animation: 'spin 6s linear infinite' }} />
              <div className="absolute inset-3 rounded-full border-2 border-dashed border-rose-500/15" style={{ animation: 'spin 10s linear infinite reverse' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles size={32} className="text-emerald-400/60 animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg text-zinc-400">Aguardando conclusão da pesquisa...</p>
              <div className="w-48 h-1.5 bg-zinc-900 rounded-full overflow-hidden mx-auto">
                <div className="h-full bg-gradient-to-r from-emerald-600 to-rose-400 rounded-full"
                  style={{ width: `${data.totalCount > 0 ? (data.processedCount / data.totalCount) * 100 : 0}%`, transition: data.processedCount <= 1 ? 'none' : 'width 1s ease-out' }} />
              </div>
            </div>
          </div>
        ) : (
          /* Analysis content — headline + 2 columns + bottom */
          <div className="max-w-7xl mx-auto space-y-4 mt-2">
            {/* McKinsey Headline */}
            {sections.headline ? (
              <div className="relative rounded-2xl p-px bg-gradient-to-r from-emerald-500/50 via-sky-500/30 to-violet-500/50">
                <div className="bg-zinc-950 rounded-2xl p-6 md:p-8">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-white/[0.06]">
                      <Zap size={18} className="text-white" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
                      Recomendacao Estrategica{platform ? ` — ${platform.label}` : ''}
                    </span>
                  </div>
                  <p className="text-xl md:text-2xl font-bold text-white tracking-tight leading-snug">
                    {sections.headline.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
                      part.startsWith('**') && part.endsWith('**')
                        ? <span key={i} className="text-emerald-400">{part.slice(2, -2)}</span>
                        : part
                    )}
                  </p>
                </div>
              </div>
            ) : (isTyping || charIndex.current < text.length) ? (
              <div className="relative rounded-2xl p-px bg-gradient-to-r from-zinc-800/50 via-zinc-700/30 to-zinc-800/50 animate-pulse">
                <div className="bg-zinc-950 rounded-2xl p-6">
                  <div className="h-6 w-3/4 bg-zinc-800/50 rounded-lg" />
                </div>
              </div>
            ) : null}

            {/* Two columns: Acertos + Erros */}
            <div className="grid grid-cols-2 gap-4">
              {/* Acertos */}
              <div className="bg-emerald-500/[0.03] backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 rounded-xl bg-emerald-500/10">
                    <CheckCircle size={20} className="text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-bold text-emerald-400 tracking-tight">O que funcionou</h2>
                </div>
                <RenderBullets text={sections.acertos} accentColor="emerald" />
                {!sections.acertos && (isTyping || charIndex.current < text.length) && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-400/40 rounded-full animate-pulse" />
                    <span className="text-sm text-zinc-600">Analisando acertos...</span>
                  </div>
                )}
              </div>

              {/* Erros */}
              <div className="bg-rose-500/[0.03] backdrop-blur-xl border border-rose-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 rounded-xl bg-rose-500/10">
                    <AlertTriangle size={20} className="text-rose-400" />
                  </div>
                  <h2 className="text-xl font-bold text-rose-400 tracking-tight">O que ajustar</h2>
                </div>
                <RenderBullets text={sections.erros} accentColor="rose" />
                {!sections.erros && (isTyping || charIndex.current < text.length) && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-rose-400/40 rounded-full animate-pulse" />
                    <span className="text-sm text-zinc-600">Analisando erros...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Sugestoes — full width */}
            {(sections.sugestoes || (isTyping && sections.erros)) && (
              <div className="bg-amber-500/[0.03] backdrop-blur-xl border border-amber-500/20 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 rounded-xl bg-amber-500/10">
                    <Target size={20} className="text-amber-400" />
                  </div>
                  <h2 className="text-xl font-bold text-amber-400 tracking-tight">Proximos Passos</h2>
                </div>
                <RenderBullets text={sections.sugestoes} accentColor="amber" />
                {!sections.sugestoes && (isTyping || charIndex.current < text.length) && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-400/40 rounded-full animate-pulse" />
                    <span className="text-sm text-zinc-600">Gerando sugestões...</span>
                  </div>
                )}
              </div>
            )}

            {/* Typing indicator */}
            {(isTyping || charIndex.current < text.length) && (
              <div className="flex items-center justify-center gap-2 py-2">
                <span className="inline-block w-0.5 h-5 bg-emerald-400 animate-pulse" />
                <span className="text-xs text-zinc-600">Gerando análise...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ BOTTOM SENTIMENT BAR ═══ */}
      {total > 0 && (
        <div className="shrink-0 h-[3px]">
          <div className="h-full flex">
            <div className="h-full bg-emerald-500 transition-all duration-[2000ms]" style={{ width: `${pctPos}%` }} />
            <div className="h-full bg-amber-500 transition-all duration-[2000ms]" style={{ width: `${pctNeu}%` }} />
            <div className="h-full bg-rose-500 transition-all duration-[2000ms]" style={{ width: `${pctNeg}%` }} />
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
