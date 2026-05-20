'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  className?: string;
  label?: string;
}

/**
 * Atalho compacto pra voltar ao /admin. Dropa no topo de qualquer página
 * que seja submódulo do admin (ex: /admin/video-modelo, /selfie-video/monitor,
 * /users). Mantém estilo único pra não criar inconsistência entre telas.
 */
export function AdminBackLink({ className, label = 'Voltar ao Admin' }: Props) {
  return (
    <Link
      href="/admin"
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5',
        'bg-white/[0.04] hover:bg-white/[0.08]',
        'text-zinc-400 hover:text-white',
        'border border-white/[0.06] hover:border-white/[0.12]',
        'rounded-lg text-xs font-medium',
        'active:scale-[0.97] transition-all duration-200',
        className,
      )}
    >
      <ArrowLeft size={13} />
      {label}
    </Link>
  );
}
