'use client';

import { useEffect, useRef } from 'react';
import type { ConversationBlock } from '@/hooks/useConversation';

interface ConversationAreaProps {
  blocks: ConversationBlock[];
  renderBlock: (block: ConversationBlock) => React.ReactNode;
  welcomeScreen?: React.ReactNode;
}

export function ConversationArea({ blocks, renderBlock, welcomeScreen }: ConversationAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new blocks arrive
  useEffect(() => {
    if (blocks.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [blocks.length]);

  if (blocks.length === 0 && welcomeScreen) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto relative z-10">
        {welcomeScreen}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto scroll-smooth pb-4"
    >
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
        {blocks.map(block => (
          <div key={block.id} className="animate-fade-in-up">
            {renderBlock(block)}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
