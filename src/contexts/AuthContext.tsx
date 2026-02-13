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

  const fetchProfile = useCallback(async (userId: string, email: string | null) => {
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
        console.error('[Auth] Error fetching profile:', error);
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
      console.error('[Auth] Unexpected error fetching profile:', err);
    }
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Use onAuthStateChange as the SOLE session source.
    // It fires immediately with INITIAL_SESSION (the session from cookies),
    // then again on SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.
    // The proxy (server-side) already validated and refreshed the token,
    // so the cookies are guaranteed to contain a valid session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('[Auth] onAuthStateChange:', event, currentSession ? 'has session' : 'no session');

      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        // Don't await profile fetch for INITIAL_SESSION — it would block loading
        // Instead, start it async and let it update state when done
        fetchProfile(
          currentSession.user.id,
          currentSession.user.email ?? null,
        );
      } else {
        setProfile(null);
        profileCache.clear();
      }

      setLoading(false);
    });

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
      console.error('[Auth] SignOut error (ignored):', err);
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
