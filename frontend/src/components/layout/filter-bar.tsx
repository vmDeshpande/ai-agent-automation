import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FilterBarProps {
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function FilterBar({
  search,
  filters,
  actions,
  children,
  className
}: FilterBarProps) {
  return (
    <div 
      className={cn("flex flex-col gap-4", className)}
      role="group"
      aria-label="Filter controls"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        
        {/* Left Side: Search and Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center flex-1 w-full md:w-auto">
          {search && (
            <div className="w-full sm:min-w-[260px] md:max-w-sm shrink-0">
              {search}
            </div>
          )}
          
          {filters && (
            <div className="flex flex-wrap items-center gap-2">
              {filters}
            </div>
          )}
        </div>

        {/* Right Side: Actions */}
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-auto w-full sm:w-auto">
            {actions}
          </div>
        )}
      </div>
      
      {children && (
        <div className="w-full">
          {children}
        </div>
      )}
    </div>
  );
}
