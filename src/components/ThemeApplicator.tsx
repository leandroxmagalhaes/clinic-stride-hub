import { useApplyTheme } from '@/hooks/useApplyTheme';

/**
 * Component that applies theme colors from settings to CSS variables.
 * Should be placed inside providers that give access to settings.
 */
export function ThemeApplicator() {
  useApplyTheme();
  return null;
}
