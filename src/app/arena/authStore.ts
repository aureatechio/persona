// Arena PWA — Auth Store (ported from mobile)
// Uses existing Supabase client from the web project

'use client';

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { UserProfile } from './types';

interface AuthStore {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;

  initialize: () => Promise<void>;
  signUp: (params: {
    email: string;
    password: string;
    name: string;
    ideology: 'esquerda' | 'centro' | 'direita';
    state: string;
    city?: string;
  }) => Promise<{ error?: string }>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (fields: Record<string, any>) => Promise<{ error?: string }>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ session, user: session.user, isAuthenticated: true });
        await get().fetchProfile(session.user.id);
      }
    } catch (err) {
      console.error('[Auth] initialize error:', err);
    } finally {
      set({ loading: false });
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        set({ session, user: session.user, isAuthenticated: true });
        get().fetchProfile(session.user.id);
      } else {
        set({ session: null, user: null, profile: null, isAuthenticated: false });
      }
    });
  },

  signUp: async ({ email, password, name, ideology, state, city }) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) return { error: error.message };
      if (!data.user) return { error: 'Erro ao criar conta' };

      const { error: profileError } = await supabase.from('users').upsert({
        id: data.user.id,
        email,
        name,
        user_type: 'normal',
        ideology,
        state,
        city: city || null,
      });
      if (profileError) console.error('[Auth] profile insert error:', profileError);

      await get().fetchProfile(data.user.id);
      return {};
    } catch (err: any) {
      return { error: err.message || 'Erro desconhecido' };
    }
  },

  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      if (data.user) await get().fetchProfile(data.user.id);
      return {};
    } catch (err: any) {
      return { error: err.message || 'Erro desconhecido' };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, isAuthenticated: false });
  },

  fetchProfile: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, user_type, ideology, state, city, avatar_url')
        .eq('id', userId)
        .single();
      if (!error && data) set({ profile: data as UserProfile });
    } catch (err) {
      console.error('[Auth] fetchProfile error:', err);
    }
  },

  updateProfile: async (fields: Record<string, any>) => {
    const profile = get().profile;
    if (!profile) return { error: 'Não logado' };
    try {
      const { error } = await supabase
        .from('users')
        .update(fields)
        .eq('id', profile.id);
      if (error) return { error: error.message };
      set({ profile: { ...profile, ...fields } });
      return {};
    } catch (err: any) {
      return { error: err.message || 'Erro desconhecido' };
    }
  },
}));
