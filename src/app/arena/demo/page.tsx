// Arena PWA — Demo auto-login page
// URL: /arena/demo — logs in as test user and redirects to /arena

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '../authStore';

const TEST_EMAIL = 'teste@votia.br';
const TEST_PASSWORD = 'votia2026';

export default function DemoPage() {
  const router = useRouter();
  const initialize = useAuthStore((s) => s.initialize);
  const [status, setStatus] = useState('Entrando...');

  useEffect(() => {
    async function autoLogin() {
      try {
        // Sign in with test credentials
        const { error } = await supabase.auth.signInWithPassword({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        });

        if (error) {
          setStatus(`Erro: ${error.message}`);
          return;
        }

        // Initialize auth store
        await initialize();

        setStatus('Pronto! Redirecionando...');

        // Redirect to arena
        setTimeout(() => {
          router.replace('/arena');
        }, 500);
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
