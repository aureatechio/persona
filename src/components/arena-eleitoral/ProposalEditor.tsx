'use client';

import { useState } from 'react';
import {
  Zap, Target, Users, ChevronRight, ChevronDown, RotateCcw,
  AlertTriangle, MessageCircle, ClipboardList, Scale, Shield,
} from 'lucide-react';
import type { CounterProposal, CriticismCategory, CandidateColorSet } from '@/lib/arena-eleitoral/types';
import { LEANING_COLORS } from '@/lib/arena-eleitoral/constants';

interface ProposalEditorProps {
  proposals: CounterProposal[];
  loserName: string;
  loserParty?: string;
  loserLeaning?: string;
  winnerName: string;
  criticisms: CriticismCategory[];
  onToggle: (id: string) => void;
  onEditDescription: (id: string, description: string) => void;
  onReSimulate: () => void;
}

function SectionLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon size={14} className="text-zinc-500" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
    </div>
  );
}

export function ProposalEditor({
  proposals,
  loserName,
  loserParty,
  loserLeaning,
  winnerName,
  criticisms,
  onToggle,
  onEditDescription,
  onReSimulate,
}: ProposalEditorProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const enabledCount = proposals.filter((p) => p.enabled).length;
  const totalEstimatedFlip = proposals
    .filter((p) => p.enabled)
    .reduce((sum, p) => sum + p.estimatedFlip, 0);

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // Lookup criticism by matching targetCriticism text
  const findCriticism = (targetCriticism: string): CriticismCategory | undefined => {
    return criticisms.find(
      (c) => c.category.toLowerCase() === targetCriticism.toLowerCase()
    );
  };

  const leaningColors = loserLeaning ? LEANING_COLORS[loserLeaning] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white tracking-tight">
            Plano Estratégico para {loserName}
          </h3>
          <p className="text-sm text-zinc-400 mt-1">
            Propostas para reverter a derrota — ative, edite ou desative antes de re-simular
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-400">
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
            {enabledCount} ativas
          </span>
          <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
            ~{totalEstimatedFlip} votos estimados
          </span>
          {loserLeaning && leaningColors && (
            <span className={`px-2.5 py-1 rounded-full ${leaningColors.bg} ${leaningColors.text} border ${leaningColors.border} font-semibold text-[10px] uppercase tracking-wider`}>
              {loserLeaning}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {proposals.map((proposal) => {
          const isOpen = !!expanded[proposal.id];
          const linkedCriticism = findCriticism(proposal.targetCriticism);
          const hasActionPlan = proposal.actionPlan && proposal.actionPlan.length > 0;

          return (
            <div
              key={proposal.id}
              className={`border rounded-2xl transition-all duration-300 overflow-hidden ${
                proposal.enabled
                  ? 'bg-emerald-500/[0.03] border-emerald-500/20'
                  : 'bg-white/[0.02] border-white/[0.06] opacity-60'
              }`}
            >
              {/* Collapsed Header */}
              <div className="p-5 flex items-start gap-4">
                {/* Toggle switch */}
                <button
                  onClick={() => onToggle(proposal.id)}
                  className={`shrink-0 w-12 h-7 rounded-full p-0.5 transition-all duration-300 ${
                    proposal.enabled ? 'bg-emerald-500' : 'bg-zinc-700'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-300 ${
                    proposal.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>

                {/* Title + target */}
                <button
                  onClick={() => toggle(proposal.id)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Zap size={14} className="text-emerald-400 shrink-0" />
                    <h4 className="text-sm font-semibold text-white truncate">{proposal.title}</h4>
                  </div>
                  <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                    <Target size={10} className="shrink-0" />
                    Alvo: {proposal.targetCriticism}
                  </p>
                </button>

                {/* Estimated flip + expand arrow */}
                <div className="shrink-0 flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">+{proposal.estimatedFlip}</p>
                    <p className="text-[10px] text-zinc-500">votos est.</p>
                  </div>
                  <button
                    onClick={() => toggle(proposal.id)}
                    className="p-1 rounded-lg hover:bg-white/[0.06] transition-colors duration-200"
                  >
                    <ChevronDown
                      size={16}
                      className={`text-zinc-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* Expanded Strategic Plan */}
              {isOpen && (
                <div className="px-5 pb-5 space-y-5 border-t border-white/[0.04] pt-4">
                  {/* Diagnóstico — linked criticism data */}
                  {linkedCriticism && (
                    <div>
                      <SectionLabel icon={AlertTriangle} label="Diagnóstico" />
                      <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 space-y-2.5">
                        <p className="text-xs text-zinc-300">
                          <span className="font-semibold text-white">&ldquo;{linkedCriticism.category}&rdquo;</span>
                          {' '}— {linkedCriticism.voterCount} eleitores de {winnerName} criticam isso
                        </p>
                        {linkedCriticism.behavioralProfiles && linkedCriticism.behavioralProfiles.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {linkedCriticism.behavioralProfiles.map((p, j) => (
                              <span key={j} className="px-2 py-0.5 rounded-full bg-white/[0.04] text-zinc-400 text-[10px] border border-white/[0.06]">
                                {p.label} ({p.percentage}%)
                              </span>
                            ))}
                          </div>
                        )}
                        {linkedCriticism.keyObjection && (
                          <p className="text-xs text-zinc-500 italic">
                            &ldquo;{linkedCriticism.keyObjection}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Strategic Rationale */}
                  {proposal.strategicRationale && (
                    <div>
                      <SectionLabel icon={Scale} label="Racional Estratégico" />
                      <p className="text-xs text-zinc-400 leading-relaxed bg-white/[0.02] border border-white/[0.04] rounded-xl px-4 py-3">
                        {proposal.strategicRationale}
                      </p>
                    </div>
                  )}

                  {/* Action Plan */}
                  {hasActionPlan && (
                    <div>
                      <SectionLabel icon={ClipboardList} label="Plano de Ação" />
                      <div className="space-y-2">
                        {proposal.actionPlan.map((step) => (
                          <div key={step.step} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                            <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-emerald-400">{step.step}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-zinc-300 leading-relaxed">{step.action}</p>
                            </div>
                            <span className="text-[10px] text-zinc-600 shrink-0 whitespace-nowrap">{step.timeline}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ideological Fit */}
                  {proposal.ideologicalFit && (
                    <div>
                      <SectionLabel icon={Scale} label="Coerência Ideológica" />
                      <div className="flex items-start gap-3">
                        {loserLeaning && leaningColors && (
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${leaningColors.bg} ${leaningColors.text} border ${leaningColors.border}`}>
                            {loserLeaning}
                          </span>
                        )}
                        <p className="text-xs text-zinc-400 leading-relaxed flex-1">{proposal.ideologicalFit}</p>
                      </div>
                    </div>
                  )}

                  {/* Voter Message */}
                  {proposal.voterMessage && (
                    <div>
                      <SectionLabel icon={MessageCircle} label="Mensagem ao Eleitor" />
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                        <p className="text-sm text-zinc-200 font-medium italic leading-relaxed">
                          &ldquo;{proposal.voterMessage}&rdquo;
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Target Demographics */}
                  {proposal.affectedDemographics && (
                    <div>
                      <SectionLabel icon={Users} label="Público-Alvo" />
                      <div className="flex flex-wrap items-start gap-3">
                        {proposal.targetClusters.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {proposal.targetClusters.map((c) => (
                              <span key={c} className="px-2 py-0.5 rounded-full bg-white/[0.04] text-zinc-400 text-[10px] border border-white/[0.06]">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-zinc-400 leading-relaxed">{proposal.affectedDemographics}</p>
                      </div>
                    </div>
                  )}

                  {/* Risk */}
                  {proposal.risk && (
                    <div>
                      <SectionLabel icon={Shield} label="Risco" />
                      <p className="text-xs text-amber-400/80 leading-relaxed bg-amber-500/5 border border-amber-500/10 rounded-xl px-4 py-3">
                        {proposal.risk}
                      </p>
                    </div>
                  )}

                  {/* Impact Bar */}
                  <div>
                    <SectionLabel icon={Zap} label="Impacto Estimado" />
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 rounded-full bg-zinc-800/50 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min((proposal.estimatedFlip / 80) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-emerald-400 shrink-0">~{proposal.estimatedFlip} votos</span>
                    </div>
                  </div>

                  {/* Editable Description */}
                  <div>
                    <SectionLabel icon={ClipboardList} label="Editar Descrição" />
                    <textarea
                      value={proposal.description}
                      onChange={(e) => onEditDescription(proposal.id, e.target.value)}
                      disabled={!proposal.enabled}
                      rows={3}
                      className="w-full px-4 py-3 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-zinc-300 placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Re-simulate button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={onReSimulate}
          disabled={enabledCount === 0}
          className="inline-flex items-center gap-3 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-base rounded-2xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw size={20} />
          Re-simular com {enabledCount} Proposta{enabledCount !== 1 ? 's' : ''}
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
