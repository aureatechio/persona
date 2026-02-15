'use client';

import { useState } from 'react';
import { Search, Plus, Swords, ChevronRight, X } from 'lucide-react';
import type { Politician, PoliticalLeaning } from '@/lib/arena-eleitoral/types';
import { POLITICIANS, LEANING_COLORS, getCandidateColors } from '@/lib/arena-eleitoral/constants';
import { CandidateAvatar } from './CandidateAvatar';

interface CandidateSelectorProps {
  onStart: (candidateA: Politician, candidateB: Politician) => void;
}

function LeaningBadge({ leaning }: { leaning?: PoliticalLeaning }) {
  if (!leaning) return null;
  const colors = LEANING_COLORS[leaning] || LEANING_COLORS.centro;
  const labels: Record<string, string> = {
    esquerda: 'Esquerda',
    'centro-esquerda': 'Centro-Esq.',
    centro: 'Centro',
    'centro-direita': 'Centro-Dir.',
    direita: 'Direita',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${colors.bg} ${colors.text} border ${colors.border}`}>
      {labels[leaning] || leaning}
    </span>
  );
}

function PoliticianCard({
  politician,
  isSelected,
  onClick,
}: {
  politician: Politician;
  isSelected: boolean;
  onClick: () => void;
}) {
  const colors = getCandidateColors(politician);
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ${
        isSelected
          ? `${colors.bg} ${colors.border} shadow-lg ${colors.glow}`
          : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12]'
      }`}
    >
      <CandidateAvatar politician={politician} size="sm" />
      <div className="flex-1 text-left">
        <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
          {politician.name}
        </p>
        <p className="text-xs text-zinc-500">
          {politician.party && `${politician.party} · `}{politician.position}
        </p>
      </div>
      <LeaningBadge leaning={politician.leaning} />
    </button>
  );
}

