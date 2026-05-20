import { memo, useEffect, useState } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Search, Sun, Moon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { usePageTitleContext } from '@/contexts/PageTitleContext';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { applyThemeMode, getStoredMode } from '@/lib/theme';

export const PersistentHeader = memo(function PersistentHeader() {
  const { pageTitle } = usePageTitleContext();
  const { title, subtitle, actions } = pageTitle;
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const toggleMode = () => {
    const current = getStoredMode();
    // Cycle: anything → opposite explicit value
    const next = (current === 'dark' || (current === 'system' && isDark)) ? 'light' : 'dark';
    applyThemeMode(next);
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      <SidebarTrigger className="-ml-1" />

      <div className="flex-1 flex items-center gap-4">
        {title && (
          <div className="hidden md:block">
            <h1 className="font-display text-lg font-semibold">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="w-64 pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-1"
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMode}
          title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          aria-label="Alternar modo claro/escuro"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <NotificationBell />

        {actions}
      </div>
    </header>
  );
});
