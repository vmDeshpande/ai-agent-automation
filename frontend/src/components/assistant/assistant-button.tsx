"use client";

import { MessageCircle } from "lucide-react";

export function AssistantButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg hover:opacity-90"
    >
      <MessageCircle className="h-5 w-5" />
      Help
    </button>
  );
}
