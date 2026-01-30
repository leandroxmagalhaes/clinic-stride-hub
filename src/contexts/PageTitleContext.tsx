import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface PageTitleState {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

interface PageTitleContextType {
  pageTitle: PageTitleState;
  setPageTitle: (state: PageTitleState) => void;
}

const PageTitleContext = createContext<PageTitleContextType | undefined>(undefined);

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [pageTitle, setPageTitleState] = useState<PageTitleState>({});

  const setPageTitle = useCallback((state: PageTitleState) => {
    setPageTitleState(state);
  }, []);

  return (
    <PageTitleContext.Provider value={{ pageTitle, setPageTitle }}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitleContext() {
  const context = useContext(PageTitleContext);
  if (!context) {
    throw new Error('usePageTitleContext must be used within a PageTitleProvider');
  }
  return context;
}

// Hook for pages to set their title
export function usePageTitle(title?: string, subtitle?: string, actions?: ReactNode) {
  const { setPageTitle } = usePageTitleContext();
  
  // Use useEffect to set title on mount
  useState(() => {
    setPageTitle({ title, subtitle, actions });
  });
  
  return { setPageTitle };
}