function CustomPoliticianForm({
  onAdd,
  onCancel,
}: {
  onAdd: (p: Politician) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [party, setParty] = useState('');
  const [position, setPosition] = useState('');
  const [leaning, setLeaning] = useState<PoliticalLeaning>('centro');

  const handleSubmit = () => {
    if (!name.trim()) return;
    onAdd({
      id: `custom_${Date.now()}`,
      name: name.trim(),
      party: party.trim() || undefined,
      position: position.trim() || undefined,
      leaning,
      isCustom: true,
    });
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Político Customizado</p>
        <button onClick={onCancel} className="p-1 rounded-lg hover:bg-white/[0.1] text-zinc-400 hover:text-white transition-colors duration-200">
          <X size={16} />
        </button>
      </div>
      <input
        type="text"
        placeholder="Nome do político"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-4 py-3 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
      />
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Partido (ex: PT)"
          value={party}
          onChange={(e) => setParty(e.target.value)}
          className="w-full px-4 py-3 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
        />
        <input
          type="text"
          placeholder="Cargo (ex: Governador)"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="w-full px-4 py-3 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
        />
      </div>
      <div>
        <p className="text-xs font-medium text-zinc-500 mb-2">Posicionamento</p>
        <div className="flex flex-wrap gap-2">
          {(['esquerda', 'centro-esquerda', 'centro', 'centro-direita', 'direita'] as PoliticalLeaning[]).map((l) => (
            <button
              key={l}
              onClick={() => setLeaning(l)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                leaning === l
                  ? `${LEANING_COLORS[l].bg} ${LEANING_COLORS[l].text} ${LEANING_COLORS[l].border}`
                  : 'bg-white/[0.03] text-zinc-400 border-white/[0.06] hover:bg-white/[0.06]'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={handleSubmit}
        disabled={!name.trim()}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus size={16} />
        Adicionar
      </button>
    </div>
  );
}

export function CandidateSelector({ onStart }: CandidateSelectorProps) {
  const [candidateA, setCandidateA] = useState<Politician | null>(null);
  const [candidateB, setCandidateB] = useState<Politician | null>(null);
  const [search, setSearch] = useState('');
  const [showCustomA, setShowCustomA] = useState(false);
  const [showCustomB, setShowCustomB] = useState(false);

  const filtered = POLITICIANS.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.party && p.party.toLowerCase().includes(search.toLowerCase()))
  );

  const canStart = candidateA && candidateB && candidateA.id !== candidateB.id;

  const colorsA = candidateA ? getCandidateColors(candidateA) : null;
  const colorsB = candidateB ? getCandidateColors(candidateB) : null;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-rose-500/10 to-sky-500/10 border border-white/[0.06]">
          <Swords size={32} className="text-white" />
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          Arena Eleitoral
        </h2>
        <p className="text-zinc-400 text-lg max-w-lg mx-auto leading-relaxed">
          Selecione dois candidatos para simular uma eleição com nossas personas sintéticas
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md mx-auto">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          placeholder="Buscar político..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl text-sm text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200"
        />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-start">
        {/* Column A */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-3 h-3 rounded-full ${colorsA ? colorsA.dot : 'bg-zinc-600'}`} />
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
              Candidato A {candidateA && `— ${candidateA.name}`}
            </p>
          </div>

          {showCustomA ? (
            <CustomPoliticianForm
              onAdd={(p) => { setCandidateA(p); setShowCustomA(false); }}
              onCancel={() => setShowCustomA(false)}
            />
          ) : (
            <>
              {filtered.map((p) => (
                <PoliticianCard
                  key={p.id}
                  politician={p}
                  isSelected={candidateA?.id === p.id}
                  onClick={() => {
                    if (candidateB?.id === p.id) return;
                    setCandidateA(candidateA?.id === p.id ? null : p);
                  }}
                />
              ))}
              <button
                onClick={() => setShowCustomA(true)}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border border-dashed border-white/[0.1] hover:border-white/[0.2] text-zinc-500 hover:text-zinc-300 transition-all duration-200"
              >
                <Plus size={16} />
                <span className="text-sm">Político customizado</span>
              </button>
            </>
          )}
        </div>

        {/* VS Divider */}
        <div className="hidden lg:flex flex-col items-center justify-center py-12">
          <div className="relative">
            <div className="absolute -inset-6 bg-gradient-to-b from-rose-500/5 via-white/[0.02] to-sky-500/5 rounded-full blur-xl" />
            <div className="relative w-16 h-16 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center backdrop-blur-xl">
              <span className="text-xl font-black text-white tracking-tighter">VS</span>
            </div>
          </div>
          <div className="w-px h-32 bg-gradient-to-b from-rose-500/20 via-transparent to-sky-500/20 mt-4" />
        </div>

        {/* Mobile VS */}
        <div className="lg:hidden flex items-center justify-center py-4">
          <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
            <span className="text-sm font-black text-white">VS</span>
          </div>
        </div>

        {/* Column B */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-3 h-3 rounded-full ${colorsB ? colorsB.dot : 'bg-zinc-600'}`} />
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
              Candidato B {candidateB && `— ${candidateB.name}`}
            </p>
          </div>

          {showCustomB ? (
            <CustomPoliticianForm
              onAdd={(p) => { setCandidateB(p); setShowCustomB(false); }}
              onCancel={() => setShowCustomB(false)}
            />
          ) : (
            <>
              {filtered.map((p) => (
                <PoliticianCard
                  key={p.id}
                  politician={p}
                  isSelected={candidateB?.id === p.id}
                  onClick={() => {
                    if (candidateA?.id === p.id) return;
                    setCandidateB(candidateB?.id === p.id ? null : p);
                  }}
                />
              ))}
              <button
                onClick={() => setShowCustomB(true)}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border border-dashed border-white/[0.1] hover:border-white/[0.2] text-zinc-500 hover:text-zinc-300 transition-all duration-200"
              >
                <Plus size={16} />
                <span className="text-sm">Político customizado</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Start Button */}
      {canStart && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => onStart(candidateA!, candidateB!)}
            className="inline-flex items-center gap-3 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-base rounded-2xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/30 active:scale-[0.97] transition-all duration-200"
          >
            <Swords size={20} />
            Iniciar Simulação Eleitoral
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
