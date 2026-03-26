'use client';

import CalibrationHeader from '@/components/calibracao/CalibrationHeader';
import CalibrationInput from '@/components/calibracao/CalibrationInput';
import CalibrationResults from '@/components/calibracao/CalibrationResults';
import CalibrationMonitor from '@/components/calibracao/monitor/CalibrationMonitor';

export default function CalibracaoPage() {
  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      {/* Header */}
      <CalibrationHeader />

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — Input + Results */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-white/[0.06]">
          <CalibrationInput />
          <CalibrationResults />
        </div>

        {/* Right panel — Pipeline Monitor */}
        <div className="w-[560px] shrink-0 bg-zinc-950/50 overflow-hidden">
          <CalibrationMonitor />
        </div>
      </div>
    </div>
  );
}
