"use client";

import { useEffect, useRef } from "react";

export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef<number | null>(null);

  useEffect(() => {
    // Gate behind development mode
    if (process.env.NODE_ENV !== "development") return;

    renderCount.current += 1;
    const now = Date.now();
    const timeSinceLastRender = lastRenderTime.current !== null ? now - lastRenderTime.current : 0;
    
    console.debug(
      `[Profiler] ⚡ ${componentName} | Render: #${renderCount.current} | Time since last: ${timeSinceLastRender}ms`
    );
    
    lastRenderTime.current = now;
  }); 
}
