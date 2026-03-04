'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Brain,
  ChevronDown,
  Instagram,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  Tag,
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
import { NeuralBackground } from '@/components/NeuralBackground';
import { supabase } from '@/lib/supabase';

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

  // Custom prompt regeneration
  const [customPrompt, setCustomPrompt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenProgress, setRegenProgress] = useState({ current: 0, total: 0 });
  const [regeneratingUsername, setRegeneratingUsername] = useState<string | null>(null);

  // Campaign images by grupo tag (e.g. { ESPORTE: "https://...", FE: "https://..." })
  const [campaignImages, setCampaignImages] = useState<Record<string, string>>({});

  // Supabase account ID for saving followers
  const [accountId, setAccountId] = useState<string | null>(null);

  // Ref to track completed count across batches
  const batchCompletedRef = useRef(0);

  // Cache: username -> raw public followers (avoids re-calling Apify)
  const searchCacheRef = useRef<Map<string, RawFollower[]>>(new Map());

  // Fetch campaign tag images on mount + preload them
  useEffect(() => {
    function applyMap(map: Record<string, string>) {
      setCampaignImages(map);
      // Preload all images so thumbnails render instantly
      for (const url of Object.values(map)) {
        const img = new Image();
        img.src = url;
      }
    }

    supabase
      .from('campaign_tag_images')
      .select('grupo, image_url')
      .then(({ data, error }) => {
        if (error) console.error('[CampaignImages] error:', error);
        if (data && data.length > 0) {
          const map: Record<string, string> = {};
          for (const row of data) map[row.grupo] = row.image_url;
          applyMap(map);
        } else {
          // Fallback: fetch via REST API directly
          fetch(
            'https://sobfplitrzgggzqsycew.supabase.co/rest/v1/campaign_tag_images?select=grupo,image_url',
            {
              headers: {
                apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvYmZwbGl0cnpnZ2d6cXN5Y2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzMTY4NTgsImV4cCI6MjA4Mzg5Mjg1OH0.0UOS6R0j7QwO6N7QIgrksA9iXr_82kL2a1QGjdTlsGA',
              },
            },
          )
            .then((r) => r.json())
            .then((rows: { grupo: string; image_url: string }[]) => {
              if (rows && rows.length > 0) {
                const map: Record<string, string> = {};
                for (const row of rows) map[row.grupo] = row.image_url;
                applyMap(map);
              }
            })
            .catch(() => {});
        }
      });
  }, []);

  /* ─── Persist a single analyzed follower to Supabase (fire-and-forget) ─── */

  const persistFollower = useCallback((data: AnalyzedFollowerData, acctId: string | null) => {
    if (!acctId) return;
    fetch('/api/instagram-mapping/followers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_id: acctId,
        username: data.username,
        display_name: data.display_name,
        avatar_url: data.avatar_url,
        ai_summary: data.analysis?.resumo || '',
        category: data.category || data.analysis?.categoria || 'outro',
        category_label: data.analysis?.categoria_label || null,
        metadata_json: {
          analysis_raw: data.analysis,
          biography: data.profile?.biography,
          followers_count: data.profile?.followers_count,
          follows_count: data.profile?.follows_count,
          posts_count: data.profile?.posts_count,
          scraped_at: new Date().toISOString(),
        },
      }),
    }).catch(() => {}); // fire-and-forget
  }, []);

  /* ─── Analyze a batch of followers (parallel, 3 workers) ─── */

  const accountIdRef = useRef<string | null>(null);

  // Keep ref in sync with state so analyzeBatch closure always has latest value
  useEffect(() => { accountIdRef.current = accountId; }, [accountId]);

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
            full_name: f.full_name,
            profile_pic_url: f.profile_pic_url,
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

          // Persist to Supabase (fire-and-forget)
          persistFollower(followerData, accountIdRef.current);
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
  }, [persistFollower]);

  /* ─── Search handler ─── */

  const handleSearch = useCallback(async (username: string, maxCount: number) => {
    setSearchLoading(true);
    setError('');
    setTargetUsername(username);
    setPageState('loading');
    setRawFollowers([]);
    setAnalyzedFollowers([]);
    setAnalyzedCursor(0);
    setAccountId(null);
    accountIdRef.current = null;

    try {
      // Always call the API — it checks DB cache internally
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

      /* ─── CACHED PATH: results loaded from Supabase ─── */
      if (data.cached && data.analyzedFollowers) {
        setAccountId(data.account_id || null);
        accountIdRef.current = data.account_id || null;

        const cachedAnalyzed: AnalyzedFollowerData[] = data.analyzedFollowers.map(
          (f: { username: string; display_name: string; avatar_url: string; analysis: AnalyzedFollowerData['analysis']; category: string; profile: AnalyzedFollowerData['profile'] }) => ({
            username: f.username,
            display_name: f.display_name,
            avatar_url: f.avatar_url,
            analysis: f.analysis,
            category: f.category,
            profile: f.profile,
          }),
        );

        setAnalyzedFollowers(cachedAnalyzed);
        // No raw followers to load more from cache — cursor = 0, rawFollowers empty
        setRawFollowers([]);
        setAnalyzedCursor(0);

        setSearchLoading(false);
        setPageState('results');
        return;
      }

      /* ─── FRESH PATH: results from Apify ─── */
      if (data.account_id) {
        setAccountId(data.account_id);
        accountIdRef.current = data.account_id; // Set ref immediately so analyzeBatch can use it
      }

      if (!data.followers || data.followers.length === 0) {
        setError('Nenhum seguidor encontrado. Verifique se o perfil é público.');
        setPageState('search');
        setSearchLoading(false);
        return;
      }

      const allFollowers = data.followers as RawFollower[];

      if (allFollowers.length === 0) {
        setError('Nenhum seguidor encontrado.');
        setPageState('search');
        setSearchLoading(false);
        return;
      }

      // Cache for future in-session searches
      searchCacheRef.current.set(username, allFollowers);

      // Store all followers — analyze only the first batch
      setRawFollowers(allFollowers);
      const firstBatch = allFollowers.slice(0, maxCount);
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
        const hasMatch = filters.temas.some((ft) => {
          const ftNorm = stripAccents(ft);
          return temas.some((t) => t.includes(ftNorm));
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

  /* ─── Regenerate phrases with custom prompt ─── */

  const handleRegenerate = useCallback(async () => {
    if (!customPrompt.trim() || isRegenerating || isAnalyzing) return;

    const targets = filteredFollowers.length > 0 ? filteredFollowers : analyzedFollowers;
    if (targets.length === 0) return;

    setIsRegenerating(true);
    setRegenProgress({ current: 0, total: targets.length });

    for (let i = 0; i < targets.length; i++) {
      const f = targets[i];
      setRegeneratingUsername(f.username);
      setRegenProgress({ current: i, total: targets.length });

      try {
        const res = await fetch('/api/instagram-mapping/regenerate-phrase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customPrompt: customPrompt.trim(),
            displayName: f.display_name || f.username,
            resumo: f.analysis.resumo,
            fraseOriginal: f.analysis.frase_comunicacao || '',
            profissao: f.analysis.profissao,
            grupo: f.analysis.grupo,
            temas: f.analysis.temas_interesse,
          }),
          signal: AbortSignal.timeout(60000),
        });

        const data = await res.json();

        if (res.ok && data.frase_comunicacao) {
          setAnalyzedFollowers((prev) =>
            prev.map((af) =>
              af.username === f.username
                ? { ...af, analysis: { ...af.analysis, frase_comunicacao: data.frase_comunicacao } }
                : af,
            ),
          );
        }
      } catch (err) {
        console.error('[Regenerate] failed for', f.username, err);
      }
    }

    setRegenProgress({ current: targets.length, total: targets.length });
    setRegeneratingUsername(null);
    setIsRegenerating(false);
  }, [customPrompt, filteredFollowers, analyzedFollowers, isRegenerating, isAnalyzing]);

  /* ─── New search ─── */

  const handleNewSearch = useCallback(() => {
    setPageState('search');
    setRawFollowers([]);
    setAnalyzedFollowers([]);
    setAnalyzedCursor(0);
    setTargetUsername('');
    setAccountId(null);
    accountIdRef.current = null;
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
          {/* Neural network canvas background */}
          <div className="pointer-events-none absolute inset-0">
            <NeuralBackground colorScheme="multi" />
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
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-zinc-300 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(255,255,255,0.08)] py-2 leading-[1.15]">
                Análise de Seguidores
              </h1>
              <p className="text-zinc-300 text-base md:text-lg max-w-lg mx-auto leading-relaxed">
                Descubra quem são os seguidores de qualquer perfil público
                <span className="text-emerald-400/90 font-medium"> com inteligência artificial</span>
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
                {rawFollowers.length > 0
                  ? `${rawFollowers.length} disponíveis`
                  : `${analyzedFollowers.length} salvos`}
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

            {/* ── Custom prompt for phrase regeneration ── */}
            {analyzedFollowers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Sparkles size={14} className="text-violet-400/60" />
                    </div>
                    <input
                      type="text"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !isRegenerating) handleRegenerate();
                      }}
                      placeholder="Digite um novo comando para regenerar as frases... (ex: fale sobre economia com tom agressivo)"
                      disabled={isRegenerating}
                      className={cn(
                        'w-full pl-10 pr-4 py-3',
                        'bg-white/[0.04] hover:bg-white/[0.06]',
                        'border border-white/[0.08] focus:border-violet-500/50',
                        'rounded-xl text-sm text-white placeholder:text-zinc-600',
                        'outline-none focus:ring-2 focus:ring-violet-500/20',
                        'transition-all duration-200',
                        'disabled:opacity-50',
                      )}
                    />
                  </div>
                  <button
                    onClick={handleRegenerate}
                    disabled={!customPrompt.trim() || isRegenerating || isAnalyzing}
                    className={cn(
                      'inline-flex items-center gap-2 px-5 py-3',
                      'rounded-xl text-sm font-semibold',
                      'shadow-lg',
                      'active:scale-[0.97] transition-all duration-200',
                      'shrink-0',
                      customPrompt.trim() && !isRegenerating && !isAnalyzing
                        ? 'bg-violet-500 hover:bg-violet-400 text-white shadow-violet-500/25 hover:shadow-violet-400/30'
                        : 'bg-white/[0.06] text-zinc-500 border border-white/[0.08] shadow-black/20 cursor-not-allowed',
                    )}
                  >
                    {isRegenerating ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        {regenProgress.current}/{regenProgress.total}
                      </>
                    ) : (
                      <>
                        <RefreshCw size={14} />
                        Regenerar
                      </>
                    )}
                  </button>
                </div>

                {/* Regeneration progress bar */}
                {isRegenerating && (
                  <div className="space-y-1.5">
                    <div className="h-1 bg-zinc-900/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-400 rounded-full transition-all duration-500"
                        style={{
                          width: `${regenProgress.total > 0 ? (regenProgress.current / regenProgress.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-600">
                      Regenerando frases — {regenProgress.current} de {regenProgress.total}
                      {regeneratingUsername && (
                        <span className="text-violet-400/60 ml-1">(@{regeneratingUsername})</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
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
                  Scraping perfis + Análise por IA — {analyzeProgress.current} de {analyzeProgress.total}
                </p>
              </div>
            )}

            {/* ── Summary Dashboard ── */}
            {filteredFollowers.length > 0 && (
              <FollowersDashboard followers={filteredFollowers} />
            )}

            {/* Results list */}
            {filteredFollowers.length > 0 && (
              <div className="space-y-1.5">
                {filteredFollowers.map((follower, i) => (
                  <FollowerRow
                    key={follower.username}
                    data={follower}
                    index={i}
                    campaignImageUrl={campaignImages[follower.analysis.grupo?.toUpperCase()]}
                    isRegenerating={regeneratingUsername === follower.username}
                  />
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
                  Analisando perfis... Os resultados aparecerão conforme ficam prontos
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

            {/* ── LOAD MORE BUTTON ── */}
            <div className="flex flex-col items-center gap-3 pt-4 pb-8">
              {/* Info line */}
              <span className="text-[11px] text-zinc-500">
                {analyzedFollowers.length} analisados
                {rawFollowers.length > 0 && (
                  <>
                    {' '}de {rawFollowers.length} disponíveis
                    {!isAnalyzing && analyzedCursor > 0 && analyzedCursor - analyzedFollowers.length > 0 && (
                      <span className="text-zinc-600">
                        {' '}({analyzedCursor - analyzedFollowers.length} pulados — perfis privados/sem dados)
                      </span>
                    )}
                  </>
                )}
              </span>

              {/* Button — only show if there are more to load */}
              {hasMoreRaw && (
                <button
                  onClick={handleLoadMore}
                  disabled={isAnalyzing}
                  className={cn(
                    'inline-flex items-center gap-2.5 px-7 py-3',
                    'rounded-xl text-sm font-semibold',
                    'shadow-lg',
                    'active:scale-[0.97] transition-all duration-200',
                    !isAnalyzing
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/25 hover:shadow-emerald-400/30'
                      : 'bg-white/[0.06] text-zinc-500 border border-white/[0.08] shadow-black/20 cursor-not-allowed',
                  )}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      Carregar mais 10
                    </>
                  )}
                </button>
              )}
            </div>
          </main>
        </>
      )}
    </div>
  );
}

/* ─────────────────── Summary Dashboard ─────────────────── */

const DASH_GROUP_COLORS: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  FAMILIA:      { bg: 'bg-amber-500/10',    text: 'text-amber-300',    border: 'border-amber-500/20',    bar: 'bg-amber-400' },
  EMPREENDEDOR: { bg: 'bg-violet-500/10',   text: 'text-violet-300',   border: 'border-violet-500/20',   bar: 'bg-violet-400' },
  FE:           { bg: 'bg-orange-500/10',    text: 'text-orange-300',   border: 'border-orange-500/20',   bar: 'bg-orange-400' },
  ESPORTE:      { bg: 'bg-emerald-500/10',   text: 'text-emerald-300',  border: 'border-emerald-500/20',  bar: 'bg-emerald-400' },
  EDUCACAO:     { bg: 'bg-teal-500/10',      text: 'text-teal-300',     border: 'border-teal-500/20',     bar: 'bg-teal-400' },
  SAUDE:        { bg: 'bg-rose-500/10',      text: 'text-rose-300',     border: 'border-rose-500/20',     bar: 'bg-rose-400' },
  TECH:         { bg: 'bg-cyan-500/10',      text: 'text-cyan-300',     border: 'border-cyan-500/20',     bar: 'bg-cyan-400' },
  POLITICA:     { bg: 'bg-red-500/10',       text: 'text-red-300',      border: 'border-red-500/20',      bar: 'bg-red-400' },
  MODA:         { bg: 'bg-fuchsia-500/10',   text: 'text-fuchsia-300',  border: 'border-fuchsia-500/20',  bar: 'bg-fuchsia-400' },
  ARTE:         { bg: 'bg-purple-500/10',    text: 'text-purple-300',   border: 'border-purple-500/20',   bar: 'bg-purple-400' },
  MUSICA:       { bg: 'bg-indigo-500/10',    text: 'text-indigo-300',   border: 'border-indigo-500/20',   bar: 'bg-indigo-400' },
  GASTRONOMIA:  { bg: 'bg-yellow-500/10',    text: 'text-yellow-300',   border: 'border-yellow-500/20',   bar: 'bg-yellow-400' },
  AGRO:         { bg: 'bg-lime-500/10',      text: 'text-lime-300',     border: 'border-lime-500/20',     bar: 'bg-lime-400' },
  PET:          { bg: 'bg-amber-400/10',     text: 'text-amber-200',    border: 'border-amber-400/20',    bar: 'bg-amber-300' },
  VIAGEM:       { bg: 'bg-sky-500/10',       text: 'text-sky-300',      border: 'border-sky-500/20',      bar: 'bg-sky-400' },
  FITNESS:      { bg: 'bg-green-500/10',     text: 'text-green-300',    border: 'border-green-500/20',    bar: 'bg-green-400' },
  JURIDICO:     { bg: 'bg-slate-400/10',     text: 'text-slate-300',    border: 'border-slate-400/20',    bar: 'bg-slate-400' },
  INFLUENCER:   { bg: 'bg-pink-500/10',      text: 'text-pink-300',     border: 'border-pink-500/20',     bar: 'bg-pink-400' },
  COMUNIDADE:   { bg: 'bg-blue-500/10',      text: 'text-blue-300',     border: 'border-blue-500/20',     bar: 'bg-blue-400' },
  LIFESTYLE:    { bg: 'bg-pink-400/10',      text: 'text-pink-200',     border: 'border-pink-400/20',     bar: 'bg-pink-300' },
  OUTRO:        { bg: 'bg-zinc-500/10',      text: 'text-zinc-300',     border: 'border-zinc-500/20',     bar: 'bg-zinc-400' },
};

function FollowersDashboard({ followers }: { followers: AnalyzedFollowerData[] }) {
  const stats = useMemo(() => {
    let homens = 0;
    let mulheres = 0;
    let indefinido = 0;
    const tagCounts: Record<string, number> = {};

    for (const f of followers) {
      const g = f.analysis.genero?.toLowerCase();
      if (g === 'homem') homens++;
      else if (g === 'mulher') mulheres++;
      else indefinido++;

      const grupo = (f.analysis.grupo || 'OUTRO').toUpperCase();
      tagCounts[grupo] = (tagCounts[grupo] || 0) + 1;
    }

    const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    const maxTagCount = sortedTags.length > 0 ? sortedTags[0][1] : 1;

    return { homens, mulheres, indefinido, sortedTags, maxTagCount, total: followers.length };
  }, [followers]);

  const homensPct = stats.total > 0 ? Math.round((stats.homens / stats.total) * 100) : 0;
  const mulheresPct = stats.total > 0 ? Math.round((stats.mulheres / stats.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* ── Top metric cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total */}
        <div className="relative overflow-hidden bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 backdrop-blur-xl">
          <div className="absolute -top-6 -right-6 w-16 h-16 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10">
              <Users size={13} className="text-emerald-400" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Total</span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">{stats.total}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">seguidores analisados</p>
        </div>

        {/* Homens */}
        <div className="relative overflow-hidden bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 backdrop-blur-xl">
          <div className="absolute -top-6 -right-6 w-16 h-16 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Homens</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-sky-300 tabular-nums">{stats.homens}</p>
            <span className="text-xs text-sky-400/50 font-medium tabular-nums">{homensPct}%</span>
          </div>
          <div className="mt-2 h-1 rounded-full bg-zinc-800/60 overflow-hidden">
            <div className="h-full bg-sky-400/60 rounded-full transition-all duration-700" style={{ width: `${homensPct}%` }} />
          </div>
        </div>

        {/* Mulheres */}
        <div className="relative overflow-hidden bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 backdrop-blur-xl">
          <div className="absolute -top-6 -right-6 w-16 h-16 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-pink-400 shadow-sm shadow-pink-400/50" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Mulheres</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-pink-300 tabular-nums">{stats.mulheres}</p>
            <span className="text-xs text-pink-400/50 font-medium tabular-nums">{mulheresPct}%</span>
          </div>
          <div className="mt-2 h-1 rounded-full bg-zinc-800/60 overflow-hidden">
            <div className="h-full bg-pink-400/60 rounded-full transition-all duration-700" style={{ width: `${mulheresPct}%` }} />
          </div>
        </div>

        {/* Indefinido / Gênero */}
        <div className="relative overflow-hidden bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 backdrop-blur-xl">
          <div className="absolute -top-6 -right-6 w-16 h-16 bg-zinc-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Indefinido</span>
          </div>
          <p className="text-2xl font-bold text-zinc-400 tabular-nums">{stats.indefinido}</p>
          {/* Mini stacked bar */}
          <div className="mt-2 h-1.5 rounded-full bg-zinc-800/60 overflow-hidden flex">
            <div className="h-full bg-sky-400/70 transition-all duration-700" style={{ width: `${homensPct}%` }} />
            <div className="h-full bg-pink-400/70 transition-all duration-700" style={{ width: `${mulheresPct}%` }} />
          </div>
        </div>
      </div>

      {/* ── Grupos/Tags breakdown ── */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-violet-500/10">
            <Tag size={13} className="text-violet-400" />
          </div>
          <span className="text-xs font-semibold text-zinc-300">Distribuição por Grupo</span>
          <span className="text-[10px] text-zinc-600 ml-auto">{stats.sortedTags.length} grupos</span>
        </div>

        <div className="space-y-2">
          {stats.sortedTags.map(([tag, count]) => {
            const colors = DASH_GROUP_COLORS[tag] || DASH_GROUP_COLORS.OUTRO;
            const pct = Math.round((count / stats.total) * 100);
            const barWidth = Math.round((count / stats.maxTagCount) * 100);
            return (
              <div key={tag} className="group/tag flex items-center gap-3">
                <span className={cn(
                  'w-24 shrink-0 text-[11px] font-bold uppercase tracking-wide text-right',
                  colors.text,
                )}>
                  {tag}
                </span>
                <div className="flex-1 h-6 rounded-lg bg-zinc-900/60 overflow-hidden relative">
                  <div
                    className={cn(
                      'h-full rounded-lg transition-all duration-700 ease-out opacity-70 group-hover/tag:opacity-100',
                      colors.bar,
                    )}
                    style={{ width: `${barWidth}%` }}
                  />
                  <div className="absolute inset-0 flex items-center px-2.5">
                    <span className="text-[10px] font-bold text-white/90 tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                      {count}
                    </span>
                    <span className="text-[10px] text-white/40 ml-1 tabular-nums">
                      ({pct}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
