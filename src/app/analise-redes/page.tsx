'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Globe,
  Hash,
  Heart,
  Lightbulb,
  MessageCircle,
  Scale,
  Search,
  Shield,
  Sparkles,
  TrendingUp,
  User,
  Users,
  Zap,
} from 'lucide-react';
import type {
  SocialIntelReport,
  SocialProfileCard,
  SocialPlatform,
} from '@/lib/social-intel/types';

/* ─────────────────── Types & constants ─────────────────── */

interface FormState {
  instagram: string;
  twitter: string;
  tiktok: string;
  facebook: string;
}

const INITIAL_FORM: FormState = { instagram: '', twitter: '', tiktok: '', facebook: '' };

const PLATFORM_META: Record<SocialPlatform, { label: string; color: string; gradient: string }> = {
  instagram: { label: 'Instagram', color: 'text-pink-400', gradient: 'from-pink-500/20 to-purple-500/20' },
  twitter: { label: 'X / Twitter', color: 'text-sky-400', gradient: 'from-sky-500/20 to-blue-500/20' },
  tiktok: { label: 'TikTok', color: 'text-cyan-400', gradient: 'from-cyan-500/20 to-teal-500/20' },
  facebook: { label: 'Facebook', color: 'text-blue-400', gradient: 'from-blue-500/20 to-indigo-500/20' },
};

/* ─────────────────── Main page ─────────────────── */

