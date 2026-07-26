"use client";

import { useContext } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "@/context/AuthContext";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { LogOut, User, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  collapsed?: boolean;
};

export function UserProfileMenu({ collapsed = false }: Props) {
  const auth = useContext(AuthContext);
  const router = useRouter();

  const user = auth?.user;

  const triggerContent = (
    <button
      className={cn(
        "group relative flex w-full items-center justify-start gap-3 rounded-xl p-2 h-auto transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary border",
        collapsed
          ? "border-transparent hover:bg-sidebar-accent/50 justify-center"
          : "bg-sidebar-accent/30 border-border/40 hover:bg-sidebar-accent/60 hover:border-border/60 shadow-sm"
      )}
      disabled={!user}
    >
      <div className="relative shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-sm font-bold text-primary border border-primary/20 shadow-sm">
          {(user?.name || user?.email || "U")[0].toUpperCase()}
        </div>
        {/* Online Status indicator */}
        <div className="absolute -bottom-1 -right-1 size-3.5 bg-sidebar rounded-full flex items-center justify-center">
          <div className="size-2 bg-emerald-500 rounded-full" />
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="flex flex-col items-start text-sm overflow-hidden text-ellipsis whitespace-nowrap flex-1">
            <span className="font-semibold text-sidebar-foreground truncate w-full text-left tracking-tight">
              {user?.name || "User"}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground truncate w-full text-left">
              Pro Plan
            </span>
          </div>
          <div className="shrink-0 p-1.5 rounded-md hover:bg-background/50 text-muted-foreground hover:text-foreground transition-colors mr-0.5">
            <Settings className="size-4" />
          </div>
        </>
      )}
    </button>
  );

  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              {triggerContent}
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={14}>
            Profile & Settings
          </TooltipContent>
        </Tooltip>
      ) : (
        <DropdownMenuTrigger asChild>
          {triggerContent}
        </DropdownMenuTrigger>
      )}

      {user && (
        <DropdownMenuContent
          align={collapsed ? "center" : "end"}
          side={collapsed ? "right" : "bottom"}
          sideOffset={collapsed ? 14 : 8}
          className="w-56 rounded-xl shadow-lg border-border/50"
        >
          <DropdownMenuItem disabled className="gap-2">
            <User className="size-4 text-muted-foreground" />
            <span>Account</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => router.push("/settings")} className="gap-2">
            <Settings className="size-4 text-muted-foreground" />
            <span>Settings</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-border/40" />

          <DropdownMenuItem
            className="text-destructive focus:text-destructive gap-2"
            onClick={auth.logout}
          >
            <LogOut className="size-4" />
            <span>Logout</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}
