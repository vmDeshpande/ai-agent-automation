// /hooks/use-assistant-mode.ts
"use client";

import { useEffect, useState } from "react";

export function useAssistantMode() {
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/assistant/status")
      .then(res => res.json())
      .then(data => {
        setOnline(data.online);
        setLoading(false);
      })
      .catch(() => {
        setOnline(false);
        setLoading(false);
      });
  }, []);

  return { online, loading };
}
