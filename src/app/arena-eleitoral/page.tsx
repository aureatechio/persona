'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ElectoralRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/'); }, [router]);
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );
}
