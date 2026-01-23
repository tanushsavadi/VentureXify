// ============================================
// CURRENCY CONVERTER
// Dynamic currency conversion with live API rates
// ============================================

// PEGGED CURRENCIES - These have fixed exchange rates to USD
// We ALWAYS use these rates, ignoring API data (more accurate)
const PEGGED_RATES_TO_USD: Record<string, number> = {
  AED: 0.2723,  // UAE Dirham - PEGGED at 3.6725 AED = 1 USD
  SAR: 0.2667,  // Saudi Riyal - PEGGED at 3.75 SAR = 1 USD
  QAR: 0.2747,  // Qatari Riyal - PEGGED at 3.64 QAR = 1 USD
  BHD: 2.6525,  // Bahraini Dinar - PEGGED at 0.377 BHD = 1 USD
  OMR: 2.5974,  // Omani Rial - PEGGED at 0.385 OMR = 1 USD
  HKD: 0.1282,  // Hong Kong Dollar - PEGGED at 7.80 HKD = 1 USD
};

// Fallback exchange rates to USD (used if API fails)
// These are approximate and will be updated by API for non-pegged currencies
const FALLBACK_RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  // Gulf currencies (PEGGED - use exact rates)
  AED: 0.2723,  // UAE Dirham: 1 AED = 1/3.6725 USD
  SAR: 0.2667,  // Saudi Riyal: 1 SAR = 1/3.75 USD
  QAR: 0.2747,  // Qatari Riyal: 1 QAR = 1/3.64 USD
  BHD: 2.6525,  // Bahraini Dinar
  OMR: 2.5974,  // Omani Rial
  KWD: 3.26,    // Kuwaiti Dinar (floating but stable)
  // Major currencies
  EUR: 1.08,    // 1 EUR = ~$1.08 USD
  GBP: 1.27,    // 1 GBP = ~$1.27 USD
  CAD: 0.74,    // 1 CAD = ~$0.74 USD
  AUD: 0.65,    // 1 AUD = ~$0.65 USD
  CHF: 1.12,    // 1 CHF = ~$1.12 USD
  JPY: 0.0067,  // 1 JPY = ~$0.0067 USD
  // Asian currencies
  INR: 0.012,   // 1 INR = ~$0.012 USD
  CNY: 0.14,    // 1 CNY = ~$0.14 USD
  SGD: 0.75,    // 1 SGD = ~$0.75 USD
  HKD: 0.1282,  // Hong Kong Dollar (PEGGED)
  KRW: 0.00076, // 1 KRW = ~$0.00076 USD
  THB: 0.029,   // 1 THB = ~$0.029 USD
  MYR: 0.22,    // 1 MYR = ~$0.22 USD
  PHP: 0.018,   // 1 PHP = ~$0.018 USD
  IDR: 0.000063, // 1 IDR = ~$0.000063 USD
  VND: 0.00004, // 1 VND = ~$0.00004 USD
  TWD: 0.031,   // 1 TWD = ~$0.031 USD
  // Other currencies
  MXN: 0.058,   // 1 MXN = ~$0.058 USD
  BRL: 0.20,    // 1 BRL = ~$0.20 USD
  NZD: 0.60,    // 1 NZD = ~$0.60 USD
  ZAR: 0.054,   // 1 ZAR = ~$0.054 USD
};

// Currency symbols mapping
const CURRENCY_SYMBOLS: Record<string, string[]> = {
  USD: ['$', 'US$', 'USD'],
  AED: ['AED', 'د.إ', 'DH'],
  EUR: ['€', 'EUR', '€'],
  GBP: ['£', 'GBP', '£'],
  CAD: ['C$', 'CA$', 'CAD'],
  AUD: ['A$', 'AU$', 'AUD'],
  INR: ['₹', 'INR', 'Rs'],
  JPY: ['¥', 'JPY', '円'],
  CNY: ['¥', 'CNY', '元', 'RMB'],
  SGD: ['S$', 'SG$', 'SGD'],
  HKD: ['HK$', 'HKD'],
  CHF: ['CHF', 'Fr'],
  MXN: ['MX$', 'MXN'],
  BRL: ['R$', 'BRL'],
  KRW: ['₩', 'KRW'],
  THB: ['฿', 'THB'],
  MYR: ['RM', 'MYR'],
  PHP: ['₱', 'PHP'],
  IDR: ['Rp', 'IDR'],
  TWD: ['NT$', 'TWD'],
  NZD: ['NZ$', 'NZD'],
  SAR: ['SAR', 'ر.س'],
  QAR: ['QAR', 'ر.ق'],
  KWD: ['KWD', 'د.ك'],
};

