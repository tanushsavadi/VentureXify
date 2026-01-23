import Papa from 'papaparse';
import { EraserItem, VENTURE_X_CONSTANTS } from './types';
import { generateId } from './storage';

// ============================================
// CSV PARSER FOR ERASER QUEUE
// ============================================

export interface CSVParseResult {
  items: EraserItem[];
  errors: string[];
  warnings: string[];
  totalRows: number;
  successRows: number;
}

interface RawCSVRow {
  [key: string]: string | undefined;
}

// Common field mappings for various bank statement exports
const FIELD_MAPPINGS = {
  date: ['date', 'transaction date', 'trans date', 'posting date', 'post date', 'transaction_date'],
  merchant: ['description', 'merchant', 'name', 'payee', 'memo', 'transaction description'],
  amount: ['amount', 'debit', 'charge', 'transaction amount', 'purchase amount'],
  category: ['category', 'type', 'transaction type'],
};

/**
 * Find the best matching column name from possible field names
 */
function findColumn(headers: string[], possibleNames: string[]): string | null {
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());
  
  for (const name of possibleNames) {
    const index = normalizedHeaders.indexOf(name.toLowerCase());
    if (index !== -1) {
      return headers[index];
    }
  }
  
  // Try partial matches
  for (const name of possibleNames) {
    const index = normalizedHeaders.findIndex((h) => h.includes(name.toLowerCase()));
    if (index !== -1) {
      return headers[index];
    }
  }
  
  return null;
}

/**
 * Parse a date string into a timestamp
 */
function parseDate(dateStr: string): number | null {
  if (!dateStr) return null;
  
  // Try various date formats
  const cleanDate = dateStr.trim();
  
  // ISO format
  const isoDate = Date.parse(cleanDate);
  if (!isNaN(isoDate)) {
    return isoDate;
  }
  
  // MM/DD/YYYY or MM-DD-YYYY
  const usMatch = cleanDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return new Date(parseInt(fullYear), parseInt(month) - 1, parseInt(day)).getTime();
  }
  
  // DD/MM/YYYY (try if US format fails contextually)
  // We'll default to US format for Capital One
  
  return null;
}

/**
 * Parse an amount string into a number
 */
function parseAmount(amountStr: string): number | null {
  if (!amountStr) return null;
  
  // Remove currency symbols and whitespace
  let clean = amountStr.replace(/[$€£¥,\s]/g, '');
  
  // Handle negative amounts in parentheses
  if (clean.startsWith('(') && clean.endsWith(')')) {
    clean = '-' + clean.slice(1, -1);
  }
  
  // Handle negative amounts with minus sign
  const amount = parseFloat(clean);
  
  if (isNaN(amount)) return null;
  
  // Return absolute value (we only care about purchase amounts)
  return Math.abs(amount);
}

/**
 * Check if a transaction is likely travel-related
 */
