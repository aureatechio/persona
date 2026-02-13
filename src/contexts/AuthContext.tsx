'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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

// Cache profile in memory to avoid re-fetching on every navigation
const profileCache = new Map<string, UserProfile>();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const initializedRef = useRef(false);

  const fetchProfile = useCallback(async (userId: string, email: string | null, name: string | null) => {
    // Check cache first - instant return
    const cached = profileCache.get(userId);
    if (cached) {
      setProfile(cached);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, user_type')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      if (data) {
        const p = data as UserProfile;
        profileCache.set(userId, p);
        setProfile(p);
        return;
      }

      // Profile not found - try by email as fallback
      if (email) {
        const { data: emailData } = await supabase
          .from('users')
          .select('id, email, name, user_type')
          .eq('email', email)
          .maybeSingle();

        if (emailData) {
          const p = emailData as UserProfile;
          profileCache.set(userId, p);
          setProfile(p);
          return;
        }
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
    }
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        return;
      }

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

      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        setProfile(null);
        profileCache.clear();
        setLoading(false);
        return;
      }

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

  const signOut = useCallback(async () => {
    setUser(null);
    setProfile(null);
    setSession(null);
    profileCache.clear();

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.error('SignOut error (ignored):', err);
    }

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
