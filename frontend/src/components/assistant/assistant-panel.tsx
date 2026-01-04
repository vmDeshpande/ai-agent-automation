import { onlineRespond } from "@/lib/assistant/online-responder";
import { AssistantHeader } from "./assistant-header";
import { AssistantInput } from "./assistant-input";
import { AssistantMessages } from "./assistant-messages";
import { useAssistantContext } from "@/context/assistant-context";
import { offlineRespond } from "@/lib/assistant/offline-responder";
import { AssistantContextPreview } from "./assistant-context-preview";

export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const { mode, context, addMessage } = useAssistantContext();

  async function handleSend(message: string) {
    addMessage({
      role: "user",
      content: message,
    });

    addMessage({
      role: "assistant",
      content: "Thinking…",
      loading: true,
    });

    let reply = "";

    if (mode === "offline") {
      reply = offlineRespond(message, context);
    } else {
      reply = await onlineRespond(message, context);
    }

    addMessage({
      role: "assistant",
      content: reply,
    });
  }

  return (
    <aside className="fixed right-0 top-0 z-40 flex h-full w-[380px] flex-col border-l border-border bg-background shadow-xl">
      <AssistantHeader mode={mode} onClose={onClose} />
      <AssistantContextPreview />
      <AssistantMessages />
      {/* <pre className="text-xs opacity-60 p-2 border-t border-border">
        {JSON.stringify(context, null, 2)}
      </pre> */}
      <AssistantInput onSend={handleSend} />
    </aside>
  );
}
