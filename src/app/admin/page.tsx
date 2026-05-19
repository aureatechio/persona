'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  Film,
  Users,
  Clapperboard,
  Sparkles,
  Sliders,
  Check,
  AlertCircle,
  Loader2,
  TrendingUp,
  Play,
  RefreshCw,
  ArrowRight,
  Video,
  ChevronRight,
  X,
  ShoppingCart,
  Mic,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SourceMetrics {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  last7d: number;
  last24h: number;
  byStatus: { status: string; count: number }[];
  byDay: { date: string; count: number }[];
}

interface ActiveBaseModel {
  id: string;
  name: string;
  video_storage_path: string;
  created_at: string;
  voice_models: { name: string; elevenlabs_voice_id: string | null } | null;
}

interface DashboardData {
  selfie: SourceMetrics;
  supia: SourceMetrics;
  summary: {
    totalGenerated: number;
    totalAttempts: number;
    successRate: number;
    totalFailed: number;
    totalInProgress: number;
    last7d: number;
    last24h: number;
    usersCount: number;
  };
  activeBaseModel: ActiveBaseModel | null;
}

interface NormalizedVideo {
  id: string;
  source: 'selfie' | 'supia';
  title: string;
  subtitle: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  videoUrl: string | null;
  storagePath: string | null;
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

function statusBadge(status: string) {
  return STATUS_COLORS[status] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return 'agora';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d atrás`;
  return new Date(iso).toLocaleDateString('pt-BR');
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
  accent: 'emerald' | 'sky' | 'amber' | 'violet' | 'rose';
}) {
  const accentMap = {
    emerald: 'bg-emerald-500/10 text-emerald-400',
    sky: 'bg-sky-500/10 text-sky-400',
    amber: 'bg-amber-500/10 text-amber-400',
    violet: 'bg-violet-500/10 text-violet-400',
    rose: 'bg-rose-500/10 text-rose-400',
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

function QuickLinkCard({
  href,
  icon: Icon,
  title,
  description,
  accent,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  accent: 'emerald' | 'sky' | 'amber' | 'violet' | 'rose';
}) {
  const accentMap = {
    emerald: 'bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/15',
    sky: 'bg-sky-500/10 text-sky-400 group-hover:bg-sky-500/15',
    amber: 'bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/15',
    violet: 'bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/15',
    rose: 'bg-rose-500/10 text-rose-400 group-hover:bg-rose-500/15',
  };

  return (
    <Link
      href={href}
      className="group relative bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 shadow-xl shadow-black/20 hover:shadow-2xl"
    >
      <div className="flex items-start gap-4">
        <div className={cn('p-3 rounded-xl transition-colors duration-200', accentMap[accent])}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
          <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
        </div>
        <ChevronRight size={16} className="text-zinc-600 group-hover:text-white group-hover:translate-x-0.5 transition-all duration-200" />
      </div>
    </Link>
  );
}

function VideoModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="relative bg-zinc-950 border border-white/[0.08] rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <span className="text-sm font-semibold text-white truncate">{title}</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors duration-200"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4">
          <video src={url} controls autoPlay className="w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

function Sparkline({ data, accent = 'emerald' }: { data: number[]; accent?: 'emerald' | 'sky' }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const accentClass = accent === 'emerald' ? 'bg-emerald-400' : 'bg-sky-400';

  return (
    <div className="flex items-end gap-1 h-12">
      {data.map((value, i) => (
        <div key={i} className="flex-1 flex flex-col justify-end">
          <div
            className={cn('w-full rounded-sm transition-all', accentClass, value === 0 ? 'opacity-20' : 'opacity-90')}
            style={{ height: `${(value / max) * 100}%`, minHeight: value > 0 ? '3px' : '2px' }}
            title={`${value}`}
          />
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [videos, setVideos] = useState<NormalizedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'selfie' | 'supia'>('all');
  const [playing, setPlaying] = useState<NormalizedVideo | null>(null);

  const fetchAll = useCallback(async (source: 'all' | 'selfie' | 'supia') => {
    try {
      const [dashRes, videosRes] = await Promise.all([
        fetch('/api/admin/dashboard', { cache: 'no-store' }),
        fetch(`/api/admin/videos?source=${source}&limit=20`, { cache: 'no-store' }),
      ]);
      if (dashRes.ok) {
        const dash = (await dashRes.json()) as DashboardData;
        setData(dash);
      }
      if (videosRes.ok) {
        const vid = (await videosRes.json()) as { videos: NormalizedVideo[] };
        setVideos(vid.videos ?? []);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAll(filter).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchAll, filter]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchAll(filter);
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 size={24} className="animate-spin" />
          <span>Carregando dashboard...</span>
        </div>
      </div>
    );
  }

  const summary = data?.summary;
  const selfieBars = data?.selfie.byDay.map((d) => d.count) ?? [];
  const supiaBars = data?.supia.byDay.map((d) => d.count) ?? [];

  return (
    <div className="min-h-screen bg-black">
      <div className="fixed -top-40 -right-40 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed -bottom-40 -left-40 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight flex items-center gap-3">
              <Sliders size={28} className="text-emerald-400" />
              Admin
            </h1>
            <p className="text-zinc-500 mt-1">Visão geral do sistema, pipelines e gestão</p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/selfie-video/monitor"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-medium transition-all duration-200"
            >
              <Activity size={14} />
              Monitor em tempo real
            </Link>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-xl hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors duration-200 disabled:opacity-50"
            >
              <RefreshCw size={16} className={cn(refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard
            label="Vídeos gerados"
            value={summary?.totalGenerated ?? 0}
            hint={`${summary?.totalAttempts ?? 0} tentativas no total`}
            icon={Film}
            accent="emerald"
          />
          <StatCard
            label="Taxa de sucesso"
            value={`${summary?.successRate ?? 0}%`}
            hint={`${summary?.totalFailed ?? 0} falhas`}
            icon={TrendingUp}
            accent="sky"
          />
          <StatCard
            label="Em processamento"
            value={summary?.totalInProgress ?? 0}
            hint="agora"
            icon={Loader2}
            accent="amber"
          />
          <StatCard
            label="Últimos 7 dias"
            value={summary?.last7d ?? 0}
            hint={`${summary?.last24h ?? 0} nas últimas 24h`}
            icon={Activity}
            accent="violet"
          />
          <StatCard
            label="Usuários"
            value={summary?.usersCount ?? 0}
            hint="cadastrados no sistema"
            icon={Users}
            accent="rose"
          />
        </div>

        {/* Pipelines breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Selfie pipeline */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10">
                  <Video size={18} className="text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Pipeline Selfie Vídeo</h2>
                  <p className="text-xs text-zinc-500">Resposta personalizada do candidato</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-white tabular-nums">{data?.selfie.total ?? 0}</span>
            </div>

            <Sparkline data={selfieBars} accent="emerald" />
            <div className="flex justify-between mt-1 text-[10px] text-zinc-600">
              <span>7d atrás</span>
              <span>hoje</span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl py-2">
                <div className="text-lg font-bold text-emerald-400 tabular-nums">{data?.selfie.completed ?? 0}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Concluídos</div>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl py-2">
                <div className="text-lg font-bold text-amber-400 tabular-nums">{data?.selfie.inProgress ?? 0}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Em proc.</div>
              </div>
              <div className="bg-red-500/5 border border-red-500/10 rounded-xl py-2">
                <div className="text-lg font-bold text-red-400 tabular-nums">{data?.selfie.failed ?? 0}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Falhas</div>
              </div>
            </div>
          </div>

          {/* Supia pipeline */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-sky-500/10">
                  <ShoppingCart size={18} className="text-sky-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Pipeline Supia</h2>
                  <p className="text-xs text-zinc-500">Vídeos para supermercados</p>
                </div>
              </div>
              <span className="text-2xl font-bold text-white tabular-nums">{data?.supia.total ?? 0}</span>
            </div>

            <Sparkline data={supiaBars} accent="sky" />
            <div className="flex justify-between mt-1 text-[10px] text-zinc-600">
              <span>7d atrás</span>
              <span>hoje</span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl py-2">
                <div className="text-lg font-bold text-emerald-400 tabular-nums">{data?.supia.completed ?? 0}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Concluídos</div>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl py-2">
                <div className="text-lg font-bold text-amber-400 tabular-nums">{data?.supia.inProgress ?? 0}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Em proc.</div>
              </div>
              <div className="bg-red-500/5 border border-red-500/10 rounded-xl py-2">
                <div className="text-lg font-bold text-red-400 tabular-nums">{data?.supia.failed ?? 0}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Falhas</div>
              </div>
            </div>
          </div>
        </div>

        {/* Active base model summary */}
        {data?.activeBaseModel && (
          <div className="bg-gradient-to-r from-violet-500/[0.04] to-emerald-500/[0.04] border border-white/[0.06] rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="p-2 rounded-xl bg-violet-500/10 shrink-0">
                <Clapperboard size={18} className="text-violet-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Modelo base ativo</p>
                <p className="text-sm font-semibold text-white truncate">{data.activeBaseModel.name}</p>
                {data.activeBaseModel.voice_models && (
                  <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-1.5">
                    <Mic size={11} />
                    Voz: {data.activeBaseModel.voice_models.name}
                  </p>
                )}
              </div>
            </div>
            <Link
              href="/admin/video-modelo"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08] hover:border-white/[0.15] rounded-xl text-sm font-medium transition-all duration-200"
            >
              Gerenciar modelo
              <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {/* Quick links */}
        <section>
          <h2 className="text-lg font-semibold text-white tracking-tight mb-4">Atalhos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <QuickLinkCard
              href="/admin/video-modelo"
              icon={Clapperboard}
              title="Modelo de Vídeo"
              description="Configure o vídeo base, voz e prompt do pipeline selfie"
              accent="violet"
            />
            <QuickLinkCard
              href="/admin/prompt-arena"
              icon={Sparkles}
              title="Prompt Arena"
              description="Edite os prompts da Arena AI"
              accent="amber"
            />
            <QuickLinkCard
              href="/admin/potenciometro"
              icon={Sliders}
              title="Potenciômetro"
              description="Calibração de distribuição política"
              accent="sky"
            />
            <QuickLinkCard
              href="/users"
              icon={Users}
              title="Usuários"
              description="Cadastrar, editar e remover usuários do sistema"
              accent="emerald"
            />
            <QuickLinkCard
              href="/selfie-video/monitor"
              icon={Activity}
              title="Monitor de Vídeos"
              description="Pipeline em tempo real com status de cada selfie"
              accent="rose"
            />
            <QuickLinkCard
              href="/selfie-video"
              icon={Video}
              title="Captura de Selfie"
              description="Página pública para gravar uma selfie e gerar vídeo"
              accent="emerald"
            />
          </div>
        </section>

        {/* Videos table */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white tracking-tight">Vídeos recentes</h2>
            <div className="flex items-center gap-1 p-1 bg-white/[0.04] border border-white/[0.06] rounded-xl">
              {(['all', 'selfie', 'supia'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                    filter === s
                      ? 'bg-white text-black'
                      : 'text-zinc-400 hover:text-white',
                  )}
                >
                  {s === 'all' ? 'Todos' : s === 'selfie' ? 'Selfie' : 'Supia'}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden">
            {videos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
                  <Film size={28} className="text-zinc-600" />
                </div>
                <p className="text-zinc-500 text-sm">Nenhum vídeo encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Vídeo</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Origem</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Status</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Quando</th>
                      <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {videos.map((v) => {
                      const isCompleted = v.status === 'completed';
                      const isFailed = v.status === 'failed';
                      return (
                        <tr key={`${v.source}-${v.id}`} className="hover:bg-white/[0.03] transition-colors duration-150 group">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={cn(
                                  'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                                  v.source === 'selfie' ? 'bg-emerald-500/10' : 'bg-sky-500/10',
                                )}
                              >
                                {v.source === 'selfie' ? (
                                  <Video size={16} className="text-emerald-400" />
                                ) : (
                                  <ShoppingCart size={16} className="text-sky-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-white text-sm truncate">{v.title}</div>
                                <div className="text-xs text-zinc-500 truncate">{v.subtitle}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-xs text-zinc-400 capitalize">{v.source}</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium', statusBadge(v.status))}>
                              {isCompleted && <Check size={11} />}
                              {isFailed && <AlertCircle size={11} />}
                              {!isCompleted && !isFailed && <Loader2 size={10} className="animate-spin" />}
                              {statusLabel(v.status)}
                            </span>
                            {isFailed && v.errorMessage && (
                              <p className="mt-1 text-[10px] text-red-400/70 line-clamp-1 max-w-xs">{v.errorMessage}</p>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="text-xs text-zinc-400">{formatRelative(v.createdAt)}</div>
                            <div className="text-[10px] text-zinc-600">{new Date(v.createdAt).toLocaleString('pt-BR')}</div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            {v.videoUrl && (
                              <button
                                onClick={() => setPlaying(v)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 hover:text-white border border-white/[0.08] rounded-lg text-xs font-medium transition-all duration-200 opacity-0 group-hover:opacity-100"
                              >
                                <Play size={12} />
                                Assistir
                              </button>
                            )}
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
      </div>

      {playing?.videoUrl && (
        <VideoModal url={playing.videoUrl} title={playing.title} onClose={() => setPlaying(null)} />
      )}
    </div>
  );
}
