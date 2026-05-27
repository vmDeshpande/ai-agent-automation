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

/* ---------------- Provider ---------------- */

export default function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  // 1. Force a dummy text token to bypass token checks
  const [token, setToken] = useState<string | null>("mock-valid-token");

  // 2. Force your mock user profile state
  const [user, setUser] = useState<AuthUser | null>({
    id: "mock-user-123",
    email: "admin@example.com",
    name: "Ami",
  });

  const [loading, setLoading] = useState(false);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    router.replace("/login");
  }, [router]);

  function login(jwt: string) {
    setToken("mock-valid-token");
    router.replace("/");
  }

  // All redirect and expiry verification hooks have been completely stripped out!

  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}