'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LogIn, Mail, Lock, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError('Credenciais inválidas. Verifique seu email e senha.');
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError('Ocorreu um erro inesperado ao tentar entrar.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl mb-4 shadow-xl shadow-white/10">
            <div className="w-8 h-8 bg-black rounded-md rotate-45" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Synthetic Person</h1>
          <p className="text-zinc-500 mt-2">Entre na sua conta para continuar</p>
        </div>

        <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-3xl shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="w-full bg-zinc-900 border border-zinc-800 text-white pl-12 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-zinc-700 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-zinc-900 border border-zinc-800 text-white pl-12 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-zinc-700 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-2xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-white/5"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Entrar</span>
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-zinc-600 text-sm mt-8">
          Acesso restrito a usuários autorizados.
        </p>
      </div>
    </div>
  );
}