function isTravelTransaction(merchant: string, category?: string): boolean {
  const travelKeywords = [
    'airline', 'airlines', 'air ', 'airways',
    'hotel', 'hotels', 'inn', 'suites', 'resort', 'marriott', 'hilton', 'hyatt', 'ihg',
    'car rental', 'hertz', 'avis', 'enterprise', 'national', 'budget',
    'uber', 'lyft', 'taxi', 'cab',
    'expedia', 'booking.com', 'hotels.com', 'kayak', 'priceline',
    'airbnb', 'vrbo',
    'united', 'delta', 'american', 'southwest', 'jetblue', 'alaska', 'spirit', 'frontier',
    'cruise', 'amtrak', 'rail',
    'travel', 'trip', 'vacation',
    'restaurant', 'dining', // sometimes counted
  ];
  
  const lowerMerchant = merchant.toLowerCase();
  const lowerCategory = category?.toLowerCase() || '';
  
  for (const keyword of travelKeywords) {
    if (lowerMerchant.includes(keyword) || lowerCategory.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Parse CSV file content into Eraser Queue items
 */
export function parseCSV(csvContent: string): CSVParseResult {
  const result: CSVParseResult = {
    items: [],
    errors: [],
    warnings: [],
    totalRows: 0,
    successRows: 0,
  };
  
  // Parse CSV
  const parsed = Papa.parse<RawCSVRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  
  if (parsed.errors.length > 0) {
    result.errors.push(...parsed.errors.map((e) => `Row ${e.row}: ${e.message}`));
  }
  
  if (!parsed.data || parsed.data.length === 0) {
    result.errors.push('No data found in CSV');
    return result;
  }
  
  result.totalRows = parsed.data.length;
  
  // Find column mappings
  const headers = Object.keys(parsed.data[0] || {});
  const dateCol = findColumn(headers, FIELD_MAPPINGS.date);
  const merchantCol = findColumn(headers, FIELD_MAPPINGS.merchant);
  const amountCol = findColumn(headers, FIELD_MAPPINGS.amount);
  const categoryCol = findColumn(headers, FIELD_MAPPINGS.category);
  
  if (!dateCol) {
    result.errors.push('Could not find date column. Expected: ' + FIELD_MAPPINGS.date.join(', '));
    return result;
  }
  
  if (!merchantCol) {
    result.errors.push('Could not find merchant/description column. Expected: ' + FIELD_MAPPINGS.merchant.join(', '));
    return result;
  }
  
  if (!amountCol) {
    result.errors.push('Could not find amount column. Expected: ' + FIELD_MAPPINGS.amount.join(', '));
    return result;
  }
  
  // Process each row
  const now = Date.now();
  const ninetyDaysAgo = now - VENTURE_X_CONSTANTS.ERASER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  
  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const rowNum = i + 2; // Account for header row and 0-index
    
    const dateStr = row[dateCol] || '';
    const merchant = row[merchantCol] || '';
    const amountStr = row[amountCol] || '';
    const category = categoryCol ? row[categoryCol] : undefined;
    
    // Parse date
    const purchaseDate = parseDate(dateStr);
    if (!purchaseDate) {
      result.warnings.push(`Row ${rowNum}: Could not parse date "${dateStr}"`);
      continue;
    }
    
    // Parse amount
    const amount = parseAmount(amountStr);
    if (!amount || amount <= 0) {
      result.warnings.push(`Row ${rowNum}: Invalid amount "${amountStr}"`);
      continue;
    }
    
    // Skip if too old
    if (purchaseDate < ninetyDaysAgo) {
      result.warnings.push(`Row ${rowNum}: Transaction older than 90 days, skipping`);
      continue;
    }
    
    // Check if travel-related
    const isTravel = isTravelTransaction(merchant, category);
    if (!isTravel) {
      result.warnings.push(`Row ${rowNum}: "${merchant}" may not be travel-related`);
    }
    
    // Create eraser item
    const expiryDate = purchaseDate + VENTURE_X_CONSTANTS.ERASER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    
    const item: EraserItem = {
      id: generateId(),
      merchant: merchant.trim(),
      amount,
      purchaseDate,
      expiryDate,
      status: expiryDate > now ? 'pending' : 'expired',
      notes: isTravel ? undefined : 'May not be travel-eligible',
      createdAt: now,
    };
    
    result.items.push(item);
    result.successRows++;
  }
  
  return result;
}

/**
 * Validate a single manual entry
 */
export function validateEraserEntry(
  merchant: string,
  amount: number,
  purchaseDate: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!merchant || merchant.trim().length === 0) {
    errors.push('Merchant name is required');
  }
  
  if (!amount || amount <= 0) {
    errors.push('Amount must be greater than 0');
  }
  
  if (!purchaseDate) {
    errors.push('Purchase date is required');
  } else {
    const now = Date.now();
    const ninetyDaysAgo = now - VENTURE_X_CONSTANTS.ERASER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    
    if (purchaseDate > now) {
      errors.push('Purchase date cannot be in the future');
    } else if (purchaseDate < ninetyDaysAgo) {
      errors.push('Purchase is older than 90 days and no longer eligible');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create an eraser item from manual input
 */
export function createEraserItem(
  merchant: string,
  amount: number,
  purchaseDate: number,
  notes?: string
): EraserItem {
  const now = Date.now();
  const expiryDate = purchaseDate + VENTURE_X_CONSTANTS.ERASER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  
  return {
    id: generateId(),
    merchant: merchant.trim(),
    amount,
    purchaseDate,
    expiryDate,
    status: expiryDate > now ? 'pending' : 'expired',
    notes,
    createdAt: now,
  };
}

/**
 * Export eraser queue to CSV format
 */
export function exportEraserQueueToCSV(items: EraserItem[]): string {
  const data = items.map((item) => ({
    Merchant: item.merchant,
    Amount: item.amount.toFixed(2),
    'Purchase Date': new Date(item.purchaseDate).toLocaleDateString(),
    'Expiry Date': new Date(item.expiryDate).toLocaleDateString(),
    Status: item.status,
    Notes: item.notes || '',
  }));
  
  return Papa.unparse(data);
}
