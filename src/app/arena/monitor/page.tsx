// Arena Monitor — Real-time usage dashboard with live sessions

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Users, Activity, Clock, BarChart3, Loader2, CheckCircle, XCircle, Radio } from 'lucide-react';

interface LiveSession {
  id: string;
  user_name: string;
  user_email: string;
  started_at: string;
  updated_at: string;
  status: string;
  phase: string;
  processed_count: number;
  total_count: number;
  platform: string;
  region: string;
  error: string | null;
  score: number | null;
  completed_at: string | null;
}

interface Stats {
  totalUsers: number;
  totalAnalyses: number;
  last24h: number;
  last7d: number;
  recentAnalyses: any[];
  topUsers: { name: string; email: string; count: number }[];
}

export default function MonitorPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [active, setActive] = useState<LiveSession[]>([]);
  const [recent, setRecent] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, liveRes] = await Promise.all([
        fetch('/api/arena/monitor-stats'),
        fetch('/api/arena/live-session'),
      ]);
      const statsData = await statsRes.json();
      const liveData = await liveRes.json();
      setStats(statsData);
      setActive(liveData.active || []);
      setRecent(liveData.recent || []);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, [fetchAll]);

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Monitor VOTIA</h1>
          <p className="text-xs text-zinc-500 mt-1">Atualiza a cada 5 segundos</p>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-sm text-zinc-300 active:scale-95 transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Users} label="Usuários" value={stats.totalUsers} color="#8b5cf6" />
          <StatCard icon={BarChart3} label="Análises" value={stats.totalAnalyses} color="#34d399" />
          <StatCard icon={Activity} label="Últimas 24h" value={stats.last24h} color="#38bdf8" />
          <StatCard icon={Clock} label="7 dias" value={stats.last7d} color="#fbbf24" />
        </div>
      )}

      {/* ═══ LIVE NOW ═══ */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative">
            <Radio size={14} className="text-red-500" />
            {active.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
          <span className="text-xs font-extrabold text-red-400 uppercase tracking-[2px]">AO VIVO</span>
          <span className="text-xs text-zinc-600">({active.length})</span>
        </div>

        <AnimatePresence>
          {active.length === 0 ? (
            <div className="py-8 text-center rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
              <p className="text-sm text-zinc-600">Nenhuma análise rodando agora</p>
            </div>
          ) : (
            <div className="space-y-2">
              {active.map((s) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="px-4 py-3 rounded-xl relative overflow-hidden"
                  style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '0.5px solid rgba(239,68,68,0.15)' }}
                >
                  {/* Progress bar background */}
                  <div className="absolute inset-0 opacity-10">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-1000"
                      style={{ width: s.total_count > 0 ? `${(s.processed_count / s.total_count) * 100}%` : '5%' }}
                    />
                  </div>

                  <div className="relative flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-white truncate">{s.user_name || s.user_email}</span>
                        <span className="text-[10px] text-zinc-500">{s.region || 'BR'}</span>
                        {s.platform && <span className="text-[10px] text-zinc-500">· {s.platform}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase">
                          {s.phase === 'collecting' ? 'Preparando' : s.phase === 'streaming' ? 'Analisando' : s.phase === 'aggregating' ? 'Finalizando' : s.phase}
                        </span>
                        {s.total_count > 0 && (
                          <span className="text-[10px] text-zinc-400 tabular-nums">
                            {s.processed_count.toLocaleString()}/{s.total_count.toLocaleString()} ({Math.round((s.processed_count / s.total_count) * 100)}%)
                          </span>
                        )}
                        <span className="text-[10px] text-zinc-600">{timeAgo(s.started_at)}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ RECENT COMPLETED ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-zinc-500" />
          <span className="text-xs font-extrabold text-zinc-500 uppercase tracking-[1.5px]">Últimas 24h</span>
        </div>

        {recent.length === 0 ? (
          <p className="text-sm text-zinc-600 text-center py-8">Nenhuma sessão recente</p>
        ) : (
          <div className="space-y-2">
            {recent.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)' }}
              >
                {/* Status icon */}
                {s.status === 'complete' ? (
                  <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                ) : (
                  <XCircle size={18} className="text-red-400 shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-white truncate">{s.user_name || s.user_email}</span>
                    <span className="text-[10px] text-zinc-500">{s.region || 'BR'}</span>
                    {s.platform && <span className="text-[10px] text-zinc-500">· {s.platform}</span>}
                  </div>
                  {s.error && <p className="text-[11px] text-red-400 mt-0.5 truncate">{s.error}</p>}
                </div>

                <div className="flex flex-col items-end shrink-0">
                  {s.score != null && s.score > 0 && (
                    <span className="text-sm font-black tabular-nums" style={{ color: s.score >= 7 ? '#34d399' : s.score >= 4 ? '#fbbf24' : '#fb7185' }}>
                      {Number(s.score).toFixed(1)}
                    </span>
                  )}
                  <span className="text-[10px] text-zinc-600">{timeAgo(s.completed_at || s.updated_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top users */}
      {stats && stats.topUsers.length > 0 && (
        <div className="mt-6">
          <span className="text-xs font-extrabold text-zinc-500 uppercase tracking-[1.5px]">Ranking</span>
          <div className="space-y-2 mt-3">
            {stats.topUsers.map((u, i) => (
              <div key={u.email} className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                <span className="text-sm font-black text-zinc-600 w-5">{i + 1}</span>
                <span className="flex-1 text-sm text-white truncate">{u.name}</span>
                <span className="text-sm font-black text-emerald-400 tabular-nums">{u.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="px-4 py-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color }} />
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-2xl font-black text-white tabular-nums">{value.toLocaleString('pt-BR')}</span>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
