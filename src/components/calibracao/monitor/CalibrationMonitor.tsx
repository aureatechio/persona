'use client';

import CalibrationPipeline from './CalibrationPipeline';
import StepDetail from './StepDetail';

export default function CalibrationMonitor() {
  return (
    <div className="flex flex-col h-full">
      {/* Pipeline sidebar (top) */}
      <div className="shrink-0 border-b border-white/[0.06]">
        <CalibrationPipeline />
      </div>

      {/* Step detail (fills remaining space) */}
      <StepDetail />
    </div>
  );
}
