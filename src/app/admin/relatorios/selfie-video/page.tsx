'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Film,
  Filter,
  Loader2,
  Lock,
  MessageCircle,
  MousePointerClick,
  Phone,
  RefreshCw,
  Search,
  Send,
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

interface ThemeOption {
  slug: string;
  label: string;
}

interface ReportItem {
  id: string;
  name: string;
  phone: string;
  firstName: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  transcription: string | null;
  themeSlug: string | null;
  generatedText: string | null;
  videoStrategy: string | null;
  category: string | null;
  hasSelfie: boolean;
  hasTts: boolean;
  hasLipsync: boolean;
  hasFinalVideo: boolean;
  finalVideoPath: string | null;
  cachedFrom: string | null;
  isCached: boolean;
  whatsappSent: boolean;
  whatsappSentAt: string | null;
  whatsappProvider: string | null;
  whatsappButtonClickedAt: string | null;
  isLocked: boolean;
  lockedAt: string | null;
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
  whatsappOfficial: number;
  whatsappUazapi: number;
  cached: number;
  hasFinalVideo: number;
  hasLipsync: number;
  recordingOnly: number;
  locked: number;
}

interface ReportData {
  pipeline: string;
  filters: {
    baseModelId: string | null;
    status: string | null;
    strategy: string | null;
    theme: string | null;
    whatsapp: string | null;
    from: string | null;
    to: string | null;
    search: string | null;
    limit: number;
  };
  baseModels: BaseModelOption[];
  themes: ThemeOption[];
  summary: ReportSummary;
  byStatus: { status: string; count: number }[];
  byStrategy: { strategy: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byTheme: { theme: string; count: number }[];
  byProgress: { progress: string; count: number }[];
  byProvider: { provider: string; count: number }[];
  byDay: { date: string; count: number }[];
  items: ReportItem[];
}

const STATUS_LABELS: Record<string, string> = {
  recording: 'Gravando',
  uploading: 'Enviando',
  queued: 'Na fila',
  transcribing: 'Transcrevendo',
  generating_text: 'Gerando texto',
  generating_tts: 'Gerando voz',
  generating_lipsync: 'Lip-sync',
  composing: 'Compondo',
  sending: 'Enviando WA',
  completed: 'Concluido',
  failed: 'Falhou',
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
  queued: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  recording: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  uploading: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  transcribing: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  generating_text: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  generating_tts: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  generating_lipsync: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  composing: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  sending: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

const STRATEGY_LABELS: Record<string, string> = {
  name_sync: 'Sync do nome (curto)',
  full_video: 'Video completo',
  unknown: 'Sem estrategia',
};

const PROGRESS_LABELS: Record<string, string> = {
  completo_enviado: 'Completo + enviado',
  completo_nao_enviado: 'Completo, sem envio',
  video_pronto_pendente: 'Video pronto, finalizando',
  so_inicio_gravando: 'So o inicio (gravando)',
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

const PROVIDER_LABELS: Record<string, string> = {
  official: 'Meta Cloud API',
  uazapi: 'UAZAPI',
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

const OPTION_CLASS = 'bg-zinc-900 text-white';

function formatDateTime(iso: string | null) {
  if (!iso) return '\u2014';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return 'agora';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
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

function PipelineDots({ item }: { item: ReportItem }) {
  const steps = [
    { key: 'selfie', done: item.hasSelfie, label: 'Selfie' },
    { key: 'tts', done: item.hasTts, label: 'TTS' },
    { key: 'lipsync', done: item.hasLipsync, label: 'Lipsync' },
    { key: 'video', done: item.hasFinalVideo, label: 'Video' },
    { key: 'wa', done: item.whatsappSent, label: 'WhatsApp' },
  ];
  return (
    <div className="flex items-center gap-1" title={steps.map((s) => `${s.label}: ${s.done ? 'OK' : '-'}`).join(' | ')}>
      {steps.map((s) => (
        <div
          key={s.key}
          className={cn(
            'w-2 h-2 rounded-full transition-colors',
            s.done ? 'bg-emerald-400' : 'bg-zinc-700',
          )}
        />
      ))}
    </div>
  );
}

function ExpandedRow({ item }: { item: ReportItem }) {
  return (
    <tr className="bg-white/[0.02]">
      <td colSpan={9} className="px-4 py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Dados do eleitor */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Eleitor</h4>
            <div className="flex items-center gap-2">
              <Phone size={11} className="text-zinc-500" />
              <span className="text-zinc-300">{item.phone}</span>
            </div>
            <div>
              <span className="text-zinc-500">Nome detectado: </span>
              <span className="text-zinc-300">{item.firstName ?? '\u2014'}</span>
            </div>
            <div>
              <span className="text-zinc-500">Criado: </span>
              <span className="text-zinc-300">{formatDateTime(item.createdAt)}</span>
            </div>
            <div>
              <span className="text-zinc-500">Atualizado: </span>
              <span className="text-zinc-300">{formatDateTime(item.updatedAt)}</span>
            </div>
            {item.retryCount > 0 && (
              <div>
                <span className="text-amber-400">{item.retryCount} tentativa{item.retryCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Transcricao e classificacao */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Processamento</h4>
            {item.transcription && (
              <div>
                <span className="text-zinc-500 block mb-1">Transcricao:</span>
                <p className="text-zinc-300 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 line-clamp-4 leading-relaxed">
                  {item.transcription}
                </p>
              </div>
            )}
            <div>
              <span className="text-zinc-500">Tema: </span>
              <span className="text-zinc-300">{item.themeSlug ?? '\u2014'}</span>
            </div>
            <div>
              <span className="text-zinc-500">Categoria: </span>
              <span className="text-zinc-300">{item.category ?? '\u2014'}</span>
            </div>
            {item.isCached && (
              <div className="inline-flex items-center gap-1 text-violet-400">
                <Sparkles size={11} /> Reusou cache
                {item.cachedFrom && <span className="text-zinc-500 text-[10px]">({item.cachedFrom.slice(0, 8)})</span>}
              </div>
            )}
          </div>

          {/* WhatsApp delivery */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">Entrega WhatsApp</h4>
            {item.whatsappSent ? (
              <>
                <div className="flex items-center gap-2 text-emerald-400">
                  <Check size={12} />
                  <span>Enviado</span>
                </div>
                <div>
                  <span className="text-zinc-500">Quando: </span>
                  <span className="text-zinc-300">{formatDateTime(item.whatsappSentAt)}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Provedor: </span>
                  <span className={cn(
                    'inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium',
                    item.whatsappProvider === 'official'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                  )}>
                    {PROVIDER_LABELS[item.whatsappProvider ?? ''] ?? item.whatsappProvider ?? '\u2014'}
                  </span>
                </div>
                {item.whatsappButtonClickedAt ? (
                  <div className="flex items-center gap-2 text-violet-400">
                    <MousePointerClick size={12} />
                    <span>Clicou em {formatDateTime(item.whatsappButtonClickedAt)}</span>
                  </div>
                ) : (
                  <div className="text-zinc-600 text-[10px]">Nao clicou no botao</div>
                )}
              </>
            ) : (
              <div className="text-zinc-600">Nao enviado</div>
            )}
            {item.errorMessage && (
              <div className="mt-2">
                <span className="text-red-400 text-[10px] block mb-1">Erro:</span>
                <p className="text-red-300/70 bg-red-500/5 border border-red-500/10 rounded-xl p-3 text-[11px] break-all">
                  {item.errorMessage}
                </p>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function RelatorioSelfieVideoPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [baseModelId, setBaseModelId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [strategy, setStrategy] = useState<string>('');
  const [themeSlug, setThemeSlug] = useState<string>('');
  const [whatsappFilter, setWhatsappFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');

  const buildQuery = useCallback(
    (overrides?: Partial<{ format: string }>) => {
      const params = new URLSearchParams();
      params.set('pipeline', 'v2');
      if (baseModelId) params.set('baseModelId', baseModelId);
      if (status) params.set('status', status);
      if (strategy) params.set('strategy', strategy);
      if (themeSlug) params.set('theme', themeSlug);
      if (whatsappFilter) params.set('whatsapp', whatsappFilter);
      if (fromDate) params.set('from', new Date(fromDate).toISOString());
      if (toDate) {
        const t = new Date(toDate);
        t.setHours(23, 59, 59, 999);
        params.set('to', t.toISOString());
      }
      if (search) params.set('q', search);
      if (overrides?.format) params.set('format', overrides.format);
      params.set('limit', '2000');
      return params.toString();
    },
    [baseModelId, status, strategy, themeSlug, whatsappFilter, fromDate, toDate, search],
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
      setError(err instanceof Error ? err.message : 'Erro ao carregar relatorio');
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

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData();
    }, 30000);
    return () => clearInterval(interval);
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
    setThemeSlug('');
    setWhatsappFilter('');
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
  const themes = useMemo(() => data?.themes ?? [], [data?.themes]);
  const items = data?.items ?? [];
  const summary = data?.summary;

  const hasActiveFilters =
    !!baseModelId || !!status || !!strategy || !!themeSlug || !!whatsappFilter || !!fromDate || !!toDate || !!search;

  const deliveryRate = summary && summary.completed > 0
    ? Math.round((summary.whatsappSent / summary.completed) * 100)
    : 0;

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
                Observabilidade V2
              </h1>
              <p className="text-zinc-500 mt-1">
                Pipeline V2 — quem enviou, o que recebeu, se recebeu. Auto-refresh 30s.
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
                CSV
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 rounded-xl hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors duration-200 disabled:opacity-50"
                title="Atualizar agora"
              >
                <RefreshCw size={16} className={cn(refreshing && 'animate-spin')} />
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
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
                <option className={OPTION_CLASS} value="">Todos</option>
                {baseModels.map((m) => (
                  <option className={OPTION_CLASS} key={m.id} value={m.id}>
                    {m.display_name || m.name}
                    {m.slug ? ` (${m.slug})` : ''}
                    {m.is_active ? '' : ' \u2014 inativo'}
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
                <option className={OPTION_CLASS} value="">Todos</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option className={OPTION_CLASS} key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Tema</label>
              <select
                value={themeSlug}
                onChange={(e) => setThemeSlug(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
              >
                <option className={OPTION_CLASS} value="">Todos os temas</option>
                {themes.map((t) => (
                  <option className={OPTION_CLASS} key={t.slug} value={t.slug}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">WhatsApp</label>
              <select
                value={whatsappFilter}
                onChange={(e) => setWhatsappFilter(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
              >
                <option className={OPTION_CLASS} value="">Todos</option>
                <option className={OPTION_CLASS} value="sent">Enviados</option>
                <option className={OPTION_CLASS} value="not_sent">Nao enviados</option>
                <option className={OPTION_CLASS} value="clicked">Clicaram no botao</option>
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
                  placeholder="Joao, 5592..."
                  className="w-full pl-9 pr-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                />
              </div>
            </form>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Estrategia</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
              >
                <option className={OPTION_CLASS} value="">Todas</option>
                <option className={OPTION_CLASS} value="name_sync">Sync do nome</option>
                <option className={OPTION_CLASS} value="full_video">Video completo</option>
              </select>
            </div>

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
              <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Ate</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-zinc-400">
              <Loader2 size={20} className="animate-spin" />
              <span>Carregando...</span>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 flex items-center gap-3">
            <AlertCircle size={18} className="text-red-400" />
            <span className="text-sm text-red-300">{error}</span>
          </div>
        ) : (
          <>
            {/* Primary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard
                label="Total"
                value={summary?.total ?? 0}
                hint={summary && summary.totalInDb > summary.total ? `${summary.totalInDb} no banco` : 'pedidos'}
                icon={Film}
                accent="zinc"
              />
              <StatCard
                label="Completos"
                value={summary?.completed ?? 0}
                hint={`${deliveryRate}% taxa entrega`}
                icon={Check}
                accent="emerald"
              />
              <StatCard
                label="WA Enviados"
                value={summary?.whatsappSent ?? 0}
                hint={`${summary?.whatsappOfficial ?? 0} oficial / ${summary?.whatsappUazapi ?? 0} uazapi`}
                icon={Send}
                accent="emerald"
              />
              <StatCard
                label="Em processo"
                value={summary?.inProgress ?? 0}
                hint={summary?.locked ? `${summary.locked} travados` : 'pipeline ativo'}
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
                hint="reusaram video"
                icon={Sparkles}
                accent="violet"
              />
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard
                label="So gravacao"
                value={summary?.recordingOnly ?? 0}
                hint="inicio sem processar"
                icon={Video}
                accent="zinc"
              />
              <StatCard
                label="Lipsync prontos"
                value={summary?.hasLipsync ?? 0}
                hint="falta compose"
                icon={Zap}
                accent="amber"
              />
              <StatCard
                label="Video final"
                value={summary?.hasFinalVideo ?? 0}
                hint="composicao OK"
                icon={Film}
                accent="sky"
              />
              <StatCard
                label="Clicaram link"
                value={summary?.whatsappClicked ?? 0}
                hint="engajamento pos-envio"
                icon={MousePointerClick}
                accent="violet"
              />
            </div>

            {/* Breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Progress */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <BarChart3 size={14} className="text-emerald-400" />
                  Estado da geracao
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
                </div>
              </div>

              {/* Status */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Activity size={14} className="text-sky-400" />
                  Por status
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
                </div>
              </div>

              {/* Themes (top 8) */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <MessageCircle size={14} className="text-violet-400" />
                  Top temas
                </h3>
                <div className="space-y-3">
                  {(data?.byTheme ?? []).slice(0, 8).map((b) => (
                    <BreakdownBar
                      key={b.theme}
                      label={b.theme.replace(/_/g, ' ')}
                      count={b.count}
                      total={summary?.total ?? 0}
                      badgeClass="bg-violet-500/10 text-violet-400 border-violet-500/20"
                    />
                  ))}
                </div>
              </div>

              {/* WhatsApp providers */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Send size={14} className="text-emerald-400" />
                  Provedor WA
                </h3>
                <div className="space-y-3">
                  {(data?.byProvider ?? []).map((b) => (
                    <BreakdownBar
                      key={b.provider}
                      label={PROVIDER_LABELS[b.provider] ?? b.provider}
                      count={b.count}
                      total={summary?.whatsappSent ?? 0}
                      badgeClass={
                        b.provider === 'official'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }
                    />
                  ))}
                  {(data?.byProvider ?? []).length === 0 && (
                    <p className="text-xs text-zinc-500">Nenhum envio</p>
                  )}
                </div>
              </div>
            </div>

            {/* Sparkline */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">Volume 30 dias</h3>
                <span className="text-xs text-zinc-500">{summary?.total ?? 0} no filtro</span>
              </div>
              <Sparkline data={(data?.byDay ?? []).map((d) => d.count)} />
              <div className="flex justify-between mt-1 text-[10px] text-zinc-600">
                <span>30d atras</span>
                <span>{toDate || 'hoje'}</span>
              </div>
            </div>

            {/* Pedidos - Cards (mobile) / Table (desktop) */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white tracking-tight">
                  Pedidos detalhados
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    {items.length} registro{items.length === 1 ? '' : 's'}
                  </span>
                </h2>
              </div>

              {items.length === 0 ? (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
                    <Film size={28} className="text-zinc-600" />
                  </div>
                  <p className="text-zinc-500 text-sm">Nenhum registro para os filtros selecionados</p>
                </div>
              ) : (
                <>
                  {/* Mobile: Cards */}
                  <div className="md:hidden space-y-3">
                    {items.map((it) => {
                      const isExpanded = expandedId === it.id;
                      return (
                        <div
                          key={it.id}
                          className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden"
                        >
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : it.id)}
                            className="w-full p-4 text-left"
                          >
                            {/* Top row: name + status */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="min-w-0">
                                <div className="font-medium text-white text-sm truncate">{it.name}</div>
                                <div className="text-[11px] text-zinc-500">{it.phone}</div>
                              </div>
                              <span className={cn('shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium', statusBadge(it.status))}>
                                {statusLabel(it.status)}
                              </span>
                            </div>

                            {/* Middle: pipeline dots + theme */}
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <PipelineDots item={it} />
                              <span className="text-[11px] text-zinc-400 truncate max-w-[140px]">
                                {it.themeSlug?.replace(/_/g, ' ') ?? ''}
                              </span>
                            </div>

                            {/* Bottom: WA status + provider + time */}
                            <div className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-2">
                                {it.whatsappSent ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-400">
                                    <Check size={10} /> enviado
                                    {it.whatsappProvider && (
                                      <span className={cn(
                                        'ml-1 px-1.5 py-0.5 rounded-full border text-[9px] font-medium',
                                        it.whatsappProvider === 'official'
                                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                                      )}>
                                        {it.whatsappProvider === 'official' ? 'Meta' : 'UAZAPI'}
                                      </span>
                                    )}
                                  </span>
                                ) : it.status === 'completed' ? (
                                  <span className="text-amber-400">nao enviou</span>
                                ) : (
                                  <span className="text-zinc-600">{'\u2014'}</span>
                                )}
                                {it.whatsappButtonClickedAt && (
                                  <MousePointerClick size={10} className="text-violet-400" />
                                )}
                                {it.isLocked && <Lock size={10} className="text-amber-400" />}
                              </div>
                              <span className="text-zinc-500">{formatRelative(it.createdAt)}</span>
                            </div>
                          </button>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <div className="border-t border-white/[0.06] p-4 space-y-3 text-xs">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <span className="text-zinc-500 block text-[10px] uppercase tracking-wider mb-1">Candidato</span>
                                  <span className="text-zinc-300">{it.baseModelName ?? '\u2014'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 block text-[10px] uppercase tracking-wider mb-1">Estrategia</span>
                                  <span className="text-zinc-300">{STRATEGY_LABELS[it.videoStrategy ?? ''] ?? '\u2014'}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 block text-[10px] uppercase tracking-wider mb-1">Criado</span>
                                  <span className="text-zinc-300">{formatDateTime(it.createdAt)}</span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 block text-[10px] uppercase tracking-wider mb-1">Atualizado</span>
                                  <span className="text-zinc-300">{formatDateTime(it.updatedAt)}</span>
                                </div>
                              </div>

                              {it.whatsappSent && (
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <span className="text-zinc-500 block text-[10px] uppercase tracking-wider mb-1">WA enviado em</span>
                                    <span className="text-zinc-300">{formatDateTime(it.whatsappSentAt)}</span>
                                  </div>
                                  <div>
                                    <span className="text-zinc-500 block text-[10px] uppercase tracking-wider mb-1">Clicou botao</span>
                                    <span className="text-zinc-300">
                                      {it.whatsappButtonClickedAt ? formatDateTime(it.whatsappButtonClickedAt) : 'Nao'}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {it.transcription && (
                                <div>
                                  <span className="text-zinc-500 block text-[10px] uppercase tracking-wider mb-1">Transcricao</span>
                                  <p className="text-zinc-300 bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 leading-relaxed">
                                    {it.transcription}
                                  </p>
                                </div>
                              )}

                              {it.isCached && (
                                <div className="inline-flex items-center gap-1 text-violet-400 text-[11px]">
                                  <Sparkles size={11} /> Reusou cache
                                </div>
                              )}

                              {it.errorMessage && (
                                <div>
                                  <span className="text-red-400 text-[10px] block mb-1">Erro:</span>
                                  <p className="text-red-300/70 bg-red-500/5 border border-red-500/10 rounded-xl p-3 text-[11px] break-all">
                                    {it.errorMessage}
                                  </p>
                                </div>
                              )}

                              {it.retryCount > 0 && (
                                <span className="text-amber-400 text-[11px]">{it.retryCount} tentativa{it.retryCount > 1 ? 's' : ''}</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop: Table */}
                  <div className="hidden md:block bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 w-8"></th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Eleitor</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Candidato</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Status</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pipeline</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Tema</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">WhatsApp</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Provedor</th>
                            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Quando</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                          {items.map((it) => {
                            const isExpanded = expandedId === it.id;
                            return (
                              <Fragment key={it.id}>
                                <tr
                                  onClick={() => setExpandedId(isExpanded ? null : it.id)}
                                  className={cn(
                                    'hover:bg-white/[0.03] transition-colors duration-150 cursor-pointer',
                                    isExpanded && 'bg-white/[0.02]',
                                  )}
                                >
                                  <td className="px-4 py-3">
                                    <button className="p-1 rounded-lg hover:bg-white/[0.08] text-zinc-500 hover:text-white transition-colors">
                                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="font-medium text-white text-sm">{it.name}</div>
                                    <div className="text-[11px] text-zinc-500">{it.phone}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm text-zinc-300">{it.baseModelName ?? '\u2014'}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium', statusBadge(it.status))}>
                                      {statusLabel(it.status)}
                                    </span>
                                    {it.isLocked && (
                                      <span className="ml-1 text-amber-400" title={`Travado desde ${formatDateTime(it.lockedAt)}`}>
                                        <Lock size={10} />
                                      </span>
                                    )}
                                    {it.retryCount > 0 && (
                                      <span className="ml-1 text-[10px] text-amber-400/80">{it.retryCount}x</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <PipelineDots item={it} />
                                  </td>
                                  <td className="px-4 py-3 text-xs text-zinc-400 max-w-[120px] truncate" title={it.themeSlug ?? undefined}>
                                    {it.themeSlug?.replace(/_/g, ' ') ?? '\u2014'}
                                  </td>
                                  <td className="px-4 py-3">
                                    {it.whatsappSent ? (
                                      <div className="flex items-center gap-1.5">
                                        <Check size={12} className="text-emerald-400" />
                                        {it.whatsappButtonClickedAt && (
                                          <MousePointerClick size={10} className="text-violet-400" />
                                        )}
                                      </div>
                                    ) : it.status === 'completed' ? (
                                      <span className="text-[10px] text-amber-400">nao enviou</span>
                                    ) : (
                                      <span className="text-[10px] text-zinc-600">{'\u2014'}</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    {it.whatsappProvider ? (
                                      <span className={cn(
                                        'inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium',
                                        it.whatsappProvider === 'official'
                                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                                      )}>
                                        {it.whatsappProvider === 'official' ? 'Meta' : 'UAZAPI'}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-zinc-600">{'\u2014'}</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-[11px] text-zinc-400" title={formatDateTime(it.createdAt)}>
                                      {formatRelative(it.createdAt)}
                                    </div>
                                  </td>
                                </tr>
                                {isExpanded && <ExpandedRow item={it} />}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