// ============================================
// LIVE EXCHANGE RATE API
// Using free exchangerate.host API (no key required)
// Fallback: fawazahmed0/currency-api on GitHub
// ============================================

// Cache settings
const CACHE_KEY = 'vx_exchange_rates';
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

interface CachedRates {
  rates: Record<string, number>;
  fetchedAt: number;
  source: 'api' | 'fallback';
}

// In-memory cache for quick access
let cachedRates: CachedRates | null = null;

/**
 * Get exchange rates from API
 * Uses exchangerate.host as primary, fallback to fawazahmed0/currency-api
 */
async function fetchLiveRates(): Promise<Record<string, number>> {
  // Primary API: exchangerate.host (free, no key required)
  // Returns rates FROM USD to other currencies
  const primaryUrl = 'https://api.exchangerate.host/latest?base=USD';
  
  // Fallback API: fawazahmed0/currency-api (free, GitHub hosted)
  const fallbackUrl = 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';
  
  let rates: Record<string, number> = {};
  
  // Try primary API
  try {
    console.log('[CurrencyConverter] Fetching rates from exchangerate.host...');
    const response = await fetch(primaryUrl, { 
      signal: AbortSignal.timeout(5000) 
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success !== false && data.rates) {
        // Convert FROM rates (1 USD = X currency) TO rates (1 currency = X USD)
        for (const [code, rate] of Object.entries(data.rates)) {
          if (typeof rate === 'number' && rate > 0) {
            rates[code.toUpperCase()] = 1 / rate;
          }
        }
        rates['USD'] = 1.0;
        console.log('[CurrencyConverter] Fetched', Object.keys(rates).length, 'rates from primary API');
        return rates;
      }
    }
  } catch (e) {
    console.log('[CurrencyConverter] Primary API failed:', e);
  }
  
  // Try fallback API
  try {
    console.log('[CurrencyConverter] Trying fallback API (fawazahmed0)...');
    const response = await fetch(fallbackUrl, { 
      signal: AbortSignal.timeout(5000) 
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.usd) {
        // This API returns: 1 USD = X currency, so we need to invert
        for (const [code, rate] of Object.entries(data.usd)) {
          if (typeof rate === 'number' && rate > 0) {
            rates[code.toUpperCase()] = 1 / rate;
          }
        }
        rates['USD'] = 1.0;
        console.log('[CurrencyConverter] Fetched', Object.keys(rates).length, 'rates from fallback API');
        return rates;
      }
    }
  } catch (e) {
    console.log('[CurrencyConverter] Fallback API failed:', e);
  }
  
  // All APIs failed, return empty (will use fallback rates)
  console.log('[CurrencyConverter] All APIs failed, using hardcoded fallback rates');
  return {};
}

/**
 * Load cached rates from Chrome storage
 */
async function loadCachedRates(): Promise<CachedRates | null> {
  try {
    const result = await chrome.storage.local.get(CACHE_KEY);
    if (result[CACHE_KEY]) {
      const cached = result[CACHE_KEY] as CachedRates;
      // Check if cache is still valid
      if (Date.now() - cached.fetchedAt < CACHE_DURATION_MS) {
        console.log('[CurrencyConverter] Loaded cached rates from', new Date(cached.fetchedAt).toLocaleString());
        return cached;
      }
      console.log('[CurrencyConverter] Cache expired');
    }
  } catch (e) {
    console.log('[CurrencyConverter] Could not load cached rates:', e);
  }
  return null;
}

/**
 * Save rates to Chrome storage
 */
async function saveCachedRates(cached: CachedRates): Promise<void> {
  try {
    await chrome.storage.local.set({ [CACHE_KEY]: cached });
    console.log('[CurrencyConverter] Saved rates to cache');
  } catch (e) {
    console.log('[CurrencyConverter] Could not save rates to cache:', e);
  }
}

