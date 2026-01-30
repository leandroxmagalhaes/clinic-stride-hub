import { useEffect } from 'react';
import { usePageTitleContext } from '@/contexts/PageTitleContext';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function AppLayout({ children, title, subtitle, actions }: AppLayoutProps) {
  const { setPageTitle } = usePageTitleContext();

  // Update the persistent header's title when this component mounts or props change
  useEffect(() => {
    setPageTitle({ title, subtitle, actions });
    
    // Clear title when unmounting
    return () => {
      setPageTitle({});
    };
  }, [title, subtitle, actions, setPageTitle]);

  return (
    <div className="space-y-6 animate-fade-in">
      {children}
    </div>
  );
}
