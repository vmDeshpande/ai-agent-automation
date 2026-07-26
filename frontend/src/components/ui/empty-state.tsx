import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description: React.ReactNode;
  icon?: LucideIcon;
  illustration?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  illustration,
  primaryAction,
  secondaryAction,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 sm:p-12 md:p-16 rounded-2xl border border-dashed border-border/60 bg-muted/10",
        className
      )}
      {...props}
    >
      {illustration ? (
        <div className="mb-6">
          {illustration}
        </div>
      ) : Icon ? (
        <div className="mb-6 flex size-12 items-center justify-center rounded-xl bg-muted/50 border border-border/50 shadow-sm">
          <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
        </div>
      ) : null}

      <h3 className="text-lg font-semibold tracking-tight text-foreground/90 mb-2">
        {title}
      </h3>
      
      <p className="text-sm text-muted-foreground max-w-[320px] mb-8 leading-relaxed">
        {description}
      </p>

      {(primaryAction || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
