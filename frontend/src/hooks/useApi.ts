"use client";

import { useContext, useEffect, useRef, useState, useCallback } from "react";
import { AuthContext } from "@/context/AuthContext";
import { apiUrl } from "@/lib/api";

type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export function useApi<T>(endpoint: string): ApiState<T> {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error("useApi must be used inside AuthProvider");
  }

  const { token, loading: authLoading } = auth;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const didFetch = useRef(false);

  const fetchData = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(apiUrl(`${endpoint}`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json() as Record<string, unknown>;

      if (!res.ok || json.ok === false) {
        throw new Error((json.error as string) || "Request failed");
      }

      const payload = (json.stats ??
        json.tasks ??
        json.task ??
        json.workflow ??
        json.agent ??
        json.settings ??
        json) as T;

      setData(payload);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [endpoint, token]);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      setLoading(false);
      setError("Not authenticated");
      return;
    }

    if (didFetch.current) return;
    didFetch.current = true;

    fetchData();
  }, [authLoading, token, fetchData]);

  return { data, loading, error, refetch: fetchData };
}
