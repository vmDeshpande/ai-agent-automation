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

import { Button } from "@/components/ui/button";
import { LogOut, User, Settings } from "lucide-react";

type Props = {
  collapsed?: boolean;
};

export function UserProfileMenu({ collapsed = false }: Props) {
  // ✅ hooks ALWAYS run
  const auth = useContext(AuthContext);
  const router = useRouter();

  // ✅ derive state AFTER hooks
  const user = auth?.user;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex w-full items-center justify-start gap-3 px-3 py-2"
          disabled={!user}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
            {(user?.name || user?.email || "U")[0].toUpperCase()}
          </div>

          {/* Hide text when collapsed */}
          {!collapsed && (
            <div className="flex flex-col items-start text-sm">
              <span className="font-medium">
                {user?.name || "User"}
              </span>
              <span className="text-xs text-muted-foreground">
                {user?.email || ""}
              </span>
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>

      {/* Menu only opens if user exists */}
      {user && (
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem disabled>
            <User className="mr-2 size-4" />
            Account
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <Settings className="mr-2 size-4" />
            Settings
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={auth.logout}
          >
            <LogOut className="mr-2 size-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}
