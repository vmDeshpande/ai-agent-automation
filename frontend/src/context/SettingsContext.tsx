"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { AuthContext } from "@/context/AuthContext";

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

  async function load() {
    if (!token) return;

    try {
      const res = await fetch("http://localhost:5000/api/settings", {
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
  }

  // 🔁 React to login / logout
  useEffect(() => {
    if (!token) {
      setSettings(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    load();
  }, [token]);

  return (
    <SettingsContext.Provider value={{ settings, loading, reload: load }}>
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
