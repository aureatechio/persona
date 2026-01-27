'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { 
  User, 
  Mail, 
  Lock, 
  Save, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  Menu
} from 'lucide-react';

export default function SettingsPage() {
  const { profile, user } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
    }
  }, [profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('users')
        .update({ name })
        .eq('id', user?.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao atualizar perfil.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas não coincidem.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao alterar senha.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden lg:pl-64">
        <header className="h-20 border-b border-zinc-900 flex items-center px-8 bg-black/50 backdrop-blur-md sticky top-0 z-30">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-zinc-400 hover:text-white transition-colors mr-4"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        </header>

        <div className="p-8 overflow-y-auto max-w-4xl mx-auto w-full">
          {message && (
            <div className={`mb-8 p-4 rounded-2xl flex items-center gap-3 border ${
              message.type === 'success' 
                ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <span className="text-sm font-medium">{message.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Profile Section */}
            <section className="bg-zinc-950 border border-zinc-900 p-8 rounded-3xl shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white">
                  <User size={20} />
                </div>
                <h2 className="text-lg font-bold">Informações Pessoais</h2>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">
                    Email (Não alterável)
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                    <input
                      type="email"
                      value={profile?.email || ''}
                      disabled
                      className="w-full bg-zinc-900/50 border border-zinc-900 text-zinc-500 pl-12 pr-4 py-3 rounded-2xl cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">
                    Nome
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="w-full bg-zinc-900 border border-zinc-800 text-white pl-12 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-white text-black font-bold py-3 rounded-2xl hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Salvar Alterações</>}
                </button>
              </form>
            </section>

            {/* Password Section */}
            <section className="bg-zinc-950 border border-zinc-900 p-8 rounded-3xl shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white">
                  <Lock size={20} />
                </div>
                <h2 className="text-lg font-bold">Segurança</h2>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-zinc-900 border border-zinc-800 text-white pl-12 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2 px-1">
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-zinc-900 border border-zinc-800 text-white pl-12 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white font-bold py-3 rounded-2xl hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Redefinir Senha'}
                </button>
              </form>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
