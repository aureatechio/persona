'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { Politician } from '@/lib/arena-eleitoral/types';
import { getCandidateColors } from '@/lib/arena-eleitoral/constants';

interface CandidateAvatarProps {
  politician: Politician;
  size?: 'sm' | 'md' | 'lg';
  showRing?: boolean;
  className?: string;
}

const SIZES = {
  sm: { container: 'w-10 h-10', text: 'text-sm', ring: 'ring-2' },
  md: { container: 'w-16 h-16', text: 'text-xl', ring: 'ring-4' },
  lg: { container: 'w-20 h-20', text: 'text-2xl', ring: 'ring-4' },
};

const SIZE_PX = { sm: 40, md: 64, lg: 80 };

export function CandidateAvatar({ politician, size = 'md', showRing = false, className = '' }: CandidateAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const colors = getCandidateColors(politician);
  const s = SIZES[size];

  const ringClass = showRing ? `${s.ring} ring-emerald-500/30` : '';

  if (politician.photoUrl && !imgError) {
    return (
      <div className={`${s.container} rounded-full overflow-hidden relative shrink-0 ${ringClass} ${className}`}>
        <Image
          src={politician.photoUrl}
          alt={politician.name}
          width={SIZE_PX[size]}
          height={SIZE_PX[size]}
          className="object-cover w-full h-full"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${s.container} rounded-full flex items-center justify-center ${s.text} font-bold ${colors.bgSolid} text-white shrink-0 ${ringClass} ${className}`}>
      {politician.name.charAt(0)}
    </div>
  );
}
