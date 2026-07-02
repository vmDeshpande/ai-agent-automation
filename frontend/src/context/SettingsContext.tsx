"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { AuthContext } from "@/context/AuthContext";
import { apiUrl } from "@/lib/api";

type Settings = {
  theme?: string;
  assistantEnabled?: boolean;
};

type SettingsContextType = {
  settings: Settings | null;
  loading: boolean;
  reload: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const auth = useContext(AuthContext);
  const token = auth?.token;

  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;

    try {
      const res = await fetch(apiUrl("/settings"), {
        headers: {
          Authorization: "Bearer " + token,
        },
      });

      const data = await res.json();
      if (data.ok) {
        setSettings(data.settings);
      }
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // 🔁 React to login / logout
  useEffect(() => {
    if (!token) {
      setSettings(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    load();
  }, [token, load]);

  const contextValue = useMemo(() => ({
    settings,
    loading,
    reload: load
  }), [settings, loading, load]);

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }
  return ctx;
}
