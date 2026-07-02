'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Workflow,
  ListChecks,
  Bot,
  ScrollText,
  Clock12,
  ChevronLeft,
  Menu,
  X,
  FlaskConical,
} from 'lucide-react';
import { UserProfileMenu } from '@/components/user-profile-menu';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useRef, startTransition } from 'react';
import { Brain, FileText } from 'lucide-react';
import { ReportIssueDialog } from '@/components/report-issue-dialog';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Workflows', href: '/workflows', icon: Workflow },
  { name: 'Schedules', href: '/schedules', icon: Clock12 },
  { name: 'Tasks', href: '/tasks', icon: ListChecks },
  { name: 'Agents', href: '/agents', icon: Bot },
  { name: 'Agent Playground', href: '/playground', icon: FlaskConical },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Memory', href: '/memory', icon: Brain },
  { name: 'Logs', href: '/logs', icon: ScrollText },
];

const SIDEBAR_EXPANDED = 256;
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

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
            <Workflow className="size-5 text-primary-foreground" />
          </div>
          <AnimatePresence>
            {showLabels && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="text-lg font-semibold text-sidebar-foreground"
              >
                AI Workflows
              </motion.span>
            )}
          </AnimatePresence>
        </Link>

        {/* Desktop collapse button */}
        <button
          onClick={onCollapse}
          className="hidden md:flex rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
        >
          <ChevronLeft className={cn('size-4 transition-transform', collapsed && 'rotate-180')} />
        </button>

        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="md:hidden rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="size-4 shrink-0" />
              <AnimatePresence>
                {showLabels && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.15 }}
                    className="whitespace-nowrap"
                  >
                    {item.name}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-3">
        {showLabels && (
          <>
            <div className="text-xs text-muted-foreground px-2">Support</div>
            <ReportIssueDialog />
          </>
        )}
        <UserProfileMenu collapsed={!showLabels} />
      </div>
    </div>
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
        className="md:hidden fixed top-4 left-4 z-40 rounded-md p-2 bg-sidebar border border-border text-sidebar-foreground shadow-md"
      >
        <Menu className="size-5" />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="md:hidden fixed inset-0 z-30 bg-black/50"
          />
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -SIDEBAR_EXPANDED }}
            animate={{ x: 0 }}
            exit={{ x: -SIDEBAR_EXPANDED }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="md:hidden fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-sidebar"
          >
            <SidebarContent
              collapsed={false}
              mobileOpen={true}
              onCollapse={() => setCollapsed((v) => !v)}
              onMobileClose={() => setMobileOpen(false)}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED }}
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        className="hidden md:block fixed left-0 top-0 z-30 h-screen border-r border-border bg-sidebar"
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
