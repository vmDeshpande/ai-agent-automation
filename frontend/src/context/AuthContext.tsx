"use client";

import { createContext, useState, useEffect, ReactNode } from "react";
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

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("token");
    if (saved) {
      setToken(saved);
      decodeUser(saved);
    }
    setLoading(false);
  }, []);

  function decodeUser(jwt: string) {
    try {
      const payload = JSON.parse(atob(jwt.split(".")[1]));
      setUser({
        id: payload.sub,
        email: payload.email,
        name: payload.name,
      });
    } catch {
      setUser(null);
    }
  }

  function login(jwt: string) {
    setToken(jwt);
    localStorage.setItem("token", jwt);
    decodeUser(jwt);
    router.push("/");
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
