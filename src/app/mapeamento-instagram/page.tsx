'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  Download,
  ImageIcon,
  Instagram,
  Plus,
  Search,
  Shield,
  Users,
  XCircle,
} from 'lucide-react';
import type {
  InstagramAccount,
  InstagramFollower,
  FollowerWithPost,
} from '@/lib/instagram-mapping/types';
import { AccountCard } from '@/components/instagram-mapping/AccountCard';
import { FollowerCard } from '@/components/instagram-mapping/FollowerCard';
import { GeneratePostsBar } from '@/components/instagram-mapping/GeneratePostsBar';
import { AddFollowerModal } from '@/components/instagram-mapping/AddFollowerModal';
import { AddAccountModal } from '@/components/instagram-mapping/AddAccountModal';

/* ─────────────────── Page wrapper with Suspense ─────────────────── */

export default function MapeamentoInstagramPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MapeamentoContent />
    </Suspense>
  );
}

/* ─────────────────── Main content ─────────────────── */

function MapeamentoContent() {
  const searchParams = useSearchParams();
  const isAdmin = searchParams.get('p') === '1';

  // State
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<InstagramAccount | null>(null);
  const [followers, setFollowers] = useState<InstagramFollower[]>([]);
  const [generatedResults, setGeneratedResults] = useState<FollowerWithPost[]>([]);
  const [showPosts, setShowPosts] = useState(false);

  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingFollowers, setLoadingFollowers] = useState(false);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0, username: '' });
  const [analyzeResults, setAnalyzeResults] = useState<{ analyzed: number; deleted: number; failed: number } | null>(null);
  const [persistingAvatars, setPersistingAvatars] = useState(false);
  const [persistMsg, setPersistMsg] = useState('');

  // Load accounts on mount
  useEffect(() => {
    setLoadingAccounts(true);
    fetch('/api/instagram-mapping')
      .then((res) => res.json())
      .then((data) => setAccounts(data.accounts || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingAccounts(false));
  }, []);

  // Load followers when account is selected
  useEffect(() => {
    if (!selectedAccount) return;
    setLoadingFollowers(true);
    setGeneratedResults([]);
    setShowPosts(false);
    setError('');

    fetch(`/api/instagram-mapping?accountId=${selectedAccount.id}`)
      .then((res) => res.json())
      .then((data) => setFollowers(data.followers || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingFollowers(false));
  }, [selectedAccount]);

  const handleBack = useCallback(() => {
    setSelectedAccount(null);
    setFollowers([]);
    setGeneratedResults([]);
    setShowPosts(false);
  }, []);

  const handleGenerated = useCallback((results: unknown[]) => {
    setGeneratedResults(results as FollowerWithPost[]);
    setShowPosts(true);
  }, []);

  const reloadAccounts = useCallback(() => {
    fetch('/api/instagram-mapping')
      .then((res) => res.json())
      .then((data) => setAccounts(data.accounts || []));
  }, []);

  const handleImportFollowers = useCallback(async () => {
    if (!selectedAccount || importing) return;
    setImporting(true);
    setImportMsg('');
    setError('');

    try {
      const res = await fetch('/api/instagram-mapping/import-followers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccount.id,
          username: selectedAccount.username,
          maxCount: 50,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao importar');
      }

      setImportMsg(data.message || `${data.imported} importados`);

      // Reload followers
      const fRes = await fetch(`/api/instagram-mapping?accountId=${selectedAccount.id}`);
      const fData = await fRes.json();
      setFollowers(fData.followers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar seguidores');
    } finally {
      setImporting(false);
    }
  }, [selectedAccount, importing]);

  const handleFollowerAdded = useCallback(() => {
    if (!selectedAccount) return;
    // Reload followers
    fetch(`/api/instagram-mapping?accountId=${selectedAccount.id}`)
      .then((res) => res.json())
      .then((data) => setFollowers(data.followers || []));
  }, [selectedAccount]);

  const handleAnalyzeFollowers = useCallback(async () => {
    if (!selectedAccount || analyzing) return;

    const unanalyzed = followers.filter((f) => !f.ai_summary);
    if (unanalyzed.length === 0) {
      setAnalyzeResults({ analyzed: 0, deleted: 0, failed: 0 });
      return;
    }

    setAnalyzing(true);
    setAnalyzeResults(null);
    setError('');

    let analyzed = 0;
    let deleted = 0;
    let failed = 0;

    for (let i = 0; i < unanalyzed.length; i++) {
      const f = unanalyzed[i];
      setAnalyzeProgress({ current: i + 1, total: unanalyzed.length, username: f.username });

      try {
        const res = await fetch('/api/instagram-mapping/analyze-follower', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ followerId: f.id, username: f.username }),
          signal: AbortSignal.timeout(115000),
        });

        const data = await res.json();

        if (!res.ok) {
          failed++;
          continue;
        }

        if (data.deleted) {
          deleted++;
        } else {
          analyzed++;
        }
      } catch {
        failed++;
      }
    }

    setAnalyzeResults({ analyzed, deleted, failed });
    setAnalyzing(false);

    // Reload followers
    const fRes = await fetch(`/api/instagram-mapping?accountId=${selectedAccount.id}`);
    const fData = await fRes.json();
    setFollowers(fData.followers || []);
  }, [selectedAccount, analyzing, followers]);

  const handlePersistAvatars = useCallback(async () => {
    if (!selectedAccount || persistingAvatars) return;
    setPersistingAvatars(true);
    setPersistMsg('');
    setError('');

    try {
      const res = await fetch('/api/instagram-mapping/persist-avatars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedAccount.id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao persistir avatares');
      }

      setPersistMsg(data.message || `${data.fixed} avatares corrigidos`);

      // Reload followers to show updated avatars
      const fRes = await fetch(`/api/instagram-mapping?accountId=${selectedAccount.id}`);
      const fData = await fRes.json();
      setFollowers(fData.followers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao persistir avatares');
    } finally {
      setPersistingAvatars(false);
    }
  }, [selectedAccount, persistingAvatars]);

  // Find generated post for a specific follower
  const getPostForFollower = (followerId: string) => {
    const match = generatedResults.find((r) => r.id === followerId);
    return match?.generatedPost || null;
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-x-hidden">
      {/* Ambient glow orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-pink-500/[0.04] rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] bg-violet-500/[0.05] rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] bg-emerald-500/[0.04] rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="h-16 border-b border-white/[0.06] flex items-center px-6 md:px-8 bg-zinc-950/80 backdrop-blur-2xl sticky top-0 z-30 gap-4">
        {selectedAccount ? (
          <button
            onClick={handleBack}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all duration-200"
          >
            <ArrowLeft size={20} />
          </button>
        ) : (
          <Link
            href="/"
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all duration-200"
          >
            <ArrowLeft size={20} />
          </Link>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent truncate">
            {selectedAccount
              ? `@${selectedAccount.username}`
              : 'Mapeamento Instagram'}
          </h1>
          <p className="text-[11px] text-zinc-500 truncate">
            {selectedAccount
              ? (selectedAccount.bio || 'Seguidores mapeados e analise por IA')
              : 'Perfis mapeados, seguidores e inteligencia artificial'}
          </p>
        </div>

        <div className="hidden md:flex items-center gap-3">
          {isAdmin && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-medium">
              <Shield size={12} />
              Admin
            </span>
          )}
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
            <Instagram size={12} />
            Mapeamento
          </div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto p-6 md:p-8 lg:p-10 space-y-6">
        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm text-red-400 animate-fade-in-up">
            {error}
          </div>
        )}

        {/* ─── ACCOUNTS GRID VIEW ─── */}
        {!selectedAccount && (
          <div className="animate-fade-in-up">
            {/* Page header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  Perfis Mapeados
                </h2>
                <p className="text-zinc-500 mt-1 text-sm">
                  Selecione um perfil para ver seus seguidores e gerar postagens personalizadas
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-full text-xs text-zinc-400">
                  <Users size={13} />
                  {accounts.length} perfis
                </span>
                {isAdmin && (
                  <button
                    onClick={() => setShowAddAccountModal(true)}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2.5',
                      'bg-gradient-to-r from-pink-500 to-violet-500',
                      'hover:from-pink-400 hover:to-violet-400',
                      'text-white font-semibold text-sm',
                      'rounded-xl',
                      'shadow-lg shadow-pink-500/25',
                      'hover:shadow-pink-400/30',
                      'active:scale-[0.97]',
                      'transition-all duration-200',
                    )}
                  >
                    <Plus size={15} />
                    Novo Perfil
                  </button>
                )}
              </div>
            </div>

            {/* Loading */}
            {loadingAccounts && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-52 bg-zinc-900/50 rounded-2xl animate-pulse"
                  />
                ))}
              </div>
            )}

            {/* Grid */}
            {!loadingAccounts && accounts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 stagger-children">
                {accounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onClick={() => setSelectedAccount(account)}
                  />
                ))}
              </div>
            )}

            {/* Empty */}
            {!loadingAccounts && accounts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
                  <Instagram size={32} className="text-zinc-600" />
                </div>
                <p className="text-zinc-500 text-sm">Nenhum perfil mapeado ainda</p>
                {isAdmin ? (
                  <button
                    onClick={() => setShowAddAccountModal(true)}
                    className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-400 hover:to-violet-400 text-white font-semibold text-sm rounded-xl shadow-lg shadow-pink-500/25 active:scale-[0.97] transition-all duration-200"
                  >
                    <Plus size={15} />
                    Cadastrar primeiro perfil
                  </button>
                ) : (
                  <p className="text-zinc-600 text-xs mt-1">
                    Adicione ?p=1 na URL para habilitar o modo admin
                  </p>
                )}
              </div>
            )}

            {/* Add account modal */}
            {isAdmin && (
              <AddAccountModal
                open={showAddAccountModal}
                onClose={() => setShowAddAccountModal(false)}
                onAdded={reloadAccounts}
              />
            )}
          </div>
        )}

        {/* ─── ACCOUNT DETAIL VIEW ─── */}
        {selectedAccount && (
          <div className="animate-fade-in-up space-y-6">
            {/* Account header */}
            <AccountHeader account={selectedAccount} followerCount={followers.length} />

            {/* Generate posts bar */}
            <GeneratePostsBar
              accountId={selectedAccount.id}
              followerCount={followers.length}
              onGenerated={handleGenerated}
            />

            {/* Admin actions */}
            {isAdmin && (
              <div className="space-y-3">
                {/* Analyze progress bar */}
                {analyzing && (
                  <div className="bg-white/[0.03] backdrop-blur-2xl border border-emerald-500/20 rounded-2xl p-4 animate-fade-in-up">
                    <div className="flex items-center gap-4">
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 grid place-content-center">
                          <Brain size={18} className="text-emerald-400 animate-pulse" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-sm font-semibold bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                            Analisando @{analyzeProgress.username}...
                          </p>
                          <span className="text-xs text-zinc-400 tabular-nums font-mono shrink-0">
                            {analyzeProgress.current}/{analyzeProgress.total}
                          </span>
                        </div>
                        <div className="h-1.5 bg-zinc-800/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-500"
                            style={{ width: `${analyzeProgress.total > 0 ? (analyzeProgress.current / analyzeProgress.total) * 100 : 0}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-1.5">
                          Scraping Instagram + Analise por IA (Claude)
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Analyze results */}
                {analyzeResults && !analyzing && (
                  <div className="bg-white/[0.03] backdrop-blur-2xl border border-emerald-500/20 rounded-2xl p-4 animate-fade-in-up">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-emerald-300 tracking-tight">
                            Analise concluida
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            {analyzeResults.analyzed > 0 && (
                              <span className="text-[11px] text-emerald-400/70">{analyzeResults.analyzed} analisados</span>
                            )}
                            {analyzeResults.deleted > 0 && (
                              <span className="text-[11px] text-amber-400/70">{analyzeResults.deleted} removidos (privados)</span>
                            )}
                            {analyzeResults.failed > 0 && (
                              <span className="text-[11px] text-red-400/70">{analyzeResults.failed} falharam</span>
                            )}
                            {analyzeResults.analyzed === 0 && analyzeResults.deleted === 0 && analyzeResults.failed === 0 && (
                              <span className="text-[11px] text-zinc-500">Todos ja estavam analisados</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setAnalyzeResults(null)}
                        className="p-1.5 text-zinc-600 hover:text-zinc-400 transition-colors duration-200"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  {/* Status messages */}
                  {(importMsg || persistMsg) ? (
                    <span className="text-xs text-emerald-400 animate-fade-in-up">{importMsg || persistMsg}</span>
                  ) : (
                    <span />
                  )}

                  <div className="flex items-center gap-2">
                    {/* Analyze followers with AI */}
                    <button
                      onClick={handleAnalyzeFollowers}
                      disabled={analyzing || followers.length === 0}
                      className={cn(
                        'inline-flex items-center gap-2 px-4 py-2.5',
                        'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20',
                        'hover:from-emerald-500/30 hover:to-cyan-500/30',
                        'text-emerald-300 hover:text-emerald-200',
                        'border border-emerald-500/20 hover:border-emerald-500/30',
                        'rounded-xl font-medium text-sm',
                        'active:scale-[0.97] transition-all duration-200',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    >
                      <Brain size={15} />
                      Analisar Seguidores
                    </button>

                    {/* Import from Instagram */}
                    <button
                      onClick={handleImportFollowers}
                      disabled={importing}
                      className={cn(
                        'inline-flex items-center gap-2 px-4 py-2.5',
                        'bg-gradient-to-r from-pink-500/20 to-violet-500/20',
                        'hover:from-pink-500/30 hover:to-violet-500/30',
                        'text-pink-300 hover:text-pink-200',
                        'border border-pink-500/20 hover:border-pink-500/30',
                        'rounded-xl font-medium text-sm',
                        'active:scale-[0.97] transition-all duration-200',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    >
                      {importing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-pink-400/30 border-t-pink-400 rounded-full animate-spin" />
                          Importando...
                        </>
                      ) : (
                        <>
                          <Download size={15} />
                          Importar Seguidores
                        </>
                      )}
                    </button>

                    {/* Persist avatars to Supabase Storage */}
                    <button
                      onClick={handlePersistAvatars}
                      disabled={persistingAvatars || followers.length === 0}
                      className={cn(
                        'inline-flex items-center gap-2 px-4 py-2.5',
                        'bg-gradient-to-r from-sky-500/20 to-cyan-500/20',
                        'hover:from-sky-500/30 hover:to-cyan-500/30',
                        'text-sky-300 hover:text-sky-200',
                        'border border-sky-500/20 hover:border-sky-500/30',
                        'rounded-xl font-medium text-sm',
                        'active:scale-[0.97] transition-all duration-200',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    >
                      {persistingAvatars ? (
                        <>
                          <div className="w-4 h-4 border-2 border-sky-400/30 border-t-sky-400 rounded-full animate-spin" />
                          Corrigindo...
                        </>
                      ) : (
                        <>
                          <ImageIcon size={15} />
                          Corrigir Avatares
                        </>
                      )}
                    </button>

                    {/* Add manually */}
                    <button
                      onClick={() => setShowAddModal(true)}
                      className={cn(
                        'inline-flex items-center gap-2 px-4 py-2.5',
                        'bg-white/[0.05] hover:bg-white/[0.1]',
                        'text-zinc-300 hover:text-white',
                        'border border-white/[0.08] hover:border-white/[0.15]',
                        'rounded-xl font-medium text-sm',
                        'active:scale-[0.97] transition-all duration-200',
                      )}
                    >
                      <Plus size={15} />
                      Adicionar Manual
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Followers list header */}
            <div className="flex items-center gap-2.5">
              <Users size={16} className="text-emerald-400" />
              <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-500">
                Seguidores mapeados
              </h2>
              <span className="text-[10px] text-zinc-600 ml-auto">
                {followers.length} seguidores
              </span>
            </div>

            {/* Loading followers */}
            {loadingFollowers && (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-28 bg-zinc-900/50 rounded-2xl animate-pulse"
                  />
                ))}
              </div>
            )}

            {/* Followers grid */}
            {!loadingFollowers && followers.length > 0 && (
              <div className={cn(
                'grid grid-cols-1 lg:grid-cols-2 gap-4',
                showPosts && 'stagger-posts',
              )}>
                {followers.map((follower, index) => (
                  <FollowerCard
                    key={follower.id}
                    follower={follower}
                    post={showPosts ? getPostForFollower(follower.id) : null}
                    showPost={showPosts}
                    index={index}
                    isAdmin={isAdmin}
                    onDeleted={handleFollowerAdded}
                  />
                ))}
              </div>
            )}

            {/* Empty followers */}
            {!loadingFollowers && followers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
                  <Search size={28} className="text-zinc-600" />
                </div>
                <p className="text-zinc-500 text-sm">Nenhum seguidor mapeado</p>
                {isAdmin && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="mt-3 text-xs text-emerald-400 hover:text-emerald-300 transition-colors duration-200"
                  >
                    + Adicionar o primeiro seguidor
                  </button>
                )}
              </div>
            )}

            {/* Add follower modal */}
            {isAdmin && (
              <AddFollowerModal
                open={showAddModal}
                onClose={() => setShowAddModal(false)}
                accountId={selectedAccount.id}
                onAdded={handleFollowerAdded}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/* ─────────────────── Account header ─────────────────── */

function AccountHeader({
  account,
  followerCount,
}: {
  account: InstagramAccount;
  followerCount: number;
}) {
  const [imgError, setImgError] = useState(false);
  const initials = (account.display_name || account.username)
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative bg-white/[0.03] backdrop-blur-2xl border border-white/[0.06] rounded-3xl p-5 md:p-6 overflow-hidden">
      {/* Instagram gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/[0.04] via-purple-500/[0.03] to-orange-500/[0.04] rounded-3xl" />
      {/* Glow */}
      <div className="absolute -top-16 -right-16 w-32 h-32 bg-pink-500/[0.08] rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex items-center gap-5">
        {/* Avatar */}
        <div className="relative">
          <div className="p-[3px] rounded-full animate-ig-gradient">
            {account.avatar_url && !imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={account.avatar_url}
                alt={account.username}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-16 h-16 rounded-full object-cover border-2 border-black"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-zinc-900 border-2 border-black grid place-content-center text-xl font-bold text-zinc-300">
                {initials}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-white tracking-tight truncate">
            {account.display_name || account.username}
          </h2>
          <p className="text-sm text-pink-400/80">@{account.username}</p>
          {account.bio && (
            <p className="text-xs text-zinc-500 mt-1 line-clamp-1">
              {account.bio}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="hidden md:flex items-center gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{followerCount}</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
              Mapeados
            </p>
          </div>
          <div className="w-px h-10 bg-white/[0.06]" />
          <div className="text-center">
            <p className="text-2xl font-bold text-white">
              {account.follower_count}
            </p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">
              Total
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Skeleton ─────────────────── */

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-black">
      <div className="h-16 border-b border-white/[0.06] bg-zinc-950/80" />
      <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6">
        <div className="h-10 w-64 bg-zinc-900/50 rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-52 bg-zinc-900/50 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
