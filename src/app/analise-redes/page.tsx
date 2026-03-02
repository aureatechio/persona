'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Sparkles } from 'lucide-react';
import type { LabelConfidence, SocialIntelReport, SocialProfileCard } from '@/lib/social-intel/types';

interface FormState {
  instagram: string;
  twitter: string;
  tiktok: string;
  facebook: string;
}

const INITIAL_FORM: FormState = {
  instagram: '',
  twitter: '',
  tiktok: '',
  facebook: '',
};

export default function AnaliseRedesPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<SocialIntelReport | null>(null);

  const canSubmit = useMemo(
    () => Boolean(form.instagram || form.twitter || form.tiktok || form.facebook),
    [form],
  );

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

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
        const detail = 'error' in data ? data.error : 'Falha ao analisar perfil.';
        throw new Error(detail || 'Falha ao analisar perfil.');
      }

      setReport(data as SocialIntelReport);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao analisar perfil.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.16),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(34,197,94,0.12),transparent_40%),radial-gradient(circle_at_50%_100%,rgba(236,72,153,0.12),transparent_45%)]" />

      <header className="h-16 border-b border-white/[0.06] flex items-center px-6 md:px-8 bg-zinc-950/70 backdrop-blur-xl sticky top-0 z-30 gap-4">
        <Link href="/" className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all duration-200">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Análise de Redes</h1>
          <p className="text-xs text-zinc-500">Leitura instantânea de perfil político, crenças e interesses</p>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto p-6 md:p-8 space-y-6">
        <form onSubmit={handleAnalyze} className="bg-zinc-950/80 border border-zinc-800 rounded-3xl p-6 md:p-8 space-y-5 backdrop-blur-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input value={form.instagram} onChange={(e) => updateField('instagram', e.target.value)} placeholder="Instagram (URL ou @)" className="w-full bg-zinc-900/70 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40" />
            <input value={form.twitter} onChange={(e) => updateField('twitter', e.target.value)} placeholder="X / Twitter (opcional)" className="w-full bg-zinc-900/70 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40" />
            <input value={form.tiktok} onChange={(e) => updateField('tiktok', e.target.value)} placeholder="TikTok (opcional)" className="w-full bg-zinc-900/70 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40" />
            <input value={form.facebook} onChange={(e) => updateField('facebook', e.target.value)} placeholder="Facebook (opcional)" className="w-full bg-zinc-900/70 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400/40" />
          </div>

          <button type="submit" disabled={!canSubmit || loading} className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-400 to-emerald-400 text-black font-bold px-5 py-3 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed">
            <Search size={18} />
            {loading ? 'Extraindo dados...' : 'Analisar agora'}
          </button>
        </form>

        {loading && <LoadingPanel />}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-300 text-sm">{error}</div>
        )}

        {report && (
          <div className="space-y-6 animate-[fade-in_300ms_ease-out]">
            <HeroProfile report={report} />

            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <Kpi title="Político" value={report.indicators.politicalOrientationScore} />
              <Kpi title="Costumes" value={report.indicators.customsScore} />
              <Kpi title="Religiosidade" value={report.indicators.religiosityScore} nonNegative />
              <Kpi title="Consistência" value={report.indicators.consistencyScore} nonNegative />
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <GlassCard title="Leitura rápida" subtitle="Bater o olho e decidir">
                <ul className="space-y-2 text-sm text-zinc-200">
                  {report.quickSummary.map((line) => (
                    <li key={line} className="leading-relaxed">• {line}</li>
                  ))}
                </ul>
              </GlassCard>

              <GlassCard title="Perfil político" subtitle={`${report.politicalProfile.primarySide} • ${report.politicalProfile.sideConfidence}%`}>
                <p className="text-sm text-zinc-200">{report.politicalProfile.summary}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Chip text={report.politicalProfile.economicAxis} />
                  <Chip text={report.politicalProfile.customsAxis} />
                </div>
              </GlassCard>

              <GlassCard title="Crenças e gostos" subtitle={`${report.beliefProfile.religion} • ${report.beliefProfile.favoriteTeam}`}>
                <div className="flex flex-wrap gap-2">
                  {report.beliefProfile.coreValues.map((item) => <Chip key={item} text={item} />)}
                </div>
              </GlassCard>
            </section>

            <section>
              <h2 className="text-sm uppercase tracking-widest text-zinc-500 mb-3">Perfis encontrados</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {report.profiles.map((profile) => (
                  <ProfileCard key={`${profile.platform}-${profile.handle}`} profile={profile} />
                ))}
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlassCard title="Top interesses" subtitle="Sinais mais fortes">
                <div className="flex flex-wrap gap-2">
                  {formatRanked(report.topInterests).slice(0, 10).map((item) => <Chip key={item} text={item} />)}
                </div>
              </GlassCard>

              <GlassCard title="Top tópicos" subtitle="Onde a pessoa mais fala">
                <div className="flex flex-wrap gap-2">
                  {formatRanked(report.topTopics).slice(0, 10).map((item) => <Chip key={item} text={item} />)}
                </div>
              </GlassCard>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <GlassCard title="Recomendações" subtitle="Como abordar rápido">
                <ul className="space-y-1 text-sm text-zinc-200">
                  {report.recommendations.map((tip) => <li key={tip}>• {tip}</li>)}
                </ul>
              </GlassCard>

              <GlassCard title="Contradições" subtitle="Diferenças entre redes">
                {report.contradictions.length > 0 ? (
                  <ul className="space-y-1 text-sm text-zinc-200">
                    {report.contradictions.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                ) : (
                  <p className="text-sm text-zinc-400">Sem conflito forte de sinal.</p>
                )}
              </GlassCard>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function Kpi({ title, value, nonNegative = false }: { title: string; value: number; nonNegative?: boolean }) {
  const displayed = Math.round(value);
  const bounded = nonNegative ? Math.max(0, Math.min(100, displayed)) : Math.max(-100, Math.min(100, displayed));
  const width = nonNegative ? bounded : Math.min(50, Math.abs(bounded) / 2);
  const fromRight = bounded >= 0;

  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-widest text-zinc-500">{title}</p>
      <p className="text-3xl font-bold mt-1">{displayed}</p>
      {nonNegative ? (
        <div className="h-2 bg-zinc-800 rounded-full mt-3 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${width}%` }} />
        </div>
      ) : (
        <div className="h-2 bg-zinc-800 rounded-full mt-3 overflow-hidden relative">
          <div className="absolute inset-y-0 left-1/2 w-px bg-zinc-600" />
          <div
            className="absolute inset-y-0 bg-gradient-to-r from-cyan-400 to-emerald-400"
            style={{
              width: `${width}%`,
              left: fromRight ? '50%' : `calc(50% - ${width}%)`,
            }}
          />
        </div>
      )}
    </div>
  );
}

function GlassCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-5 backdrop-blur-xl">
      <p className="text-xs uppercase tracking-widest text-zinc-500">{title}</p>
      {subtitle && <p className="text-sm text-zinc-300 mt-1 mb-3">{subtitle}</p>}
      {children}
    </div>
  );
}

