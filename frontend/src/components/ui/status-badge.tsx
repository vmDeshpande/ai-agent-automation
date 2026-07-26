import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent",
        subtle: "border-transparent",
        outline: "bg-transparent border",
      },
      status: {
        success: "",
        completed: "",
        active: "",
        running: "",
        pending: "",
        warning: "",
        paused: "",
        failed: "",
        error: "",
        idle: "",
        disabled: "",
        draft: "",
      },
    },
    compoundVariants: [
      // DEFAULT variant colors
      { variant: "default", status: ["success", "completed", "active"], className: "bg-success/15 text-success hover:bg-success/25" },
      { variant: "default", status: ["running"], className: "bg-primary text-primary-foreground hover:bg-primary/90" },
      { variant: "default", status: ["pending", "warning", "paused"], className: "bg-warning/15 text-warning hover:bg-warning/25" },
      { variant: "default", status: ["failed", "error"], className: "bg-destructive/15 text-destructive hover:bg-destructive/25" },
      { variant: "default", status: ["idle", "disabled", "draft"], className: "bg-muted/50 text-muted-foreground hover:bg-muted/70" },

      // SUBTLE variant colors
      { variant: "subtle", status: ["success", "completed", "active"], className: "bg-success/10 text-success/90 hover:bg-success/20" },
      { variant: "subtle", status: ["running"], className: "bg-primary/10 text-primary/90 hover:bg-primary/20" },
      { variant: "subtle", status: ["pending", "warning", "paused"], className: "bg-warning/10 text-warning/90 hover:bg-warning/20" },
      { variant: "subtle", status: ["failed", "error"], className: "bg-destructive/10 text-destructive/90 hover:bg-destructive/20" },
      { variant: "subtle", status: ["idle", "disabled", "draft"], className: "bg-muted/30 text-muted-foreground/80 hover:bg-muted/50" },

      // OUTLINE variant colors
      { variant: "outline", status: ["success", "completed", "active"], className: "border-success/30 text-success" },
      { variant: "outline", status: ["running"], className: "border-primary/30 text-primary" },
      { variant: "outline", status: ["pending", "warning", "paused"], className: "border-warning/30 text-warning" },
      { variant: "outline", status: ["failed", "error"], className: "border-destructive/30 text-destructive" },
      { variant: "outline", status: ["idle", "disabled", "draft"], className: "border-border/50 text-muted-foreground" },
    ],
    defaultVariants: {
      variant: "default",
      status: "idle",
    },
  }
)

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  showDot?: boolean
}

export function StatusBadge({
  className,
  variant,
  status,
  showDot = true,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <div className={cn(statusBadgeVariants({ variant, status }), className)} {...props}>
      {showDot && (
        <span
          className="size-1.5 rounded-full bg-current opacity-70"
          aria-hidden="true"
        />
      )}
      {children}
    </div>
  )
}
