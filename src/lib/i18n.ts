// Internationalization utilities for currency, number formatting, and labels
// Configured for Portugal (PT) with future flexibility for Brazil (BR)

export type Locale = 'pt-PT' | 'pt-BR';
export type Currency = 'EUR' | 'BRL';

// Default configuration - Portugal MVP
let currentLocale: Locale = 'pt-PT';

interface LocaleConfig {
  locale: Locale;
  currency: Currency;
  currencySymbol: string;
  countryName: string;
  flag: string;
}

export const LOCALE_CONFIGS: Record<Locale, LocaleConfig> = {
  'pt-PT': {
    locale: 'pt-PT',
    currency: 'EUR',
    currencySymbol: '€',
    countryName: 'Portugal',
    flag: '🇵🇹',
  },
  'pt-BR': {
    locale: 'pt-BR',
    currency: 'BRL',
    currencySymbol: 'R$',
    countryName: 'Brasil',
    flag: '🇧🇷',
  },
};

// Set the current locale (called from LocaleContext)
export function setCurrentLocale(locale: Locale): void {
  currentLocale = locale;
}

// Get current locale
export function getCurrentLocale(): Locale {
  return currentLocale;
}

// Get current config based on active locale
export function getLocaleConfig(locale?: Locale): LocaleConfig {
  return LOCALE_CONFIGS[locale ?? currentLocale];
}

/**
 * Format a number as currency using the current locale
 * @param value - The number to format
 * @param locale - Optional locale override
 * @returns Formatted currency string (e.g., "1.000,00 €")
 */
export function formatCurrency(value: number, locale?: Locale): string {
  const config = getLocaleConfig(locale);
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
  }).format(value);
}

/**
 * Format a number using the current locale
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @param locale - Optional locale override
 * @returns Formatted number string (e.g., "1.000,00")
 */
export function formatNumber(value: number, decimals: number = 2, locale?: Locale): string {
  const config = getLocaleConfig(locale);
  return new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Get the currency symbol for display
 */
export function getCurrencySymbol(locale?: Locale): string {
  return getLocaleConfig(locale).currencySymbol;
}

// Field Labels - Internationalized terminology (based on locale)
export function getFieldLabels(locale?: Locale) {
  const loc = locale ?? currentLocale;
  
  if (loc === 'pt-BR') {
    return {
      // Patient fields
      document: 'CPF',
      documentPlaceholder: 'Número do CPF (11 dígitos)',
      phone: 'Telefone',
      phonePlaceholder: '(11) 91234-5678',
      emergencyPhone: 'Telefone de Emergência',
      emergencyPhonePlaceholder: '(11) 91234-5678',
      postalCode: 'CEP',
      healthInsurance: 'Convênio',
      healthInsurancePlaceholder: 'Nome do convênio (se aplicável)',
      
      // Professional fields
      professionalLicense: 'CREFITO',
      professionalLicensePlaceholder: 'Número do CREFITO',
      
      // Address
      addressPlaceholder: 'Rua, número, bairro, cidade',
      
      // Terminology
      patient: 'Paciente',
      patients: 'Pacientes',
    } as const;
  }
  
  // Default: Portugal
  return {
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
    
    // Terminology
    patient: 'Utente',
    patients: 'Utentes',
  } as const;
}

// Legacy constant for backwards compatibility
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
