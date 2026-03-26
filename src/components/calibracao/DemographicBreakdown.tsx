'use client';

import { useState } from 'react';
import { SegmentCard } from '@/app/arena/components/SegmentCard';
import type { AllSegments } from '@/app/calibracao/store';

const TABS = [
  {
    id: 'demografico',
    label: 'Demografico',
    segments: [
      { key: 'gender', title: 'Genero', accent: 'violet' },
      { key: 'race', title: 'Etnia', accent: 'amber' },
      { key: 'generation', title: 'Faixa Etaria', accent: 'cyan' },
      { key: 'religion', title: 'Religiao', accent: 'rose' },
      { key: 'region', title: 'Regiao', accent: 'sky' },
      { key: 'socialClass', title: 'Classe Social', accent: 'orange' },
      { key: 'education', title: 'Escolaridade', accent: 'emerald' },
    ],
  },
  {
    id: 'eleitoral',
    label: 'Eleitoral',
    segments: [
      { key: 'voto2022', title: 'Voto 2022', accent: 'amber' },
      { key: 'voto2026', title: 'Intencao 2026', accent: 'sky' },
      { key: 'aprovacaoLula', title: 'Aprovacao Lula', accent: 'rose' },
      { key: 'politicalLeaning', title: 'Pos. Politica', accent: 'violet' },
    ],
  },
  {
    id: 'ideologico',
    label: 'Ideologico',
    segments: [
      { key: 'scoreEco', title: 'Espectro Economico', accent: 'emerald' },
      { key: 'scoreCost', title: 'Espectro Comportamental', accent: 'fuchsia' },
      { key: 'archetype', title: 'Arquetipos', accent: 'cyan' },
      { key: 'clusterMacro', title: 'Cluster Macro', accent: 'indigo' },
    ],
  },
] as const;

export default function DemographicBreakdown({ segments }: { segments: AllSegments | null }) {
  const [activeTab, setActiveTab] = useState('demografico');

  if (!segments) return null;

  const currentTab = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 p-1 rounded-xl bg-white/[0.02] border border-white/[0.04] w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-white/[0.08] text-white border border-white/[0.1]'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Segment grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {currentTab.segments.map((seg) => {
          const items = (segments as any)[seg.key];
          if (!items || !Array.isArray(items) || items.length === 0) return null;
          return (
            <SegmentCard
              key={seg.key}
              items={items}
              title={seg.title}
              accentColor={seg.accent}
              maxItems={10}
            />
          );
        })}
      </div>
    </div>
  );
}
