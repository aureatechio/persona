'use client';

import CalibrationPipeline from './CalibrationPipeline';
import StepDetail from './StepDetail';

export default function CalibrationMonitor() {
  return (
    <div className="flex h-full">
      {/* Pipeline sidebar (left, scrollable) */}
      <div className="w-[200px] shrink-0 border-r border-white/[0.06] overflow-y-auto">
        <CalibrationPipeline />
      </div>

      {/* Step detail (fills remaining space, scrollable) */}
      <div className="flex-1 overflow-y-auto">
        <StepDetail />
      </div>
    </div>
  );
}
