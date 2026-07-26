import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  badge,
  actions,
  children,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col border-b border-border/40 pb-4">
      {breadcrumbs && (
        <nav aria-label="Breadcrumb" className="mb-3 flex items-center text-sm font-medium text-muted-foreground/70 transition-colors">
          {breadcrumbs}
        </nav>
      )}
      
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground/95">
              {title}
            </h1>
            {badge && <div className="flex-shrink-0">{badge}</div>}
          </div>
          {description && (
            <p className="max-w-2xl text-sm text-muted-foreground/80 leading-relaxed font-normal">
              {description}
            </p>
          )}
        </div>
        
        {actions && (
          <div className="flex w-full items-center gap-3 md:w-auto md:shrink-0 md:pl-4">
            {actions}
          </div>
        )}
      </div>

      {children && <div className="mt-6">{children}</div>}
    </header>
  );
}
