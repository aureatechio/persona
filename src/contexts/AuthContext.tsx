'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { ensureProfileAction } from '@/app/actions/userActions';

export type UserType = 'normal' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  user_type: UserType;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const initializedRef = useRef(false);

  const fetchProfile = useCallback(async (userId: string, email: string | null, name: string | null) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116' && email) {
          const { data: emailData, error: emailError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();

          if (!emailError && emailData) {
            setProfile(emailData as UserProfile);
            return;
          }
        }
        console.error('Error fetching profile:', error);
        return;
      }

      if (!data) {
        if (email) {
          const result = await ensureProfileAction({
            id: userId,
            email,
            name: name ?? email.split('@')[0] ?? 'Usuário',
          });

          if (result?.profile) {
            setProfile(result.profile as UserProfile);
            return;
          }
        }
        return;
      }

      setProfile(data as UserProfile);
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
    }
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // 1. Restaurar sessão existente do storage/cookies
    const initSession = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          return;
        }

        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          await fetchProfile(
            currentSession.user.id,
            currentSession.user.email ?? null,
            currentSession.user.user_metadata?.name ?? null
          );
        }
      } catch (err) {
        console.error('Error initializing session:', err);
      } finally {
        setLoading(false);
      }
    };

    // 2. Escutar mudanças de auth (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      // TOKEN_REFRESHED: apenas atualiza sessão silenciosamente
      if (event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        return;
      }

      // SIGNED_IN: usuário fez login
      if (event === 'SIGNED_IN' && newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
        await fetchProfile(
          newSession.user.id,
          newSession.user.email ?? null,
          newSession.user.user_metadata?.name ?? null
        );
        setLoading(false);
        return;
      }

      // SIGNED_OUT: limpar tudo
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      // Qualquer outro evento
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (!newSession?.user) {
        setProfile(null);
      }
      setLoading(false);
    });

    initSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // SignOut robusto: limpa estado local PRIMEIRO, depois tenta revogar no servidor
  const signOut = useCallback(async () => {
    // 1. Limpar estado local imediatamente (garante que a UI responde)
    setUser(null);
    setProfile(null);
    setSession(null);

    // 2. Tentar signOut no Supabase (scope: 'local' limpa cookies/storage mesmo se API falhar)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        console.error('SignOut API error (ignorado):', error.message);
      }
    } catch (err) {
      console.error('SignOut exception (ignorado):', err);
    }

    // 3. Redirecionar para login (sempre, independente de erros)
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
