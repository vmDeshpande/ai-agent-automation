"use client";

import { useState } from "react";
import AuthProvider from "@/context/AuthContext";
import { ThemeProvider } from "next-themes";
import { PageTransition } from "@/components/page-transition";
import { ToastProvider } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { AssistantShell } from "@/components/assistant/assistant-shell";
import { AssistantProvider } from "@/context/assistant-context";
import { Analytics } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const pathname = usePathname();

  const HIDE_ASSISTANT_ROUTES = ["/login", "/register"];
  const showAssistant = !HIDE_ASSISTANT_ROUTES.includes(pathname);

  return (
    <AuthProvider>
      <AssistantProvider>
        <ToastProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange={false}
            themes={["light", "dark", "midnight", "solarized"]}
          >
            <PageTransition>{children}</PageTransition>

            {showAssistant && (
              <>
                {/* Assistant */}
                <AssistantShell
                  open={assistantOpen}
                  onClose={() => setAssistantOpen(false)}
                />

                {/* Floating button */}
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
          </ThemeProvider>
        </ToastProvider>
      </AssistantProvider>
    </AuthProvider>
  );
}
