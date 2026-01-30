import { ReactNode, memo } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppFooter } from './AppFooter';
import { PersistentHeader } from './PersistentHeader';
import { PageTransition } from './PageTransition';
import { PageTitleProvider } from '@/contexts/PageTitleContext';

interface PersistentLayoutProps {
  children: ReactNode;
}

// Memoize footer to prevent re-renders
const MemoizedFooter = memo(AppFooter);

export function PersistentLayout({ children }: PersistentLayoutProps) {
  return (
    <PageTitleProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col min-h-screen">
          <PersistentHeader />
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            <PageTransition>
              {children}
            </PageTransition>
          </main>
          <MemoizedFooter />
        </SidebarInset>
      </SidebarProvider>
    </PageTitleProvider>
  );
}
