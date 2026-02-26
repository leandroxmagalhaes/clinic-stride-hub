import { ReactNode, memo } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppFooter } from './AppFooter';
import { PersistentHeader } from './PersistentHeader';
import { PageTransition } from './PageTransition';
import { PageTitleProvider } from '@/contexts/PageTitleContext';
import { CopilotFAB } from '@/components/copilot/CopilotFAB';
import { CopilotChat } from '@/components/copilot/CopilotChat';
import { useCopilot } from '@/hooks/useCopilot';

interface PersistentLayoutProps {
  children: ReactNode;
}

// Memoize footer to prevent re-renders
const MemoizedFooter = memo(AppFooter);

export function PersistentLayout({ children }: PersistentLayoutProps) {
  const { messages, isOpen, isStreaming, togglePanel, sendMessage, clearMessages, setIsOpen } = useCopilot();

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
      <CopilotFAB onClick={togglePanel} isOpen={isOpen} />
      <CopilotChat
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        messages={messages}
        isStreaming={isStreaming}
        onSend={sendMessage}
        onClear={clearMessages}
      />
    </PageTitleProvider>
  );
}
