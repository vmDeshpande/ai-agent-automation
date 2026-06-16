"use client";

import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "@/context/AuthContext";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const auth = useContext(AuthContext);
  const router = useRouter();
  const token = auth?.token ?? null;
  const loading = auth?.loading ?? true;

  useEffect(() => {
    if (auth && !loading && !token) {
      router.replace("/login");
    }
  }, [auth, loading, router, token]);

  if (!auth) {
    throw new Error("AuthContext missing");
  }

  // ⏳ Prevent UI flash
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Checking authentication…
      </div>
    );
  }

  if (!token) {
    return null; // redirect already triggered
  }

  return <>{children}</>;
}
