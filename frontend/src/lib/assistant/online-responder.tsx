// /lib/assistant/online-responder.ts
import type { AssistantRuntimeContext } from "@/context/assistant-context";

function normalizeMarkdown(text: string) {
  return text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^(Step Overview)/gm, "## $1")
    .replace(/^(Step Type)/gm, "## $1")
    .replace(/^(Request Details)/gm, "## $1");
}

export async function onlineRespond(
  message: string,
  context?: AssistantRuntimeContext | null
): Promise<string> {
  const res = await fetch("http://localhost:5000/api/assistant/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + localStorage.getItem("token"),
    },
    body: JSON.stringify({ message, context }),
  });

  if (!res.ok) {
    return "Failed to reach AI service. Please check your API configuration.";
  }

  const data = await res.json();
  return normalizeMarkdown(data.reply) ?? "No response received from AI.";
}
