// Arena PWA — Demo auto-login page
// /arena/demo       → teste@votia.br (original)
// /arena/demo?u=1   → demo1@votia.br (SP, direita)
// /arena/demo?u=2   → demo2@votia.br (RJ, esquerda)
// /arena/demo?u=3   → demo3@votia.br (MG, centro)
// /arena/demo?u=4   → demo4@votia.br (BA, esquerda)
// /arena/demo?u=5   → demo5@votia.br (Brasil, direita)

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '../authStore';

const ACCOUNTS: Record<string, { email: string; password: string; name: string }> = {
  '0': { email: 'teste@votia.br', password: 'votia2026', name: 'Usuário Teste' },
  '1': { email: 'demo1@votia.br', password: 'votia2026', name: 'Demo São Paulo' },
  '2': { email: 'demo2@votia.br', password: 'votia2026', name: 'Demo Rio de Janeiro' },
  '3': { email: 'demo3@votia.br', password: 'votia2026', name: 'Demo Minas Gerais' },
  '4': { email: 'demo4@votia.br', password: 'votia2026', name: 'Demo Bahia' },
  '5': { email: 'demo5@votia.br', password: 'votia2026', name: 'Demo Brasil' },
};

export default function DemoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialize = useAuthStore((s) => s.initialize);
  const [status, setStatus] = useState('Entrando...');

  useEffect(() => {
    const u = searchParams.get('u') || '0';
    const account = ACCOUNTS[u] || ACCOUNTS['0'];

    async function autoLogin() {
      try {
        setStatus(`Entrando como ${account.name}...`);

        const { error } = await supabase.auth.signInWithPassword({
          email: account.email,
          password: account.password,
        });

        if (error) {
          setStatus(`Erro: ${error.message}`);
          return;
        }

        await initialize();
        setStatus('Pronto! Redirecionando...');
        setTimeout(() => router.replace('/arena'), 500);
      } catch (err: any) {
        setStatus(`Erro: ${err.message}`);
      }
    }

    autoLogin();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-[100dvh] bg-black gap-4"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-zinc-400">{status}</p>
    </div>
  );
}
