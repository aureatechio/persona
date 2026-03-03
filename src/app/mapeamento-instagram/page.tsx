'use client';

import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Brain,
  ChevronDown,
  Instagram,
  Loader2,
  Plus,
  Search,
} from 'lucide-react';
import { SearchBar } from '@/components/instagram-mapping/SearchBar';
import {
  FilterSidebar,
  EMPTY_FILTERS,
  type ActiveFilters,
} from '@/components/instagram-mapping/FilterSidebar';
import {
  FollowerRow,
  type AnalyzedFollowerData,
} from '@/components/instagram-mapping/FollowerRow';

/* ─────────────────── Types ─────────────────── */

interface RawFollower {
  username: string;
  full_name: string;
  is_private: boolean;
  is_verified: boolean;
  profile_pic_url: string;
  ig_id: string;
}

type PageState = 'search' | 'loading' | 'results';

/* ─────────────────── Page wrapper ─────────────────── */

export default function MapeamentoInstagramPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MapeamentoContent />
    </Suspense>
  );
}

/* ─────────────────── Main content ─────────────────── */

function MapeamentoContent() {
  const [pageState, setPageState] = useState<PageState>('search');
  const [targetUsername, setTargetUsername] = useState('');

  // All public followers returned by Apify
  const [rawFollowers, setRawFollowers] = useState<RawFollower[]>([]);
  // How many raw followers have been sent for analysis so far
  const [analyzedCursor, setAnalyzedCursor] = useState(0);
  // Analyzed results
  const [analyzedFollowers, setAnalyzedFollowers] = useState<AnalyzedFollowerData[]>([]);

  const [searchLoading, setSearchLoading] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [filters, setFilters] = useState<ActiveFilters>({ ...EMPTY_FILTERS });
  const [error, setError] = useState('');

  // Ref to track completed count across batches
  const batchCompletedRef = useRef(0);

  // Cache: username -> raw public followers (avoids re-calling Apify)
  const searchCacheRef = useRef<Map<string, RawFollower[]>>(new Map());

  /* ─── Analyze a batch of followers (parallel, 3 workers) ─── */

  const analyzeBatch = useCallback(async (followers: RawFollower[]) => {
    if (followers.length === 0) return;

    setIsAnalyzing(true);
    batchCompletedRef.current = 0;
    setAnalyzeProgress({ current: 0, total: followers.length });

    const CONCURRENCY = 3;
    const queue = [...followers];

    async function analyzeOne(f: RawFollower) {
      try {
        const res = await fetch('/api/instagram-mapping/analyze-follower', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            followerId: null,
            username: f.username,
            saveToDb: false,
          }),
          signal: AbortSignal.timeout(120000),
        });

        const data = await res.json();

        if (res.ok && data.analyzed && !data.skipped) {
          const followerData: AnalyzedFollowerData = {
            username: data.username,
            display_name: data.display_name,
            avatar_url: data.avatar_url,
            analysis: data.analysis,
            category: data.category,
            profile: data.profile,
          };

          setAnalyzedFollowers((prev) => [...prev, followerData]);
        }
      } catch {
        // Skip failed analyses silently
      }

      batchCompletedRef.current++;
      setAnalyzeProgress({ current: batchCompletedRef.current, total: followers.length });
    }

    async function runWorker() {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item) await analyzeOne(item);
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, followers.length) }, () => runWorker()),
    );

    setIsAnalyzing(false);
  }, []);

  /* ─── Search handler ─── */

  const handleSearch = useCallback(async (username: string, maxCount: number) => {
    setSearchLoading(true);
    setError('');
    setTargetUsername(username);
    setPageState('loading');
    setRawFollowers([]);
    setAnalyzedFollowers([]);
    setAnalyzedCursor(0);
    setFilters({ ...EMPTY_FILTERS });

    try {
      const cached = searchCacheRef.current.get(username);
      let publicFollowers: RawFollower[];

      if (cached) {
        // Simulate brief loading for UX consistency
        await new Promise((r) => setTimeout(r, 800));
        publicFollowers = cached;
      } else {
        const res = await fetch('/api/instagram-mapping/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, maxCount: Math.max(50, maxCount) }),
          signal: AbortSignal.timeout(320000),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Falha ao buscar seguidores');
        }

        if (!data.followers || data.followers.length === 0) {
          setError('Nenhum seguidor encontrado. Verifique se o perfil e publico.');
          setPageState('search');
          setSearchLoading(false);
          return;
        }

        publicFollowers = (data.followers as RawFollower[]).filter(
          (f) => !f.is_private,
        );

        if (publicFollowers.length === 0) {
          setError('Todos os seguidores encontrados sao privados.');
          setPageState('search');
          setSearchLoading(false);
          return;
        }

        // Cache for future searches
        searchCacheRef.current.set(username, publicFollowers);
      }

      // Store ALL public followers — analyze only the first batch
      setRawFollowers(publicFollowers);
      const firstBatch = publicFollowers.slice(0, maxCount);
      setAnalyzedCursor(firstBatch.length);

      setSearchLoading(false);
      setPageState('results');

      analyzeBatch(firstBatch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao buscar seguidores';
      setError(msg);
      setPageState('search');
      setSearchLoading(false);
    }
  }, [analyzeBatch]);

  /* ─── Load more — analyze next 10 raw followers ─── */

  const handleLoadMore = useCallback(() => {
    if (isAnalyzing) return;
    const nextBatch = rawFollowers.slice(analyzedCursor, analyzedCursor + 10);
    if (nextBatch.length === 0) return;
    setAnalyzedCursor((prev) => prev + nextBatch.length);
    analyzeBatch(nextBatch);
  }, [rawFollowers, analyzedCursor, isAnalyzing, analyzeBatch]);

  const hasMoreRaw = analyzedCursor < rawFollowers.length;

  /* ─── Filter logic ─── */

  function stripAccents(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  const filteredFollowers = useMemo(() => {
    return analyzedFollowers.filter((f) => {
      const a = f.analysis;

      if (filters.genero.length > 0 && !filters.genero.includes(a.genero.toLowerCase())) return false;
      if (filters.faixa_etaria.length > 0 && !filters.faixa_etaria.includes(a.faixa_etaria)) return false;
      if (filters.renda.length > 0 && !filters.renda.includes(a.renda_estimada.toLowerCase())) return false;
      if (filters.engajamento.length > 0 && !filters.engajamento.includes(a.engajamento_politico.toLowerCase())) return false;

      if (filters.grupo.length > 0 && !filters.grupo.includes(a.grupo.toUpperCase())) return false;

      if (filters.temas.length > 0) {
        const temas = (a.temas_interesse || []).map((t) => stripAccents(t));
        const grupoNorm = stripAccents(a.grupo);
        const resumoNorm = stripAccents(a.resumo || '');
        const profNorm = stripAccents(a.profissao || '');
        const hasMatch = filters.temas.some((ft) => {
          const ftNorm = stripAccents(ft);
          return (
            temas.some((t) => t.includes(ftNorm)) ||
            grupoNorm.includes(ftNorm) ||
            resumoNorm.includes(ftNorm) ||
            profNorm.includes(ftNorm)
          );
        });
        if (!hasMatch) return false;
      }

      if (filters.profissao.trim()) {
        const search = stripAccents(filters.profissao.trim());
        if (!stripAccents(a.profissao).includes(search)) return false;
      }

      return true;
    });
  }, [analyzedFollowers, filters]);

  /* ─── New search ─── */

  const handleNewSearch = useCallback(() => {
    setPageState('search');
    setRawFollowers([]);
    setAnalyzedFollowers([]);
    setAnalyzedCursor(0);
    setTargetUsername('');
    setError('');
    setFilters({ ...EMPTY_FILTERS });
  }, []);

  /* ─── Render ─── */

  return (
    <div className="min-h-screen bg-black text-white relative overflow-x-hidden">
      {/* Animated dot grid pattern */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.04)_1px,_transparent_0)] bg-[size:32px_32px] animate-grid-fade" />

      {/* Animated ambient glow orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] bg-pink-500/[0.07] rounded-full blur-[150px] animate-float" />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] bg-violet-500/[0.08] rounded-full blur-[150px] animate-float" style={{ animationDelay: '1s', animationDuration: '5s' }} />
        <div className="absolute -bottom-20 -left-20 w-[500px] h-[500px] bg-emerald-500/[0.07] rounded-full blur-[150px] animate-float" style={{ animationDelay: '2s', animationDuration: '6s' }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-r from-pink-500/[0.04] via-violet-500/[0.05] to-emerald-500/[0.04] rounded-full blur-[120px] animate-glow-pulse" />
      </div>

      {/* ─── SEARCH STATE — fullscreen, search in lower-center ─── */}
      {pageState === 'search' && (
        <div className="relative flex flex-col items-center justify-center min-h-screen px-6 md:px-8">
          {/* Animated orbs behind content */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute top-1/3 left-1/4 w-[350px] h-[350px] bg-pink-500/[0.06] rounded-full blur-[100px] animate-orb-drift-1" />
            <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-emerald-500/[0.06] rounded-full blur-[100px] animate-orb-drift-2" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-violet-500/[0.04] rounded-full blur-[120px] animate-glow-pulse" />
          </div>

          {/* Error */}
          {error && (
            <div className="absolute top-8 left-1/2 -translate-x-1/2 w-full max-w-xl bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm text-red-400 animate-in fade-in duration-300 z-10">
              {error}
            </div>
          )}

          <div className="w-full max-w-3xl space-y-8 animate-fade-in-up">
            {/* Hero text — centered */}
            <div className="space-y-5 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/[0.06] border border-white/[0.1] rounded-full text-[11px] text-zinc-300 shadow-lg shadow-black/20">
                <Instagram size={13} className="text-pink-400" />
                Mapeamento Instagram
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-zinc-300 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(255,255,255,0.08)]">
                Analise de Seguidores
              </h1>
              <p className="text-zinc-300 text-base md:text-lg max-w-lg mx-auto leading-relaxed">
                Descubra quem sao os seguidores de qualquer perfil publico
                <span className="text-emerald-400/90 font-medium"> com inteligencia artificial</span>
              </p>
            </div>

            {/* Search bar + filters inline */}
            <SearchBar
              onSearch={handleSearch}
              loading={searchLoading}
              filterSlot={
                <FilterSidebar
                  filters={filters}
                  onChange={setFilters}
                  totalResults={0}
                  filteredCount={0}
                />
              }
            />
          </div>
        </div>
      )}

      {/* ─── LOADING STATE — fullscreen, no header ─── */}
      {pageState === 'loading' && (
        <div className="relative flex flex-col items-center justify-center min-h-screen px-6 md:px-8">
          <div className="w-full max-w-3xl space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col items-center space-y-5">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-white/[0.06] grid place-content-center">
                  <Loader2 size={32} className="text-emerald-400 animate-spin" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-ping" />
              </div>

              <div className="text-center space-y-2">
                <p className="text-xl font-semibold bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                  Extraindo seguidores de @{targetUsername}
                </p>
                <p className="text-sm text-zinc-600">
                  Isso pode levar alguns minutos dependendo da quantidade
                </p>
              </div>
            </div>

            {/* Skeleton rows */}
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-14 bg-zinc-900/30 rounded-xl animate-pulse"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── RESULTS STATE — with header ─── */}
      {pageState === 'results' && (
        <>
          {/* Header — only on results */}
          <header className="h-14 border-b border-white/[0.06] flex items-center px-6 md:px-8 bg-zinc-950/80 backdrop-blur-2xl sticky top-0 z-30 gap-3">
            <button
              onClick={handleNewSearch}
              className="p-2 text-zinc-500 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all duration-200"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="h-5 w-px bg-white/[0.06]" />

            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Instagram size={14} className="text-pink-400/60 shrink-0" />
              <span className="text-sm font-semibold text-white truncate">
                @{targetUsername}
              </span>
              <span className="text-[11px] text-zinc-600 shrink-0">
                {rawFollowers.length} publicos
              </span>
            </div>

            {/* Analyze status pill */}
            {isAnalyzing ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <Brain size={12} className="text-emerald-400 animate-pulse" />
                <span className="text-[11px] text-emerald-400 tabular-nums font-mono">
                  {analyzeProgress.current}/{analyzeProgress.total}
                </span>
              </div>
            ) : analyzedFollowers.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[11px] font-medium">
                <Brain size={11} />
                {analyzedFollowers.length} analisados
              </span>
            ) : null}
          </header>

          <main className="relative max-w-5xl mx-auto p-6 md:p-8 lg:p-10 space-y-6 animate-in fade-in duration-500">
            {/* Filters — outside header so dropdown doesn't clip */}
            {analyzedFollowers.length > 0 && (
              <FilterSidebar
                filters={filters}
                onChange={setFilters}
                totalResults={analyzedFollowers.length}
                filteredCount={filteredFollowers.length}
              />
            )}

            {/* Progress bar */}
            {isAnalyzing && (
              <div className="space-y-1.5">
                <div className="h-1 bg-zinc-900/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-500"
                    style={{
                      width: `${analyzeProgress.total > 0 ? (analyzeProgress.current / analyzeProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-zinc-600">
                  Scraping perfis + Analise por IA — {analyzeProgress.current} de {analyzeProgress.total}
                </p>
              </div>
            )}

            {/* Results list */}
            {filteredFollowers.length > 0 && (
              <div className="space-y-2">
                {filteredFollowers.map((follower, i) => (
                  <FollowerRow key={follower.username} data={follower} index={i} />
                ))}
              </div>
            )}

            {/* Skeleton while analyzing first results */}
            {isAnalyzing && analyzedFollowers.length === 0 && (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-14 bg-zinc-900/30 rounded-xl animate-pulse"
                  />
                ))}
                <p className="text-center text-xs text-zinc-600">
                  Analisando perfis... Os resultados aparecerao conforme ficam prontos
                </p>
              </div>
            )}

            {/* Empty filtered results */}
            {!isAnalyzing && analyzedFollowers.length > 0 && filteredFollowers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
                  <Search size={28} className="text-zinc-600" />
                </div>
                <p className="text-zinc-500 text-sm">Nenhum resultado com os filtros selecionados</p>
              </div>
            )}

            {/* ── LOAD MORE BUTTON — always visible ── */}
            <div className="flex flex-col items-center gap-3 pt-4 pb-8">
              {/* Info line */}
              <span className="text-[11px] text-zinc-500">
                {analyzedFollowers.length} analisados de {rawFollowers.length} disponiveis
              </span>

              {/* Button — always present */}
              <button
                onClick={handleLoadMore}
                disabled={isAnalyzing || !hasMoreRaw}
                className={cn(
                  'inline-flex items-center gap-2.5 px-7 py-3',
                  'rounded-xl text-sm font-semibold',
                  'shadow-lg',
                  'active:scale-[0.97] transition-all duration-200',
                  hasMoreRaw && !isAnalyzing
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/25 hover:shadow-emerald-400/30'
                    : 'bg-white/[0.06] text-zinc-500 border border-white/[0.08] shadow-black/20 cursor-not-allowed',
                )}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Analisando...
                  </>
                ) : hasMoreRaw ? (
                  <>
                    <Plus size={14} />
                    Carregar mais 10
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} />
                    Todos analisados
                  </>
                )}
              </button>
            </div>
          </main>
        </>
      )}
    </div>
  );
}

/* ─────────────────── Skeleton ─────────────────── */

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-2xl space-y-8">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-48 bg-zinc-900/50 rounded-xl animate-pulse" />
          <div className="h-5 w-80 bg-zinc-900/30 rounded-lg animate-pulse" />
        </div>
        <div className="h-16 w-full bg-zinc-900/50 rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}
