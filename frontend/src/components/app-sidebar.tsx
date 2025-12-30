"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Workflow, ListChecks, Bot, ScrollText, Clock1, Clock10, Clock10Icon, Clock12 } from "lucide-react"
import { UserProfileMenu } from "@/components/user-profile-menu";
import { cn } from "@/lib/utils"

const navItems = [
  {
    name: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Workflows",
    href: "/workflows",
    icon: Workflow,
  },
  {
    name: "Schedules",
    href: "/schedules",
    icon: Clock12,
  },
  {
    name: "Tasks",
    href: "/tasks",
    icon: ListChecks,
  },
  {
    name: "Agents",
    href: "/agents",
    icon: Bot,
  },
  {
    name: "Logs",
    href: "/logs",
    icon: ScrollText,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-30 h-screen w-64 border-r border-border bg-sidebar">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center border-b border-border px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <Workflow className="size-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-sidebar-foreground">AI Workflows</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.name}
              </Link>
            )
          })}
        </nav>
          <div className="mt-auto border-t border-border p-3">
            <UserProfileMenu />
          </div>
      </div>
    </aside>
  )
}
