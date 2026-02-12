'use client';

import {
  Users,
  Calendar,
  Scale,
  MapPin,
  GraduationCap,
  Target,
  Sparkles,
  TrendingUp,
  Heart,
  Briefcase,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────
interface DashboardAnalyticsProps {
  personas: any[];
}

interface DistItem {
  label: string;
  count: number;
  pct: number;
  color: string;
}

// ── Color Maps ───────────────────────────────────────────────────────────────
const POLITICAL_COLORS: Record<string, string> = {
  'Extrema Esquerda': '#ef4444',
  'Esquerda': '#f87171',
  'Centro-Esquerda': '#fb923c',
  'Centro': '#fbbf24',
  'Centro-Liberal': '#a3e635',
  'Centro-Direita': '#38bdf8',
  'Direita': '#6366f1',
  'Extrema Direita': '#8b5cf6',
  'Libertário': '#22d3ee',
  'Apolítico': '#71717a',
};

const GENERATION_COLORS: Record<string, string> = {
  'Gen Z': '#22d3ee',
  'Millennial': '#a78bfa',
  'Gen X': '#f59e0b',
  'Boomer': '#ef4444',
};

const DISC_COLORS: Record<string, string> = {
  'Dominância': '#ef4444',
  'Influência': '#f59e0b',
  'Estabilidade': '#10b981',
  'Conformidade': '#3b82f6',
};

const REGION_COLORS: Record<string, string> = {
  'Norte': '#22d3ee',
  'Nordeste': '#f59e0b',
  'Centro-Oeste': '#a78bfa',
  'Sudeste': '#10b981',
  'Sul': '#3b82f6',
};

const GENDER_COLORS: Record<string, string> = {
  'Masculino': '#6366f1',
  'Feminino': '#ec4899',
  'Não-Binário': '#a78bfa',
  'Outro': '#71717a',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function computeDistribution(personas: any[], field: string, colorMap: Record<string, string>): DistItem[] {
  const counts: Record<string, number> = {};
  for (const p of personas) {
    const val = p[field] || 'Não informado';
    counts[val] = (counts[val] || 0) + 1;
  }
  const total = personas.length;
  return Object.entries(counts)
    .map(([label, count]) => ({
      label,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
      color: colorMap[label] || '#71717a',
    }))
    .sort((a, b) => b.count - a.count);
}

function avgAge(personas: any[]): number {
  if (!personas.length) return 0;
  return Math.round(personas.reduce((sum, p) => sum + (p.age || 0), 0) / personas.length);
}

function avgIncome(personas: any[]): string {
  const incomes = personas
    .map(p => p.demographic_json?.renda_e_financas?.renda_mensal_individual)
    .filter(Boolean);
  if (!incomes.length) return 'N/A';
  const avg = Math.round(incomes.reduce((a: number, b: number) => a + b, 0) / incomes.length);
  return `R$ ${avg.toLocaleString('pt-BR')}`;
}

// ── Donut Chart (SVG) ───────────────────────────────────────────────────────
function DonutChart({ items, size = 160 }: { items: DistItem[]; size?: number }) {
  const total = items.reduce((sum, i) => sum + i.count, 0);
  if (total === 0) return null;

  const radius = size / 2 - 20;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  let offset = 0;
  const segments = items.map(item => {
    const len = (item.count / total) * circumference;
    const seg = { ...item, len, offset };
    offset += len;
    return seg;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={22} />
      {segments.map((seg, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={seg.color}
          strokeWidth={22}
          strokeDasharray={`${seg.len} ${circumference}`}
          strokeDashoffset={-seg.offset}
          strokeLinecap="round"
          className="transition-all duration-[1500ms] ease-out"
          style={{ opacity: 0.85 }}
        />
      ))}
    </svg>
  );
}

// ── Horizontal Bar ───────────────────────────────────────────────────────────
function HBar({ items, maxItems = 10 }: { items: DistItem[]; maxItems?: number }) {
  const display = items.slice(0, maxItems);
  const maxPct = Math.max(...display.map(i => i.pct), 1);

  return (
    <div className="space-y-4">
      {display.map((item, idx) => (
        <div key={item.label} className="group/bar">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm text-zinc-300 font-medium truncate max-w-[65%]">
              {item.label}
            </span>
            <span className="text-sm font-bold text-white tabular-nums">
              {item.pct}%
              <span className="text-zinc-500 ml-1.5 text-xs">({item.count.toLocaleString('pt-BR')})</span>
            </span>
          </div>
          <div className="h-3 rounded-full overflow-hidden bg-zinc-900/80">
            <div
              className="h-full rounded-full transition-all duration-[1200ms] ease-out group-hover/bar:brightness-125"
              style={{
                width: `${(item.pct / maxPct) * 100}%`,
                backgroundColor: item.color,
                opacity: 0.85,
                transitionDelay: `${idx * 80}ms`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Stacked Bar ──────────────────────────────────────────────────────────────
function StackedBar({ items }: { items: DistItem[] }) {
  return (
    <div>
      <div className="h-8 rounded-full overflow-hidden flex bg-zinc-900/80">
        {items.map((item) => (
          <div
            key={item.label}
            className="h-full transition-all duration-[1500ms] ease-out flex items-center justify-center"
            style={{
              width: `${item.pct}%`,
              backgroundColor: item.color,
              opacity: 0.85,
            }}
          >
            {item.pct >= 10 && (
              <span className="text-[10px] font-black text-white drop-shadow-sm">{item.pct}%</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: item.color, opacity: 0.85 }}
            />
            <span className="text-xs text-zinc-400 font-medium">
              {item.label}
              <span className="text-zinc-500 ml-1">({item.count.toLocaleString('pt-BR')})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Analytics Card Wrapper ───────────────────────────────────────────────────
function AnalyticsCard({
  title,
  icon: Icon,
  children,
  delay = 0,
  className,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'group relative bg-zinc-950/70 border border-white/[0.06] rounded-2xl p-6',
        'hover:border-white/[0.12] hover:bg-zinc-950/90',
        'transition-all duration-300 animate-fade-in-up backdrop-blur-sm',
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center">
          <Icon size={18} className="text-zinc-400" />
        </div>
        <h3 className="text-xs font-black uppercase tracking-[0.15em] text-zinc-400">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, subtitle, icon: Icon, color }: {
  label: string;
  value: string;
  subtitle?: string;
  icon: any;
  color: string;
}) {
  return (
    <div className="flex items-center gap-4 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon size={22} style={{ color }} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</p>
        <p className="text-lg font-bold text-white">{value}</p>
        {subtitle && <p className="text-xs text-zinc-500">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Donut Card with Legend ────────────────────────────────────────────────────
function DonutCard({ title, icon, items, delay }: {
  title: string;
  icon: any;
  items: DistItem[];
  delay: number;
}) {
  return (
    <AnalyticsCard title={title} icon={icon} delay={delay}>
      <div className="flex items-center gap-6">
        <DonutChart items={items} size={140} />
        <div className="flex-1 space-y-2.5">
          {items.map(item => (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-zinc-300">{item.label}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-white">{item.pct}%</span>
                <span className="text-xs text-zinc-500 ml-1.5">({item.count.toLocaleString('pt-BR')})</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnalyticsCard>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function DashboardAnalytics({ personas }: DashboardAnalyticsProps) {
  if (!personas.length) return null;

  const genderDist = computeDistribution(personas, 'gender_identity', GENDER_COLORS);
  const generationDist = computeDistribution(personas, 'generation', GENERATION_COLORS);
  const politicalDist = computeDistribution(personas, 'political_leaning', POLITICAL_COLORS);
  const religionDist = computeDistribution(personas, 'macro_religion', {
    'Católico': '#f59e0b',
    'Evangélico/Protestante': '#a78bfa',
    'Espírita (Kardecista)': '#22d3ee',
    'Ateu/Agnóstico': '#71717a',
    'Matriz Africana (Candomblé/Umbanda)': '#10b981',
    'Espiritualidade Eclética': '#ec4899',
    'Judaísmo': '#3b82f6',
    'Islamismo': '#ef4444',
    'Outros': '#525252',
  });
  const regionDist = computeDistribution(personas, 'region_br', REGION_COLORS);
  const classDist = computeDistribution(personas, 'social_class', {
    'A': '#10b981',
    'B1': '#22d3ee',
    'B2': '#3b82f6',
    'C1': '#a78bfa',
    'C2': '#f59e0b',
    'D': '#f97316',
    'E': '#ef4444',
  });
  const educationDist = computeDistribution(personas, 'education_level', {
    'Fundamental': '#ef4444',
    'Médio': '#f59e0b',
    'Superior Incompleto': '#22d3ee',
    'Superior Completo': '#3b82f6',
    'Pós-Graduação/MBA': '#a78bfa',
    'Mestrado/Doutorado': '#10b981',
  });
  const discDist = computeDistribution(personas, 'disc_main_factor', DISC_COLORS);

  const baseDelay = 200;

  return (
    <div className="w-full max-w-6xl mx-auto mt-10 mb-8">
      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent mb-10" />

      {/* Header */}
      <div className="flex items-center justify-center gap-4 mb-10 animate-fade-in-up" style={{ animationDelay: `${baseDelay}ms` }}>
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10 flex items-center justify-center border border-emerald-500/20">
          <TrendingUp size={22} className="text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Perfil Demográfico da Amostra
          </h2>
          <p className="text-sm text-zinc-500">
            Distribuição real das {personas.length.toLocaleString('pt-BR')} personas no banco
          </p>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-in-up" style={{ animationDelay: `${baseDelay + 100}ms` }}>
        <StatCard icon={Users} label="Total" value={`${personas.length.toLocaleString('pt-BR')}`} subtitle="personas" color="#10b981" />
        <StatCard icon={Calendar} label="Idade Média" value={`${avgAge(personas)} anos`} color="#a78bfa" />
        <StatCard icon={DollarSign} label="Renda Média" value={avgIncome(personas)} color="#f59e0b" />
        <StatCard icon={Briefcase} label="Perfis DISC" value={`${discDist.length} tipos`} color="#3b82f6" />
      </div>

      {/* Donut Charts - 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <DonutCard title="Gênero" icon={Heart} items={genderDist} delay={baseDelay + 200} />
        <DonutCard title="Geração" icon={Calendar} items={generationDist} delay={baseDelay + 280} />
        <DonutCard title="Perfil DISC" icon={Target} items={discDist} delay={baseDelay + 360} />
        <DonutCard title="Região" icon={MapPin} items={regionDist} delay={baseDelay + 440} />
      </div>

      {/* Bar Charts - 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        <AnalyticsCard title="Orientação Política" icon={Scale} delay={baseDelay + 520}>
          <HBar items={politicalDist} maxItems={10} />
        </AnalyticsCard>

        <AnalyticsCard title="Religião" icon={Sparkles} delay={baseDelay + 600}>
          <HBar items={religionDist} maxItems={9} />
        </AnalyticsCard>
      </div>

      {/* Full-width charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <AnalyticsCard title="Classe Social" icon={TrendingUp} delay={baseDelay + 680}>
          <StackedBar items={classDist} />
        </AnalyticsCard>

        <AnalyticsCard title="Escolaridade" icon={GraduationCap} delay={baseDelay + 760}>
          <HBar items={educationDist} maxItems={6} />
        </AnalyticsCard>
      </div>
    </div>
  );
}
