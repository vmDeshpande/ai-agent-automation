"use client";

import { useAssistantContext } from "@/context/assistant-context";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { AssistantPlaceholder } from "./assistant-placeholder";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function AssistantMessages() {
  const { messages, mode } = useAssistantContext();

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  /* -------------------------------
     Detect manual scroll
  -------------------------------- */
  useEffect(() => {
  const container = containerRef.current;
  if (!container) return;

  const onScroll = () => {
    // 🔒 extra safety — TS is happy now
    if (!container) return;

    const nearBottom =
      container.scrollHeight -
        container.scrollTop -
        container.clientHeight <
      120;

    setAutoScroll(nearBottom);
  };

  container.addEventListener("scroll", onScroll);
  return () => container.removeEventListener("scroll", onScroll);
}, []);

  /* -------------------------------
     Auto scroll on new messages
  -------------------------------- */
  useEffect(() => {
    if (!autoScroll) return;

    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, autoScroll]);

  /* -------------------------------
     Placeholder
  -------------------------------- */
  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <AssistantPlaceholder mode={mode} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto no-scrollbar px-4 py-6 space-y-4"
    >
      <AnimatePresence initial={false}>
        {messages.map((msg, i) => {
          const isAssistant = msg.role === "assistant";

          return (
            <motion.div
              key={i}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className={cn(
                "max-w-[90%] rounded-xl px-4 py-3 text-sm leading-relaxed",
                "overflow-x-hidden break-words",
                isAssistant
                  ? "mr-auto bg-muted text-foreground"
                  : "ml-auto bg-primary text-primary-foreground",
                msg.loading && "opacity-70"
              )}
            >
              {/* Assistant label */}
              {isAssistant && (
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Assistant Analysis
                </div>
              )}

              {/* Markdown */}
              <div
                className={cn(
                  "prose prose-sm max-w-none",
                  isAssistant
                    ? "prose-neutral dark:prose-invert"
                    : "prose-invert",

                  /* spacing */
                  "prose-p:my-2 prose-p:leading-relaxed",
                  "prose-ul:my-2 prose-li:my-1 prose-ul:pl-5",
                  "prose-headings:mt-4 prose-headings:mb-2",
                  "prose-h2:text-sm prose-h3:text-xs prose-headings:font-semibold",

                  /* wrapping (CRITICAL) */
                  "prose-pre:whitespace-pre-wrap",
                  "prose-pre:break-words",
                  "prose-pre:overflow-x-hidden",
                  "prose-code:break-all",

                  /* visuals */
                  "prose-pre:bg-black/40 prose-pre:rounded-md prose-pre:p-3",
                  "prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded",

                  /* preserve empty lines */
                  "prose-br:block prose-br:my-2"
                )}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={{
                    p: ({ children }) => (
                      <p className="whitespace-pre-wrap break-words">
                        {children}
                      </p>
                    ),
                    li: ({ children }) => (
                      <li className="break-words">{children}</li>
                    ),
                    pre: ({ children }) => (
                      <pre className="whitespace-pre-wrap break-words overflow-x-hidden">
                        {children}
                      </pre>
                    ),
                    code: ({ children }) => (
                      <code className="break-all">{children}</code>
                    ),
                    h2: ({ children }) => (
                      <h2 className="border-l-2 border-primary pl-3">
                        {children}
                      </h2>
                    ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>

              {/* Loading */}
              {msg.loading && isAssistant && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  Analyzing current state…
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}
