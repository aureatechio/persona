'use client';

import { InsightCard, type InsightCardData } from './InsightCard';
import { cn } from '@/lib/utils';

interface FloatingCardRowProps {
  cards: InsightCardData[];
  speed: number;
  direction: 'left' | 'right';
  size: 'sm' | 'md' | 'lg';
  opacity: number;
}

export function FloatingCardRow({ cards, speed, direction, size, opacity }: FloatingCardRowProps) {
  // Scale factor for depth effect - smaller cards appear further away
  const scale = size === 'sm' ? 0.9 : size === 'md' ? 0.95 : 1;
  const blur = size === 'sm' ? 'blur-[0.5px]' : '';

  return (
    <div
      className={cn('overflow-hidden w-full', blur)}
      style={{
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'center',
      }}
    >
      <div
        className={cn(
          'flex gap-3',
          direction === 'left' ? 'animate-marquee-left' : 'animate-marquee-right',
        )}
        style={{ '--marquee-speed': `${speed}s` } as React.CSSProperties}
      >
        {/* Triple set for smoother infinite loop */}
        {cards.map((card, idx) => (
          <InsightCard key={`a-${idx}`} data={card} size={size} />
        ))}
        {cards.map((card, idx) => (
          <InsightCard key={`b-${idx}`} data={card} size={size} />
        ))}
        {cards.map((card, idx) => (
          <InsightCard key={`c-${idx}`} data={card} size={size} />
        ))}
      </div>
    </div>
  );
}
