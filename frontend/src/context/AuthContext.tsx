"use client";

import { createContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";

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
    return JSON.parse(atob(jwt.split(".")[1]));
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

  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem("token");
    return saved && !isTokenExpired(saved) ? saved : null;
  });

  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem("token");
    if (!saved || isTokenExpired(saved)) return null;
    const payload = decodeJwt(saved);
    if (!payload) return null;
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
    };
  });

  const [loading, setLoading] = useState(false);

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
    localStorage.removeItem("token");
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("token");
    if (saved && isTokenExpired(saved)) {
      localStorage.removeItem("token");
    }
  }, []);

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

  function login(jwt: string) {
    if (isTokenExpired(jwt)) {
      logout();
      return;
    }

    setToken(jwt);
    localStorage.setItem("token", jwt);
    hydrateUser(jwt);
    router.replace("/");
  }


  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
