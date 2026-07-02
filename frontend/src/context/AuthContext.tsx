'use client';

import type { ReactNode } from 'react';
import { createContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type AuthUser = {
  id?: string;
  email?: string;
  name?: string;
};

type AuthContextType = {
  token: string | null;
  user: AuthUser | null;
  login: (token: string) => void;
  logout: () => void;
  loading: boolean;
};

export const AuthContext = createContext<AuthContextType | null>(null);

/* ---------------- Helpers ---------------- */

function decodeJwt(jwt: string) {
  try {
    return JSON.parse(atob(jwt.split('.')[1]));
  } catch {
    return null;
  }
}

function isTokenExpired(jwt: string) {
  const payload = decodeJwt(jwt);
  if (!payload?.exp) return true;
  return payload.exp * 1000 < Date.now();
}

/* ---------------- Provider ---------------- */

export default function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrateUser = useCallback((jwt: string) => {
    const payload = decodeJwt(jwt);

    if (!payload) {
      setUser(null);
      return;
    }

    setUser({
      id: payload.sub,
      email: payload.email,
      name: payload.name,
    });
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    router.replace('/login');
  }, [router]);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (!active) return;

      const saved = localStorage.getItem('token');

      if (saved && isTokenExpired(saved)) {
        localStorage.removeItem('token');
        setLoading(false);
        return;
      }

      if (saved) {
        setToken(saved);
        hydrateUser(saved);
      }

      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [hydrateUser]);

  /* ---- Auto logout on token expiry (CRITICAL) ---- */
  useEffect(() => {
    if (!token) return;

    const payload = decodeJwt(token);
    if (!payload?.exp) return;

    const expiresAt = payload.exp * 1000;
    const timeout = expiresAt - Date.now();

    if (timeout <= 0) {
      setTimeout(logout, 0);
      return;
    }

    const timer = setTimeout(logout, timeout);

    return () => clearTimeout(timer);
  }, [token, logout]);

  /* ---- Intercept 401 responses globally to clear stale sessions ---- */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await originalFetch(input, init);
      if (response.status === 401) {
        const urlStr = typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
        // Ignore token errors for login or registration requests to allow inline form error handling
        if (!urlStr.includes('/auth/login') && !urlStr.includes('/auth/register')) {
          logout();
        }
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [logout]);

  function login(jwt: string) {
    if (isTokenExpired(jwt)) {
      logout();
      return;
    }

    setToken(jwt);
    localStorage.setItem('token', jwt);
    hydrateUser(jwt);
    router.replace('/');
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}