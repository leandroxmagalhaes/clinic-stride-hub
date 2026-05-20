import { useEffect } from 'react';
import { useSettings } from './useSettings';
import { applyPrimaryColor, applyThemeMode, applyGradients, getStoredMode, getStoredGradient } from '@/lib/theme';

/**
 * Applies the clinic's primary color faithfully (HEX→HSL) to CSS variables.
 * Theme mode and gradient toggle are read from localStorage (also applied
 * pre-render by the inline boot script in index.html — see no-flash strategy).
 * Listens to system color-scheme changes when mode === "system".
 */
export function useApplyTheme() {
  const { settings, isLoading } = useSettings();

  // Apply primary color when clinic settings load (overrides localStorage cached value).
  useEffect(() => {
    if (isLoading || !settings?.primary_color) return;
    applyPrimaryColor(settings.primary_color);
  }, [settings?.primary_color, isLoading]);

  // Re-apply mode + gradients on mount (boot script already did it, but keep
  // SPA navigation consistent), and listen for OS scheme changes when in "system".
  useEffect(() => {
    applyThemeMode(getStoredMode());
    applyGradients(getStoredGradient());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (getStoredMode() === 'system') applyThemeMode('system');
    };
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  return { isLoading };
}
