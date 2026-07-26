'use client';

import type { ReactNode } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { AuthGuard } from '@/components/auth/auth-guard';
import { PageContainer } from '@/components/layout/page-container';
import { AppBreadcrumbs } from '@/components/layout/app-breadcrumbs';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

export function AuthenticatedLayout({
  children,
  layout = 'default',
}: {
  children: ReactNode;
  layout?: 'default' | 'full' | 'panel';
}) {
  const pathname = usePathname();

  return (
    <AuthGuard>
      <div className="flex h-[100dvh] w-full bg-background overflow-hidden relative">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground"
        >
          Skip to main content
        </a>
        <AppSidebar />
        <main
          id="main-content"
          className={`flex-1 min-h-0 overflow-y-auto transition-all duration-300 md:pl-[var(--sidebar-width,256px)] w-full relative z-0 outline-none ${layout === 'panel' ? 'flex flex-col' : ''}`}
          tabIndex={-1}
        >
          {pathname !== '/' ? (
            <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border pr-4 sm:pr-6 md:px-8 pl-14 sm:pl-16 md:pl-8 py-3 w-full shrink-0">
              <AppBreadcrumbs />
            </div>
          ) : (
            <div className="h-14 md:hidden w-full shrink-0" /> /* Spacer for mobile hamburger menu when no breadcrumbs */
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={layout === 'panel' ? 'flex flex-col flex-1 min-h-0' : 'min-h-full'}
            >
              {layout === 'default' ? <PageContainer>{children}</PageContainer> : children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </AuthGuard>
  );
}
