'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Workflow,
  ListChecks,
  Bot,
  Network,
  ScrollText,
  Clock12,
  ChevronLeft,
  Menu,
  X,
  FlaskConical,
  Brain,
  FileText,
  BarChart2,
} from 'lucide-react';
import { UserProfileMenu } from '@/components/user-profile-menu';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef, startTransition } from 'react';
import { ReportIssueDialog } from '@/components/report-issue-dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useApi } from '@/hooks/useApi';

const navGroups = [
  {
    title: 'WORKSPACE',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Workflows', href: '/workflows', icon: Workflow, statKey: 'workflows' },
      { name: 'Agents', href: '/agents', icon: Bot, statKey: 'agents' },
      { name: 'Agent Teams', href: '/agent-teams/new/builder', icon: Network },
      { name: 'Tasks', href: '/tasks', icon: ListChecks, statKey: 'tasks' },
    ],
  },
  {
    title: 'INTELLIGENCE',
    items: [
      { name: 'Agent Playground', href: '/playground', icon: FlaskConical },
      { name: 'Documents', href: '/documents', icon: FileText },
      { name: 'Memory', href: '/memory', icon: Brain },
      { name: 'Insights', href: '/insights', icon: BarChart2 },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { name: 'Schedules', href: '/schedules', icon: Clock12, statKey: 'schedules' },
      { name: 'Logs', href: '/logs', icon: ScrollText },
    ],
  },
];

const SIDEBAR_EXPANDED = 260;
const SIDEBAR_COLLAPSED = 72;

/* ── Shared sidebar inner content ── */
function SidebarContent({
  collapsed,
  mobileOpen,
  onCollapse,
  onMobileClose,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onCollapse: () => void;
  onMobileClose: () => void;
}) {
  const pathname = usePathname();
  const showLabels = !collapsed || mobileOpen;
  const { data: stats } = useApi<any>('/dashboard/stats');

  const renderNavItem = (item: { name: string; href: string; icon: any; statKey?: string }) => {
    const isActive =
      pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

    const navContent = (
      <Link
        href={item.href}
        className={cn(
          'group relative flex items-center gap-3 rounded-xl px-2 py-2 text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isActive
            ? 'bg-sidebar-accent text-sidebar-foreground shadow-sm border border-border/50'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border border-transparent'
        )}
      >
        {/* Active Indicator */}
        {isActive && (
          <motion.div
            layoutId="active-nav-indicator"
            className="absolute left-0 top-1/2 h-1/2 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
        )}

        <div
          className={cn(
            'flex items-center justify-center size-7 rounded-lg shrink-0 transition-colors',
            isActive
              ? 'bg-background shadow-sm border border-border/50 text-primary'
              : 'text-sidebar-foreground/70 group-hover:bg-background/50 group-hover:text-sidebar-foreground'
          )}
        >
          <item.icon className="size-4" />
        </div>

        <AnimatePresence>
          {showLabels && (
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.15 }}
              className="flex-1 whitespace-nowrap"
            >
              {item.name}
            </motion.span>
          )}
        </AnimatePresence>

        {showLabels && item.statKey && stats?.[item.statKey] !== undefined && (
          <span className="ml-auto text-[10px] font-semibold bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground group-hover:text-foreground transition-colors">
            {typeof stats[item.statKey] === 'object'
              ? (stats[item.statKey].total ?? stats[item.statKey].enabled)
              : stats[item.statKey]}
          </span>
        )}
      </Link>
    );

    if (!showLabels) {
      return (
        <Tooltip key={item.href} delayDuration={0}>
          <TooltipTrigger asChild>{navContent}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={14}>
            {item.name}
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.href}>{navContent}</div>;
  };

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col bg-sidebar">
        {/* Header - Workspace Switcher Style */}
        <div className="flex h-16 shrink-0 items-center justify-between px-4 mt-2">
          <Link
            href="/"
            className="flex items-center gap-3 overflow-hidden rounded-xl p-1.5 hover:bg-sidebar-accent/50 transition-colors w-full border border-transparent hover:border-border/50 outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary shadow-sm">
              <Bot className="size-4" />
            </div>
            <AnimatePresence>
              {showLabels && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex flex-col whitespace-nowrap flex-1 overflow-hidden"
                >
                  <span className="text-sm font-bold text-sidebar-foreground tracking-tight truncate">
                    AI Workbench
                  </span>
                  <span className="text-[10px] font-medium text-sidebar-foreground/50 truncate uppercase tracking-wider">
                    Automation Engine
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>

          <button
            onClick={onCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden md:flex shrink-0 items-center justify-center rounded-lg p-1.5 text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-foreground border border-transparent hover:border-border/50 ml-1"
          >
            <ChevronLeft
              className={cn('size-4 transition-transform duration-300', collapsed && 'rotate-180')}
            />
          </button>

          <button
            onClick={onMobileClose}
            aria-label="Close sidebar"
            className="md:hidden shrink-0 items-center justify-center rounded-lg p-1.5 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Nav Groups */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-3 py-4 flex flex-col gap-6 mt-2">
          {navGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-1.5">
              {showLabels && (
                <div className="px-3 pb-1 text-[10px] font-bold tracking-widest text-sidebar-foreground/40 uppercase">
                  {group.title}
                </div>
              )}
              <nav className="flex flex-col gap-1">{group.items.map(renderNavItem)}</nav>
            </div>
          ))}

          <div className="flex flex-col gap-1.5">
            {showLabels && (
              <div className="px-3 pb-1 text-[10px] font-bold tracking-widest text-sidebar-foreground/40 uppercase">
                SUPPORT
              </div>
            )}
            <nav className="flex flex-col gap-1">
              <ReportIssueDialog collapsed={!showLabels} />
            </nav>
          </div>
        </div>

        {/* Profile Card / Footer */}
        <div className="mt-auto p-3">
          <UserProfileMenu collapsed={!showLabels} />
        </div>
      </div>
    </TooltipProvider>
  );
}

/* ── Main exported component ── */
export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathnameRef = useRef(pathname);

  /* Sync layout padding for desktop */
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-width',
      collapsed ? `${SIDEBAR_COLLAPSED}px` : `${SIDEBAR_EXPANDED}px`
    );
  }, [collapsed]);

  /* Close mobile drawer on route change */
  useEffect(() => {
    if (pathnameRef.current !== pathname) {
      pathnameRef.current = pathname;
      startTransition(() => setMobileOpen(false));
    }
  }, [pathname]);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open sidebar"
        aria-expanded={mobileOpen}
        aria-controls="mobile-sidebar-menu"
        className="md:hidden fixed top-4 left-4 z-40 rounded-md p-2 bg-sidebar border border-border text-sidebar-foreground shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-foreground"
      >
        <Menu className="size-5" />
      </button>

      {/* Mobile drawer (Accessible) */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64 [&>button]:hidden" id="mobile-sidebar-menu">
          <SidebarContent
            collapsed={false}
            mobileOpen={true}
            onCollapse={() => setCollapsed((v) => !v)}
            onMobileClose={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="hidden md:block fixed left-0 top-0 z-30 h-screen border-r border-border/40 bg-sidebar"
      >
        <SidebarContent
          collapsed={collapsed}
          mobileOpen={false}
          onCollapse={() => setCollapsed((v) => !v)}
          onMobileClose={() => setMobileOpen(false)}
        />
      </motion.aside>
    </>
  );
}
