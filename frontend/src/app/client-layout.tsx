"use client";

import { useState, useEffect } from "react";
import AuthProvider from "@/context/AuthContext";
import { ThemeProvider, useTheme } from "next-themes";
import { PageTransition } from "@/components/page-transition";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { AssistantShell } from "@/components/assistant/assistant-shell";
import { AssistantProvider } from "@/context/assistant-context";
import { Analytics } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { SettingsProvider, useSettings } from "@/context/SettingsContext";

const PUBLIC_ROUTES = ["/login", "/register"];

function InnerLayout({ children }: { children: React.ReactNode }) {
  const { settings, loading } = useSettings();
  const { setTheme } = useTheme();
  const pathname = usePathname();
  const [assistantOpen, setAssistantOpen] = useState(false);

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (!loading && settings?.theme) {
      setTheme(settings.theme);
    }
  }, [settings, loading, setTheme]);

  return (
    <>
      {isPublicRoute ? (
        children
      ) : (
        <AuthGuard>
          <PageTransition>{children}</PageTransition>
        </AuthGuard>
      )}

      {!isPublicRoute && (
        <>
          <AssistantShell
            open={assistantOpen}
            onClose={() => setAssistantOpen(false)}
          />

          {!assistantOpen && (
            <button
              onClick={() => setAssistantOpen(true)}
              className="fixed bottom-6 right-6 z-40 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg hover:opacity-90 transition"
            >
              💬 Help
            </button>
          )}
        </>
      )}

      <Toaster />
      <Analytics />
    </>
  );
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AssistantProvider>
          <ToastProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
              <InnerLayout>{children}</InnerLayout>
            </ThemeProvider>
          </ToastProvider>
        </AssistantProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
