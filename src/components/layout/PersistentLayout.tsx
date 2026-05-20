import { ReactNode, memo, useEffect, useState } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { getStoredSidebarCompact, applySidebarCompact } from '@/lib/theme';
import { AppSidebar } from './AppSidebar';
import { AppFooter } from './AppFooter';
import { PersistentHeader } from './PersistentHeader';
import { PageTransition } from './PageTransition';
import { PageTitleProvider } from '@/contexts/PageTitleContext';
import { CopilotFAB } from '@/components/copilot/CopilotFAB';
import { CopilotChat } from '@/components/copilot/CopilotChat';
import { useCopilot } from '@/hooks/useCopilot';
import { DiaryFloatingButton } from '@/components/notifications/DiaryFloatingButton';
import { FloatingPanelsProvider, useFloatingPanels } from '@/contexts/FloatingPanelsContext';

interface PersistentLayoutProps {
  children: ReactNode;
}

const MemoizedFooter = memo(AppFooter);

function FloatingPanels() {
  const { messages, isOpen, isStreaming, togglePanel, sendMessage, clearMessages, setIsOpen } = useCopilot();
  const { diaryOpen, setCopilotOpen } = useFloatingPanels();

  // Sync copilot open state to context so DiaryFloatingButton can react
  useEffect(() => {
    setCopilotOpen(isOpen);
  }, [isOpen, setCopilotOpen]);

  return (
    <>
      <DiaryFloatingButton />
      <CopilotFAB onClick={togglePanel} isOpen={isOpen} hidden={diaryOpen} />
      <CopilotChat
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        messages={messages}
        isStreaming={isStreaming}
        onSend={sendMessage}
        onClear={clearMessages}
      />
    </>
  );
}

export function PersistentLayout({ children }: PersistentLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => !getStoredSidebarCompact());
  const handleOpenChange = (o: boolean) => {
    setSidebarOpen(o);
    applySidebarCompact(!o);
  };
  // React to changes from Configurações
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'physione.sidebar.compact') setSidebarOpen(e.newValue !== '1');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <PageTitleProvider>
      <FloatingPanelsProvider>
        <SidebarProvider open={sidebarOpen} onOpenChange={handleOpenChange}>
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
        <FloatingPanels />
      </FloatingPanelsProvider>
    </PageTitleProvider>
  );
}
