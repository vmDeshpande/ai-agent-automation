import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const emptyVariants = cva(
  "flex flex-col items-center justify-center text-center p-8 rounded-xl border border-dashed bg-muted/30 animate-in fade-in-50 duration-300",
  {
    variants: {
      variant: {
        default: "border-border",
        accent: "border-primary/30 bg-primary/5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface EmptyProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof emptyVariants> {}

export const Empty = React.forwardRef<HTMLDivElement, EmptyProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(emptyVariants({ variant }), className)}
        {...props}
      />
    );
  }
);
Empty.displayName = "Empty";

export const EmptyHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex flex-col items-center gap-2 max-w-sm", className)}
      {...props}
    />
  );
});
EmptyHeader.displayName = "EmptyHeader";

const mediaVariants = cva(
  "flex items-center justify-center rounded-full mb-2 shrink-0",
  {
    variants: {
      variant: {
        default: "size-10 bg-muted text-muted-foreground",
        icon: "size-12 bg-primary/10 text-primary [&>svg]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface EmptyMediaProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof mediaVariants> {}

export const EmptyMedia = React.forwardRef<HTMLDivElement, EmptyMediaProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(mediaVariants({ variant }), className)}
        {...props}
      />
    );
  }
);
EmptyMedia.displayName = "EmptyMedia";

export const EmptyTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => {
  return (
    <h3
      ref={ref}
      className={cn("text-lg font-semibold tracking-tight text-foreground", className)}
      {...props}
    />
  );
});
EmptyTitle.displayName = "EmptyTitle";

export const EmptyDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn("text-sm text-muted-foreground leading-relaxed", className)}
      {...props}
    />
  );
});
EmptyDescription.displayName = "EmptyDescription";

export const EmptyContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("mt-6 flex flex-wrap items-center justify-center gap-3 w-full", className)}
      {...props}
    />
  );
});
EmptyContent.displayName = "EmptyContent";