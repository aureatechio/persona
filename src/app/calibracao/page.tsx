'use client';

import CalibrationHeader from '@/components/calibracao/CalibrationHeader';
import CalibrationInput from '@/components/calibracao/CalibrationInput';
import CalibrationResults from '@/components/calibracao/CalibrationResults';
import CalibrationMonitor from '@/components/calibracao/monitor/CalibrationMonitor';

export default function CalibracaoPage() {
  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      {/* Subtle grid texture */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.015)_1px,_transparent_0)] bg-[size:32px_32px] pointer-events-none" />

      {/* Header */}
      <CalibrationHeader />

      {/* Split layout */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Left panel — Input + Results */}
        <div className="flex-1 flex flex-col min-w-0">
          <CalibrationInput />
          <CalibrationResults />
        </div>

        {/* Divider with glow */}
        <div className="relative w-px shrink-0">
          <div className="absolute inset-0 bg-white/[0.06]" />
          <div className="absolute top-1/4 bottom-1/4 w-px bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent" />
        </div>

        {/* Right panel — Pipeline Monitor (wider for prompt readability) */}
        <div className="w-[720px] shrink-0 bg-gradient-to-b from-zinc-950/80 to-black overflow-hidden">
          <CalibrationMonitor />
        </div>
      </div>
    </div>
  );
}
