'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Sidebar } from '@/components/Sidebar';
import {
  Menu,
  Send,
  Users,
  RotateCcw,
  Sparkles,
  Activity,
  Zap,
  TrendingUp,
  Eye,
  Layers,
  ChevronDown,
  X,
} from 'lucide-react';
import { DashboardAnalytics } from '@/components/DashboardAnalytics';

// ── Arena modules ────────────────────────────────────────────────────────────
import type { Phase, Sentiment, CommentResult, EnhancedSimulationResult } from '@/lib/arena';
import {
  CLUSTERS,
  MACRO_COLORS,
  MACRO_GROUPS,
  ARCHETYPES,
  BASE_DISTRIBUTION,
  detectTopics,
  buildPersonasForAI,
  generateAIComments,
  runEnhancedSimulation,
} from '@/lib/arena';

// ── Arena components ─────────────────────────────────────────────────────────
import { DonutChart } from '@/components/arena/DonutChart';
import { CommentBubble } from '@/components/arena/CommentBubble';
import { ArchetypeBar } from '@/components/arena/ArchetypeBar';
import { ClusterBar } from '@/components/arena/ClusterBar';
import { ProcessingOrb } from '@/components/arena/ProcessingOrb';

import { IdeologicalScatter } from '@/components/arena/IdeologicalScatter';
import { QuadrantAnalysis } from '@/components/arena/QuadrantAnalysis';
import { RegionBreakdown } from '@/components/arena/RegionBreakdown';
import { GenerationBreakdown } from '@/components/arena/GenerationBreakdown';
import { EducationAnalysis } from '@/components/arena/EducationAnalysis';
import { PoliticalFigurePanel } from '@/components/arena/PoliticalFigurePanel';

// ── Hook ─────────────────────────────────────────────────────────────────────
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';

