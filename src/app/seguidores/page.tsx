'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Search,
  Send,
  Users,
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink,
  CheckCircle2,
  X,
  Instagram,
  Clock,
  Link2,
  Unplug,
  Zap,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { GROUP_LABELS, GRUPO_OPTIONS, getGroupColor } from '@/lib/instagram-groups';
import { MessageModal } from '@/components/instagram-mapping/MessageModal';
import { ConnectInstagramModal } from '@/components/instagram-mapping/ConnectInstagramModal';

/* ─── Types ─── */

interface FollowerRow {
  id: string;
  account_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  ai_summary: string | null;
  category: string;
  category_label: string | null;
  metadata_json: Record<string, unknown> | null;
  messaged: boolean | null;
  messaged_at: string | null;
  last_message: string | null;
  created_at: string;
  instagram_accounts: {
    username: string;
    display_name: string | null;
  };
}

interface Account {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number;
}

/* ─── Page ─── */

export default function SeguidoresPage() {
  const [followers, setFollowers] = useState<FollowerRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, messaged: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedGrupo, setSelectedGrupo] = useState('');
  const [messagedFilter, setMessagedFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 30;

  // Instagram session
  const [igSession, setIgSession] = useState<{ id: string; ig_username: string } | null>(null);
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  // Message modal (single)
  const [messageTarget, setMessageTarget] = useState<{
    username: string;
    displayName: string;
    defaultMessage: string;
  } | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk test state
  const [bulkTestOpen, setBulkTestOpen] = useState(false);
  const [bulkTestCount, setBulkTestCount] = useState(5);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkResults, setBulkResults] = useState<Array<{ username: string; success: boolean; error?: string }> | null>(null);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [debouncedSearch, selectedAccount, selectedGrupo, messagedFilter]);

  // Check for active Instagram session on mount
  useEffect(() => {
    fetch('/api/instagram-mapping/session')
      .then((r) => r.json())
      .then((data) => {
        if (data.session) setIgSession(data.session);
      })
      .catch(() => {});
  }, []);

  const fetchFollowers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('per_page', String(perPage));
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedAccount) params.set('account_id', selectedAccount);
      if (selectedGrupo) params.set('grupo', selectedGrupo);
      if (messagedFilter) params.set('messaged', messagedFilter);

      const res = await fetch(`/api/seguidores?${params}`);
      const data = await res.json();

      setFollowers(data.followers || []);
      setTotal(data.total || 0);
      setAccounts(data.accounts || []);
      setStats(data.stats || { total: 0, messaged: 0 });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, selectedAccount, selectedGrupo, messagedFilter]);

  useEffect(() => { fetchFollowers(); }, [fetchFollowers]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const handleMessageSent = (username: string) => {
    setFollowers((prev) =>
      prev.map((f) =>
        f.username === username
          ? { ...f, messaged: true, messaged_at: new Date().toISOString() }
          : f,
      ),
    );
  };

  const activeFilterCount = [selectedAccount, selectedGrupo, messagedFilter].filter(Boolean).length;

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === followers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(followers.map((f) => f.id)));
    }
  };

  const selectedFollowers = followers.filter((f) => selectedIds.has(f.id));

  // Count not-yet-messaged in current page
  const notMessagedFollowers = followers.filter((f) => !f.messaged);
  const notMessagedCount = notMessagedFollowers.length;

  // Fetch ALL not-messaged followers from DB (for "todos" mode)
  const fetchAllNotMessaged = async (): Promise<Array<{ username: string; display_name: string | null }>> => {
    const params = new URLSearchParams();
    params.set('messaged', 'false');
    params.set('per_page', '9999');
    params.set('page', '1');
    if (selectedAccount) params.set('account_id', selectedAccount);
    if (selectedGrupo) params.set('grupo', selectedGrupo);

    const res = await fetch(`/api/seguidores?${params}`);
    const data = await res.json();
    return (data.followers || []).map((f: FollowerRow) => ({
      username: f.username,
      display_name: f.display_name,
    }));
  };

  // Bulk test — sends one by one sequentially with progress
  // bulkTestCount=0 means "TODOS"
  const handleBulkTest = async () => {
    if (!igSession) {
      setConnectModalOpen(true);
      return;
    }

    if (!bulkMessage.trim()) return;

    setBulkSending(true);
    setBulkResults(null);

    let bulkTargets: Array<{ username: string; message: string }>;

    try {
      if (selectedIds.size > 0) {
        const targets = selectedFollowers.filter((f) => !f.messaged);
        if (targets.length === 0) { setBulkSending(false); return; }
        bulkTargets = targets.map((f) => {
          const nome = f.display_name || f.username;
          return { username: f.username, message: bulkMessage.replace(/\{\{nome\}\}/gi, nome) };
        });
      } else if (bulkTestCount === 0) {
        const allPending = await fetchAllNotMessaged();
        if (allPending.length === 0) { setBulkSending(false); return; }
        bulkTargets = allPending.map((f) => {
          const nome = f.display_name || f.username;
          return { username: f.username, message: bulkMessage.replace(/\{\{nome\}\}/gi, nome) };
        });
      } else {
        const targets = notMessagedFollowers.slice(0, bulkTestCount);
        if (targets.length === 0) { setBulkSending(false); return; }
        bulkTargets = targets.map((f) => {
          const nome = f.display_name || f.username;
          return { username: f.username, message: bulkMessage.replace(/\{\{nome\}\}/gi, nome) };
        });
      }

      setBulkProgress({ current: 0, total: bulkTargets.length });

      // Send one by one sequentially — avoids Apify rate limits
      const results: Array<{ username: string; success: boolean; error?: string }> = [];

      for (let i = 0; i < bulkTargets.length; i++) {
        const target = bulkTargets[i];
        setBulkProgress({ current: i, total: bulkTargets.length });

        try {
          const res = await fetch('/api/instagram-mapping/send-dm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetUsername: target.username,
              message: target.message,
            }),
          });

          const data = await res.json();

          if (res.ok && data.success) {
            results.push({ username: target.username, success: true });
            // Update the card in real-time
            setFollowers((prev) =>
              prev.map((f) =>
                f.username === target.username
                  ? { ...f, messaged: true, messaged_at: new Date().toISOString(), last_message: target.message }
                  : f,
              ),
            );
            setStats((prev) => ({ ...prev, messaged: prev.messaged + 1 }));
          } else {
            results.push({ username: target.username, success: false, error: data.error || 'Erro' });
          }
        } catch {
          results.push({ username: target.username, success: false, error: 'Erro de conexão' });
        }

        // Small delay between sends to avoid hitting Instagram limits
        if (i < bulkTargets.length - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      setBulkProgress({ current: bulkTargets.length, total: bulkTargets.length });
      setBulkResults(results);
    } catch {
      setBulkResults([{ username: '-', success: false, error: 'Erro de conexão' }]);
    } finally {
      setBulkSending(false);
    }
  };

  const bulkSuccessCount = bulkResults?.filter((r) => r.success).length || 0;
  const bulkFailCount = bulkResults?.filter((r) => !r.success).length || 0;

  return (
    <div className="min-h-screen bg-black text-white relative overflow-x-hidden">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.03)_1px,_transparent_0)] bg-[size:32px_32px]" />
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-2xl">
        <div className="max-w-6xl mx-auto px-6 md:px-8 py-4 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Seguidores</h1>
            <p className="text-zinc-500 text-sm mt-0.5">
              {stats.total} seguidores · <span className="text-emerald-500/70">{stats.messaged} contactados</span> · <span className="text-amber-500/70">{stats.total - stats.messaged} pendentes</span>
            </p>
          </div>

          {/* Instagram connection */}
          {igSession ? (
            <button
              onClick={() => setConnectModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/15 transition-all duration-200"
            >
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">@{igSession.ig_username}</span>
            </button>
          ) : (
            <button
              onClick={() => setConnectModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-pink-500/10 border border-pink-500/20 rounded-xl hover:bg-pink-500/15 transition-all duration-200"
            >
              <Link2 size={14} className="text-pink-400" />
              <span className="text-xs text-pink-400 font-medium">Conectar Instagram</span>
            </button>
          )}

          {/* Bulk test button */}
          <button
            onClick={() => setBulkTestOpen(!bulkTestOpen)}
            disabled={bulkSending}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5',
              'bg-gradient-to-r from-amber-500/80 to-orange-500/80',
              'hover:from-amber-400/80 hover:to-orange-400/80',
              'text-black font-semibold text-xs',
              'rounded-xl',
              'shadow-lg shadow-amber-500/20',
              'active:scale-[0.97]',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {bulkSending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Zap size={14} />
                {selectedIds.size > 0
                  ? `Enviar para ${selectedIds.size} selecionados`
                  : 'Teste em Lote'}
              </>
            )}
          </button>

          {/* Search */}
          <div className="relative w-full md:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por nome ou @username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                'w-full pl-10 pr-4 py-2.5',
                'bg-white/[0.04] hover:bg-white/[0.06]',
                'border border-white/[0.08] focus:border-emerald-500/50',
                'rounded-xl text-sm text-white placeholder:text-zinc-600',
                'outline-none focus:ring-2 focus:ring-emerald-500/20',
                'transition-all duration-200',
              )}
            />
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5',
              'rounded-xl text-sm font-medium',
              'transition-all duration-200',
              showFilters || activeFilterCount > 0
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-white/[0.05] text-zinc-400 border border-white/[0.08] hover:bg-white/[0.1] hover:text-white',
            )}
          >
            <Filter size={15} />
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-1 w-5 h-5 rounded-full bg-emerald-500 text-black text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Bulk test config dropdown */}
        {bulkTestOpen && !bulkSending && (
          <div className="border-t border-amber-500/10 bg-amber-500/[0.03] backdrop-blur-xl">
            <div className="max-w-6xl mx-auto px-6 md:px-8 py-4 space-y-3">
              {/* Row 1: target config */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-amber-400" />
                  <span className="text-xs text-zinc-300 font-medium">Teste em lote</span>
                </div>

                <div className="h-4 w-px bg-zinc-700/50" />

                {selectedIds.size > 0 ? (
                  <span className="text-xs text-amber-300">
                    Enviar para <strong>{selectedFollowers.filter((f) => !f.messaged).length}</strong> não contactado{selectedFollowers.filter((f) => !f.messaged).length !== 1 ? 's' : ''} de {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
                    {selectedFollowers.some((f) => f.messaged) && (
                      <span className="text-zinc-500 ml-1">
                        ({selectedFollowers.filter((f) => f.messaged).length} já contactado{selectedFollowers.filter((f) => f.messaged).length !== 1 ? 's' : ''} — pulado{selectedFollowers.filter((f) => f.messaged).length !== 1 ? 's' : ''})
                      </span>
                    )}
                  </span>
                ) : (
                  <>
                    <span className="text-xs text-zinc-500">Enviar para</span>
                    <div className="flex items-center gap-1.5">
                      {[3, 5, 10, 20].map((n) => (
                        <button
                          key={n}
                          onClick={() => setBulkTestCount(n)}
                          className={cn(
                            'w-8 h-8 rounded-xl text-xs font-bold transition-all duration-200',
                            bulkTestCount === n
                              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/25'
                              : 'bg-white/[0.05] text-zinc-400 hover:bg-white/[0.1] hover:text-white border border-white/[0.08]',
                          )}
                        >
                          {n}
                        </button>
                      ))}
                      <button
                        onClick={() => setBulkTestCount(0)}
                        className={cn(
                          'px-3 h-8 rounded-xl text-xs font-bold transition-all duration-200',
                          bulkTestCount === 0
                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                            : 'bg-white/[0.05] text-zinc-400 hover:bg-red-500/15 hover:text-red-300 border border-white/[0.08] hover:border-red-500/30',
                        )}
                      >
                        TODOS
                      </button>
                    </div>
                    <span className="text-xs text-zinc-500">
                      não contactados
                      <span className="text-zinc-600 ml-1">({stats.total - stats.messaged} pendentes no total)</span>
                    </span>
                  </>
                )}

                <button
                  onClick={() => setBulkTestOpen(false)}
                  className="ml-auto p-1.5 text-zinc-500 hover:text-white transition-colors duration-200"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Row 2: message input */}
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Mensagem
                    </label>
                    <span className="text-[10px] text-zinc-600">
                      Use <code className="px-1 py-0.5 bg-white/[0.06] rounded text-amber-400/80 text-[9px]">{'{{nome}}'}</code> para personalizar com o nome
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Ex: Oi {{nome}}! Vi que a gente tem interesses em comum, queria me apresentar..."
                    value={bulkMessage}
                    onChange={(e) => setBulkMessage(e.target.value)}
                    className={cn(
                      'w-full px-4 py-3',
                      'bg-white/[0.04] hover:bg-white/[0.06]',
                      'border border-white/[0.08] focus:border-amber-500/50',
                      'rounded-xl text-sm text-white placeholder:text-zinc-600',
                      'outline-none focus:ring-2 focus:ring-amber-500/20',
                      'transition-all duration-200',
                      'resize-none leading-relaxed',
                    )}
                  />
                </div>

                <button
                  onClick={handleBulkTest}
                  disabled={!bulkMessage.trim()}
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-3',
                    'text-sm font-semibold rounded-xl',
                    'active:scale-[0.97]',
                    'transition-all duration-200',
                    'disabled:opacity-30 disabled:cursor-not-allowed',
                    bulkTestCount === 0 && selectedIds.size === 0
                      ? 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/25'
                      : 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/25',
                  )}
                >
                  <Send size={14} />
                  {bulkTestCount === 0 && selectedIds.size === 0
                    ? `Disparar para TODOS (${stats.total - stats.messaged})`
                    : 'Disparar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filter bar */}
        {showFilters && (
          <div className="border-t border-white/[0.04] bg-zinc-950/60 backdrop-blur-xl">
            <div className="max-w-6xl mx-auto px-6 md:px-8 py-3 flex flex-wrap items-center gap-3">
              {/* Account selector */}
              <div className="relative">
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className={cn(
                    'appearance-none pl-3 pr-8 py-2',
                    'bg-white/[0.04] border border-white/[0.08] rounded-xl',
                    'text-sm text-zinc-300',
                    'outline-none focus:border-emerald-500/50',
                    'transition-all duration-200 cursor-pointer',
                  )}
                >
                  <option value="">Todas as contas</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      @{a.username} ({a.follower_count})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>

              {/* Grupo selector */}
              <div className="relative">
                <select
                  value={selectedGrupo}
                  onChange={(e) => setSelectedGrupo(e.target.value)}
                  className={cn(
                    'appearance-none pl-3 pr-8 py-2',
                    'bg-white/[0.04] border border-white/[0.08] rounded-xl',
                    'text-sm text-zinc-300',
                    'outline-none focus:border-emerald-500/50',
                    'transition-all duration-200 cursor-pointer',
                  )}
                >
                  <option value="">Todos os grupos</option>
                  {GRUPO_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {GROUP_LABELS[g] || g}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>

              {/* Messaged filter */}
              <div className="relative">
                <select
                  value={messagedFilter}
                  onChange={(e) => setMessagedFilter(e.target.value)}
                  className={cn(
                    'appearance-none pl-3 pr-8 py-2',
                    'bg-white/[0.04] border border-white/[0.08] rounded-xl',
                    'text-sm text-zinc-300',
                    'outline-none focus:border-emerald-500/50',
                    'transition-all duration-200 cursor-pointer',
                  )}
                >
                  <option value="">Todos</option>
                  <option value="true">Contactados</option>
                  <option value="false">Não contactados</option>
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>

              {/* Clear filters */}
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setSelectedAccount('');
                    setSelectedGrupo('');
                    setMessagedFilter('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-zinc-400 hover:text-white transition-colors duration-200"
                >
                  <X size={12} />
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="relative max-w-6xl mx-auto p-6 md:p-8 space-y-4">
        {/* Select all bar */}
        {followers.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAll}
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5',
                'rounded-xl text-xs font-medium',
                'transition-all duration-200',
                selectedIds.size === followers.length
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-white/[0.03] text-zinc-500 border border-white/[0.06] hover:bg-white/[0.06] hover:text-zinc-300',
              )}
            >
              <div className={cn(
                'w-4 h-4 rounded border flex items-center justify-center transition-all duration-200',
                selectedIds.size === followers.length
                  ? 'bg-emerald-500 border-emerald-500'
                  : selectedIds.size > 0
                    ? 'bg-emerald-500/30 border-emerald-500/50'
                    : 'border-zinc-600',
              )}>
                {selectedIds.size > 0 && <CheckCircle2 size={10} className="text-black" />}
              </div>
              {selectedIds.size > 0
                ? `${selectedIds.size} selecionados`
                : 'Selecionar todos'}
            </button>

            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-zinc-500 hover:text-white transition-colors duration-200"
              >
                Limpar seleção
              </button>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && followers.length === 0 ? (
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-20 bg-zinc-900/50 rounded-2xl animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        ) : followers.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
              <Users size={32} className="text-zinc-600" />
            </div>
            <p className="text-zinc-400 text-sm font-medium">Nenhum seguidor encontrado</p>
            <p className="text-zinc-600 text-xs mt-1">
              {debouncedSearch || activeFilterCount > 0
                ? 'Tente ajustar os filtros ou a busca'
                : 'Vá ao Mapeamento Instagram para analisar seguidores'}
            </p>
          </div>
        ) : (
          <>
            {/* Follower list */}
            <div className="space-y-2">
              {followers.map((f) => (
                <FollowerCard
                  key={f.id}
                  follower={f}
                  selected={selectedIds.has(f.id)}
                  onToggleSelect={() => toggleSelect(f.id)}
                  onMessage={(username, displayName, defaultMsg) => {
                    if (!igSession) {
                      setConnectModalOpen(true);
                      return;
                    }
                    setMessageTarget({ username, displayName, defaultMessage: defaultMsg });
                  }}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={cn(
                    'p-2 rounded-xl transition-all duration-200',
                    page === 1
                      ? 'text-zinc-700 cursor-not-allowed'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]',
                  )}
                >
                  <ChevronLeft size={18} />
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let p: number;
                    if (totalPages <= 5) {
                      p = i + 1;
                    } else if (page <= 3) {
                      p = i + 1;
                    } else if (page >= totalPages - 2) {
                      p = totalPages - 4 + i;
                    } else {
                      p = page - 2 + i;
                    }
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={cn(
                          'w-9 h-9 rounded-xl text-sm font-medium transition-all duration-200',
                          p === page
                            ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/25'
                            : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]',
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className={cn(
                    'p-2 rounded-xl transition-all duration-200',
                    page === totalPages
                      ? 'text-zinc-700 cursor-not-allowed'
                      : 'text-zinc-400 hover:text-white hover:bg-white/[0.06]',
                  )}
                >
                  <ChevronRight size={18} />
                </button>

                <span className="text-xs text-zinc-600 ml-3">
                  {total} resultado{total !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Loading overlay for pagination */}
            {loading && followers.length > 0 && (
              <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-20 flex items-center justify-center pointer-events-none">
                <Loader2 size={24} className="text-emerald-400 animate-spin" />
              </div>
            )}
          </>
        )}
      </main>

      {/* Bulk results floating bar */}
      {bulkResults && (
        <div className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-40',
          'bg-zinc-900/95 backdrop-blur-2xl',
          'border border-white/[0.1]',
          'rounded-2xl shadow-2xl shadow-black/50',
          'px-6 py-4',
          'flex items-center gap-5',
          'animate-in fade-in slide-in-from-bottom-4 duration-300',
        )}>
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-amber-400" />
            <span className="text-sm font-semibold text-white">Resultado do teste</span>
          </div>

          <div className="h-5 w-px bg-zinc-700/50" />

          {bulkSuccessCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <CheckCircle2 size={13} /> {bulkSuccessCount} enviada{bulkSuccessCount !== 1 ? 's' : ''}
            </span>
          )}
          {bulkFailCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-red-400 font-medium">
              <XCircle size={13} /> {bulkFailCount} falha{bulkFailCount !== 1 ? 's' : ''}
            </span>
          )}

          {bulkFailCount > 0 && (
            <span className="text-[10px] text-zinc-500 max-w-xs truncate">
              {bulkResults.find((r) => !r.success)?.error}
            </span>
          )}

          <button
            onClick={() => { setBulkResults(null); setSelectedIds(new Set()); setBulkTestOpen(false); }}
            className="ml-2 text-xs text-zinc-400 hover:text-white transition-colors duration-200"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Bulk sending overlay */}
      {bulkSending && (
        <div className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-40',
          'bg-zinc-900/95 backdrop-blur-2xl',
          'border border-amber-500/20',
          'rounded-2xl shadow-2xl shadow-black/50',
          'px-6 py-4',
          'flex items-center gap-4',
          'animate-in fade-in slide-in-from-bottom-4 duration-300',
        )}>
          <Loader2 size={18} className="animate-spin text-amber-400" />
          <div className="flex flex-col gap-1">
            <span className="text-sm text-zinc-300">
              Enviando {bulkProgress.current + 1} de {bulkProgress.total}...
            </span>
            {/* Progress bar */}
            <div className="w-48 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Message modal */}
      {messageTarget && (
        <MessageModal
          open={!!messageTarget}
          onClose={() => setMessageTarget(null)}
          targetUsername={messageTarget.username}
          targetDisplayName={messageTarget.displayName}
          defaultMessage={messageTarget.defaultMessage}
          onSent={handleMessageSent}
        />
      )}

      {/* Connect Instagram modal */}
      <ConnectInstagramModal
        open={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        onConnected={(session) => setIgSession(session)}
      />
    </div>
  );
}

/* ─── Follower Card Component ─── */

function FollowerCard({
  follower,
  selected,
  onToggleSelect,
  onMessage,
}: {
  follower: FollowerRow;
  selected: boolean;
  onToggleSelect: () => void;
  onMessage: (username: string, displayName: string, defaultMessage: string) => void;
}) {
  const grupo = (follower.category || 'OUTRO').toUpperCase();
  const colors = getGroupColor(grupo);
  const label = GROUP_LABELS[grupo] || grupo;
  const metadata = follower.metadata_json as Record<string, unknown> | null;
  const analysis = metadata?.analysis_raw as Record<string, unknown> | null;
  const frase = (analysis?.frase_comunicacao as string) || '';
  const profissao = (analysis?.profissao as string) || '';
  const followersCount = (metadata?.followers_count as number) || 0;

  const displayName = follower.display_name || follower.username;
  const accountUsername = follower.instagram_accounts?.username || '';

  return (
    <div
      className={cn(
        'group relative flex items-start gap-4 p-4 md:p-5',
        'border rounded-2xl',
        'transition-all duration-300 ease-out',
        selected
          ? 'bg-emerald-500/[0.04] border-emerald-500/20 shadow-lg shadow-emerald-500/5'
          : 'bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.05] hover:border-white/[0.1]',
      )}
    >
      {/* Checkbox */}
      <button
        onClick={onToggleSelect}
        className="shrink-0 mt-1"
      >
        <div className={cn(
          'w-5 h-5 rounded-lg border flex items-center justify-center transition-all duration-200',
          selected
            ? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/25'
            : 'border-zinc-700 hover:border-zinc-500 bg-white/[0.02]',
        )}>
          {selected && <CheckCircle2 size={12} className="text-black" />}
        </div>
      </button>

      {/* Avatar */}
      <div className="relative shrink-0">
        {follower.avatar_url ? (
          <img
            src={follower.avatar_url}
            alt={displayName}
            className="w-12 h-12 rounded-full object-cover border border-white/[0.08]"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-zinc-800 border border-white/[0.08] flex items-center justify-center">
            <Users size={18} className="text-zinc-500" />
          </div>
        )}
        {follower.messaged && (
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 rounded-full ring-2 ring-black flex items-center justify-center">
            <CheckCircle2 size={10} className="text-black" />
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white truncate">{displayName}</span>
          <a
            href={`https://instagram.com/${follower.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-pink-400 transition-colors duration-200 flex items-center gap-1"
          >
            @{follower.username}
            <ExternalLink size={10} />
          </a>
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-0.5',
              colors.bg,
              colors.text,
              colors.border,
              'border rounded-full text-[10px] font-medium',
            )}
          >
            {label}
          </span>
        </div>

        {follower.ai_summary && (
          <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
            {follower.ai_summary}
          </p>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          {profissao && (
            <span className="text-[10px] text-zinc-500">{profissao}</span>
          )}
          {followersCount > 0 && (
            <span className="text-[10px] text-zinc-600">
              {followersCount >= 1000
                ? `${(followersCount / 1000).toFixed(1)}K`
                : followersCount}{' '}
              seguidores
            </span>
          )}
          {accountUsername && (
            <span className="text-[10px] text-zinc-600 flex items-center gap-1">
              <Instagram size={9} />
              via @{accountUsername}
            </span>
          )}
          {follower.messaged && follower.messaged_at && (
            <span className="text-[10px] text-emerald-500/70 flex items-center gap-1">
              <Clock size={9} />
              {new Date(follower.messaged_at).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>

        {follower.last_message && (
          <div className="mt-1 px-3 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
            <p className="text-[10px] text-zinc-500 mb-0.5">Última mensagem:</p>
            <p className="text-xs text-zinc-400 line-clamp-2">{follower.last_message}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-2">
        <button
          onClick={() => onMessage(follower.username, displayName, frase)}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2',
            follower.messaged
              ? 'bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08]'
              : 'bg-emerald-500 hover:bg-emerald-400 text-black font-semibold shadow-lg shadow-emerald-500/25',
            'rounded-xl text-xs',
            'active:scale-[0.97]',
            'transition-all duration-200',
          )}
        >
          <Send size={13} />
          {follower.messaged ? 'Reenviar' : 'Enviar DM'}
        </button>
      </div>
    </div>
  );
}
