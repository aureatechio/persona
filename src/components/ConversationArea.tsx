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
  const lastBlockRef = useRef<HTMLDivElement>(null);
  const prevBlockCount = useRef(0);

  // When a NEW block is added, scroll to the top of that block (not the bottom)
  useEffect(() => {
    if (blocks.length > prevBlockCount.current && blocks.length > 0) {
      // Small delay to let the DOM render the new block
      requestAnimationFrame(() => {
        lastBlockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    prevBlockCount.current = blocks.length;
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
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {blocks.map((block, idx) => (
          <div
            key={block.id}
            ref={idx === blocks.length - 1 ? lastBlockRef : undefined}
            className="animate-fade-in-up"
          >
            {renderBlock(block)}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
