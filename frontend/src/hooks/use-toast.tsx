"use client";

import * as React from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  title?: string;
  description?: string;
  type?: ToastType;
};

type ToastContextType = {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextType | null>(null);

// ✅ SAFE ID GENERATOR
function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  function addToast(toast: Omit<Toast, "id">) {
    const id = generateId();

    setToasts((prev) => [...prev, { ...toast, id }]);

    setTimeout(() => removeToast(id), 4000);
  }

  function removeToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
