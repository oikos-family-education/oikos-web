'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '../lib/apiFetch';

type AdminState = { email: string } | null;

type Ctx = {
  admin: AdminState;
  loading: boolean;
  logout: () => Promise<void>;
};

const AdminAuthContext = createContext<Ctx>({ admin: null, loading: true, logout: async () => {} });

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminState>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/admin/auth/me', { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) setAdmin(null);
          if (pathname !== '/login' && !cancelled) router.replace('/login');
          return;
        }
        const data = await res.json();
        if (!cancelled) setAdmin({ email: data.email });
      } catch {
        if (!cancelled) setAdmin(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  const logout = async () => {
    try {
      await apiFetch('/api/v1/admin/auth/logout', { method: 'POST' });
    } finally {
      setAdmin(null);
      router.replace('/login');
    }
  };

  return (
    <AdminAuthContext.Provider value={{ admin, loading, logout }}>{children}</AdminAuthContext.Provider>
  );
}

export const useAdminAuth = () => useContext(AdminAuthContext);
