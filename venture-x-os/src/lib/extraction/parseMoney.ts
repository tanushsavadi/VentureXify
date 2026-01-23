// ============================================
// PARSE MONEY - Robust Currency & Number Parsing
// ============================================
// Handles international currency formats, symbols, and edge cases
// for reliable price extraction across different locales

import { Money } from './types';

// ============================================
// CURRENCY DEFINITIONS
// ============================================

/**
 * Currency information including symbols and formatting
 */
interface CurrencyInfo {
  code: string;
  symbol: string;
  symbolAlt?: string[];
  name: string;
  decimalSeparator: '.' | ',';
  thousandsSeparator: ',' | '.' | ' ' | "'";
  symbolPosition: 'before' | 'after';
  minorUnits: number; // decimal places (2 for most, 0 for JPY, etc.)
}

/**
 * Comprehensive currency database
 */
const CURRENCIES: Record<string, CurrencyInfo> = {
  USD: { code: 'USD', symbol: '$', symbolAlt: ['US$', 'USD'], name: 'US Dollar', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  EUR: { code: 'EUR', symbol: '€', symbolAlt: ['EUR'], name: 'Euro', decimalSeparator: ',', thousandsSeparator: '.', symbolPosition: 'after', minorUnits: 2 },
  GBP: { code: 'GBP', symbol: '£', symbolAlt: ['GBP'], name: 'British Pound', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  JPY: { code: 'JPY', symbol: '¥', symbolAlt: ['JPY', '円'], name: 'Japanese Yen', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 0 },
  CNY: { code: 'CNY', symbol: '¥', symbolAlt: ['CNY', 'RMB', '元'], name: 'Chinese Yuan', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  AED: { code: 'AED', symbol: 'د.إ', symbolAlt: ['AED', 'Dhs', 'DH'], name: 'UAE Dirham', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  CAD: { code: 'CAD', symbol: 'CA$', symbolAlt: ['CAD', 'C$'], name: 'Canadian Dollar', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  AUD: { code: 'AUD', symbol: 'A$', symbolAlt: ['AUD', 'AU$'], name: 'Australian Dollar', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  INR: { code: 'INR', symbol: '₹', symbolAlt: ['INR', 'Rs', 'Rs.'], name: 'Indian Rupee', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  CHF: { code: 'CHF', symbol: 'CHF', symbolAlt: ['Fr', 'SFr'], name: 'Swiss Franc', decimalSeparator: '.', thousandsSeparator: "'", symbolPosition: 'before', minorUnits: 2 },
  SGD: { code: 'SGD', symbol: 'S$', symbolAlt: ['SGD'], name: 'Singapore Dollar', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  HKD: { code: 'HKD', symbol: 'HK$', symbolAlt: ['HKD'], name: 'Hong Kong Dollar', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  KRW: { code: 'KRW', symbol: '₩', symbolAlt: ['KRW', '원'], name: 'South Korean Won', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 0 },
  MXN: { code: 'MXN', symbol: 'MX$', symbolAlt: ['MXN'], name: 'Mexican Peso', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  BRL: { code: 'BRL', symbol: 'R$', symbolAlt: ['BRL'], name: 'Brazilian Real', decimalSeparator: ',', thousandsSeparator: '.', symbolPosition: 'before', minorUnits: 2 },
  NZD: { code: 'NZD', symbol: 'NZ$', symbolAlt: ['NZD'], name: 'New Zealand Dollar', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  SEK: { code: 'SEK', symbol: 'kr', symbolAlt: ['SEK'], name: 'Swedish Krona', decimalSeparator: ',', thousandsSeparator: ' ', symbolPosition: 'after', minorUnits: 2 },
  NOK: { code: 'NOK', symbol: 'kr', symbolAlt: ['NOK'], name: 'Norwegian Krone', decimalSeparator: ',', thousandsSeparator: ' ', symbolPosition: 'after', minorUnits: 2 },
  DKK: { code: 'DKK', symbol: 'kr', symbolAlt: ['DKK'], name: 'Danish Krone', decimalSeparator: ',', thousandsSeparator: '.', symbolPosition: 'after', minorUnits: 2 },
  PLN: { code: 'PLN', symbol: 'zł', symbolAlt: ['PLN'], name: 'Polish Zloty', decimalSeparator: ',', thousandsSeparator: ' ', symbolPosition: 'after', minorUnits: 2 },
  THB: { code: 'THB', symbol: '฿', symbolAlt: ['THB', 'B'], name: 'Thai Baht', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  MYR: { code: 'MYR', symbol: 'RM', symbolAlt: ['MYR'], name: 'Malaysian Ringgit', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  IDR: { code: 'IDR', symbol: 'Rp', symbolAlt: ['IDR'], name: 'Indonesian Rupiah', decimalSeparator: ',', thousandsSeparator: '.', symbolPosition: 'before', minorUnits: 0 },
  PHP: { code: 'PHP', symbol: '₱', symbolAlt: ['PHP', 'P'], name: 'Philippine Peso', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  VND: { code: 'VND', symbol: '₫', symbolAlt: ['VND'], name: 'Vietnamese Dong', decimalSeparator: ',', thousandsSeparator: '.', symbolPosition: 'after', minorUnits: 0 },
  ZAR: { code: 'ZAR', symbol: 'R', symbolAlt: ['ZAR'], name: 'South African Rand', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  TRY: { code: 'TRY', symbol: '₺', symbolAlt: ['TRY', 'TL'], name: 'Turkish Lira', decimalSeparator: ',', thousandsSeparator: '.', symbolPosition: 'before', minorUnits: 2 },
  RUB: { code: 'RUB', symbol: '₽', symbolAlt: ['RUB', 'руб'], name: 'Russian Ruble', decimalSeparator: ',', thousandsSeparator: ' ', symbolPosition: 'after', minorUnits: 2 },
  SAR: { code: 'SAR', symbol: 'ر.س', symbolAlt: ['SAR', 'SR'], name: 'Saudi Riyal', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  QAR: { code: 'QAR', symbol: 'ر.ق', symbolAlt: ['QAR', 'QR'], name: 'Qatari Riyal', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  BHD: { code: 'BHD', symbol: 'ب.د', symbolAlt: ['BHD', 'BD'], name: 'Bahraini Dinar', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 3 },
  KWD: { code: 'KWD', symbol: 'د.ك', symbolAlt: ['KWD', 'KD'], name: 'Kuwaiti Dinar', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 3 },
  OMR: { code: 'OMR', symbol: 'ر.ع', symbolAlt: ['OMR', 'OR'], name: 'Omani Rial', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 3 },
  JOD: { code: 'JOD', symbol: 'د.أ', symbolAlt: ['JOD', 'JD'], name: 'Jordanian Dinar', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 3 },
  ILS: { code: 'ILS', symbol: '₪', symbolAlt: ['ILS', 'NIS'], name: 'Israeli Shekel', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  EGP: { code: 'EGP', symbol: 'E£', symbolAlt: ['EGP', 'ج.م'], name: 'Egyptian Pound', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
  TWD: { code: 'TWD', symbol: 'NT$', symbolAlt: ['TWD'], name: 'Taiwan Dollar', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 0 },
  CZK: { code: 'CZK', symbol: 'Kč', symbolAlt: ['CZK'], name: 'Czech Koruna', decimalSeparator: ',', thousandsSeparator: ' ', symbolPosition: 'after', minorUnits: 2 },
  HUF: { code: 'HUF', symbol: 'Ft', symbolAlt: ['HUF'], name: 'Hungarian Forint', decimalSeparator: ',', thousandsSeparator: ' ', symbolPosition: 'after', minorUnits: 0 },
  CLP: { code: 'CLP', symbol: 'CL$', symbolAlt: ['CLP'], name: 'Chilean Peso', decimalSeparator: ',', thousandsSeparator: '.', symbolPosition: 'before', minorUnits: 0 },
  COP: { code: 'COP', symbol: 'CO$', symbolAlt: ['COP'], name: 'Colombian Peso', decimalSeparator: ',', thousandsSeparator: '.', symbolPosition: 'before', minorUnits: 0 },
  ARS: { code: 'ARS', symbol: 'AR$', symbolAlt: ['ARS'], name: 'Argentine Peso', decimalSeparator: ',', thousandsSeparator: '.', symbolPosition: 'before', minorUnits: 2 },
  PEN: { code: 'PEN', symbol: 'S/', symbolAlt: ['PEN'], name: 'Peruvian Sol', decimalSeparator: '.', thousandsSeparator: ',', symbolPosition: 'before', minorUnits: 2 },
};

/**
 * Build a lookup map for symbols to currency codes
 */
const SYMBOL_TO_CURRENCY: Map<string, string> = new Map();

// Initialize symbol lookup
for (const [code, info] of Object.entries(CURRENCIES)) {
  SYMBOL_TO_CURRENCY.set(info.symbol.toLowerCase(), code);
  if (info.symbolAlt) {
    for (const alt of info.symbolAlt) {
      SYMBOL_TO_CURRENCY.set(alt.toLowerCase(), code);
    }
  }
}

// Special case: $ without prefix defaults to USD
SYMBOL_TO_CURRENCY.set('$', 'USD');

// ============================================
// PARSING OPTIONS
// ============================================

export interface ParseMoneyOptions {
  /** Default currency if not detected */
  defaultCurrency?: string;
  
  /** Expected currency (for validation) */
  expectedCurrency?: string;
  
  /** Minimum valid amount */
  minAmount?: number;
  
  /** Maximum valid amount */
  maxAmount?: number;
  
  /** Whether to allow zero amounts */
  allowZero?: boolean;
  
  /** Whether to allow negative amounts */
  allowNegative?: boolean;
  
  /** Locale hint for parsing */
  locale?: string;
}

export interface ParseMoneyResult {
  /** Successfully parsed money */
  money: Money | null;
  
  /** Confidence in the parse (0-100) */
  confidence: number;
  
  /** Warnings about parsing */
  warnings: string[];
  
  /** Whether this looks like a "from" price */
  isFromPrice: boolean;
  
  /** Whether this is per-night */
  isPerNight: boolean;
  
  /** Whether this is per-person */
  isPerPerson: boolean;
}

// ============================================
// MAIN PARSING FUNCTION
// ============================================

/**
 * Parse a price string into a Money object
 * Handles various international formats and edge cases
 * 
 * @param text - Raw text containing a price
 * @param options - Parsing options
 * @returns ParseMoneyResult with parsed money and metadata
 */
export function parseMoney(
  text: string,
  options: ParseMoneyOptions = {}
): ParseMoneyResult {
  const {
    defaultCurrency = 'USD',
    expectedCurrency,
    minAmount = 0,
    maxAmount = 10000000,
    allowZero = false,
    allowNegative = false,
  } = options;
  
  const result: ParseMoneyResult = {
    money: null,
    confidence: 0,
    warnings: [],
    isFromPrice: false,
    isPerNight: false,
    isPerPerson: false,
  };
  
  if (!text || typeof text !== 'string') {
    result.warnings.push('Empty or invalid input');
    return result;
  }
  
  // Normalize the text
  let normalized = normalizeText(text);
  
  // Check for price qualifiers
  result.isFromPrice = detectFromPrice(normalized);
  result.isPerNight = detectPerNight(normalized);
  result.isPerPerson = detectPerPerson(normalized);
  
  // Detect currency
  const detectedCurrency = detectCurrency(normalized);
  const currency = detectedCurrency || expectedCurrency || defaultCurrency;
  
  // Validate expected currency if provided
  if (expectedCurrency && detectedCurrency && detectedCurrency !== expectedCurrency) {
    result.warnings.push(`Expected ${expectedCurrency} but detected ${detectedCurrency}`);
  }
  
  // Get currency info for parsing hints
  const currencyInfo = CURRENCIES[currency];
  
  // Extract numeric value
  const amount = extractAmount(normalized, currencyInfo);
  
  if (amount === null) {
    result.warnings.push('Could not extract numeric amount');
    return result;
  }
  
  // Validate amount
  if (!allowNegative && amount < 0) {
    result.warnings.push('Negative amount not allowed');
    return result;
  }
  
  if (!allowZero && amount === 0) {
    result.warnings.push('Zero amount not allowed');
    return result;
  }
  
  if (amount < minAmount) {
    result.warnings.push(`Amount ${amount} below minimum ${minAmount}`);
    return result;
  }
  
  if (amount > maxAmount) {
    result.warnings.push(`Amount ${amount} above maximum ${maxAmount}`);
    return result;
  }
  
  // Build result
  result.money = {
    amount,
    currency,
    rawText: text.trim()
  };
  
  // Calculate confidence
  result.confidence = calculateConfidence(
    text,
    amount,
    currency,
    detectedCurrency,
    result.warnings
  );
  
  return result;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normalize text for parsing
 */
function normalizeText(text: string): string {
  return text
    // Remove non-breaking spaces
    .replace(/\u00A0/g, ' ')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
}

/**
 * Detect currency from text
 */
function detectCurrency(text: string): string | null {
  const upper = text.toUpperCase();
  const lower = text.toLowerCase();
  
  // Check for ISO currency codes first (most reliable)
  // Pattern: 3 uppercase letters that are known currency codes
  const isoMatch = upper.match(/\b([A-Z]{3})\b/g);
  if (isoMatch) {
    for (const code of isoMatch) {
      if (CURRENCIES[code]) {
        return code;
      }
    }
  }
  
  // Check for prefixed dollar signs (CA$, A$, US$, etc.)
  const prefixedDollar = upper.match(/([A-Z]{1,2})\$/);
  if (prefixedDollar) {
    const prefix = prefixedDollar[1];
    if (prefix === 'CA' || prefix === 'C') return 'CAD';
    if (prefix === 'AU' || prefix === 'A') return 'AUD';
    if (prefix === 'US') return 'USD';
    if (prefix === 'NZ') return 'NZD';
    if (prefix === 'HK') return 'HKD';
    if (prefix === 'SG' || prefix === 'S') return 'SGD';
  }
  
  // Check for specific symbols BEFORE the generic symbol map
  // to handle ambiguous cases better
  
  // Euro
  if (/€/.test(text)) {
    return 'EUR';
  }
  
  // British Pound
  if (/£/.test(text)) {
    return 'GBP';
  }
  
  // Indian Rupee
  if (/₹/.test(text)) {
    return 'INR';
  }
  
  // AED dirham symbol
  if (/د\.إ/.test(text)) {
    return 'AED';
  }
  
  // Japanese Yen (¥ defaults to JPY in most travel contexts)
  // Chinese Yuan uses CNY code explicitly
  if (/¥/.test(text)) {
    return 'JPY';
  }
  
  // Plain dollar sign - USD by default
  if (/\$/.test(text)) {
    return 'USD';
  }
  
  // Check for remaining currency symbols in the map
  for (const [symbol, code] of SYMBOL_TO_CURRENCY.entries()) {
    // Skip $ as we already handled it above
    if (symbol === '$') continue;
    if (lower.includes(symbol)) {
      return code;
    }
  }
  
  return null;
}

/**
 * Extract numeric amount from text
 */
function extractAmount(text: string, currencyInfo?: CurrencyInfo): number | null {
  // Remove currency symbols and codes for cleaner parsing
  let cleaned = text
    // Remove ISO codes (but keep numbers)
    .replace(/\b[A-Z]{3}\b/gi, ' ')
    // Remove common currency symbols
    .replace(/[$€£¥₹₽₩₪฿₫₱]/g, ' ')
    // Remove Arabic currency symbols (using alternation, not character class)
    .replace(/ر\.س|ر\.ق|ب\.د|د\.ك|ر\.ع|د\.إ|ج\.م|د\.أ/g, ' ')
    // Remove other currency indicators
    .replace(/\b(zł|kr|Ft|Kč|Rs\.?|RM|Rp)\b/gi, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
  
  // Find all number-like patterns in the cleaned text
  // This comprehensive regex captures numbers with various formats
  const numberPattern = /(-?\d[\d,.''\s]*\d|-?\d)/g;
  const matches = cleaned.match(numberPattern);
  
  if (!matches || matches.length === 0) {
    return null;
  }
  
  // Take the first (or best) match
  // For most cases, take the longest number-like string
  const bestMatch = matches.reduce((a, b) => a.length >= b.length ? a : b);
  
  return parseNumericString(bestMatch, currencyInfo);
}

/**
 * Parse a numeric string with smart separator detection
 */
function parseNumericString(numStr: string, currencyInfo?: CurrencyInfo): number | null {
  if (!numStr) return null;
  
  // Remove all whitespace
  let clean = numStr.replace(/\s/g, '');
  
  // Remove Swiss-style apostrophes as thousands separator
  clean = clean.replace(/'/g, '');
  
  // Count occurrences of . and ,
  const dots = (clean.match(/\./g) || []).length;
  const commas = (clean.match(/,/g) || []).length;
  
  // Find positions
  const lastDot = clean.lastIndexOf('.');
  const lastComma = clean.lastIndexOf(',');
  
  // No separators - simple integer
  if (lastDot === -1 && lastComma === -1) {
    const result = parseInt(clean, 10);
    return isNaN(result) ? null : result;
  }
  
  // Determine which is the decimal separator based on:
  // 1. Position (last one is usually decimal)
  // 2. Count (if multiple, that's the thousands separator)
  // 3. Digits after (1-2 = decimal, 3 = thousands)
  
  let decimalSep: '.' | ',' | null = null;
  
  if (dots > 0 && commas === 0) {
    // Only dots
    if (dots === 1) {
      const afterDot = clean.substring(lastDot + 1);
      if (afterDot.length === 3) {
        // Could be thousands (e.g., 1.234) or decimal with 3 places
        // Use currency hint if available
        if (currencyInfo && currencyInfo.decimalSeparator === ',') {
          // European currency - dot is thousands
          decimalSep = null;
        } else {
          // Default: treat as ambiguous, but prefer decimal for safety
          // If it's exactly 3 digits and looks like a round number, it's thousands
          if (/^\d{1,3}\.\d{3}$/.test(clean)) {
            // Could be either - use currency hint or default to thousands for EUR context
            decimalSep = currencyInfo?.decimalSeparator === ',' ? null : '.';
          } else {
            decimalSep = '.';
          }
        }
      } else {
        // 1-2 digits after dot = definitely decimal
        decimalSep = '.';
      }
    } else {
      // Multiple dots = thousands separators (e.g., 1.234.567)
      decimalSep = null;
    }
  } else if (commas > 0 && dots === 0) {
    // Only commas
    if (commas === 1) {
      const afterComma = clean.substring(lastComma + 1);
      if (afterComma.length === 3) {
        // Could be thousands (e.g., 1,234) - common in US
        // 3 digits after single comma usually means thousands in US format
        decimalSep = null;
      } else if (afterComma.length <= 2) {
        // 1-2 digits after comma = decimal (European)
        decimalSep = ',';
      } else {
        // More than 3 = thousands
        decimalSep = null;
      }
    } else {
      // Multiple commas = thousands separators (e.g., 1,234,567)
      decimalSep = null;
    }
  } else {
    // Both dots and commas present
    // The LAST one is the decimal separator
    if (lastDot > lastComma) {
      decimalSep = '.';
    } else {
      decimalSep = ',';
    }
  }
  
  // Now parse based on determined separator
  if (decimalSep === '.') {
    // Remove commas (thousands)
    clean = clean.replace(/,/g, '');
  } else if (decimalSep === ',') {
    // Remove dots (thousands), then replace comma with dot
    clean = clean.replace(/\./g, '');
    clean = clean.replace(',', '.');
  } else {
    // No decimal separator - remove all separators
    clean = clean.replace(/[.,]/g, '');
  }
  
  const result = parseFloat(clean);
  return isNaN(result) ? null : result;
}

/**
 * Detect if this is a "from" or "starting at" price
 */
function detectFromPrice(text: string): boolean {
  const patterns = [
    /\bfrom\b/i,
    /\bstarting\s+at\b/i,
    /\bstarts?\s+at\b/i,
    /\bas\s+low\s+as\b/i,
    /\bbase\s+(?:fare|price|rate)\b/i,
    /^from\s+/i,
  ];
  
  return patterns.some(p => p.test(text));
}

/**
 * Detect if this is a per-night price
 */
function detectPerNight(text: string): boolean {
  const patterns = [
    /\/\s*night/i,
    /per\s*night/i,
    /\bnight(?:ly)?\b.*\$/i,
    /\bnightly\s*rate/i,
    /\bper\s*n(?:ight|ite)\b/i,
  ];
  
  return patterns.some(p => p.test(text));
}

/**
 * Detect if this is a per-person price
 */
function detectPerPerson(text: string): boolean {
  const patterns = [
    /\/\s*person/i,
    /per\s*person/i,
    /\/\s*pax/i,
    /\bper\s*(?:person|pax|guest|adult|traveler)\b/i,
    /\beach\b/i,
  ];
  
  return patterns.some(p => p.test(text));
}

/**
 * Calculate confidence in the parsed result
 */
function calculateConfidence(
  originalText: string,
  amount: number,
  currency: string,
  detectedCurrency: string | null,
  warnings: string[]
): number {
  let confidence = 100;
  
  // Deduct for warnings
  confidence -= warnings.length * 10;
  
  // Deduct if currency wasn't explicitly detected
  if (!detectedCurrency) {
    confidence -= 15;
  }
  
  // Deduct for ambiguous amounts (could be different with different separators)
  const hasAmbiguousSeparators = /^\d{1,3}[.,]\d{3}$/.test(
    originalText.replace(/[^0-9.,]/g, '')
  );
  if (hasAmbiguousSeparators) {
    confidence -= 10;
  }
  
  // Deduct for very large or very small amounts (unusual for travel)
  if (amount < 10 || amount > 100000) {
    confidence -= 10;
  }
  
  // Deduct for "from" prices
  if (detectFromPrice(originalText)) {
    confidence -= 5;
  }
  
  // Boost for clean, standard formats
  if (/^\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?$/.test(originalText.trim())) {
    confidence += 10;
  }
  
  // Cap confidence
  return Math.max(0, Math.min(100, confidence));
}

// ============================================
// BATCH & UTILITY FUNCTIONS
// ============================================

/**
 * Parse multiple prices from text and return all found
 */
export function parseAllPrices(
  text: string,
  options: ParseMoneyOptions = {}
): ParseMoneyResult[] {
  const results: ParseMoneyResult[] = [];
  
  // Find all potential price patterns
  const pricePatterns = [
    // Currency symbol + amount
    /(?:[A-Z]{2,3}\$?|\$|€|£|¥|₹|₽|₩|₪|฿|₫|₱|[\u0600-\u06FF.]+)\s*[\d,.''\s]+(?:\.\d{1,2})?/gi,
    // Amount + currency code
    /[\d,.''\s]+(?:\.\d{1,2})?\s*(?:USD|EUR|GBP|AED|CAD|AUD|INR|JPY|CNY|CHF|SGD|HKD|KRW|MXN|BRL)/gi,
    // Amount + currency symbol
    /[\d,.''\s]+(?:\.\d{1,2})?\s*[€£₹₽₩₪฿₫₱kr zł Ft Kč]/gi,
  ];
  
  const seen = new Set<string>();
  
  for (const pattern of pricePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const priceText = match[0].trim();
      if (!seen.has(priceText)) {
        seen.add(priceText);
        const result = parseMoney(priceText, options);
        if (result.money) {
          results.push(result);
        }
      }
    }
  }
  
  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);
  
  return results;
}

/**
 * Format a Money object back to string
 */
export function formatMoney(money: Money, locale?: string): string {
  const currencyInfo = CURRENCIES[money.currency];
  
  try {
    return new Intl.NumberFormat(locale || 'en-US', {
      style: 'currency',
      currency: money.currency,
      minimumFractionDigits: currencyInfo?.minorUnits ?? 2,
      maximumFractionDigits: currencyInfo?.minorUnits ?? 2,
    }).format(money.amount);
  } catch {
    // Fallback for unsupported currencies
    const symbol = currencyInfo?.symbol || money.currency;
    return `${symbol}${money.amount.toFixed(2)}`;
  }
}

/**
 * Compare two Money objects (returns true if same amount and currency)
 */
export function compareMoney(a: Money, b: Money): boolean {
  return a.currency === b.currency && Math.abs(a.amount - b.amount) < 0.01;
}

/**
 * Convert money between currencies (requires rate)
 */
export function convertMoney(
  money: Money,
  targetCurrency: string,
  rate: number
): Money {
  return {
    amount: money.amount * rate,
    currency: targetCurrency,
    rawText: undefined
  };
}

/**
 * Get currency info for a code
 */
export function getCurrencyInfo(code: string): CurrencyInfo | null {
  return CURRENCIES[code] || null;
}

/**
 * Check if a string looks like it contains a price
 */
export function looksLikePrice(text: string): boolean {
  if (!text) return false;
  
  // Must have numbers
  if (!/\d/.test(text)) return false;
  
  // Should have currency indicator OR be in a context that implies price
  const hasCurrencyIndicator = 
    /[$€£¥₹₽₩₪฿₫₱]/.test(text) ||
    /\b(?:USD|EUR|GBP|AED|CAD|AUD|INR|JPY|CNY|CHF|SGD|HKD|KRW|MXN|BRL)\b/i.test(text);
  
  // Reasonable length for a price
  const reasonableLength = text.length < 50;
  
  // Has number pattern typical of prices
  const hasTypicalPattern = /\d{1,3}(?:[,.\s]\d{3})*(?:[.,]\d{1,2})?/.test(text);
  
  return (hasCurrencyIndicator || hasTypicalPattern) && reasonableLength;
}

/**
 * Extract the best price from text (highest confidence)
 */
export function extractBestPrice(
  text: string,
  options: ParseMoneyOptions = {}
): Money | null {
  const results = parseAllPrices(text, options);
  return results[0]?.money || null;
}
