import { useEffect } from 'react';
import { useSettings } from './useSettings';
import {
  applyPrimaryColor,
  applyThemeMode,
  applyGradients,
  applySidebarStyle,
  getStoredMode,
  getStoredGradient,
  getStoredSidebarStyle,
} from '@/lib/theme';

/**
 * Applies the clinic's primary color faithfully (HEX→HSL) to CSS variables.
 * Theme mode, gradient toggle and sidebar style are read from localStorage
 * (also applied pre-render by the inline boot script in index.html).
 */
export function useApplyTheme() {
  const { settings, isLoading } = useSettings();

  useEffect(() => {
    if (isLoading || !settings?.primary_color) return;
    applyPrimaryColor(settings.primary_color);
  }, [settings?.primary_color, isLoading]);

  useEffect(() => {
    applyThemeMode(getStoredMode());
    applyGradients(getStoredGradient());
    applySidebarStyle(getStoredSidebarStyle());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (getStoredMode() === 'system') applyThemeMode('system');
    };
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  return { isLoading };
}