/**
 * Get current exchange rates (from cache or API)
 */
async function getExchangeRates(): Promise<CachedRates> {
  // Return in-memory cache if valid
  if (cachedRates && Date.now() - cachedRates.fetchedAt < CACHE_DURATION_MS) {
    return cachedRates;
  }
  
  // Try to load from Chrome storage
  const storedCache = await loadCachedRates();
  if (storedCache) {
    cachedRates = storedCache;
    return cachedRates;
  }
  
  // Fetch fresh rates from API
  const liveRates = await fetchLiveRates();
  
  if (Object.keys(liveRates).length > 0) {
    cachedRates = {
      rates: liveRates,
      fetchedAt: Date.now(),
      source: 'api',
    };
    await saveCachedRates(cachedRates);
    return cachedRates;
  }
  
  // Fall back to hardcoded rates
  cachedRates = {
    rates: { ...FALLBACK_RATES_TO_USD },
    fetchedAt: Date.now(),
    source: 'fallback',
  };
  return cachedRates;
}

/**
 * Initialize currency converter (call on extension load)
 * Pre-fetches rates so conversions are instant
 */
export async function initCurrencyConverter(): Promise<void> {
  console.log('[CurrencyConverter] Initializing...');
  await getExchangeRates();
  console.log('[CurrencyConverter] Ready. Source:', cachedRates?.source || 'unknown');
}

/**
 * Force refresh rates from API
 */
export async function refreshExchangeRates(): Promise<boolean> {
  console.log('[CurrencyConverter] Force refreshing rates...');
  cachedRates = null;
  
  const liveRates = await fetchLiveRates();
  
  if (Object.keys(liveRates).length > 0) {
    cachedRates = {
      rates: liveRates,
      fetchedAt: Date.now(),
      source: 'api',
    };
    await saveCachedRates(cachedRates);
    console.log('[CurrencyConverter] Refreshed', Object.keys(liveRates).length, 'rates');
    return true;
  }
  
  // Fall back to hardcoded rates
  cachedRates = {
    rates: { ...FALLBACK_RATES_TO_USD },
    fetchedAt: Date.now(),
    source: 'fallback',
  };
  console.log('[CurrencyConverter] Refresh failed, using fallback rates');
  return false;
}

/**
 * Get the current rate for a currency to USD (synchronous, uses cache)
 * IMPORTANT: Pegged currencies ALWAYS use the fixed rate for accuracy
 */
function getRateToUSD(currency: string): number {
  const code = currency.toUpperCase();
  
  // PRIORITY 1: Always use pegged rates for pegged currencies (most accurate)
  if (PEGGED_RATES_TO_USD[code]) {
    console.log(`[CurrencyConverter] Using PEGGED rate for ${code}: ${PEGGED_RATES_TO_USD[code]}`);
    return PEGGED_RATES_TO_USD[code];
  }
  
  // PRIORITY 2: Use live API rates if available
  if (cachedRates?.rates[code]) {
    console.log(`[CurrencyConverter] Using ${cachedRates.source} rate for ${code}: ${cachedRates.rates[code]}`);
    return cachedRates.rates[code];
  }
  
  // PRIORITY 3: Fall back to hardcoded rates
  if (FALLBACK_RATES_TO_USD[code]) {
    console.log(`[CurrencyConverter] Using FALLBACK rate for ${code}: ${FALLBACK_RATES_TO_USD[code]}`);
    return FALLBACK_RATES_TO_USD[code];
  }
  
  console.warn(`[CurrencyConverter] Unknown currency: ${currency}, assuming USD`);
  return 1.0;
}

/**
 * Convert amount from one currency to USD (synchronous)
 */
export function convertToUSD(amount: number, currency: string): number {
  const code = currency.toUpperCase();
  const rate = getRateToUSD(code);
  const result = amount * rate;
  
  console.log(`[CurrencyConverter] CONVERSION: ${amount} ${code} × ${rate} = $${result.toFixed(2)} USD`);
  
  return result;
}

/**
 * Convert amount from one currency to USD (async, ensures fresh rates)
 */
