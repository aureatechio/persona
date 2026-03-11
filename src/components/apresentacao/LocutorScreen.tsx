'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePresentationData } from '@/hooks/usePresentationData';

export function LocutorScreen() {
  const data = usePresentationData();
  const [text, setText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const hasCalledPartial = useRef(false);
  const hasCalledFinal = useRef(false);
  const lastQuestion = useRef('');
  const charIndex = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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
    if (!data) return;
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
      if (err?.name !== 'AbortError') {
        console.error('[Locutor] Error:', err);
      }
    } finally {
      setIsTyping(false);
    }
  }, [data]);

  // Trigger at ~30% progress (partial)
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

  // Trigger at complete (final)
  useEffect(() => {
    if (!data || hasCalledFinal.current) return;
    if (data.phase === 'complete' && data.segments) {
      hasCalledFinal.current = true;
      callLocutor('complete');
    }
  }, [data, callLocutor]);

  // Typing animation effect
  useEffect(() => {
    if (!text) return;
    if (typingTimer.current) clearInterval(typingTimer.current);

    typingTimer.current = setInterval(() => {
      if (charIndex.current < text.length) {
        // Type 2-3 chars at a time for speed
        const charsToAdd = Math.min(2, text.length - charIndex.current);
        charIndex.current += charsToAdd;
        setDisplayedText(text.slice(0, charIndex.current));
      } else {
        if (typingTimer.current) clearInterval(typingTimer.current);
      }
    }, 18);

    return () => {
      if (typingTimer.current) clearInterval(typingTimer.current);
    };
  }, [text]);

  const total = (data?.positive || 0) + (data?.negative || 0) + (data?.neutral || 0);
  const pctPos = total > 0 ? Math.round((data!.positive / total) * 100) : 0;
  const pctNeg = total > 0 ? Math.round((data!.negative / total) * 100) : 0;
  const pctNeu = total > 0 ? Math.round((data!.neutral / total) * 100) : 0;
  const dominant = pctPos >= pctNeg && pctPos >= pctNeu ? 'positive' : pctNeg >= pctPos && pctNeg >= pctNeu ? 'negative' : 'neutral';

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative flex flex-col">
      {/* Decorative glow orbs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Question bar */}
      {data?.question && (
        <div className="shrink-0 px-8 pt-8 pb-4">
          <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.06] rounded-2xl px-6 py-4 flex items-center gap-4">
            <div className={cn(
              'p-2.5 rounded-xl transition-colors duration-300',
              isTyping ? 'bg-emerald-500/10' : 'bg-white/[0.04]'
            )}>
              <Sparkles size={22} className={cn(
                'transition-colors duration-300',
                isTyping ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'
              )} />
            </div>
            <p className="text-lg text-zinc-300 font-medium leading-relaxed flex-1">{data.question}</p>
            {data.phase === 'streaming' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-emerald-400">
                  {Math.round((data.processedCount / data.totalCount) * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center px-12 pb-8">
        {!data ? (
          <div className="flex flex-col items-center gap-6">
            <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/[0.04]">
              <Sparkles size={48} className="text-zinc-700" />
            </div>
            <p className="text-zinc-600 text-lg">Aguardando analise...</p>
          </div>
        ) : !displayedText && !isTyping && data.phase !== 'complete' ? (
          <div className="flex flex-col items-center gap-6">
            <div className="p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/10">
              <Sparkles size={48} className="text-emerald-500/40 animate-pulse" />
            </div>
            <p className="text-zinc-500 text-lg">Processando personas...</p>
            <div className="w-64 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${data.totalCount > 0 ? (data.processedCount / data.totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="max-w-4xl w-full">
            <div className="text-xl md:text-2xl leading-relaxed text-zinc-200 font-light tracking-wide whitespace-pre-wrap">
              {displayedText}
              {(isTyping || charIndex.current < text.length) && (
                <span className="inline-block w-0.5 h-6 bg-emerald-400 ml-1 animate-pulse" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom sentiment mini-bar */}
      {data && total > 0 && (
        <div className="shrink-0 px-8 pb-6">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.04] rounded-2xl p-4">
            <div className="flex items-center gap-6">
              {/* Mini bar */}
              <div className="flex-1 h-3 rounded-full overflow-hidden flex bg-zinc-900/80">
                <div className="h-full bg-emerald-500 transition-all duration-[2000ms]" style={{ width: `${pctPos}%` }} />
                <div className="h-full bg-amber-500 transition-all duration-[2000ms]" style={{ width: `${pctNeu}%` }} />
                <div className="h-full bg-rose-500 transition-all duration-[2000ms]" style={{ width: `${pctNeg}%` }} />
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-400">{pctPos}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Minus size={14} className="text-amber-400" />
                  <span className="text-sm font-bold text-amber-400">{pctNeu}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingDown size={14} className="text-rose-400" />
                  <span className="text-sm font-bold text-rose-400">{pctNeg}%</span>
                </div>
              </div>

              {/* Total */}
              <span className="text-xs text-zinc-600 shrink-0">
                {total.toLocaleString()} personas
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