// ── Main Page Component ──────────────────────────────────────────────────────
export default function ArenaPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [simulation, setSimulation] = useState<EnhancedSimulationResult | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [submittedQuestion, setSubmittedQuestion] = useState('');
  const [personaCount, setPersonaCount] = useState(2000);
  const [showComments, setShowComments] = useState(false);
  const [allPersonas, setAllPersonas] = useState<any[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [clusterDropdownOpen, setClusterDropdownOpen] = useState(false);
  const [effectivePersonaCount, setEffectivePersonaCount] = useState(0);
  const [pipelinePhase, setPipelinePhase] = useState('');
  const [contextPreview, setContextPreview] = useState<{ tema: string; figuras: any[]; periodo: string } | null>(null);
  const [commentsToShow, setCommentsToShow] = useState(30);
  const [commentFilter, setCommentFilter] = useState<'all' | Sentiment>('all');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<{ x: number; y: number; vx: number; vy: number; r: number; alpha: number; color: number[]; targetColor: number[] }[]>([]);
  const animFrameRef = useRef(0);

  // Placeholder rotation
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const placeholders = [
    'Os meninos que bateram o carro devem ser condenados a prisão perpétua?',
    'O Brasil deveria investir mais em energia nuclear?',
    'A reforma tributária vai beneficiar a classe média?',
    'Deveria existir pena de morte no Brasil?',
    'A maconha deveria ser legalizada?',
  ];

  useEffect(() => {
    const t = setInterval(() => setPlaceholderIdx(p => (p + 1) % placeholders.length), 4000);
    return () => clearInterval(t);
  }, []);

  // Close cluster dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setClusterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch persona count
  useEffect(() => {
    (async () => {
      const { count } = await supabase.from('personas').select('*', { count: 'exact', head: true });
      if (count && count > 0) setPersonaCount(count);
    })();
  }, []);

  // Lazy-load ALL persona data only when needed
  const loadAllPersonas = useCallback(async (): Promise<any[]> => {
    if (allPersonas.length > 0) return allPersonas;

    const batchSize = 1000;
    let allData: any[] = [];

    for (let from = 0; from < personaCount; from += batchSize) {
      const { data } = await supabase
        .from('personas')
        .select('*')
        .range(from, from + batchSize - 1);
      if (data && data.length > 0) {
        allData = [...allData, ...data];
      } else {
        break;
      }
    }

    if (allData.length > 0) setAllPersonas(allData);
    return allData;
  }, [allPersonas, personaCount]);

  // Animated counters for results
  const animPositive = useAnimatedNumber(simulation?.positive ?? 0, 2500, phase === 'results');
  const animNegative = useAnimatedNumber(simulation?.negative ?? 0, 2500, phase === 'results');
  const animNeutral = useAnimatedNumber(simulation?.neutral ?? 0, 2500, phase === 'results');

  // ── Canvas Particle System ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const PARTICLE_COUNT = Math.min(personaCount, 600);
    const particles: typeof particlesRef.current = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * (w || 1200),
        y: Math.random() * (h || 800),
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.8 + 0.5,
        alpha: Math.random() * 0.35 + 0.08,
        color: [255, 255, 255],
        targetColor: [255, 255, 255],
      });
    }
    particlesRef.current = particles;

    const draw = () => {
      if (!w || !h) { resize(); }
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        for (let c = 0; c < 3; c++) {
          p.color[c] += (p.targetColor[c] - p.color[c]) * 0.03;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${Math.round(p.color[0])},${Math.round(p.color[1])},${Math.round(p.color[2])},${p.alpha})`;
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [personaCount]);

  // Update particle colors based on simulation results
  useEffect(() => {
    const particles = particlesRef.current;
    if (!particles.length) return;

    if (phase === 'idle') {
      for (const p of particles) {
        p.targetColor = [255, 255, 255];
        p.alpha = Math.random() * 0.35 + 0.08;
      }
    } else if (simulation && (phase === 'processing' || phase === 'results')) {
      const total = simulation.total;
      const posRatio = simulation.positive / total;
      const negRatio = simulation.negative / total;

      for (let i = 0; i < particles.length; i++) {
        const ratio = i / particles.length;
        if (ratio < posRatio) {
          particles[i].targetColor = [16, 185, 129];
        } else if (ratio < posRatio + negRatio) {
          particles[i].targetColor = [244, 63, 94];
        } else {
          particles[i].targetColor = [245, 158, 11];
        }
        particles[i].alpha = Math.random() * 0.5 + 0.2;
      }
    }
  }, [phase, simulation]);

  // ── Submit Handler ──────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!question.trim()) return;

    const q = question.trim();
    setSubmittedQuestion(q);
    setPhase('processing');
    setProcessedCount(0);
    setSimulation(null);
    setShowComments(false);
    setPipelinePhase('Analisando personas...');
    setContextPreview(null);
    setCommentsToShow(30);
    setCommentFilter('all');

    // Abort previous request if any
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // ── Try Python SSE backend ──────────────────────────────────────
      const response = await fetch('/api/arena/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, cluster_filter: selectedCluster || null }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error('Python backend unavailable');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() || '';

        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith('data: ')) continue;

          try {
            const payload = JSON.parse(line.slice(6));

            switch (payload.type) {
              case 'phase':
                setPipelinePhase(payload.data.message);
                break;

              case 'context':
                setContextPreview({
                  tema: payload.data.tema || '',
                  figuras: payload.data.figuras || [],
                  periodo: payload.data.periodo || '',
                });
                break;

              case 'personas_loaded':
                setEffectivePersonaCount(payload.data.count);
                break;

              case 'progress':
                setProcessedCount(payload.data.processed);
                setEffectivePersonaCount(payload.data.total);
                setSimulation(prev => ({
                  total: payload.data.total,
                  positive: payload.data.positive,
                  negative: payload.data.negative,
                  neutral: payload.data.neutral,
                  archetypes: prev?.archetypes || [],
                  clusterResults: prev?.clusterResults || [],
                  comments: prev?.comments || [],
                  processingTime: prev?.processingTime || 0,
                  ideologicalPoints: prev?.ideologicalPoints || [],
                  quadrants: prev?.quadrants || [],
                  regions: prev?.regions || [],
                  generations: prev?.generations || [],
                  educationLevels: prev?.educationLevels || [],
                  politicalFigures: prev?.politicalFigures || [],
                  intensityBands: prev?.intensityBands || [],
                }));
                break;

              case 'results':
                setSimulation(payload.data as EnhancedSimulationResult);
                break;

              case 'done':
                streamDone = true;
                setProcessedCount(payload.data.total_personas);
                setPhase('results');
                setTimeout(() => setShowComments(true), 800);
                break;
            }
          } catch (parseErr) {
            console.warn('[Arena] SSE parse error:', parseErr);
          }
        }
      }

      // Safety: if stream ended without explicit 'done' event
      if (!streamDone) {
        setPhase('results');
        setTimeout(() => setShowComments(true), 800);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;

      // ── Fallback: JS simulation ─────────────────────────────────────
      console.warn('[Arena] Python backend offline, fallback JS:', err);
      setPipelinePhase('Analisando personas...');

      try {
        const allData = await loadAllPersonas();
        const targetPersonas = selectedCluster
          ? allData.filter((p: any) => p.cluster_id === selectedCluster)
          : allData;
        const effectiveCount = targetPersonas.length || personaCount;
        setEffectivePersonaCount(effectiveCount);

        // Animate counter
        const animDuration = 5000;
        const animStart = performance.now();
        let animStopped = false;

        const animateCount = (time: number) => {
          if (animStopped) return;
          const progress = Math.min((time - animStart) / animDuration, 1);
          const eased = 1 - Math.pow(1 - progress, 2);
          setProcessedCount(Math.round(effectiveCount * eased));
          if (progress < 1) requestAnimationFrame(animateCount);
        };
        requestAnimationFrame(animateCount);

        const enhanced = runEnhancedSimulation(q, effectiveCount, targetPersonas);
        const topicScores = detectTopics(q);
        const personasForAI = buildPersonasForAI(q, targetPersonas, topicScores);
        const claudeComments = await generateAIComments(q, personasForAI);

        animStopped = true;
        setSimulation({ ...enhanced, comments: claudeComments });
        setProcessedCount(effectiveCount);
        setPhase('results');
        setTimeout(() => setShowComments(true), 800);
      } catch (fallbackErr) {
        console.error('[Arena] Fallback also failed:', fallbackErr);
        setPhase('idle');
      }
    }
  }, [question, personaCount, selectedCluster, loadAllPersonas]);

  const handleReset = () => {
    if (abortRef.current) abortRef.current.abort();
    setPhase('idle');
    setSimulation(null);
    setQuestion('');
    setSubmittedQuestion('');
    setProcessedCount(0);
    setShowComments(false);
    setPipelinePhase('');
    setContextPreview(null);
    setCommentsToShow(30);
    setCommentFilter('all');
  };

  const pct = (n: number) =>
    simulation && simulation.total > 0 ? Math.round((n / simulation.total) * 100) : 0;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-black text-white font-sans">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 relative lg:pl-64 overflow-y-auto overflow-x-hidden">
        {/* Particle canvas background */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-1000"
          style={{ opacity: phase === 'results' ? 0.25 : 0.5 }}
        />

        {/* Gradient overlays */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-600/[0.04] rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-fuchsia-600/[0.03] rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 min-h-screen flex flex-col">
          {/* ── Top Bar ────────────────────────────────────────────────── */}
          <header className="flex items-center justify-between p-4 md:px-8 md:py-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 bg-zinc-900/80 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition-colors backdrop-blur-sm"
              >
                <Menu size={22} />
              </button>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center border border-violet-500/20">
                  <Activity size={16} className="text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-bold tracking-tight leading-none">Pulse Arena</p>
                  <p className="text-[9px] text-zinc-600 font-medium">Análise de sentimento em tempo real</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl bg-zinc-900/60 border border-zinc-800/50 backdrop-blur-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold text-zinc-300 tabular-nums">
                  {personaCount.toLocaleString('pt-BR')} personas
                </span>
              </div>
              {phase === 'results' && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl text-sm font-bold hover:bg-zinc-200 transition-all active:scale-95 shadow-lg shadow-white/5"
                >
                  <RotateCcw size={14} />
                  Nova Pesquisa
                </button>
              )}
            </div>
          </header>

          {/* ══════════════════════════════════════════════════════════════
              IDLE STATE
          ══════════════════════════════════════════════════════════════ */}
          {phase === 'idle' && (
            <div className="min-h-screen flex flex-col items-center px-4 pb-16 pt-12">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 mb-8 animate-fade-in-up">
                <Sparkles size={13} className="text-violet-400" />
                <span className="text-[10px] font-black text-violet-400 uppercase tracking-[0.2em]">Inteligência Coletiva Sintética</span>
              </div>

              {/* Hero Title */}
              <h1 className="text-center text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight mb-5 leading-[1.05] animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                O que{' '}
                <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent arena-gradient-text">
                  {personaCount.toLocaleString('pt-BR')}
                </span>
                <br />
                <span className="text-zinc-400">personas pensam?</span>
              </h1>

              <p className="text-zinc-500 text-sm md:text-base max-w-lg mx-auto text-center mb-10 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                Digite uma pergunta polêmica, proposta ou declaração e veja instantaneamente como milhares de personas sintéticas reagem em tempo real.
              </p>

              {/* Input */}
              <div className="w-full max-w-2xl mb-14 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-violet-600/20 via-fuchsia-600/20 to-violet-600/20 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-500" />
                  <div className="relative bg-zinc-950/90 border border-zinc-800 rounded-[2rem] overflow-hidden group-focus-within:border-violet-500/30 transition-all duration-300 backdrop-blur-sm">
                    <textarea
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                      placeholder={placeholders[placeholderIdx]}
                      rows={3}
                      className="w-full bg-transparent px-6 pt-6 pb-3 text-white placeholder-zinc-600 focus:outline-none resize-none text-base md:text-lg"
                    />
                    <div className="flex items-center justify-between px-5 pb-4">
                      <div className="flex items-center gap-2 text-zinc-600">
                        <Zap size={13} />
                        <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Pressione Enter para analisar</span>
                      </div>
                      <button
                        onClick={handleSubmit}
                        disabled={!question.trim()}
                        className="flex items-center gap-2 px-7 py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white rounded-xl font-bold text-sm hover:from-violet-400 hover:to-fuchsia-400 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20"
                      >
                        Analisar
                        <Send size={15} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Cluster Selector */}
                <div className="flex items-center justify-center mt-4">
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setClusterDropdownOpen(!clusterDropdownOpen)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 border ${
                        selectedCluster
                          ? `${MACRO_COLORS[CLUSTERS.find(c => c.id === selectedCluster)?.macro || 'Moderado'].bg} ${MACRO_COLORS[CLUSTERS.find(c => c.id === selectedCluster)?.macro || 'Moderado'].text} ${MACRO_COLORS[CLUSTERS.find(c => c.id === selectedCluster)?.macro || 'Moderado'].border}`
                          : 'text-zinc-500 border-zinc-800/50 hover:text-zinc-300 hover:border-zinc-700/50 bg-zinc-900/50'
                      }`}
                    >
                      <Layers size={13} />
                      {selectedCluster
                        ? `${selectedCluster} · ${CLUSTERS.find(c => c.id === selectedCluster)?.name}`
                        : 'Filtrar por Cluster'}
                      <ChevronDown size={12} className={`transition-transform duration-200 ${clusterDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {selectedCluster && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedCluster(null); }}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center transition-colors z-10"
                      >
                        <X size={8} className="text-white" />
                      </button>
                    )}

                    {clusterDropdownOpen && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 max-h-72 overflow-y-auto bg-zinc-950 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 z-50 py-2">
                        <button
                          onClick={() => { setSelectedCluster(null); setClusterDropdownOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-150 ${
                            !selectedCluster ? 'text-white bg-white/[0.06] font-semibold' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                          }`}
                        >
                          Todos os Clusters
                        </button>
                        <div className="h-px bg-zinc-800/50 my-1" />

                        {MACRO_GROUPS.map(macro => {
                          const macroColors = MACRO_COLORS[macro];
                          const clusters = CLUSTERS.filter(c => c.macro === macro);
                          return (
                            <div key={macro}>
                              <p className={`sticky top-0 bg-zinc-950 px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] ${macroColors.text} z-10`}>
                                {macro === 'Progressista' ? 'Progressistas' : macro === 'Moderado' ? 'Moderados' : macro === 'Conservador' ? 'Conservadores' : 'Transversais'}
                              </p>
                              {clusters.map(cluster => (
                                <button
                                  key={cluster.id}
                                  onClick={() => { setSelectedCluster(cluster.id); setClusterDropdownOpen(false); }}
                                  className={`w-full text-left px-4 py-2 text-sm transition-colors duration-150 flex items-center gap-2.5 ${
                                    selectedCluster === cluster.id
                                      ? 'text-white bg-white/[0.06] font-semibold'
                                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                                  }`}
                                >
                                  <span className={`w-6 text-center text-[10px] font-black ${macroColors.text}`}>{cluster.id}</span>
                                  <span className="truncate">{cluster.name}</span>
                                </button>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              PROCESSING STATE
          ══════════════════════════════════════════════════════════════ */}
          {phase === 'processing' && (
            <div className="flex-1 flex flex-col items-center justify-center px-4 pb-12">
              {/* Processing Orb */}
              <ProcessingOrb />

              {/* Pipeline Phase */}
              {pipelinePhase && (
                <p className="text-sm text-violet-400 font-medium mt-6 mb-1 animate-pulse">
                  {pipelinePhase}
                </p>
              )}

              {/* Counter */}
              <p className="text-5xl sm:text-6xl md:text-7xl font-black tabular-nums tracking-tight mt-4 mb-2 bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                {processedCount.toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-zinc-500 mb-6">
                de <span className="font-bold text-zinc-300">{(effectivePersonaCount || personaCount).toLocaleString('pt-BR')}</span> personas analisadas
              </p>

              {/* Progress bar */}
              <div className="w-full max-w-md mb-6">
                <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-75 ease-linear"
                    style={{ width: `${(processedCount / (effectivePersonaCount || personaCount)) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-[10px] text-zinc-600">0%</span>
                  <span className="text-[10px] font-bold text-violet-400 tabular-nums">
                    {Math.round((processedCount / (effectivePersonaCount || personaCount)) * 100)}%
                  </span>
                  <span className="text-[10px] text-zinc-600">100%</span>
                </div>
              </div>

              {/* Context Preview */}
              {contextPreview && (
                <div className="mt-4 px-6 py-4 rounded-2xl bg-zinc-950/80 border border-violet-500/20 max-w-lg backdrop-blur-sm animate-fade-in-up">
                  <p className="text-[10px] font-black uppercase tracking-widest text-violet-400/60 mb-2">Contexto Identificado</p>
                  <p className="text-sm text-zinc-300 font-medium text-center">{contextPreview.tema}</p>
                  {contextPreview.figuras.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 justify-center">
                      {contextPreview.figuras.map((f: any, i: number) => (
                        <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 text-[10px] font-bold border border-violet-500/20">
                          {f.nome} &middot; {f.cargo}
                        </span>
                      ))}
                    </div>
                  )}
                  {contextPreview.periodo && (
                    <p className="text-[10px] text-zinc-500 text-center mt-2">{contextPreview.periodo}</p>
                  )}
                </div>
              )}

              {/* Submitted question */}
              <div className="mt-4 px-6 py-4 rounded-2xl bg-zinc-950/80 border border-zinc-900 max-w-lg backdrop-blur-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-2">Pergunta</p>
                <p className="text-sm text-zinc-300 text-center leading-relaxed">&ldquo;{submittedQuestion}&rdquo;</p>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              RESULTS STATE
          ══════════════════════════════════════════════════════════════ */}
          {phase === 'results' && simulation && (
            <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-12">
              <div className="max-w-6xl mx-auto">
                {/* Question recap */}
                <div className="mb-8 text-center animate-fade-in-up">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-3">Resultado da Análise</p>
                  <p className="text-lg md:text-xl font-bold text-white max-w-3xl mx-auto leading-relaxed mb-2">
                    &ldquo;{submittedQuestion}&rdquo;
                  </p>
                  <div className="flex items-center justify-center gap-4 text-[10px] text-zinc-600 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Users size={11} /> {simulation.total.toLocaleString('pt-BR')} personas
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap size={11} /> {simulation.processingTime.toFixed(0)}ms
                    </span>
                    {selectedCluster && (() => {
                      const cluster = CLUSTERS.find(c => c.id === selectedCluster);
                      if (!cluster) return null;
                      const mc = MACRO_COLORS[cluster.macro];
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${mc.bg} ${mc.text} ${mc.border}`}>
                          <Layers size={10} />
                          {cluster.id} · {cluster.name}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* ── Main Stats Grid ──────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                  {/* Donut Chart */}
                  <div className="lg:row-span-2 flex flex-col items-center justify-center p-6 rounded-3xl bg-zinc-950/80 border border-zinc-900 backdrop-blur-sm animate-fade-in-up">
                    <DonutChart
                      positive={animPositive}
                      negative={animNegative}
                      neutral={animNeutral}
                      size={190}
                    />
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mt-4">
                      Distribuição Geral
                    </p>
                  </div>

                  {/* Stat: Positive */}
                  <div className="p-5 rounded-3xl bg-zinc-950/80 border border-emerald-500/10 text-center animate-fade-in-up backdrop-blur-sm" style={{ animationDelay: '100ms' }}>
                    <p className="text-4xl md:text-5xl font-black text-emerald-400 mb-1 tabular-nums">
                      {pct(animPositive)}%
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80 mb-1">Concordam</p>
                    <p className="text-xs text-zinc-600 tabular-nums">{animPositive.toLocaleString('pt-BR')} personas</p>
                  </div>

                  {/* Stat: Negative */}
                  <div className="p-5 rounded-3xl bg-zinc-950/80 border border-rose-500/10 text-center animate-fade-in-up backdrop-blur-sm" style={{ animationDelay: '200ms' }}>
                    <p className="text-4xl md:text-5xl font-black text-rose-400 mb-1 tabular-nums">
                      {pct(animNegative)}%
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-400/80 mb-1">Discordam</p>
                    <p className="text-xs text-zinc-600 tabular-nums">{animNegative.toLocaleString('pt-BR')} personas</p>
                  </div>

                  {/* Stat: Neutral */}
                  <div className="p-5 rounded-3xl bg-zinc-950/80 border border-amber-500/10 text-center animate-fade-in-up backdrop-blur-sm" style={{ animationDelay: '300ms' }}>
                    <p className="text-4xl md:text-5xl font-black text-amber-400 mb-1 tabular-nums">
                      {pct(animNeutral)}%
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-400/80 mb-1">Neutros</p>
                    <p className="text-xs text-zinc-600 tabular-nums">{animNeutral.toLocaleString('pt-BR')} personas</p>
                  </div>

                  {/* Sentiment Bar */}
                  <div className="lg:col-span-3 p-5 rounded-3xl bg-zinc-950/80 border border-zinc-900 backdrop-blur-sm animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">
                      Barra de Sentimento
                    </p>
                    <div className="h-7 rounded-full overflow-hidden flex bg-zinc-900">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-[2500ms] ease-out flex items-center justify-center"
                        style={{ width: `${pct(simulation.positive)}%` }}
                      >
                        {pct(simulation.positive) > 8 && (
                          <span className="text-[10px] font-black text-white drop-shadow-sm">{pct(simulation.positive)}%</span>
                        )}
                      </div>
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-[2500ms] ease-out flex items-center justify-center"
                        style={{ width: `${pct(simulation.neutral)}%` }}
                      >
                        {pct(simulation.neutral) > 8 && (
                          <span className="text-[10px] font-black text-white drop-shadow-sm">{pct(simulation.neutral)}%</span>
                        )}
                      </div>
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-[2500ms] ease-out flex items-center justify-center"
                        style={{ width: `${pct(simulation.negative)}%` }}
                      >
                        {pct(simulation.negative) > 8 && (
                          <span className="text-[10px] font-black text-white drop-shadow-sm">{pct(simulation.negative)}%</span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between mt-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px] text-zinc-400 font-medium">Concordam</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="text-[10px] text-zinc-400 font-medium">Neutros</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span className="text-[10px] text-zinc-400 font-medium">Discordam</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Cluster Ideological Breakdown ───────────────────── */}
                {simulation.clusterResults.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4 px-1">
                      <Layers size={14} className="text-zinc-500" />
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                        Análise por Cluster Ideológico
                      </p>
                    </div>

                    {MACRO_GROUPS.map(macro => {
                      const macroColors = MACRO_COLORS[macro];
                      const results = simulation.clusterResults.filter(r => r.macro === macro);
                      if (results.length === 0) return null;

                      return (
                        <div key={macro} className="mb-6">
                          <div className="flex items-center gap-3 mb-4 px-1">
                            <div className={`w-3 h-3 rounded-full ${macroColors.dot}`} />
                            <p className={`text-base font-black uppercase tracking-wide ${macroColors.text}`}>
                              {macro === 'Progressista' ? 'Progressistas' : macro === 'Moderado' ? 'Moderados' : macro === 'Conservador' ? 'Conservadores' : 'Transversais'}
                              <span className="text-zinc-600 ml-3 text-xs font-bold">
                                ({results.reduce((s, r) => s + r.count, 0).toLocaleString('pt-BR')} personas)
                              </span>
                            </p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {results.map((result, idx) => (
                              <div key={result.id} style={{ animationDelay: `${idx * 80}ms` }}>
                                <ClusterBar result={result} />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ══════════════════════════════════════════════════════
                    NEW: 2D ANALYSIS SECTIONS
                ══════════════════════════════════════════════════════ */}

                {/* Divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent my-10" />

                {/* Ideological Scatter 2D */}
                {simulation.ideologicalPoints.length > 0 && (
                  <IdeologicalScatter points={simulation.ideologicalPoints} />
                )}

                {/* Quadrant Analysis */}
                {simulation.quadrants.length > 0 && (
                  <QuadrantAnalysis quadrants={simulation.quadrants} />
                )}

                {/* Political Figure Panel (conditional) */}
                {simulation.politicalFigures.length > 0 && (
                  <PoliticalFigurePanel figures={simulation.politicalFigures} />
                )}

                {/* Regional Breakdown */}
                {simulation.regions.length > 0 && (
                  <RegionBreakdown regions={simulation.regions} />
                )}

                {/* Generational Breakdown */}
                {simulation.generations.length > 0 && (
                  <GenerationBreakdown generations={simulation.generations} />
                )}

                {/* Education Analysis */}
                {simulation.educationLevels.length > 0 && (
                  <EducationAnalysis educationLevels={simulation.educationLevels} />
                )}

                {/* ── Comments Section — All Personas ──────────────────── */}
                {showComments && simulation.comments.length > 0 && (() => {
                  const filteredComments = commentFilter === 'all'
                    ? simulation.comments
                    : simulation.comments.filter(c => c.sentiment === commentFilter);
                  const visibleComments = filteredComments.slice(0, commentsToShow);
                  const hasMore = filteredComments.length > commentsToShow;
                  const remaining = filteredComments.length - commentsToShow;

                  return (
                    <div className="mb-8 animate-fade-in-up">
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-4 px-1">
                        <Eye size={14} className="text-zinc-500" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                          Reações das Personas
                        </p>
                        <span className="text-[10px] text-zinc-600 font-bold ml-2">
                          {simulation.comments.length.toLocaleString('pt-BR')} comentários
                        </span>
                      </div>

                      {/* Filter Tabs */}
                      <div className="flex items-center gap-1.5 mb-6 flex-wrap">
                        {([
                          { key: 'all' as const, label: 'Todos', active: 'bg-white/10 text-white border-white/20' },
                          { key: 'positive' as const, label: 'A Favor', active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                          { key: 'neutral' as const, label: 'Neutros', active: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                          { key: 'negative' as const, label: 'Contra', active: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
                        ]).map(({ key, label, active }) => {
                          const count = key === 'all'
                            ? simulation.comments.length
                            : simulation.comments.filter(c => c.sentiment === key).length;
                          const isActive = commentFilter === key;

                          return (
                            <button
                              key={key}
                              onClick={() => { setCommentFilter(key); setCommentsToShow(30); }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 ${
                                isActive ? active : 'text-zinc-500 border-zinc-800/50 hover:text-zinc-300 hover:border-zinc-700/50'
                              }`}
                            >
                              {label} ({count.toLocaleString('pt-BR')})
                            </button>
                          );
                        })}
                      </div>

                      {/* Comments Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {visibleComments.map((comment, idx) => (
                          <CommentBubble key={`comment-${commentFilter}-${idx}`} comment={comment} index={idx} />
                        ))}
                      </div>

                      {/* Load More */}
                      {hasMore && (
                        <div className="text-center mt-6">
                          <button
                            onClick={() => setCommentsToShow(prev => prev + 30)}
                            className="px-6 py-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/50 text-sm font-bold text-zinc-400 hover:text-white hover:border-zinc-700/50 transition-all duration-200"
                          >
                            Carregar mais {Math.min(30, remaining)} de {remaining.toLocaleString('pt-BR')} restantes
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── Demographic Profile ────────────────────────────── */}
                {allPersonas.length > 0 && (
                  <DashboardAnalytics personas={allPersonas} />
                )}

                {/* ── Bottom Action ────────────────────────────────────── */}
                <div className="text-center pt-4 pb-8 animate-fade-in-up" style={{ animationDelay: '1200ms' }}>
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-2 px-8 py-3 bg-zinc-900 border border-zinc-800 text-white rounded-2xl font-bold text-sm hover:bg-zinc-800 hover:border-zinc-700 transition-all active:scale-95"
                  >
                    <RotateCcw size={16} />
                    Fazer Nova Pesquisa
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
