'use client';

import { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, MessageCircle, ChevronDown, Users, BarChart3, Brain, Smartphone, Quote } from 'lucide-react';
import type { CriticismCategory } from '@/lib/arena-eleitoral/types';

interface CriticismPanelProps {
  criticisms: CriticismCategory[];
  winnerName: string;
}

const SEVERITY_STYLES = {
  high: {
    border: 'border-l-red-500',
    bg: 'bg-red-500/5',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
    icon: AlertTriangle,
    label: 'Alta',
    accent: 'text-red-400',
  },
  medium: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-500/5',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    icon: AlertCircle,
    label: 'Média',
    accent: 'text-amber-400',
  },
  low: {
    border: 'border-l-zinc-500',
    bg: 'bg-zinc-500/5',
    badge: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    icon: Info,
    label: 'Baixa',
    accent: 'text-zinc-400',
  },
};

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <Icon size={14} className="text-zinc-500" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
    </div>
  );
}

export function CriticismPanel({ criticisms, winnerName }: CriticismPanelProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  if (!criticisms.length) {
    return (
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 text-center">
        <div className="p-4 rounded-2xl bg-zinc-900/50 inline-block mb-4">
          <MessageCircle size={32} className="text-zinc-600" />
        </div>
        <p className="text-zinc-500 text-sm">Nenhuma crítica identificada</p>
      </div>
    );
  }

  const sorted = [...criticisms].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  const toggle = (i: number) => setExpanded((prev) => ({ ...prev, [i]: !prev[i] }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white tracking-tight">
          Críticas dos eleitores de {winnerName}
        </h3>
        <span className="text-xs text-zinc-500">{criticisms.length} categorias</span>
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed">
        Pontos que os próprios eleitores de {winnerName} criticam nele — oportunidades para o oponente explorar.
      </p>

      <div className="space-y-4">
        {sorted.map((criticism, i) => {
          const style = SEVERITY_STYLES[criticism.severity];
          const SeverityIcon = style.icon;
          const isOpen = !!expanded[i];
          const hasBehavioral = criticism.behavioralProfiles && criticism.behavioralProfiles.length > 0;
          const hasDemographics = criticism.dominantAge || criticism.dominantRegion;

          return (
            <div
              key={i}
              className={`${style.bg} border border-white/[0.06] border-l-4 ${style.border} rounded-2xl transition-all duration-300 overflow-hidden`}
            >
              {/* Collapsed Header — always visible */}
              <button
                onClick={() => toggle(i)}
                className="w-full text-left p-5 flex items-start justify-between gap-4"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <SeverityIcon size={18} className={style.accent} />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-white">{criticism.category}</h4>
                    <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{criticism.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${style.badge}`}>
                    {style.label}
                  </span>
                  <span className="text-xs text-zinc-500">
                    ~{criticism.voterCount} eleitores
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-zinc-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              {/* Expanded Content */}
              {isOpen && (
                <div className="px-5 pb-5 space-y-5 border-t border-white/[0.04] pt-4">
                  {/* Affected clusters */}
                  {criticism.affectedClusters.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {criticism.affectedClusters.map((c) => (
                        <span key={c} className="px-2 py-0.5 rounded-full bg-white/[0.04] text-zinc-400 text-[10px] border border-white/[0.06]">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Behavioral Profiles */}
                  {hasBehavioral && (
                    <div>
                      <SectionHeader icon={BarChart3} label="Perfil dos Críticos" />
                      <div className="space-y-2.5">
                        {criticism.behavioralProfiles.map((profile, j) => (
                          <div key={j} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                            <div className="shrink-0 mt-0.5">
                              <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                                <span className="text-xs font-bold text-white">{profile.percentage}%</span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-zinc-200">{profile.label}</p>
                              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{profile.insight}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Demographics */}
                  {hasDemographics && (
                    <div>
                      <SectionHeader icon={Users} label="Demografia Dominante" />
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {criticism.dominantAge && (
                          <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2.5">
                            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Idade</p>
                            <p className="text-xs text-zinc-300 font-medium mt-0.5">{criticism.dominantAge}</p>
                          </div>
                        )}
                        {criticism.dominantRegion && (
                          <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2.5">
                            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Região</p>
                            <p className="text-xs text-zinc-300 font-medium mt-0.5">{criticism.dominantRegion}</p>
                          </div>
                        )}
                        {criticism.dominantEducation && (
                          <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2.5">
                            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Educação</p>
                            <p className="text-xs text-zinc-300 font-medium mt-0.5">{criticism.dominantEducation}</p>
                          </div>
                        )}
                        {criticism.dominantSocialClass && (
                          <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2.5">
                            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Classe Social</p>
                            <p className="text-xs text-zinc-300 font-medium mt-0.5">{criticism.dominantSocialClass}</p>
                          </div>
                        )}
                        {criticism.dominantReligion && (
                          <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2.5">
                            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Religião</p>
                            <p className="text-xs text-zinc-300 font-medium mt-0.5">{criticism.dominantReligion}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Media Pattern */}
                  {criticism.mediaPattern && (
                    <div>
                      <SectionHeader icon={Smartphone} label="Padrão de Mídia" />
                      <p className="text-xs text-zinc-400 leading-relaxed bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2.5">
                        {criticism.mediaPattern}
                      </p>
                    </div>
                  )}

                  {/* Psychological Trait */}
                  {criticism.psychologicalTrait && (
                    <div>
                      <SectionHeader icon={Brain} label="Perfil Psicológico" />
                      <p className="text-xs text-zinc-400 leading-relaxed bg-white/[0.02] border border-white/[0.04] rounded-xl px-3 py-2.5">
                        {criticism.psychologicalTrait}
                      </p>
                    </div>
                  )}

                  {/* Key Objection */}
                  {criticism.keyObjection && (
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                      <SectionHeader icon={Quote} label="Objeção Central" />
                      <p className="text-sm text-zinc-200 font-medium italic leading-relaxed">
                        &ldquo;{criticism.keyObjection}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Sample Comments */}
                  {criticism.sampleComments.length > 0 && (
                    <div>
                      <SectionHeader icon={MessageCircle} label="Comentários Exemplo" />
                      <div className="space-y-1.5 pl-3 border-l-2 border-white/[0.06]">
                        {criticism.sampleComments.map((comment, j) => (
                          <p key={j} className="text-xs text-zinc-500 italic leading-relaxed">
                            &ldquo;{comment}&rdquo;
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
