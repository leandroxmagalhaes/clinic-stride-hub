import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Locale, setCurrentLocale } from "@/lib/i18n";

const LOCALE_STORAGE_KEY = "physione_locale";

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

interface LocaleProviderProps {
  children: ReactNode;
}

function loadStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'pt-PT' || stored === 'pt-BR') {
      return stored;
    }
  } catch (e) {
    console.error("Error loading locale from localStorage:", e);
  }
  return 'pt-PT'; // Default to Portugal
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = loadStoredLocale();
    setCurrentLocale(stored); // Sync with i18n module
    return stored;
  });

  // Persist locale to localStorage and sync with i18n
  useEffect(() => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      setCurrentLocale(locale); // Sync with i18n module
    } catch (e) {
      console.error("Error saving locale to localStorage:", e);
    }
  }, [locale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}
