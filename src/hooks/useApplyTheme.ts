import { useEffect } from 'react';
import { useSettings } from './useSettings';

/**
 * Convert HEX color to HSL values
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Generate darker shade of a color for sidebar background
 */
function getDarkerHsl(h: number, s: number, _l: number): string {
  // Create a dark version of the color for sidebar
  // Keep hue, reduce saturation slightly, make it very dark
  return `${h} ${Math.max(s - 10, 20)}% 12%`;
}

/**
 * Generate accent shade for sidebar hover states
 */
function getAccentHsl(h: number, s: number, _l: number): string {
  return `${h} ${Math.max(s - 5, 15)}% 18%`;
}

/**
 * Hook that applies theme colors from settings to CSS variables
 */
export function useApplyTheme() {
  const { settings, isLoading } = useSettings();

  useEffect(() => {
    if (isLoading || !settings?.primary_color) return;

    const hsl = hexToHsl(settings.primary_color);
    if (!hsl) return;

    const { h, s, l } = hsl;
    const root = document.documentElement;

    // Apply primary color
    root.style.setProperty('--primary', `${h} ${s}% ${l}%`);
    root.style.setProperty('--ring', `${h} ${s}% ${l}%`);
    
    // Apply accent based on primary
    root.style.setProperty('--accent', `${h} ${Math.max(s - 20, 10)}% 95%`);
    root.style.setProperty('--accent-foreground', `${h} ${s}% ${Math.max(l - 10, 20)}%`);

    // Apply sidebar colors based on primary
    root.style.setProperty('--sidebar-background', getDarkerHsl(h, s, l));
    root.style.setProperty('--sidebar-primary', `${h} ${s}% ${Math.min(l + 10, 60)}%`);
    root.style.setProperty('--sidebar-accent', getAccentHsl(h, s, l));
    root.style.setProperty('--sidebar-ring', `${h} ${s}% ${Math.min(l + 10, 60)}%`);
    root.style.setProperty('--sidebar-border', `${h} ${Math.max(s - 10, 15)}% 20%`);

    // Chart colors - first one uses primary
    root.style.setProperty('--chart-1', `${h} ${s}% ${l}%`);

    return () => {
      // Cleanup - reset to defaults when component unmounts
      // This is optional since the component is usually always mounted
    };
  }, [settings?.primary_color, isLoading]);

  return { isLoading };
}
