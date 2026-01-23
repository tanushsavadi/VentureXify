// ============================================
// PARSE MONEY TESTS
// ============================================
// Unit tests for the robust currency parsing module

import { describe, it, expect } from 'vitest';
import { parseMoney, looksLikePrice, formatMoney, parseAllPrices, compareMoney } from '../lib/extraction/parseMoney';

describe('parseMoney', () => {
  describe('USD parsing', () => {
    it('parses $1,234.56 format', () => {
      const result = parseMoney('$1,234.56');
      expect(result.money).toBeDefined();
      expect(result.money?.amount).toBe(1234.56);
      expect(result.money?.currency).toBe('USD');
    });

    it('parses $1234.56 without comma', () => {
      const result = parseMoney('$1234.56');
      expect(result.money?.amount).toBe(1234.56);
    });

    it('parses $1234 without cents', () => {
      const result = parseMoney('$1234');
      expect(result.money?.amount).toBe(1234);
    });

    it('parses USD 1,234.56 with code', () => {
      const result = parseMoney('USD 1,234.56');
      expect(result.money?.amount).toBe(1234.56);
      expect(result.money?.currency).toBe('USD');
    });

    it('parses US$1,234.56 format', () => {
      const result = parseMoney('US$1,234.56');
      expect(result.money?.amount).toBe(1234.56);
      expect(result.money?.currency).toBe('USD');
    });
  });

  describe('EUR parsing', () => {
    it('parses €1.234,56 European format', () => {
      const result = parseMoney('€1.234,56');
      expect(result.money?.amount).toBe(1234.56);
      expect(result.money?.currency).toBe('EUR');
    });

    it('parses 1.234,56 € symbol after', () => {
      const result = parseMoney('1.234,56 €');
      expect(result.money?.amount).toBe(1234.56);
      expect(result.money?.currency).toBe('EUR');
    });

    it('parses EUR 1234.56', () => {
      const result = parseMoney('EUR 1234.56');
      expect(result.money?.amount).toBe(1234.56);
      expect(result.money?.currency).toBe('EUR');
    });

    it('handles ambiguous 1.234 as thousands in European context', () => {
      const result = parseMoney('€1.234');
      // 1.234 with € should be 1234 (thousands separator)
      expect(result.money?.amount).toBe(1234);
    });
  });

  describe('GBP parsing', () => {
    it('parses £1,234.56', () => {
      const result = parseMoney('£1,234.56');
      expect(result.money?.amount).toBe(1234.56);
      expect(result.money?.currency).toBe('GBP');
    });

    it('parses GBP 1234', () => {
      const result = parseMoney('GBP 1234');
      expect(result.money?.amount).toBe(1234);
      expect(result.money?.currency).toBe('GBP');
    });
  });

  describe('AED parsing', () => {
    it('parses AED 5,401', () => {
      const result = parseMoney('AED 5,401');
      expect(result.money?.amount).toBe(5401);
      expect(result.money?.currency).toBe('AED');
    });

    it('parses AED5401 without space', () => {
      const result = parseMoney('AED5401');
      expect(result.money?.amount).toBe(5401);
      expect(result.money?.currency).toBe('AED');
    });

    it('parses د.إ 1,234', () => {
      const result = parseMoney('د.إ 1,234');
      expect(result.money?.amount).toBe(1234);
      expect(result.money?.currency).toBe('AED');
    });
  });

  describe('JPY parsing', () => {
    it('parses ¥12,345 (no decimal)', () => {
      const result = parseMoney('¥12,345');
      expect(result.money?.amount).toBe(12345);
      expect(result.money?.currency).toBe('JPY');
    });

    it('parses JPY 12345', () => {
      const result = parseMoney('JPY 12345');
      expect(result.money?.amount).toBe(12345);
      expect(result.money?.currency).toBe('JPY');
    });
  });

  describe('INR parsing', () => {
    it('parses ₹12,345.67', () => {
      const result = parseMoney('₹12,345.67');
      expect(result.money?.amount).toBe(12345.67);
      expect(result.money?.currency).toBe('INR');
    });

    it('parses INR 12345', () => {
      const result = parseMoney('INR 12345');
      expect(result.money?.amount).toBe(12345);
      expect(result.money?.currency).toBe('INR');
    });

    it('parses Rs 12,345', () => {
      const result = parseMoney('Rs 12,345');
      expect(result.money?.amount).toBe(12345);
      expect(result.money?.currency).toBe('INR');
    });
  });

  describe('CHF parsing', () => {
    it("parses CHF 1'234.56 Swiss format", () => {
      const result = parseMoney("CHF 1'234.56");
      expect(result.money?.amount).toBe(1234.56);
      expect(result.money?.currency).toBe('CHF');
    });
  });

  describe('CAD parsing', () => {
    it('parses CA$1,234.56', () => {
      const result = parseMoney('CA$1,234.56');
      expect(result.money?.amount).toBe(1234.56);
      expect(result.money?.currency).toBe('CAD');
    });

    it('parses CAD 1234', () => {
      const result = parseMoney('CAD 1234');
      expect(result.money?.amount).toBe(1234);
      expect(result.money?.currency).toBe('CAD');
    });
  });

  describe('AUD parsing', () => {
    it('parses A$1,234.56', () => {
      const result = parseMoney('A$1,234.56');
      expect(result.money?.amount).toBe(1234.56);
      expect(result.money?.currency).toBe('AUD');
    });
  });

  describe('Edge cases', () => {
    it('handles non-breaking spaces', () => {
      const result = parseMoney('$1\u00A0234.56'); // Non-breaking space
      expect(result.money).toBeDefined();
    });

    it('rejects empty string', () => {
      const result = parseMoney('');
      expect(result.money).toBeNull();
    });

    it('rejects string without numbers', () => {
      const result = parseMoney('no price here');
      expect(result.money).toBeNull();
    });

    it('rejects extremely small amounts (below min)', () => {
      const result = parseMoney('$0.50', { minAmount: 1 });
      expect(result.money).toBeNull();
    });

    it('rejects extremely large amounts (above max)', () => {
      const result = parseMoney('$999999999', { maxAmount: 1000000 });
      expect(result.money).toBeNull();
    });

    it('uses default currency when not detected', () => {
      const result = parseMoney('1234.56', { defaultCurrency: 'EUR' });
      expect(result.money?.currency).toBe('EUR');
    });
  });

  describe('Price qualifiers', () => {
    it('detects "from" prices', () => {
      const result = parseMoney('from $1,234');
      expect(result.isFromPrice).toBe(true);
    });

    it('detects "starting at" prices', () => {
      const result = parseMoney('Starting at $1,234');
      expect(result.isFromPrice).toBe(true);
    });

    it('detects per-night prices', () => {
      const result = parseMoney('$234/night');
      expect(result.isPerNight).toBe(true);
    });

    it('detects per-person prices', () => {
      const result = parseMoney('$234 per person');
      expect(result.isPerPerson).toBe(true);
    });

    it('marks non-qualified prices correctly', () => {
      const result = parseMoney('Total: $1,234.56');
      expect(result.isFromPrice).toBe(false);
      expect(result.isPerNight).toBe(false);
      expect(result.isPerPerson).toBe(false);
    });
  });

  describe('Decimal separator detection', () => {
    it('detects . as decimal in $1,234.56', () => {
      const result = parseMoney('$1,234.56');
      expect(result.money?.amount).toBe(1234.56);
    });

    it('detects , as decimal in €1.234,56', () => {
      const result = parseMoney('€1.234,56');
      expect(result.money?.amount).toBe(1234.56);
    });

    it('handles ambiguous 1,234 as integer (US format)', () => {
      const result = parseMoney('$1,234');
      expect(result.money?.amount).toBe(1234);
    });

    it('handles space as thousands separator', () => {
      const result = parseMoney('1 234,56 €');
      expect(result.money?.amount).toBe(1234.56);
    });
  });

  describe('Confidence scoring', () => {
    it('has high confidence for clean USD format', () => {
      const result = parseMoney('$1,234.56');
      expect(result.confidence).toBeGreaterThan(70);
    });

    it('has lower confidence when currency not detected', () => {
      const result = parseMoney('1234.56');
      expect(result.confidence).toBeLessThan(90);
    });

    it('has lower confidence for "from" prices', () => {
      const resultWithFrom = parseMoney('from $1,234');
      const resultWithout = parseMoney('$1,234');
      expect(resultWithFrom.confidence).toBeLessThan(resultWithout.confidence);
    });
  });
});

