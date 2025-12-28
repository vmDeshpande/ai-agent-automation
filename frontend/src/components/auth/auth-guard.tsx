"use client";

import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "@/context/AuthContext";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const auth = useContext(AuthContext);
  const router = useRouter();

  if (!auth) {
    throw new Error("AuthContext missing");
  }

  const { token, loading } = auth;

  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [loading, token, router]);

  // ⏳ Prevent UI flash
  if (loading || !token) {
    return null; // or loader
  }

  return <>{children}</>;
}
