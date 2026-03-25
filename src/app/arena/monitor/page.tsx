// Arena Monitor — Real-time usage dashboard
// Shows who's using the platform and running analyses

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Users, Activity, Clock, BarChart3, Globe, Loader2 } from 'lucide-react';

interface AnalysisRecord {
  id: string;
  created_at: string;
  user_name: string;
  user_email: string;
  user_state: string;
  headline: string;
  score: number;
  platform: string;
  question: string;
}

interface Stats {
  totalUsers: number;
  totalAnalyses: number;
  last24h: number;
  last7d: number;
  recentAnalyses: AnalysisRecord[];
  topUsers: { name: string; email: string; count: number }[];
}

export default function MonitorPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/arena/monitor-stats');
      const data = await res.json();
      setStats(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchStats]);

  const scoreColor = (s: number) => s >= 7 ? '#34d399' : s >= 4 ? '#fbbf24' : '#fb7185';

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Monitor VOTIA</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Atualizado: {lastRefresh.toLocaleTimeString('pt-BR')}
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-sm text-zinc-300 active:scale-95 transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {!stats ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="text-emerald-400 animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard icon={Users} label="Usuários" value={stats.totalUsers} color="#8b5cf6" />
            <StatCard icon={BarChart3} label="Análises total" value={stats.totalAnalyses} color="#34d399" />
            <StatCard icon={Activity} label="Últimas 24h" value={stats.last24h} color="#38bdf8" />
            <StatCard icon={Clock} label="Últimos 7 dias" value={stats.last7d} color="#fbbf24" />
          </div>

          {/* Top users */}
          {stats.topUsers.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs font-extrabold text-zinc-500 uppercase tracking-[1.5px] mb-3">Usuários mais ativos</h2>
              <div className="space-y-2">
                {stats.topUsers.map((u, i) => (
                  <div key={u.email} className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                    <span className="text-sm font-black text-zinc-600 w-6">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{u.name}</p>
                      <p className="text-[11px] text-zinc-500">{u.email}</p>
                    </div>
                    <span className="text-sm font-black text-emerald-400 tabular-nums">{u.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent analyses */}
          <div>
            <h2 className="text-xs font-extrabold text-zinc-500 uppercase tracking-[1.5px] mb-3">Análises recentes</h2>
            {stats.recentAnalyses.length === 0 ? (
              <p className="text-sm text-zinc-600 text-center py-10">Nenhuma análise ainda</p>
            ) : (
              <div className="space-y-2">
                {stats.recentAnalyses.map((a) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-4 py-3 rounded-xl"
                    style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold text-emerald-400">{a.user_name}</span>
                          <span className="text-[10px] text-zinc-600">·</span>
                          <span className="text-[10px] text-zinc-500">{a.user_state || 'BR'}</span>
                          {a.platform && (
                            <>
                              <span className="text-[10px] text-zinc-600">·</span>
                              <span className="text-[10px] text-zinc-500">{a.platform}</span>
                            </>
                          )}
                        </div>
                        <p className="text-[13px] font-semibold text-white truncate">{a.headline || 'Análise'}</p>
                        {a.question && <p className="text-[11px] text-zinc-500 truncate mt-0.5">{a.question}</p>}
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-sm font-black tabular-nums" style={{ color: scoreColor(a.score) }}>
                          {a.score?.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-zinc-600">
                          {timeAgo(a.created_at)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </>
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
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