describe('looksLikePrice', () => {
  it('returns true for $1234', () => {
    expect(looksLikePrice('$1234')).toBe(true);
  });

  it('returns true for €1.234,56', () => {
    expect(looksLikePrice('€1.234,56')).toBe(true);
  });

  it('returns true for AED 5,401', () => {
    expect(looksLikePrice('AED 5,401')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(looksLikePrice('')).toBe(false);
  });

  it('returns false for text without numbers', () => {
    expect(looksLikePrice('hello world')).toBe(false);
  });

  it('returns false for very long strings', () => {
    expect(looksLikePrice('This is a very long string that contains $100 but is too long to be a price')).toBe(false);
  });
});

describe('formatMoney', () => {
  it('formats USD correctly', () => {
    const result = formatMoney({ amount: 1234.56, currency: 'USD' });
    expect(result).toContain('1,234.56');
  });

  it('formats EUR correctly', () => {
    const result = formatMoney({ amount: 1234.56, currency: 'EUR' });
    // EUR can be formatted differently based on locale
    expect(result).toMatch(/1[,.]234[,.]56/);
  });

  it('formats JPY without decimals', () => {
    const result = formatMoney({ amount: 12345, currency: 'JPY' });
    expect(result).toContain('12,345');
    expect(result).not.toContain('.00');
  });
});

describe('parseAllPrices', () => {
  it('extracts multiple prices from text', () => {
    const text = 'Base fare: $500, Taxes: $100, Total: $600';
    const results = parseAllPrices(text);
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('extracts prices with different currencies', () => {
    const text = '$500 USD or €450 EUR';
    const results = parseAllPrices(text);
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.some(r => r.money?.currency === 'USD')).toBe(true);
    expect(results.some(r => r.money?.currency === 'EUR')).toBe(true);
  });

  it('sorts by confidence descending', () => {
    const text = '$1,234.56 from $999';
    const results = parseAllPrices(text);
    if (results.length >= 2) {
      expect(results[0].confidence).toBeGreaterThanOrEqual(results[1].confidence);
    }
  });
});

describe('compareMoney', () => {
  it('returns true for same amount and currency', () => {
    const a = { amount: 100, currency: 'USD' };
    const b = { amount: 100, currency: 'USD' };
    expect(compareMoney(a, b)).toBe(true);
  });

  it('returns false for different amounts', () => {
    const a = { amount: 100, currency: 'USD' };
    const b = { amount: 200, currency: 'USD' };
    expect(compareMoney(a, b)).toBe(false);
  });

  it('returns false for different currencies', () => {
    const a = { amount: 100, currency: 'USD' };
    const b = { amount: 100, currency: 'EUR' };
    expect(compareMoney(a, b)).toBe(false);
  });

  it('handles floating point tolerance', () => {
    const a = { amount: 100.001, currency: 'USD' };
    const b = { amount: 100.002, currency: 'USD' };
    expect(compareMoney(a, b)).toBe(true);
  });
});
