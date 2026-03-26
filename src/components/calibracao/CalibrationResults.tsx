'use client';

import { useCalibrationStore } from '@/app/calibracao/store';
import { ScoreHero } from '@/app/arena/components/ScoreHero';
import SentimentGauge from './SentimentGauge';
import DemographicBreakdown from './DemographicBreakdown';
import PersonaSampleList from './PersonaSampleList';
import { Loader2 } from 'lucide-react';

export default function CalibrationResults() {
  const { progress, segments, isProcessing, question } = useCalibrationStore();
  const { processed, total, positive, negative, neutral, avgScore } = progress;

  if (!question && total === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 rounded-2xl bg-zinc-900/50 mb-4">
          <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-zinc-600">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </div>
        <p className="text-zinc-500 text-sm">Digite uma pergunta ou envie uma midia</p>
        <p className="text-zinc-600 text-xs mt-1">O pipeline completo sera executado igual a producao</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-5">
      {/* Progress bar during processing */}
      {isProcessing && total > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 size={14} className="text-emerald-400 animate-spin" />
            <span className="text-sm text-zinc-300">
              {processed.toLocaleString()} / {total.toLocaleString()} personas
            </span>
          </div>
          <div className="w-full h-1.5 bg-zinc-800/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${total > 0 ? (processed / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Score Hero + Sentiment side by side */}
      {processed > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ScoreHero
            avgScore={avgScore}
            processedCount={processed}
            isLive={isProcessing}
          />
          <SentimentGauge
            avgScore={avgScore}
            positive={positive}
            negative={negative}
            neutral={neutral}
            total={processed}
          />
        </div>
      )}

      {/* Demographic / Electoral / Ideological tabs */}
      {segments && <DemographicBreakdown segments={segments} />}

      {/* Persona list */}
      <PersonaSampleList />
    </div>
  );
}
