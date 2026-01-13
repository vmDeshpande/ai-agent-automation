import { useEffect, useRef, useState } from "react";

export function useAssistantScroll<T extends HTMLElement>() {
  const containerRef = useRef<T | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [autoScroll, setAutoScroll] = useState(true);

  /* -------------------------------
     Detect manual scroll
  -------------------------------- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;

      setAutoScroll(distanceFromBottom < 120);
    };

    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  /* -------------------------------
     Scroll to bottom
  -------------------------------- */
  function scrollToBottom(smooth = true) {
    bottomRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "end",
    });
  }

  return {
    containerRef,
    bottomRef,
    autoScroll,
    scrollToBottom,
  };
}