export default function AnaliseRedesPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState('');
  const [report, setReport] = useState<SocialIntelReport | null>(null);

  const canSubmit = useMemo(
    () => Boolean(form.instagram || form.twitter || form.tiktok || form.facebook),
    [form],
  );

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (!loading) { setLoadingProgress(0); setLoadingStep(0); return; }
    const timer = setInterval(() => {
      setLoadingProgress((p) => (p >= 92 ? 92 : p + (p < 40 ? 4 : p < 70 ? 2 : 1)));
      setLoadingStep((p) => (p + 1) % 5);
    }, 600);
    return () => clearInterval(timer);
  }, [loading]);

  async function handleAnalyze(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    setReport(null);

    try {
      const response = await fetch('/api/social-intel/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as SocialIntelReport | { error?: string };
      if (!response.ok) {
        throw new Error(('error' in data ? data.error : 'Falha ao analisar perfil.') || 'Falha ao analisar perfil.');
      }
      setReport(data as SocialIntelReport);
      setLoadingProgress(100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao analisar perfil.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-x-hidden">
      {/* Ambient glow orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-emerald-500/[0.06] rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[400px] h-[400px] bg-violet-500/[0.05] rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 w-[500px] h-[500px] bg-cyan-500/[0.04] rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="h-16 border-b border-white/[0.06] flex items-center px-6 md:px-8 bg-zinc-950/80 backdrop-blur-2xl sticky top-0 z-30 gap-4">
        <Link href="/" className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all duration-200">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Análise de Redes
          </h1>
          <p className="text-[11px] text-zinc-500">Leitura instantânea de perfil, crenças e interesses</p>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-zinc-600">
          <Shield size={12} /> Dados públicos
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto p-6 md:p-8 lg:p-10 space-y-8">
        {/* ─── Form ─── */}
        <form onSubmit={handleAnalyze} className="relative bg-white/[0.03] backdrop-blur-2xl border border-white/[0.06] rounded-3xl p-6 md:p-8 space-y-6 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/[0.06] rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <Search size={18} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Informar perfis</h2>
              <p className="text-xs text-zinc-500">Cole URLs ou @handles - quanto mais redes, melhor a análise</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(['instagram', 'twitter', 'tiktok', 'facebook'] as const).map((platform) => {
              const meta = PLATFORM_META[platform];
              const placeholder = platform === 'facebook' ? 'URL da página pública' : 'URL ou @handle';
              return (
                <div key={platform} className="relative group">
                  <span className={`absolute left-4 top-2 text-[10px] font-bold uppercase tracking-widest ${meta.color} opacity-60 group-focus-within:opacity-100 transition-opacity duration-200 pointer-events-none z-10`}>
                    {meta.label}
                  </span>
                  <input
                    value={form[platform]}
                    onChange={(e) => updateField(platform, e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl pl-4 pt-7 pb-2.5 pr-4 text-sm text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="inline-flex items-center gap-2.5 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Extraindo dados...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Analisar agora
                </>
              )}
            </button>
            {!canSubmit && (
              <p className="text-xs text-zinc-600">Informe ao menos 1 perfil</p>
            )}
          </div>
        </form>

        {/* ─── Loading ─── */}
        {loading && <LoadingPanel progress={loadingProgress} activeStep={loadingStep} />}

        {/* ─── Error ─── */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-red-500/20 mt-0.5"><Zap size={14} className="text-red-400" /></div>
            <div>
              <p className="text-sm font-medium text-red-300">Erro na análise</p>
              <p className="text-xs text-red-400/80 mt-1 leading-relaxed">{error}</p>
            </div>
          </div>
        )}

        {/* ─── Report ─── */}
        {report && <ReportView report={report} />}
      </main>
    </div>
  );
}

/* ─────────────────── Report view ─────────────────── */

function ReportView({ report }: { report: SocialIntelReport }) {
  return (
    <div className="space-y-8">
      {/* Hero + platforms */}
      <HeroProfile report={report} />

      {/* KPI row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Kpi icon={<Scale size={16} />} title="Político" value={report.indicators.politicalOrientationScore} accent="cyan" />
        <Kpi icon={<Users size={16} />} title="Costumes" value={report.indicators.customsScore} accent="violet" />
        <Kpi icon={<Heart size={16} />} title="Religiosidade" value={report.indicators.religiosityScore} nonNegative accent="amber" />
        <Kpi icon={<Shield size={16} />} title="Consistência" value={report.indicators.consistencyScore} nonNegative accent="emerald" />
      </section>

      {/* Confidence badge */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-white/[0.06] rounded-full text-xs text-zinc-400">
          <Brain size={14} className="text-emerald-400" />
          Confiança da análise: <span className="font-bold text-white">{report.indicators.confidence}%</span>
          <span className="text-zinc-600">|</span>
          {report.coverage.totalPostsAnalyzed} posts
          <span className="text-zinc-600">|</span>
          {report.coverage.profilesAnalyzed} perfis
        </div>
      </div>

      {/* Quick summary + Political + Beliefs */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlassCard icon={<Zap size={16} className="text-amber-400" />} title="Leitura rápida" subtitle="Visão geral instantânea">
          <ul className="space-y-2.5">
            {report.quickSummary.map((line, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300 leading-relaxed">
                <ChevronRight size={14} className="text-emerald-500/60 shrink-0 mt-0.5" />
                {line}
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard icon={<BarChart3 size={16} className="text-cyan-400" />} title="Perfil político" subtitle={`${report.politicalProfile.primarySide} - ${report.politicalProfile.sideConfidence}%`}>
          <p className="text-sm text-zinc-300 leading-relaxed mb-4">{report.politicalProfile.summary}</p>
          <div className="flex flex-wrap gap-2">
            <Badge text={report.politicalProfile.economicAxis} variant="cyan" />
            <Badge text={report.politicalProfile.customsAxis} variant="violet" />
          </div>
          {report.politicalProfile.keySignals.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/[0.06]">
              <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Sinais-chave</p>
              <div className="flex flex-wrap gap-1.5">
                {report.politicalProfile.keySignals.map((s) => (
                  <span key={s} className="text-[11px] text-zinc-500 bg-zinc-900/50 px-2 py-0.5 rounded-lg">{s}</span>
                ))}
              </div>
            </div>
          )}
        </GlassCard>

        <GlassCard icon={<BookOpen size={16} className="text-violet-400" />} title="Crenças e valores" subtitle={`${report.beliefProfile.religion} | ${report.beliefProfile.favoriteTeam}`}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {report.beliefProfile.coreValues.map((item) => <Badge key={item} text={item} variant="emerald" />)}
            </div>
            {report.beliefProfile.ideologicalBeliefs.length > 0 && (
              <div className="pt-3 border-t border-white/[0.06]">
                <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Ideologia</p>
                <ul className="space-y-1">
                  {report.beliefProfile.ideologicalBeliefs.map((b) => (
                    <li key={b} className="text-xs text-zinc-400 leading-relaxed">{b}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </GlassCard>
      </section>

      {/* Profile cards */}
      <section>
        <SectionHeader icon={<Globe size={16} className="text-emerald-400" />} title="Perfis encontrados" subtitle={`${report.profiles.length} redes sociais`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          {report.profiles.map((profile) => (
            <ProfileCard key={`${profile.platform}-${profile.handle}`} profile={profile} breakdown={report.platformBreakdown.find((b) => b.platform === profile.platform)} />
          ))}
        </div>
      </section>

      {/* Interests + Topics */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard icon={<Hash size={16} className="text-pink-400" />} title="Top interesses" subtitle="Sinais mais fortes">
          <div className="space-y-2">
            {report.topInterests.slice(0, 10).map((item, i) => (
              <InterestBar key={item.label} rank={i + 1} label={item.label} confidence={item.confidence} />
            ))}
            {report.topInterests.length === 0 && <EmptyHint text="Sem interesses identificados" />}
          </div>
        </GlassCard>

        <GlassCard icon={<MessageCircle size={16} className="text-emerald-400" />} title="Top tópicos" subtitle="Onde mais fala">
          <div className="space-y-2">
            {report.topTopics.slice(0, 10).map((item, i) => (
              <InterestBar key={item.label} rank={i + 1} label={item.label} confidence={item.confidence} />
            ))}
            {report.topTopics.length === 0 && <EmptyHint text="Sem tópicos identificados" />}
          </div>
        </GlassCard>
      </section>

      {/* Recommendations + Contradictions */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard icon={<Lightbulb size={16} className="text-amber-400" />} title="Recomendações" subtitle="Como abordar">
          <ul className="space-y-2.5">
            {report.recommendations.map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300 leading-relaxed">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                {tip}
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard icon={<Zap size={16} className="text-red-400" />} title="Contradições" subtitle="Divergências entre redes">
          {report.contradictions.length > 0 ? (
            <ul className="space-y-2.5">
              {report.contradictions.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-300 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400/60 shrink-0 mt-2" />
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint text="Sem contradições detectadas entre plataformas" />
          )}
        </GlassCard>
      </section>

      {/* Evidence */}
      {report.evidence.length > 0 && (
        <section>
          <SectionHeader icon={<BookOpen size={16} className="text-violet-400" />} title="Evidências" subtitle={`${report.evidence.length} trechos`} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {report.evidence.slice(0, 8).map((ev, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.04] transition-all duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${PLATFORM_META[ev.platform]?.color || 'text-zinc-400'}`}>
                    {PLATFORM_META[ev.platform]?.label || ev.platform}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-3">{ev.excerpt}</p>
                {ev.url && (
                  <a href={ev.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-emerald-400/70 hover:text-emerald-400 mt-2 transition-colors duration-200">
                    ver post <ArrowUpRight size={10} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Warnings */}
      {report.warnings.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-widest text-amber-500/60 mb-2">Avisos</p>
          <ul className="space-y-1">
            {report.warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-400/60 leading-relaxed">{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Hero profile ─────────────────── */

function HeroProfile({ report }: { report: SocialIntelReport }) {
  const [broken, setBroken] = useState(false);
  const prioritized: SocialPlatform[] = ['instagram', 'twitter', 'tiktok', 'facebook'];
  const mainProfile =
    prioritized
      .map((p) => report.profiles.find((pr) => pr.platform === p && pr.avatarUrl))
      .find(Boolean) || report.profiles[0];

  if (!mainProfile) return null;

  const statuses = prioritized.map((platform) => {
    const hasData = report.coverage.platformsAnalyzed.includes(platform);
    const breakdown = report.platformBreakdown.find((b) => b.platform === platform);
    return { platform, hasData, postsAnalyzed: breakdown?.postsAnalyzed || 0 };
  });

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
      {/* Avatar card */}
      <div className="relative bg-white/[0.03] backdrop-blur-2xl border border-white/[0.06] rounded-3xl p-5 overflow-hidden">
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-emerald-500/[0.06] rounded-full blur-2xl pointer-events-none" />
        <div className="relative">
          {mainProfile.avatarUrl && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarSrc(mainProfile.avatarUrl)}
              alt={mainProfile.handle}
              onError={() => setBroken(true)}
              className="w-full aspect-square object-cover rounded-2xl border border-white/[0.08]"
            />
          ) : (
            <div className="w-full aspect-square rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 grid place-content-center text-5xl text-zinc-400 font-bold border border-white/[0.06]">
              {(mainProfile.displayName || mainProfile.handle).slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="mt-4 space-y-1">
          <p className="text-base font-bold tracking-tight">{mainProfile.displayName || mainProfile.handle}</p>
          <p className={`text-xs font-medium ${PLATFORM_META[mainProfile.platform]?.color || 'text-zinc-400'}`}>
            {PLATFORM_META[mainProfile.platform]?.label || mainProfile.platform}
          </p>
          {typeof mainProfile.followers === 'number' && (
            <p className="text-xs text-zinc-500">{mainProfile.followers.toLocaleString('pt-BR')} seguidores</p>
          )}
        </div>
      </div>

      {/* Platform status grid */}
      <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.06] rounded-3xl p-5 md:p-6">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Status de coleta por rede</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statuses.map((s) => {
            const meta = PLATFORM_META[s.platform];
            return (
              <div
                key={s.platform}
                className={`relative rounded-2xl p-4 border overflow-hidden transition-all duration-300 ${
                  s.hasData
                    ? 'bg-white/[0.04] border-emerald-500/20 hover:border-emerald-500/40'
                    : 'bg-white/[0.02] border-white/[0.06]'
                }`}
              >
                {s.hasData && (
                  <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-30`} />
                )}
                <div className="relative">
                  <p className={`text-xs font-bold uppercase tracking-widest ${s.hasData ? meta.color : 'text-zinc-600'}`}>
                    {meta.label}
                  </p>
                  <div className="flex items-center gap-1.5 mt-2">
                    {s.hasData ? (
                      <CheckCircle2 size={12} className="text-emerald-400" />
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-zinc-700" />
                    )}
                    <p className={`text-xs ${s.hasData ? 'text-emerald-300' : 'text-zinc-500'}`}>
                      {s.hasData ? 'com dados' : 'sem dados'}
                    </p>
                  </div>
                  <p className="text-2xl font-bold mt-2">{s.postsAnalyzed}</p>
                  <p className="text-[10px] text-zinc-500">posts</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── KPI ─────────────────── */

const ACCENT_MAP = {
  cyan: { bar: 'from-cyan-500 to-cyan-300', text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  violet: { bar: 'from-violet-500 to-violet-300', text: 'text-violet-400', bg: 'bg-violet-500/10' },
  amber: { bar: 'from-amber-500 to-amber-300', text: 'text-amber-400', bg: 'bg-amber-500/10' },
  emerald: { bar: 'from-emerald-500 to-emerald-300', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
};

function Kpi({ icon, title, value, nonNegative = false, accent = 'cyan' }: {
  icon: React.ReactNode;
  title: string;
  value: number;
  nonNegative?: boolean;
  accent?: keyof typeof ACCENT_MAP;
}) {
  const colors = ACCENT_MAP[accent];
  const displayed = Math.round(value);
  const bounded = nonNegative ? Math.max(0, Math.min(100, displayed)) : Math.max(-100, Math.min(100, displayed));
  const width = nonNegative ? bounded : Math.min(50, Math.abs(bounded) / 2);
  const fromRight = bounded >= 0;

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 md:p-5 backdrop-blur-xl hover:bg-white/[0.05] transition-all duration-300">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${colors.bg}`}>
          <span className={colors.text}>{icon}</span>
        </div>
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">{title}</p>
      </div>
      <p className="text-3xl font-bold tracking-tight">{displayed}</p>
      {nonNegative ? (
        <div className="h-1.5 bg-zinc-800/50 rounded-full mt-3 overflow-hidden">
          <div className={`h-full bg-gradient-to-r ${colors.bar} transition-all duration-700`} style={{ width: `${width}%` }} />
        </div>
      ) : (
        <div className="h-1.5 bg-zinc-800/50 rounded-full mt-3 overflow-hidden relative">
          <div className="absolute inset-y-0 left-1/2 w-px bg-zinc-700/50" />
          <div
            className={`absolute inset-y-0 bg-gradient-to-r ${colors.bar} transition-all duration-700`}
            style={{ width: `${width}%`, left: fromRight ? '50%' : `calc(50% - ${width}%)` }}
          />
        </div>
      )}
    </div>
  );
}

/* ─────────────────── Glass card ─────────────────── */

function GlassCard({ icon, title, subtitle, children }: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.06] rounded-2xl p-5 md:p-6 hover:border-white/[0.1] transition-all duration-300">
      <div className="flex items-center gap-2.5 mb-1">
        {icon}
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">{title}</p>
      </div>
      {subtitle && <p className="text-sm text-zinc-300 mt-1 mb-4">{subtitle}</p>}
      {!subtitle && <div className="h-3" />}
      {children}
    </div>
  );
}

/* ─────────────────── Profile card ─────────────────── */

function ProfileCard({ profile, breakdown }: { profile: SocialProfileCard; breakdown?: { postsAnalyzed: number; politicalScore: number } }) {
  const [broken, setBroken] = useState(false);
  const canRenderImage = Boolean(profile.avatarUrl) && !broken;
  const initials = (profile.displayName || profile.handle || profile.platform).slice(0, 2).toUpperCase();
  const meta = PLATFORM_META[profile.platform];

  return (
    <div className="group relative bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl p-4 hover:bg-white/[0.05] transition-all duration-300 overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${meta.gradient} opacity-0 group-hover:opacity-30 transition-opacity duration-300`} />
      <div className="relative flex items-center gap-3">
        {canRenderImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarSrc(profile.avatarUrl)}
            alt={profile.handle}
            onError={() => setBroken(true)}
            className="w-12 h-12 rounded-xl object-cover border border-white/[0.08]"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-zinc-800/80 grid place-content-center text-zinc-300 text-xs font-bold border border-white/[0.06]">{initials}</div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{profile.displayName || profile.handle}</p>
          <p className={`text-[11px] font-medium ${meta.color}`}>{meta.label}</p>
        </div>
      </div>
      <div className="relative mt-3 flex items-center justify-between">
        {typeof profile.followers === 'number' ? (
          <div className="flex items-center gap-1.5">
            <User size={11} className="text-zinc-500" />
            <p className="text-xs text-zinc-400">{profile.followers.toLocaleString('pt-BR')}</p>
          </div>
        ) : <span />}
        {breakdown && (
          <span className="text-[10px] text-zinc-600">{breakdown.postsAnalyzed} posts</span>
        )}
      </div>
      {profile.profileUrl && (
        <a href={profile.profileUrl} target="_blank" rel="noreferrer" className="relative inline-flex items-center gap-1 text-[11px] text-emerald-400/70 hover:text-emerald-400 mt-2 transition-colors duration-200">
          abrir perfil <ArrowUpRight size={10} />
        </a>
      )}
    </div>
  );
}

/* ─────────────────── Interest bar ─────────────────── */

function InterestBar({ rank, label, confidence }: { rank: number; label: string; confidence: number }) {
  return (
    <div className="flex items-center gap-3 group">
      <span className="text-[10px] font-bold text-zinc-600 w-4 text-right">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm text-zinc-300 truncate">{label}</p>
          <p className="text-[11px] text-zinc-500 ml-2 shrink-0">{confidence}%</p>
        </div>
        <div className="h-1 bg-zinc-800/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500/60 to-emerald-400/40 rounded-full transition-all duration-700"
            style={{ width: `${Math.max(confidence, 4)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────── Small components ─────────────────── */

function Badge({ text, variant = 'emerald' }: { text: string; variant?: 'emerald' | 'cyan' | 'violet' | 'amber' }) {
  const styles = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    violet: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-full text-xs font-medium ${styles[variant]}`}>
      {text}
    </span>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <h2 className="text-xs font-medium uppercase tracking-widest text-zinc-500">{title}</h2>
      {subtitle && <span className="text-[10px] text-zinc-600 ml-auto">{subtitle}</span>}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="p-3 rounded-2xl bg-zinc-900/50 mb-3">
        <Search size={20} className="text-zinc-600" />
      </div>
      <p className="text-xs text-zinc-500">{text}</p>
    </div>
  );
}

function avatarSrc(url?: string): string {
  if (!url) return '';
  return `/api/social-intel/avatar?url=${encodeURIComponent(url)}`;
}

/* ─────────────────── Loading panel ─────────────────── */

function LoadingPanel({ progress, activeStep }: { progress: number; activeStep: number }) {
  const steps = [
    { label: 'Coletando perfis em paralelo (todas as redes)', icon: <Globe size={14} /> },
    { label: 'Descoberta automática de handles via bio', icon: <Search size={14} /> },
    { label: 'Extraindo posts, bio e metadados', icon: <MessageCircle size={14} /> },
    { label: 'IA: inferindo interesses, crenças e eixo político', icon: <Brain size={14} /> },
    { label: 'Consolidação: painel com evidências', icon: <TrendingUp size={14} /> },
  ];

  return (
    <div className="relative bg-white/[0.03] backdrop-blur-2xl border border-white/[0.06] rounded-3xl p-6 md:p-8 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute -top-20 -left-20 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />

      <div className="relative grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-8 items-center">
        {/* Spinner */}
        <div className="flex items-center justify-center">
          <div className="relative w-36 h-36">
            <div className="absolute inset-0 rounded-full border border-cyan-400/20 animate-[spin_10s_linear_infinite]" />
            <div className="absolute inset-3 rounded-full border border-emerald-400/20 animate-[spin_6s_linear_infinite_reverse]" />
            <div className="absolute inset-6 rounded-full border border-violet-400/15 animate-[spin_4s_linear_infinite]" />
            <div className="absolute inset-0 grid place-content-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl grid place-content-center">
                <Sparkles size={22} className="text-cyan-300 animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold bg-gradient-to-r from-cyan-300 to-emerald-300 bg-clip-text text-transparent">
              Pipeline IA de extração
            </p>
            <span className="text-xs text-zinc-400 tabular-nums font-mono">{progress}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800/50 rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="space-y-3">
            {steps.map((step, index) => {
              const done = activeStep > index || progress > 95;
              const active = activeStep === index;
              return (
                <div key={index} className="flex items-center gap-3">
                  <div className={`p-1 rounded-lg transition-all duration-300 ${done ? 'bg-emerald-500/10 text-emerald-400' : active ? 'bg-cyan-500/10 text-cyan-400' : 'text-zinc-600'}`}>
                    {done ? <CheckCircle2 size={14} /> : step.icon}
                  </div>
                  <p className={`text-sm transition-colors duration-300 ${done ? 'text-emerald-300' : active ? 'text-cyan-200' : 'text-zinc-500'}`}>
                    {step.label}
                  </p>
                  {active && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse ml-auto" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
