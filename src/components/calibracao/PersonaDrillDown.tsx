'use client';

import { X, User, MessageCircle, Vote, Brain, MapPin, GraduationCap, Heart, Shield, Briefcase, Scale } from 'lucide-react';
import type { PersonaBatchDetail } from '@/app/calibracao/store';

function scoreColor(score: number): string {
  if (score >= 7) return 'text-emerald-400';
  if (score >= 6) return 'text-emerald-500/70';
  if (score <= 3) return 'text-red-400';
  if (score <= 4) return 'text-red-500/70';
  return 'text-zinc-400';
}

function scoreBg(score: number): string {
  if (score >= 7) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 6) return 'bg-emerald-500/5 border-emerald-500/10';
  if (score <= 3) return 'bg-red-500/10 border-red-500/20';
  if (score <= 4) return 'bg-red-500/5 border-red-500/10';
  return 'bg-zinc-800/30 border-zinc-700/20';
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '' || value === 'null') return null;
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-[11px] text-zinc-600 w-32 shrink-0 uppercase tracking-wider">{label}</span>
      <span className="text-sm text-zinc-300">{String(value)}</span>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value?: number | null }) {
  if (value == null) return null;
  const percent = ((value + 1) / 2) * 100; // -1..1 → 0..100
  const isLeft = value < -0.1;
  const isRight = value > 0.1;

  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-zinc-600 uppercase tracking-wider">{label}</span>
        <span className={`text-xs font-semibold ${isLeft ? 'text-sky-400' : isRight ? 'text-amber-400' : 'text-zinc-400'}`}>
          {value.toFixed(2)}
        </span>
      </div>
      <div className="relative h-2 bg-zinc-800/50 rounded-full overflow-hidden">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-zinc-600/50" />
        <div
          className={`absolute top-0 bottom-0 rounded-full ${isLeft ? 'bg-sky-500/60' : isRight ? 'bg-amber-500/60' : 'bg-zinc-500/40'}`}
          style={{
            left: isLeft ? `${percent}%` : '50%',
            width: `${Math.abs(percent - 50)}%`,
          }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-zinc-700 mt-0.5">
        <span>Esq -1</span>
        <span>Centro</span>
        <span>Dir +1</span>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-zinc-500">{icon}</span>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function JsonSection({ title, data }: { title: string; data?: Record<string, any> | null }) {
  if (!data || Object.keys(data).length === 0) return null;

  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">{title}</h4>
      <div className="space-y-1">
        {Object.entries(data).map(([key, val]) => {
          if (val == null || val === '' || val === 'null') return null;
          if (typeof val === 'object') {
            return (
              <div key={key} className="py-1">
                <span className="text-[10px] text-zinc-600 uppercase tracking-wider">{key}</span>
                <pre className="text-xs text-zinc-400 mt-0.5 whitespace-pre-wrap">{JSON.stringify(val, null, 2)}</pre>
              </div>
            );
          }
          return <Field key={key} label={key} value={val} />;
        })}
      </div>
    </div>
  );
}

interface Props {
  persona: PersonaBatchDetail;
  onClose: () => void;
}

export default function PersonaDrillDown({ persona, onClose }: Props) {
  const p = persona.profile;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm">
      {/* Slide-in panel from right */}
      <div className="bg-zinc-950 border-l border-white/[0.08] shadow-2xl shadow-black/60 w-full max-w-xl h-full flex flex-col animate-in slide-in-from-right-4 duration-300">
        {/* Header */}
        <div className="shrink-0 px-6 py-5 border-b border-white/[0.06]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-zinc-800/50">
                <User size={22} className="text-zinc-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white tracking-tight">{persona.name}</h2>
                <p className="text-sm text-zinc-500 mt-0.5">
                  {persona.age} anos | {p?.gender || '?'} | {persona.state}
                  {p?.city ? ` / ${p.city}` : ''}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.08] text-zinc-500 hover:text-white transition-all duration-200">
              <X size={18} />
            </button>
          </div>

          {/* Score hero */}
          <div className={`mt-4 flex items-center gap-4 p-4 rounded-xl border ${scoreBg(persona.score)}`}>
            <div>
              <p className={`text-4xl font-bold tracking-tight ${scoreColor(persona.score)}`}>
                {persona.score.toFixed(1)}
              </p>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Score de Impacto</p>
            </div>
            <div className="h-10 w-px bg-white/[0.06]" />
            <div>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                persona.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : persona.sentiment === 'negative' ? 'bg-red-500/10 text-red-400 border-red-500/20'
                  : 'bg-zinc-700/50 text-zinc-400 border-zinc-600/30'
              }`}>
                {persona.sentiment === 'positive' ? 'A Favor' : persona.sentiment === 'negative' ? 'Contra' : 'Neutro'}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Comment */}
          {persona.comment && (
            <Section icon={<MessageCircle size={14} />} title="Comentario Gerado pela IA">
              <p className="text-sm text-zinc-200 leading-relaxed italic">
                &ldquo;{persona.comment}&rdquo;
              </p>
            </Section>
          )}

          {/* Demographics */}
          {p && (
            <Section icon={<MapPin size={14} />} title="Dados Demograficos">
              <div className="space-y-0.5 divide-y divide-white/[0.03]">
                <Field label="Genero" value={p.gender} />
                <Field label="Idade" value={persona.age} />
                <Field label="Estado" value={persona.state} />
                <Field label="Cidade" value={p.city} />
                <Field label="Regiao" value={p.region} />
                <Field label="Geracao" value={p.generation} />
                <Field label="Raca/Cor" value={p.race} />
                <Field label="Estado Civil" value={undefined} />
              </div>
            </Section>
          )}

          {/* Education & Class */}
          {p && (
            <Section icon={<GraduationCap size={14} />} title="Escolaridade & Classe">
              <div className="space-y-0.5 divide-y divide-white/[0.03]">
                <Field label="Escolaridade" value={p.education} />
                <Field label="Classe Social" value={p.social_class} />
                <Field label="Religiao" value={p.religion} />
                <Field label="Arquetipo" value={p.archetype} />
              </div>
            </Section>
          )}

          {/* Political Position */}
          {p && (
            <Section icon={<Vote size={14} />} title="Posicao Politica">
              <div className="space-y-0.5 divide-y divide-white/[0.03]">
                <Field label="Posicao" value={p.political_leaning} />
                <Field label="Cluster" value={p.cluster ? `${p.cluster} (${p.cluster_name || ''})` : undefined} />
                <Field label="Voto 2022" value={p.voto_2022} />
                <Field label="Voto 2026" value={p.voto_2026} />
                <Field label="Aprovacao Lula" value={p.aprovacao_lula} />
                <Field label="Aval. Bolsonaro" value={p.avaliacao_bolsonaro} />
              </div>
            </Section>
          )}

          {/* Ideological Scores */}
          {p && (p.score_eco != null || p.score_cost != null) && (
            <Section icon={<Scale size={14} />} title="Eixos Ideologicos">
              <ScoreBar label="Eixo Economico" value={p.score_eco} />
              <ScoreBar label="Eixo Costumes" value={p.score_cost} />
            </Section>
          )}

          {/* Career JSON */}
          <JsonSection title="Carreira / Profissao" data={p?.career} />

          {/* Psychology JSON */}
          <JsonSection title="Psicologia" data={p?.psychology} />

          {/* Beliefs JSON */}
          <JsonSection title="Crencas & Valores" data={p?.beliefs} />

          {/* Demographic JSON */}
          <JsonSection title="Dados Demograficos Extras" data={p?.demographic} />
        </div>
      </div>
    </div>
  );
}
