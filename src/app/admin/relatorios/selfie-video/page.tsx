'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Check,
  Download,
  FileText,
  Film,
  Filter,
  Loader2,
  MessageCircle,
  MousePointerClick,
  RefreshCw,
  Search,
  Sparkles,
  Video,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminBackLink } from '@/components/AdminBackLink';

interface BaseModelOption {
  id: string;
  slug: string | null;
  display_name: string | null;
  name: string;
  is_active: boolean;
  video_strategy: string | null;
}

interface ReportItem {
  id: string;
  name: string;
  phone: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  whatsappSent: boolean;
  whatsappSentAt: string | null;
  whatsappButtonClickedAt: string | null;
  videoStrategy: string | null;
  category: string | null;
  firstName: string | null;
  cachedFrom: string | null;
  hasFinalVideo: boolean;
  hasLipsyncOnly: boolean;
  hasSelfie: boolean;
  hasTranscription: boolean;
  retryCount: number;
  baseModelId: string | null;
  baseModelSlug: string | null;
  baseModelName: string | null;
}

interface ReportSummary {
  total: number;
  totalInDb: number;
  completed: number;
  failed: number;
  inProgress: number;
  whatsappSent: number;
  whatsappClicked: number;
  cached: number;
  hasFinalVideo: number;
  hasLipsyncOnly: number;
  recordingOnly: number;
}

interface ReportData {
  filters: {
    baseModelId: string | null;
    status: string | null;
    strategy: string | null;
    from: string | null;
    to: string | null;
    search: string | null;
    limit: number;
  };
  baseModels: BaseModelOption[];
  summary: ReportSummary;
  byStatus: { status: string; count: number }[];
  byStrategy: { strategy: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byProgress: { progress: string; count: number }[];
  byDay: { date: string; count: number }[];
  items: ReportItem[];
}

const STATUS_LABELS: Record<string, string> = {
  recording: 'Gravando',
  queued: 'Na fila',
  transcribing: 'Transcrevendo',
  generating_text: 'Gerando texto',
  generating_tts: 'Gerando voz',
  generating_lipsync: 'Lip-sync',
  composing: 'Compondo',
  sending: 'Enviando',
  completed: 'Concluído',
  failed: 'Falhou',
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  queued: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  recording: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  transcribing: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  generating_text: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  generating_tts: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  generating_lipsync: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  composing: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  sending: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const STRATEGY_LABELS: Record<string, string> = {
  name_sync: 'Sync do nome (curto)',
  full_video: 'Vídeo completo',
  unknown: 'Sem estratégia',
};

const PROGRESS_LABELS: Record<string, string> = {
  completo_enviado: 'Completo + enviado',
  completo_nao_enviado: 'Completo, sem envio',
  video_pronto_pendente: 'Vídeo pronto, finalizando',
  so_inicio_gravando: 'Só o início (gravando)',
  em_processo: 'Em processo',
  falhou: 'Falhou',
};

const PROGRESS_COLORS: Record<string, string> = {
  completo_enviado: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  completo_nao_enviado: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  video_pronto_pendente: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  so_inicio_gravando: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
  em_processo: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  falhou: 'text-red-400 bg-red-500/10 border-red-500/20',
};

function statusLabel(s: string) {
  return STATUS_LABELS[s] ?? s;
}

function statusBadge(s: string) {
  return STATUS_COLORS[s] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
}

function progressForRow(it: ReportItem): string {
  if (it.status === 'completed' && it.whatsappSent) return 'completo_enviado';
  if (it.status === 'completed') return 'completo_nao_enviado';
  if (it.status === 'failed') return 'falhou';
  if (it.hasFinalVideo) return 'video_pronto_pendente';
  if (it.status === 'recording') return 'so_inicio_gravando';
  return 'em_processo';
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: 'emerald' | 'sky' | 'amber' | 'violet' | 'rose' | 'zinc';
}) {
  const accentMap = {
    emerald: 'bg-emerald-500/10 text-emerald-400',
    sky: 'bg-sky-500/10 text-sky-400',
    amber: 'bg-amber-500/10 text-amber-400',
    violet: 'bg-violet-500/10 text-violet-400',
    rose: 'bg-rose-500/10 text-rose-400',
    zinc: 'bg-zinc-500/10 text-zinc-400',
  };
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-2 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-300">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span>
        <div className={cn('p-2 rounded-xl', accentMap[accent])}>
          <Icon size={16} />
        </div>
      </div>
      <span className="text-3xl font-bold text-white tracking-tight tabular-nums">{value}</span>
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((value, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end">
          <div
            className={cn('w-full rounded-sm transition-all bg-emerald-400', value === 0 ? 'opacity-20' : 'opacity-90')}
            style={{ height: `${(value / max) * 100}%`, minHeight: value > 0 ? '3px' : '2px' }}
            title={`${value}`}
          />
        </div>
      ))}
    </div>
  );
}

