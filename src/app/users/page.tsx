'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, UserProfile } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { createUserAction, deleteUserAction } from '@/app/actions/userActions';
import Link from 'next/link';
import {
  UserPlus,
  Trash2,
  Shield,
  User as UserIcon,
  Search,
  X,
  Loader2,
  ArrowLeft
} from 'lucide-react';

export default function UsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    user_type: 'normal' as 'normal' | 'admin'
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching users:', error);
    } else {
      setUsers(data || []);
    }
    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    const result = await createUserAction(formData);

    if (result.error) {
      setFormError(result.error);
    } else {
      setIsModalOpen(false);
      setFormData({ name: '', email: '', password: '', user_type: 'normal' });
      fetchUsers();
    }
    setFormLoading(false);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    const result = await deleteUserAction(userId);
    if (result.error) {
      alert('Erro ao deletar usuário: ' + result.error);
    } else {
      fetchUsers();
    }
  };

  const filteredUsers = users.filter(u => {
    const name = u.name || '';
    const email = u.email || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           email.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-white/[0.04] flex items-center justify-between px-6 md:px-8 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-xl transition-all duration-200"
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold tracking-tight">Gerenciamento de Usuarios</h1>
          </div>
          
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-white text-black px-4 py-2.5 rounded-2xl font-bold flex items-center gap-2 hover:bg-zinc-200 transition-all shadow-lg shadow-white/5"
          >
            <UserPlus size={20} />
            <span className="hidden sm:inline">Novo Usuário</span>
          </button>
        </header>

        <div className="p-8 overflow-y-auto">
          {/* Search */}
          <div className="relative mb-8 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              placeholder="Buscar usuários..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-900 text-white pl-12 pr-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
            />
          </div>

          {/* Users Table */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-3xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-900/30">
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Usuário</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">Tipo</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center">
                      <Loader2 className="animate-spin mx-auto text-zinc-500" size={32} />
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-zinc-500">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-900/40 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
                            <UserIcon size={20} className="text-zinc-400" />
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-200">{u.name}</div>
                            <div className="text-sm text-zinc-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                          u.user_type === 'admin' 
                            ? 'bg-white/5 border-white/10 text-white' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                        }`}>
                          {u.user_type === 'admin' && <Shield size={12} />}
                          {u.user_type === 'admin' ? 'Admin' : 'Normal'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {u.id !== profile?.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Create User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => !formLoading && setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-zinc-950 border border-zinc-900 rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-900 flex items-center justify-between">
              <h2 className="text-xl font-bold">Novo Usuário</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-zinc-500 hover:text-white transition-colors"
                disabled={formLoading}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Senha</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Tipo de Usuário</label>
                  <select
                    value={formData.user_type}
                    onChange={(e) => setFormData({ ...formData, user_type: e.target.value as any })}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white px-4 py-3 rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/10 transition-all appearance-none"
                  >
                    <option value="normal">Normal</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {formError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-2xl">
                  {formError}
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={formLoading}
                  className="flex-1 px-4 py-3 rounded-2xl border border-zinc-800 font-bold hover:bg-zinc-900 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 bg-white text-black px-4 py-3 rounded-2xl font-bold hover:bg-zinc-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {formLoading ? <Loader2 className="animate-spin" size={20} /> : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