export async function convertToUSDAsync(amount: number, currency: string): Promise<number> {
  await getExchangeRates(); // Ensure we have rates
  return convertToUSD(amount, currency);
}

/**
 * Convert amount from USD to another currency
 */
export function convertFromUSD(amountUSD: number, targetCurrency: string): number {
  const rate = getRateToUSD(targetCurrency);
  if (rate === 0) return amountUSD;
  return amountUSD / rate;
}

/**
 * Detect currency from a price string
 */
export function detectCurrency(priceStr: string): string {
  const upper = priceStr.toUpperCase().trim();
  
  // Check for explicit currency codes first
  for (const [code, symbols] of Object.entries(CURRENCY_SYMBOLS)) {
    for (const symbol of symbols) {
      if (upper.includes(symbol.toUpperCase())) {
        return code;
      }
    }
  }
  
  // Check for specific patterns
  if (/^AED\s*[\d,]+/.test(upper) || /[\d,]+\s*AED/.test(upper)) return 'AED';
  if (/^EUR\s*[\d,]+/.test(upper) || /[\d,]+\s*EUR/.test(upper)) return 'EUR';
  if (/^GBP\s*[\d,]+/.test(upper) || /[\d,]+\s*GBP/.test(upper)) return 'GBP';
  if (/^€\s*[\d,]+/.test(upper)) return 'EUR';
  if (/^£\s*[\d,]+/.test(upper)) return 'GBP';
  if (/^\$\s*[\d,]+/.test(upper)) return 'USD';
  if (/^₹\s*[\d,]+/.test(upper)) return 'INR';
  if (/^¥\s*[\d,]+/.test(upper)) return 'JPY'; // or CNY - context dependent
  
  // Default to USD if we can't determine
  return 'USD';
}

/**
 * Parse price amount from string, handling different formats
 */
export function parsePriceAmount(priceStr: string): number {
  // Remove currency symbols and text, keep only digits, commas, and decimals
  const cleaned = priceStr
    .replace(/[^\d,.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Find the number pattern
  // Handle formats like: 1,234.56 or 1.234,56 (European) or 1234
  const matches = cleaned.match(/[\d,.\s]+/g);
  if (!matches || matches.length === 0) return 0;
  
  // Take the largest number found (most likely the total)
  let maxAmount = 0;
  for (const match of matches) {
    // Normalize the number format
    let numStr = match.trim();
    
    // Determine decimal separator (last occurrence of . or , with 2 digits after)
    const lastDot = numStr.lastIndexOf('.');
    const lastComma = numStr.lastIndexOf(',');
    
    if (lastComma > lastDot && numStr.length - lastComma === 3) {
      // European format: 1.234,56
      numStr = numStr.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,234.56
      numStr = numStr.replace(/,/g, '');
    }
    
    const amount = parseFloat(numStr);
    if (!isNaN(amount) && amount > maxAmount) {
      maxAmount = amount;
    }
  }
  
  return maxAmount;
}

/**
 * Parse a price string and return normalized amount and currency
 */
export interface ParsedPrice {
  amount: number;
  currency: string;
  amountUSD: number;
  originalStr: string;
}

export function parsePrice(priceStr: string): ParsedPrice {
  const currency = detectCurrency(priceStr);
  const amount = parsePriceAmount(priceStr);
  const amountUSD = convertToUSD(amount, currency);
  
  return {
    amount,
    currency,
    amountUSD,
    originalStr: priceStr,
  };
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format USD price
 */
export function formatUSD(amount: number): string {
  return formatPrice(amount, 'USD');
}

/**
 * Get status of exchange rates
 */
export function getExchangeRateStatus(): {
  source: 'api' | 'fallback' | 'none';
  lastUpdated: number | null;
  currencyCount: number;
} {
  return {
    source: cachedRates?.source || 'none',
    lastUpdated: cachedRates?.fetchedAt || null,
    currencyCount: cachedRates?.rates ? Object.keys(cachedRates.rates).length : 0,
  };
}

// Export fallback rates for reference
export const fallbackRates = FALLBACK_RATES_TO_USD;

// Export current rates (will be updated after init)
export function getCurrentRates(): Record<string, number> {
  return cachedRates?.rates || FALLBACK_RATES_TO_USD;
}
