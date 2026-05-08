import { createContext, useContext, useState, ReactNode } from 'react';

interface FloatingPanelsContextValue {
  copilotOpen: boolean;
  diaryOpen: boolean;
  setCopilotOpen: (v: boolean) => void;
  setDiaryOpen: (v: boolean) => void;
}

const FloatingPanelsContext = createContext<FloatingPanelsContextValue | null>(null);

export function FloatingPanelsProvider({ children }: { children: ReactNode }) {
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [diaryOpen, setDiaryOpen] = useState(false);
  return (
    <FloatingPanelsContext.Provider value={{ copilotOpen, diaryOpen, setCopilotOpen, setDiaryOpen }}>
      {children}
    </FloatingPanelsContext.Provider>
  );
}

export function useFloatingPanels() {
  const ctx = useContext(FloatingPanelsContext);
  if (!ctx) {
    // Safe fallback for unmounted environments
    return { copilotOpen: false, diaryOpen: false, setCopilotOpen: () => {}, setDiaryOpen: () => {} };
  }
  return ctx;
}