function ProfileCard({ profile }: { profile: SocialProfileCard }) {
  const [broken, setBroken] = useState(false);
  const canRenderImage = Boolean(profile.avatarUrl) && !broken;
  const initials = (profile.displayName || profile.handle || profile.platform).slice(0, 2).toUpperCase();

  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        {canRenderImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarSrc(profile.avatarUrl)}
            alt={profile.handle}
            onError={() => setBroken(true)}
            className="w-12 h-12 rounded-xl object-cover border border-zinc-700"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-zinc-800 grid place-content-center text-zinc-300 text-xs font-bold">{initials}</div>
        )}
        <div>
          <p className="text-sm font-semibold">{profile.displayName || profile.handle}</p>
          <p className="text-xs text-zinc-400">{profile.platform}</p>
        </div>
      </div>
      {typeof profile.followers === 'number' && (
        <p className="text-xs text-zinc-400 mt-2">{profile.followers.toLocaleString('pt-BR')} seguidores</p>
      )}
      {profile.profileUrl && (
        <a href={profile.profileUrl} target="_blank" rel="noreferrer" className="text-xs text-cyan-300 hover:text-cyan-200 mt-2 inline-block">
          abrir perfil
        </a>
      )}
    </div>
  );
}

function Chip({ text }: { text: string }) {
  return <span className="text-xs bg-zinc-900 border border-zinc-700 px-2.5 py-1.5 rounded-xl text-zinc-200">{text}</span>;
}

function formatRanked(items: LabelConfidence[]): string[] {
  return items.map((item) => `${item.label} (${item.confidence}%)`);
}

