// Internationalization utilities for currency, number formatting, and labels
// Configured for Portugal (PT) with future flexibility for Brazil (BR)

export type Locale = 'pt-PT' | 'pt-BR';
export type Currency = 'EUR' | 'BRL';

// Default configuration - Portugal MVP
const DEFAULT_LOCALE: Locale = 'pt-PT';
const DEFAULT_CURRENCY: Currency = 'EUR';

interface LocaleConfig {
  locale: Locale;
  currency: Currency;
  currencySymbol: string;
}

const LOCALE_CONFIGS: Record<Locale, LocaleConfig> = {
  'pt-PT': {
    locale: 'pt-PT',
    currency: 'EUR',
    currencySymbol: '€',
  },
  'pt-BR': {
    locale: 'pt-BR',
    currency: 'BRL',
    currencySymbol: 'R$',
  },
};

// Get current config (can be extended to read from user settings/context)
export function getLocaleConfig(): LocaleConfig {
  return LOCALE_CONFIGS[DEFAULT_LOCALE];
}

/**
 * Format a number as currency using the current locale
 * @param value - The number to format
 * @returns Formatted currency string (e.g., "1.000,00 €")
 */
export function formatCurrency(value: number): string {
  const config = getLocaleConfig();
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
  }).format(value);
}

/**
 * Format a number using the current locale
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted number string (e.g., "1.000,00")
 */
export function formatNumber(value: number, decimals: number = 2): string {
  const config = getLocaleConfig();
  return new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Get the currency symbol for display
 */
export function getCurrencySymbol(): string {
  return getLocaleConfig().currencySymbol;
}

// Field Labels - Internationalized terminology
export const FIELD_LABELS = {
  // Patient fields
  document: 'NIF / CPF',
  documentPlaceholder: 'Número fiscal (9-14 dígitos)',
  phone: 'Telefone',
  phonePlaceholder: '+351 912 345 678',
  emergencyPhone: 'Telefone de Emergência',
  emergencyPhonePlaceholder: '+351 912 345 678',
  postalCode: 'Código Postal',
  healthInsurance: 'Seguradora / Entidade',
  healthInsurancePlaceholder: 'Nome da seguradora (se aplicável)',
  
  // Professional fields
  professionalLicense: 'Cédula / Registro Profissional',
  professionalLicensePlaceholder: 'Número da cédula profissional',
  
  // Address
  addressPlaceholder: 'Morada, número, localidade',
} as const;

// Receipt footer text
export const RECEIPT_FOOTER = 'Documento meramente informativo. Não substitui a fatura fiscal.';
