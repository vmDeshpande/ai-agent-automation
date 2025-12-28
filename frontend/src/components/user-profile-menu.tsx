"use client";

import { useContext } from "react";
import { AuthContext } from "@/context/AuthContext";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

export function UserProfileMenu() {
  const auth = useContext(AuthContext);

  if (!auth || !auth.user) return null;

  const { user, logout } = auth;
  console.log("UserProfileMenu user:", user);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex w-full items-center justify-start gap-3 px-3 py-2"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-semibold text-primary">
            {(user.name || user.email || "U")[0].toUpperCase()}
          </div>

          <div className="flex flex-col items-start text-sm">
            <span className="font-medium">
              {user.name || "User"}
            </span>
            <span className="text-xs text-muted-foreground">
              {user.email}
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem disabled>
          <User className="mr-2 size-4" />
          Account
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={logout}
        >
          <LogOut className="mr-2 size-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
