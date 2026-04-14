'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from '../lib/navigation';

interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  has_family: boolean;
  has_coat_of_arms: boolean;
}

interface Family {
  id: string;
  family_name: string;
  family_name_slug: string;
  shield_config: Record<string, string> | null;
  location_city: string | null;
  location_country: string | null;
  faith_tradition: string | null;
  education_purpose: string | null;
  education_methods: string[];
  visibility: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextValue {
  user: User | null;
  family: Family | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  family: null,
  isLoading: true,
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Verify session and get user data
        let meRes = await fetch('/api/v1/auth/me', { credentials: 'include' });
        if (meRes.status === 401) {
          // Access token expired — try refreshing
          const refreshRes = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });
          if (refreshRes.ok) {
            meRes = await fetch('/api/v1/auth/me', { credentials: 'include' });
          }
        }
        if (!meRes.ok) {
          router.replace('/login');
          return;
        }
        const { user: userData } = await meRes.json();

        if (!userData.has_family) {
          router.replace('/onboarding/family');
          return;
        }

        if (!userData.has_coat_of_arms) {
          router.replace('/onboarding/coat-of-arms');
          return;
        }

        if (cancelled) return;
        setUser(userData);

        // Fetch family data
        const familyRes = await fetch('/api/v1/families/me', { credentials: 'include' });
        if (familyRes.ok) {
          const familyData = await familyRes.json();
          if (!cancelled) setFamily(familyData);
        }
      } catch {
        router.replace('/login');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const logout = useCallback(async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
    router.replace('/login');
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, family, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
