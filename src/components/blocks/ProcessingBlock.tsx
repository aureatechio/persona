'use client';

import { SpectacularProcessing } from '@/components/arena/SpectacularProcessing';

interface ProcessingBlockProps {
  data: {
    type?: 'arena' | 'electoral' | 'personas' | 'generic';
    question?: string;
    pipelinePhase?: string;
    processedCount?: number;
    totalCount?: number;
    candidateA?: string;
    candidateB?: string;
  };
}

export function ProcessingBlock({ data }: ProcessingBlockProps) {
  const { question, pipelinePhase, processedCount = 0, totalCount = 0 } = data;

  // Build the question display
  let displayQuestion = question;
  if (!displayQuestion && data.candidateA && data.candidateB) {
    displayQuestion = `${data.candidateA} vs ${data.candidateB}`;
  }

  // All types now get the spectacular processing experience
  return (
    <SpectacularProcessing
      question={displayQuestion}
      pipelinePhase={pipelinePhase}
      processedCount={processedCount}
      totalCount={totalCount}
    />
  );
}
