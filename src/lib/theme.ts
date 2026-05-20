/**
 * Theme utilities — premium colors, HEX↔HSL conversion, dark mode, gradients.
 *
 * Bug fix notes:
 * - shadcn CSS variables expect HSL strings WITHOUT commas (e.g. "221 83% 53%").
 * - We only override --primary / --ring / --primary-foreground / --primary-light
 *   / --primary-dark. The sidebar, accents and surfaces remain as defined in
 *   index.css so the chosen color appears FAITHFULLY on buttons / links / badges
 *   instead of being repainted across the whole shell.
 * - Theme + color are applied via an inline boot script in index.html BEFORE
 *   first paint to avoid flashing.
 */

export type ThemeMode = "light" | "dark" | "system";

export interface PremiumColor {
  family: string;
  name: string;
  hex: string;
  light: string;
  dark: string;
}

export const PREMIUM_COLORS: PremiumColor[] = [
  // Sóbrios e profissionais
  { family: "Sóbrios e profissionais", name: "Azul Oceano",     hex: "#2563eb", light: "#3b82f6", dark: "#1d4ed8" },
  { family: "Sóbrios e profissionais", name: "Verde-azulado",   hex: "#0d9488", light: "#14b8a6", dark: "#0f766e" },
  { family: "Sóbrios e profissionais", name: "Ardósia",         hex: "#475569", light: "#64748b", dark: "#334155" },
  { family: "Sóbrios e profissionais", name: "Azul Meia-noite", hex: "#1e40af", light: "#2563eb", dark: "#1e3a8a" },

  // Suaves e acolhedores
  { family: "Suaves e acolhedores", name: "Salva",        hex: "#5f8d6e", light: "#7aa888", dark: "#4a7257" },
  { family: "Suaves e acolhedores", name: "Terracota",    hex: "#c2683f", light: "#d4825c", dark: "#a5532f" },
  { family: "Suaves e acolhedores", name: "Areia Quente", hex: "#b08968", light: "#c5a285", dark: "#947154" },
  { family: "Suaves e acolhedores", name: "Rosa Pó",      hex: "#c2778d", light: "#d491a5", dark: "#a55d73" },

  // Vibrantes mas refinados
  { family: "Vibrantes mas refinados", name: "Índigo",           hex: "#6366f1", light: "#818cf8", dark: "#4f46e5" },
  { family: "Vibrantes mas refinados", name: "Esmeralda",        hex: "#059669", light: "#10b981", dark: "#047857" },
  { family: "Vibrantes mas refinados", name: "Violeta",          hex: "#7c3aed", light: "#8b5cf6", dark: "#6d28d9" },
  { family: "Vibrantes mas refinados", name: "Magenta Profundo", hex: "#be185d", light: "#db2777", dark: "#9d174d" },
];

export const PREMIUM_FAMILIES = Array.from(
  new Set(PREMIUM_COLORS.map((c) => c.family)),
);

const LS_PRIMARY = "physione.theme.primary";
const LS_MODE = "physione.theme.mode";
const LS_GRADIENT = "physione.theme.gradient";
const LS_SIDEBAR_STYLE = "physione.sidebar.style";
const LS_SIDEBAR_COMPACT = "physione.sidebar.compact";

export type SidebarStyle = "escuro" | "claro" | "colorido" | "vidro";
export const SIDEBAR_STYLES: { value: SidebarStyle; label: string; description: string }[] = [
  { value: "escuro",    label: "Escuro",    description: "Azul-marinho profissional (padrão)" },
  { value: "claro",     label: "Claro",     description: "Branco minimalista" },
  { value: "colorido",  label: "Colorido",  description: "Gradiente com a cor principal" },
  { value: "vidro",     label: "Vidro",     description: "Glassmorphism com cor principal" },
];

export function applySidebarStyle(style: SidebarStyle) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-sidebar-style", style);
  try { localStorage.setItem(LS_SIDEBAR_STYLE, style); } catch { /* ignore */ }
}
export function getStoredSidebarStyle(): SidebarStyle {
  try {
    const v = localStorage.getItem(LS_SIDEBAR_STYLE);
    if (v === "escuro" || v === "claro" || v === "colorido" || v === "vidro") return v;
  } catch { /* ignore */ }
  return "escuro";
}
export function applySidebarCompact(compact: boolean) {
  try { localStorage.setItem(LS_SIDEBAR_COMPACT, compact ? "1" : "0"); } catch { /* ignore */ }
}
export function getStoredSidebarCompact(): boolean {
  try { return localStorage.getItem(LS_SIDEBAR_COMPACT) === "1"; } catch { return false; }
}

/** Convert "#rrggbb" to "h s% l%" (shadcn format, no commas). */
export function hexToHSL(hex: string): string | null {
  const clean = hex.replace(/^#/, "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Relative luminance per WCAG. Returns 0..1. */
export function getLuminance(hex: string): number {
  const clean = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return 0;
  const toLin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLin(parseInt(clean.substring(0, 2), 16));
  const g = toLin(parseInt(clean.substring(2, 4), 16));
  const b = toLin(parseInt(clean.substring(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Find premium variants if the hex matches a curated color. */
function findVariants(hex: string): { light: string; dark: string } | null {
  const normalized = hex.toLowerCase();
  const match = PREMIUM_COLORS.find((c) => c.hex.toLowerCase() === normalized);
  return match ? { light: match.light, dark: match.dark } : null;
}

/** Apply the primary color to CSS variables. Faithful (HEX→HSL). */
export function applyPrimaryColor(hex: string) {
  if (typeof document === "undefined") return;
  const hsl = hexToHSL(hex);
  if (!hsl) return;
  const root = document.documentElement;
  root.style.setProperty("--primary", hsl);
  root.style.setProperty("--ring", hsl);

  // Contrast-aware foreground
  const isLight = getLuminance(hex) > 0.55;
  root.style.setProperty("--primary-foreground", isLight ? "0 0% 10%" : "0 0% 100%");

  // Variants for gradients (use curated values when available, else derive)
  const variants = findVariants(hex);
  if (variants) {
    const lightHsl = hexToHSL(variants.light);
    const darkHsl = hexToHSL(variants.dark);
    if (lightHsl) root.style.setProperty("--primary-light", lightHsl);
    if (darkHsl) root.style.setProperty("--primary-dark", darkHsl);
  } else {
    // Derive ±10% lightness from base HSL
    const parts = hsl.split(" ");
    const h = parts[0];
    const s = parts[1];
    const l = parseInt(parts[2], 10);
    root.style.setProperty("--primary-light", `${h} ${s} ${Math.min(l + 10, 92)}%`);
    root.style.setProperty("--primary-dark", `${h} ${s} ${Math.max(l - 10, 8)}%`);
  }

  try { localStorage.setItem(LS_PRIMARY, hex); } catch { /* ignore */ }
}

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const useDark = mode === "dark" || (mode === "system" && prefersDark);
  root.classList.toggle("dark", useDark);
  try { localStorage.setItem(LS_MODE, mode); } catch { /* ignore */ }
}

export function applyGradients(enabled: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("theme-gradients", enabled);
  try { localStorage.setItem(LS_GRADIENT, enabled ? "1" : "0"); } catch { /* ignore */ }
}

export function getStoredPrimary(): string | null {
  try { return localStorage.getItem(LS_PRIMARY); } catch { return null; }
}
export function getStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(LS_MODE);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch { /* ignore */ }
  return "system";
}
export function getStoredGradient(): boolean {
  try { return localStorage.getItem(LS_GRADIENT) === "1"; } catch { return false; }
}
