import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1600px]",
        // Responsive horizontal and vertical padding.
        // py-5 handles mobile top spacing consistently.
        "px-4 sm:px-6 md:px-8 py-5 md:pt-6 pb-10",
        // Consistent vertical rhythm between major sections.
        "flex flex-col gap-5 md:gap-6",
        className
      )}
    >
      {children}
    </div>
  );
}