function avatarSrc(url?: string): string {
  if (!url) return '';
  return `/api/social-intel/avatar?url=${encodeURIComponent(url)}`;
}

function HeroProfile({ report }: { report: SocialIntelReport }) {
  const [broken, setBroken] = useState(false);
  const prioritized = ['instagram', 'twitter', 'tiktok', 'facebook'];
  const mainProfile =
    prioritized
      .map((platform) => report.profiles.find((profile) => profile.platform === platform && profile.avatarUrl))
      .find(Boolean) || report.profiles[0];

  if (!mainProfile) return null;

  const statuses = ['instagram', 'twitter', 'tiktok', 'facebook'].map((platform) => {
    const hasData = report.coverage.platformsAnalyzed.includes(platform as typeof report.coverage.platformsAnalyzed[number]);
    return { platform, hasData };
  });

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
      <div className="bg-zinc-950/80 border border-zinc-800 rounded-3xl p-4 backdrop-blur-xl">
        {mainProfile.avatarUrl && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarSrc(mainProfile.avatarUrl)}
            alt={mainProfile.handle}
            onError={() => setBroken(true)}
            className="w-full aspect-square object-cover rounded-2xl border border-zinc-700"
          />
        ) : (
          <div className="w-full aspect-square rounded-2xl bg-zinc-800 grid place-content-center text-4xl text-zinc-300 font-bold">
            {(mainProfile.displayName || mainProfile.handle).slice(0, 1).toUpperCase()}
          </div>
        )}
        <p className="text-sm font-semibold mt-3">{mainProfile.displayName || mainProfile.handle}</p>
        <p className="text-xs text-zinc-400">{mainProfile.platform}</p>
        {typeof mainProfile.followers === 'number' && (
          <p className="text-xs text-zinc-500 mt-1">{mainProfile.followers.toLocaleString('pt-BR')} seguidores</p>
        )}
      </div>

      <div className="bg-zinc-950/80 border border-zinc-800 rounded-3xl p-5 backdrop-blur-xl">
        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Status de coleta por rede</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {statuses.map((status) => (
            <div
              key={status.platform}
              className={`rounded-2xl px-3 py-2 text-xs border ${
                status.hasData
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400'
              }`}
            >
              <p className="uppercase tracking-widest">{status.platform}</p>
              <p className="mt-1">{status.hasData ? 'com dados' : 'sem dados públicos'}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LoadingPanel() {
  return (
    <div className="bg-zinc-950/80 border border-zinc-800 rounded-3xl p-6 md:p-8 backdrop-blur-xl overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_30%,rgba(34,211,238,0.15),transparent_35%),radial-gradient(circle_at_90%_70%,rgba(16,185,129,0.12),transparent_35%)]" />
      <div className="relative grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 items-center">
        <div className="flex items-center justify-center">
          <div className="relative w-40 h-40">
            <div className="absolute inset-0 rounded-full border border-cyan-300/30 animate-[spin_8s_linear_infinite]" />
            <div className="absolute inset-3 rounded-full border border-emerald-300/30 animate-[spin_5s_linear_infinite_reverse]" />
            <div className="absolute inset-0 grid place-content-center">
              <div className="w-20 h-20 rounded-2xl bg-zinc-900/90 border border-zinc-700 grid place-content-center">
                <Sparkles size={26} className="text-cyan-300 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        <div>
          <p className="text-cyan-300 text-sm font-semibold mb-4">Pipeline IA de extração de perfil</p>
          <div className="space-y-3">
            <FlowStep delay="0ms" label="Instagram: coletando bio, posts e metadados" />
            <FlowStep delay="150ms" label="Descoberta automática: X, TikTok e Facebook" />
            <FlowStep delay="300ms" label="IA: inferindo interesses, crenças e eixo político" />
            <FlowStep delay="450ms" label="Consolidação: painel rápido com evidências" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowStep({ label, delay }: { label: string; delay: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="w-2.5 h-2.5 rounded-full bg-cyan-300 animate-pulse" style={{ animationDelay: delay }} />
        <div className="absolute inset-0 rounded-full border border-cyan-300/40 animate-[ping_1.8s_ease-in-out_infinite]" style={{ animationDelay: delay }} />
      </div>
      <p className="text-sm text-zinc-300">{label}</p>
    </div>
  );
}