function BreakdownBar({
  label,
  count,
  total,
  badgeClass,
}: {
  label: string;
  count: number;
  total: number;
  badgeClass?: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium',
            badgeClass ?? 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20',
          )}
        >
          {label}
        </span>
        <span className="text-zinc-400 tabular-nums">
          {count} <span className="text-zinc-600">({pct}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-400/60 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function RelatorioSelfieVideoPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [baseModelId, setBaseModelId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [strategy, setStrategy] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');

  const buildQuery = useCallback(
    (overrides?: Partial<{ format: string }>) => {
      const params = new URLSearchParams();
      if (baseModelId) params.set('baseModelId', baseModelId);
      if (status) params.set('status', status);
      if (strategy) params.set('strategy', strategy);
      if (fromDate) params.set('from', new Date(fromDate).toISOString());
      if (toDate) {
        // Inclui o dia inteiro
        const t = new Date(toDate);
        t.setHours(23, 59, 59, 999);
        params.set('to', t.toISOString());
      }
      if (search) params.set('q', search);
      if (overrides?.format) params.set('format', overrides.format);
      params.set('limit', '2000');
      return params.toString();
    },
    [baseModelId, status, strategy, fromDate, toDate, search],
  );

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const qs = buildQuery();
      const res = await fetch(`/api/admin/relatorios/selfie-video?${qs}`, { cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `Erro ${res.status}`);
      }
      const j = (await res.json()) as ReportData;
      setData(j);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar relatório');
    }
  }, [buildQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchData().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  function clearFilters() {
    setBaseModelId('');
    setStatus('');
    setStrategy('');
    setFromDate('');
    setToDate('');
    setSearch('');
    setSearchInput('');
  }

  function downloadCsv() {
    const qs = buildQuery({ format: 'csv' });
    window.location.href = `/api/admin/relatorios/selfie-video?${qs}`;
  }

  const baseModels = useMemo(() => data?.baseModels ?? [], [data?.baseModels]);
  const items = data?.items ?? [];
  const summary = data?.summary;
  const selectedCandidate = useMemo(
    () => baseModels.find((m) => m.id === baseModelId) ?? null,
    [baseModels, baseModelId],
  );

  const hasActiveFilters =
    !!baseModelId || !!status || !!strategy || !!fromDate || !!toDate || !!search;

  return (
    <div className="min-h-screen bg-black">
      <div className="fixed -top-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <AdminBackLink />
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight flex items-center gap-3">
                <FileText size={28} className="text-emerald-400" />
                Relatório Selfie-Vídeo
              </h1>
              <p className="text-zinc-500 mt-1">
                Histórico e estatísticas por candidato — completos, parciais, enviados e falhas
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={downloadCsv}
                disabled={loading || items.length === 0}
                className={cn(
                  'inline-flex items-center gap-2 px-5 py-2.5',
                  'bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm',
                  'rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30',
                  'active:scale-[0.97] transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
                )}
              >
                <Download size={14} />
                Baixar CSV
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 rounded-xl hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors duration-200 disabled:opacity-50"
                title="Atualizar"
              >
                <RefreshCw size={16} className={cn(refreshing && 'animate-spin')} />
              </button>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={16} className="text-zinc-400" />
            <h2 className="text-sm font-semibold text-white">Filtros</h2>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-white transition-colors"
              >
                <X size={12} />
                Limpar
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Candidato</label>
              <select
                value={baseModelId}
                onChange={(e) => setBaseModelId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
              >
                <option value="">Todos os candidatos</option>
                {baseModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name || m.name}
                    {m.slug ? ` (${m.slug})` : ''}
                    {m.is_active ? '' : ' — inativo'}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
              >
                <option value="">Todos os status</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Estratégia</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
              >
                <option value="">Todas</option>
                <option value="name_sync">Sync do nome (curto)</option>
                <option value="full_video">Vídeo completo</option>
              </select>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Buscar nome/telefone</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Ex.: João, 5511..."
                  className="w-full pl-9 pr-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                />
              </div>
            </form>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">De</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Até</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
              />
            </div>
          </div>

          {selectedCandidate && (
            <div className="mt-4 flex items-center gap-2 text-xs text-zinc-400">
              <span className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {selectedCandidate.display_name || selectedCandidate.name}
              </span>
              {selectedCandidate.video_strategy && (
                <span className="text-zinc-500">
                  estratégia padrão: <span className="text-zinc-300">{STRATEGY_LABELS[selectedCandidate.video_strategy] ?? selectedCandidate.video_strategy}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Conteúdo */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-zinc-400">
              <Loader2 size={20} className="animate-spin" />
              <span>Carregando relatório...</span>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-400" />
            <span className="text-sm text-red-300">{error}</span>
          </div>
        ) : (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard
                label="Total"
                value={summary?.total ?? 0}
                hint={summary && summary.totalInDb > summary.total ? `${summary.totalInDb} no total (limite ${data?.filters.limit})` : 'no filtro'}
                icon={Film}
                accent="zinc"
              />
              <StatCard
                label="Completos"
                value={summary?.completed ?? 0}
                hint="status = completed"
                icon={Check}
                accent="emerald"
              />
              <StatCard
                label="WhatsApp"
                value={summary?.whatsappSent ?? 0}
                hint="entregues"
                icon={MessageCircle}
                accent="emerald"
              />
              <StatCard
                label="Em proc."
                value={summary?.inProgress ?? 0}
                hint="pipeline ativo"
                icon={Activity}
                accent="amber"
              />
              <StatCard
                label="Falhas"
                value={summary?.failed ?? 0}
                hint="status = failed"
                icon={AlertCircle}
                accent="rose"
              />
              <StatCard
                label="Cacheados"
                value={summary?.cached ?? 0}
                hint="reusaram vídeo"
                icon={Sparkles}
                accent="violet"
              />
            </div>

            {/* Sub stats — detalhes de progressão */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="Só gravação"
                value={summary?.recordingOnly ?? 0}
                hint="início enviado, sem processar"
                icon={Video}
                accent="zinc"
              />
              <StatCard
                label="Lipsync prontos"
                value={summary?.hasLipsyncOnly ?? 0}
                hint="só lipsync, falta compose"
                icon={Zap}
                accent="amber"
              />
              <StatCard
                label="Vídeo final pronto"
                value={summary?.hasFinalVideo ?? 0}
                hint="composição concluída"
                icon={Film}
                accent="sky"
              />
              <StatCard
                label="Clicaram no link"
                value={summary?.whatsappClicked ?? 0}
                hint="botão pós-envio"
                icon={MousePointerClick}
                accent="violet"
              />
            </div>

            {/* Breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Por progresso */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <BarChart3 size={14} className="text-emerald-400" />
                  Estado da geração
                </h3>
                <div className="space-y-3">
                  {(data?.byProgress ?? []).map((b) => (
                    <BreakdownBar
                      key={b.progress}
                      label={PROGRESS_LABELS[b.progress] ?? b.progress}
                      count={b.count}
                      total={summary?.total ?? 0}
                      badgeClass={PROGRESS_COLORS[b.progress]}
                    />
                  ))}
                  {(data?.byProgress ?? []).length === 0 && (
                    <p className="text-xs text-zinc-500">Sem dados</p>
                  )}
                </div>
              </div>

              {/* Por status */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Activity size={14} className="text-sky-400" />
                  Por status do pipeline
                </h3>
                <div className="space-y-3">
                  {(data?.byStatus ?? []).map((b) => (
                    <BreakdownBar
                      key={b.status}
                      label={statusLabel(b.status)}
                      count={b.count}
                      total={summary?.total ?? 0}
                      badgeClass={statusBadge(b.status)}
                    />
                  ))}
                  {(data?.byStatus ?? []).length === 0 && (
                    <p className="text-xs text-zinc-500">Sem dados</p>
                  )}
                </div>
              </div>

              {/* Por estratégia */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Zap size={14} className="text-amber-400" />
                  Por estratégia
                </h3>
                <div className="space-y-3">
                  {(data?.byStrategy ?? []).map((b) => (
                    <BreakdownBar
                      key={b.strategy}
                      label={STRATEGY_LABELS[b.strategy] ?? b.strategy}
                      count={b.count}
                      total={summary?.total ?? 0}
                      badgeClass={
                        b.strategy === 'full_video'
                          ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                          : b.strategy === 'name_sync'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20'
                      }
                    />
                  ))}
                  {(data?.byStrategy ?? []).length === 0 && (
                    <p className="text-xs text-zinc-500">Sem dados</p>
                  )}
                </div>
              </div>
            </div>

            {/* Sparkline diária */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Volume nos últimos 30 dias</h3>
                <span className="text-xs text-zinc-500">{summary?.total ?? 0} no filtro atual</span>
              </div>
              <Sparkline data={(data?.byDay ?? []).map((d) => d.count)} />
              <div className="flex justify-between mt-1 text-[10px] text-zinc-600">
                <span>30d atrás</span>
                <span>{toDate || 'hoje'}</span>
              </div>
            </div>

            {/* Tabela */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white tracking-tight">
                  Histórico detalhado
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    {items.length} registro{items.length === 1 ? '' : 's'}
                  </span>
                </h2>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
                      <Film size={28} className="text-zinc-600" />
                    </div>
                    <p className="text-zinc-500 text-sm">Nenhum registro para os filtros selecionados</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Eleitor</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Candidato</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Status</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Progresso</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Estratégia</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Tema</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">WA</th>
                          <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Criado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {items.map((it) => {
                          const prog = progressForRow(it);
                          return (
                            <tr key={it.id} className="hover:bg-white/[0.03] transition-colors duration-150">
                              <td className="px-4 py-3">
                                <div className="font-medium text-white text-sm">{it.name}</div>
                                <div className="text-[11px] text-zinc-500">{it.phone}</div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm text-zinc-300">{it.baseModelName ?? '—'}</div>
                                {it.baseModelSlug && (
                                  <div className="text-[10px] text-zinc-600">{it.baseModelSlug}</div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium', statusBadge(it.status))}>
                                  {statusLabel(it.status)}
                                </span>
                                {it.status === 'failed' && it.errorMessage && (
                                  <p className="mt-1 text-[10px] text-red-400/70 line-clamp-1 max-w-[200px]" title={it.errorMessage}>
                                    {it.errorMessage}
                                  </p>
                                )}
                                {it.retryCount > 0 && (
                                  <p className="mt-1 text-[10px] text-amber-400/80">
                                    {it.retryCount} retry{it.retryCount === 1 ? '' : 's'}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium', PROGRESS_COLORS[prog])}>
                                  {PROGRESS_LABELS[prog] ?? prog}
                                </span>
                                {it.cachedFrom && (
                                  <p className="mt-1 text-[10px] text-violet-400/80 flex items-center gap-1">
                                    <Sparkles size={9} /> cacheado
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs text-zinc-400">
                                {it.videoStrategy ? STRATEGY_LABELS[it.videoStrategy] ?? it.videoStrategy : '—'}
                              </td>
                              <td className="px-4 py-3 text-xs text-zinc-400">
                                {it.category ?? '—'}
                              </td>
                              <td className="px-4 py-3">
                                {it.whatsappSent ? (
                                  <div className="flex flex-col">
                                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                                      <Check size={10} /> enviado
                                    </span>
                                    {it.whatsappButtonClickedAt && (
                                      <span className="text-[10px] text-violet-400 flex items-center gap-1">
                                        <MousePointerClick size={9} /> clicou
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-zinc-600">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-[11px] text-zinc-400">{formatDateTime(it.createdAt)}</div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
