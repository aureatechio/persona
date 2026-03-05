'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ArrowLeft, RefreshCw, Radio, Sparkles, Zap } from 'lucide-react';
import { AccountSelector } from '@/components/central-mensagens/AccountSelector';
import { StatsGrid } from '@/components/central-mensagens/StatsGrid';
import { Charts } from '@/components/central-mensagens/Charts';
import { FilterBar, EMPTY_MESSAGE_FILTERS, type MessageFilters } from '@/components/central-mensagens/FilterBar';
import { MessageTable, type MessageRow } from '@/components/central-mensagens/MessageTable';
import { MessageDetailDrawer } from '@/components/central-mensagens/MessageDetailDrawer';

interface Account {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  follower_count: number;
  analyzed_count: number;
}

interface StatsData {
  total_analyzed: number;
  total_messaged: number;
  total_followed: number;
  reach_rate: number;
  messages_by_day: Array<{ date: string; count: number }>;
  distribution_by_grupo: Array<{ grupo: string; count: number }>;
  messages_by_status: Array<{ status: string; count: number }>;
  accounts: Account[];
}

export default function CentralMensagensPage() {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalMessages, setTotalMessages] = useState(0);
  const perPage = 30;

  const [filters, setFilters] = useState<MessageFilters>({ ...EMPTY_MESSAGE_FILTERS });
  const [drawerUsername, setDrawerUsername] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedAccountId) params.set('account_id', selectedAccountId);
      const res = await fetch(`/api/central-mensagens/stats?${params}`);
      const data = await res.json();
      setStats(data);
    } catch {
      // silent
    } finally {
      setStatsLoading(false);
    }
  }, [selectedAccountId]);

  const fetchMessages = useCallback(async () => {
    setMessagesLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedAccountId) params.set('account_id', selectedAccountId);
      if (filters.status.length === 1) params.set('status', filters.status[0]);
      if (filters.grupo) params.set('grupo', filters.grupo);
      if (filters.dateFrom) params.set('date_from', filters.dateFrom);
      if (filters.dateTo) params.set('date_to', filters.dateTo);
      if (filters.search) params.set('search', filters.search);
      params.set('page', String(page));
      params.set('per_page', String(perPage));

      const res = await fetch(`/api/central-mensagens/messages?${params}`);
      const data = await res.json();
      setMessages(data.messages || []);
      setTotalMessages(data.total || 0);
    } catch {
      // silent
    } finally {
      setMessagesLoading(false);
    }
  }, [selectedAccountId, filters, page]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchMessages(); }, [fetchMessages]);
  useEffect(() => { setPage(1); }, [selectedAccountId, filters]);

  const totalPages = Math.max(1, Math.ceil(totalMessages / perPage));

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchMessages()]);
    setRefreshing(false);
  };

  const handleResend = async (username: string, message: string) => {
    try {
      await fetch('/api/instagram-mapping/send-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUsername: username, message }),
      });
      fetchStats();
      fetchMessages();
      setDrawerUsername(null);
    } catch {
      // silent
    }
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* ─── Background Effects ─── */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Animated glow orbs */}
        <div className="absolute -top-[300px] -right-[200px] w-[600px] h-[600px] bg-emerald-500/[0.04] rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-[40%] -left-[200px] w-[500px] h-[500px] bg-violet-500/[0.03] rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute -bottom-[200px] right-[20%] w-[400px] h-[400px] bg-sky-500/[0.03] rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '10s' }} />

        {/* Dot grid */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.015)_1px,_transparent_0)] bg-[size:32px_32px]" />

        {/* Top gradient fade */}
        <div className="absolute top-0 inset-x-0 h-[400px] bg-gradient-to-b from-emerald-500/[0.02] via-transparent to-transparent" />
      </div>

      {/* ─── Sticky Header ─── */}
      <div className="sticky top-0 z-40 bg-black/60 backdrop-blur-2xl border-b border-white/[0.04]">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: back + title */}
            <div className="flex items-center gap-4">
              <Link
                href="/mapeamento-instagram"
                className={cn(
                  'p-2 rounded-xl',
                  'bg-white/[0.03] hover:bg-white/[0.07]',
                  'border border-white/[0.04] hover:border-white/[0.1]',
                  'text-zinc-500 hover:text-white',
                  'transition-all duration-200',
                )}
              >
                <ArrowLeft size={16} />
              </Link>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-violet-500/20 border border-white/[0.08] flex items-center justify-center">
                    <Radio size={16} className="text-emerald-400" />
                  </div>
                  {/* Live indicator */}
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 ring-2 ring-black" />
                  </span>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white tracking-tight leading-tight">
                    Central de Monitoramento
                  </h1>
                  <p className="text-[11px] text-zinc-600 leading-tight">
                    Disparos em tempo real
                  </p>
                </div>
              </div>
            </div>

            {/* Right: refresh + account */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className={cn(
                  'p-2.5 rounded-xl',
                  'bg-white/[0.03] hover:bg-white/[0.07]',
                  'border border-white/[0.04] hover:border-white/[0.1]',
                  'text-zinc-500 hover:text-white',
                  'transition-all duration-200',
                  'disabled:opacity-50',
                )}
                title="Atualizar dados"
              >
                <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
              </button>
              <AccountSelector
                accounts={stats?.accounts || []}
                selectedAccountId={selectedAccountId}
                onSelect={setSelectedAccountId}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 py-8 space-y-8">
        {/* Stats */}
        <StatsGrid
          totalAnalyzed={stats?.total_analyzed || 0}
          totalMessaged={stats?.total_messaged || 0}
          totalFollowed={stats?.total_followed || 0}
          reachRate={stats?.reach_rate || 0}
          loading={statsLoading}
        />

        {/* Charts */}
        <Charts
          messagesByDay={stats?.messages_by_day || []}
          distributionByGrupo={stats?.distribution_by_grupo || []}
          messagesByStatus={stats?.messages_by_status || []}
          loading={statsLoading}
        />

        {/* Divider with glow */}
        <div className="relative py-2">
          <div className="h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
          <div className="absolute inset-0 h-px bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent blur-sm" />
        </div>

        {/* Filters */}
        <FilterBar filters={filters} onChange={setFilters} />

        {/* Message table */}
        <MessageTable
          messages={messages}
          loading={messagesLoading}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onViewProfile={(username) => setDrawerUsername(username)}
          onResend={(msg) => handleResend(msg.target_username, msg.message_content)}
        />
      </div>

      {/* Detail drawer */}
      <MessageDetailDrawer
        username={drawerUsername}
        onClose={() => setDrawerUsername(null)}
        onResend={handleResend}
      />
    </div>
  );
}
