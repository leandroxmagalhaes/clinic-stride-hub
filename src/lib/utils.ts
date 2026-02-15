import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPublicBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'https://clinic-stride-hub.lovable.app';
  }
  const host = window.location.hostname;
  const previewMatch = host.match(/^id-preview--(.+)\.lovable\.app$/);
  if (previewMatch) {
    return `https://${previewMatch[1]}.lovable.app`;
  }
  if (host.includes('lovable.dev')) {
    return 'https://clinic-stride-hub.lovable.app';
  }
  return window.location.origin;
}
