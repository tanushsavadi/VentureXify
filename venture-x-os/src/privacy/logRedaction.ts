/**
 * PII Redaction for Logs and Telemetry
 * 
 * Ensures no personal identifiable information is sent to logs or telemetry.
 * All redaction is applied before any data leaves the browser.
 * 
 * @module privacy/logRedaction
 */

/**
 * Pattern definition for PII detection
 */
interface PIIPattern {
  /** Name of the pattern for debugging */
  name: string;
  /** Regex pattern to match */
  pattern: RegExp;
  /** Replacement text */
  replacement: string;
}

/**
 * PII patterns for detection and redaction
 */
const PII_PATTERNS: PIIPattern[] = [
  // Email addresses (non-greedy domain to handle concatenated emails)
  {
    name: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,6}/g,
    replacement: '[EMAIL]',
  },
  
  // Credit card numbers (with or without separators) - MUST come before phone/SSN
  {
    name: 'credit_card',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '[CARD]',
  },
  
  // Phone numbers (various formats) - careful not to consume leading space
  {
    name: 'phone',
    pattern: /(?:\+1[-.\s]?|1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    replacement: '[PHONE]',
  },
  
  // SSN (US Social Security Number) - must have dashes
  {
    name: 'ssn',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '[SSN]',
  },
  
  // Loyalty/frequent flyer numbers (common formats)
  {
    name: 'loyalty_number',
    pattern: /\b[A-Z]{2,3}[0-9]{6,12}\b/g,
    replacement: '[LOYALTY_NUM]',
  },
  
  // Confirmation/booking codes (typically 6 alphanumeric)
  {
    name: 'confirmation_code',
    pattern: /\b[A-Z0-9]{6}\b/g,
    replacement: '[CONF_CODE]',
  },
  
  // URLs with potential personal data
  {
    name: 'personal_url',
    pattern: /https?:\/\/[^\s]+(?:confirmation|booking|account|profile|user|member)[^\s]*/gi,
    replacement: '[URL_REDACTED]',
  },
  
  // Names after common prefixes (Mr., Mrs., etc.)
  {
    name: 'name_with_prefix',
    pattern: /(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g,
    replacement: '[NAME]',
  },
  
  // Passport numbers (various formats)
  {
    name: 'passport',
    pattern: /\b[A-Z]{1,2}[0-9]{6,9}\b/g,
    replacement: '[PASSPORT]',
  },
  
  // IP addresses (IPv4)
  {
    name: 'ipv4',
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: '[IP]',
  },
  
  // IP addresses (IPv6 - simplified)
  {
    name: 'ipv6',
    pattern: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
    replacement: '[IP]',
  },
  
  // Dates of birth (various formats)
  {
    name: 'dob',
    pattern: /\b(?:born|dob|birth(?:date)?)[:\s]+\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/gi,
    replacement: '[DOB]',
  },
  
  // API keys (common formats)
  {
    name: 'api_key',
    pattern: /\b(?:api[_-]?key|token|secret)[:\s=]+[a-zA-Z0-9_-]{20,}/gi,
    replacement: '[API_KEY]',
  },
  
  // Bearer tokens
  {
    name: 'bearer_token',
    pattern: /Bearer\s+[a-zA-Z0-9._-]+/gi,
    replacement: 'Bearer [TOKEN]',
  },
  
  // JWT tokens
  {
    name: 'jwt',
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    replacement: '[JWT]',
  },
];

/**
 * Capital One specific patterns
 */
const CAPITAL_ONE_PATTERNS: PIIPattern[] = [
  // Capital One account numbers
  {
    name: 'c1_account',
    pattern: /\b4\d{15}\b/g, // Visa cards starting with 4
    replacement: '[C1_CARD]',
  },
  {
    name: 'c1_account_mc',
    pattern: /\b5[1-5]\d{14}\b/g, // Mastercard cards
    replacement: '[C1_CARD]',
  },
  // Venture miles account ID
  {
    name: 'venture_account',
    pattern: /\b[A-Z0-9]{8,12}(?:VX|VM)\b/gi,
    replacement: '[VENTURE_ACCT]',
  },
];

/**
 * Combined patterns list
 */
const ALL_PATTERNS: PIIPattern[] = [...PII_PATTERNS, ...CAPITAL_ONE_PATTERNS];

/**
 * Result of PII detection
 */
export interface PIIDetectionResult {
  /** Whether PII was detected */
  detected: boolean;
  /** Types of PII detected */
  types: string[];
  /** Redacted text */
  redacted: string;
  /** Number of redactions made */
  redactionCount: number;
}

/**
 * Redact PII from text
 * 
 * @param text - Text to redact
 * @returns Redacted text
 */
export function redactPII(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let redacted = text;
  
  for (const { pattern, replacement } of ALL_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }
  
  return redacted;
}

/**
 * Detect and redact PII with detailed results
 * 
 * @param text - Text to check
 * @returns Detection result with redacted text
 */
export function detectAndRedactPII(text: string): PIIDetectionResult {
  if (!text || typeof text !== 'string') {
    return {
      detected: false,
      types: [],
      redacted: text,
      redactionCount: 0,
    };
  }

  const detectedTypes: string[] = [];
  let redacted = text;
  let totalRedactions = 0;
  
  for (const { name, pattern, replacement } of ALL_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      detectedTypes.push(name);
      totalRedactions += matches.length;
      redacted = redacted.replace(pattern, replacement);
    }
  }
  
  return {
    detected: detectedTypes.length > 0,
    types: [...new Set(detectedTypes)], // Dedupe types
    redacted,
    redactionCount: totalRedactions,
  };
}

/**
 * Check if text contains PII (without redacting)
 * 
 * @param text - Text to check
 * @returns true if PII detected
 */
export function containsPII(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  for (const { pattern } of ALL_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
  }
  
  return false;
}

/**
 * Redact PII from an object (recursively)
 * 
 * @param obj - Object to redact
 * @returns New object with PII redacted
 */
export function redactPIIFromObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return redactPII(obj) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactPIIFromObject(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = redactPIIFromObject(value);
    }
    return result as T;
  }

  return obj;
}

/**
 * Log levels supported
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Safe logging function that redacts PII before logging
 * 
 * @param level - Log level
 * @param message - Message to log
 * @param data - Optional data to include
 */
export function safeLog(level: LogLevel, message: string, data?: unknown): void {
  const redactedMessage = redactPII(message);
  const redactedData = data !== undefined ? redactPIIFromObject(data) : undefined;
  
  const prefix = '[VentureX]';
  
  switch (level) {
    case 'debug':
      if (process.env.NODE_ENV === 'development') {
        console.debug(`${prefix} ${redactedMessage}`, redactedData);
      }
      break;
    case 'info':
      console.info(`${prefix} ${redactedMessage}`, redactedData);
      break;
    case 'warn':
      console.warn(`${prefix} ${redactedMessage}`, redactedData);
      break;
    case 'error':
      console.error(`${prefix} ${redactedMessage}`, redactedData);
      break;
  }
}

/**
 * Create a logger instance with a specific context
 * 
 * @param context - Logger context (e.g., module name)
 * @returns Logger functions
 */
export function createSafeLogger(context: string): {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
} {
  const formatMessage = (message: string) => `[${context}] ${message}`;
  
  return {
    debug: (message: string, data?: unknown) => safeLog('debug', formatMessage(message), data),
    info: (message: string, data?: unknown) => safeLog('info', formatMessage(message), data),
    warn: (message: string, data?: unknown) => safeLog('warn', formatMessage(message), data),
    error: (message: string, data?: unknown) => safeLog('error', formatMessage(message), data),
  };
}

/**
 * Hash text for anonymized logging (SHA-256 truncated)
 * 
 * @param text - Text to hash
 * @returns Truncated hash (first 16 chars)
 */
export async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/**
 * Create an anonymized identifier from text
 * 
 * @param text - Text to anonymize
 * @returns Promise resolving to anonymized ID
 */
export async function createAnonymizedId(text: string): Promise<string> {
  const hash = await hashText(text);
  return `anon_${hash}`;
}

/**
 * Sanitize user input for safe logging
 * Removes PII and truncates to safe length
 * 
 * @param input - User input to sanitize
 * @param maxLength - Maximum length (default 200)
 * @returns Sanitized input
 */
export function sanitizeUserInput(input: string, maxLength: number = 200): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Redact PII first
  let sanitized = redactPII(input);
  
  // Truncate if needed
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength - 3) + '...';
  }
  
  // Remove potentially dangerous characters
  sanitized = sanitized
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control characters
    .replace(/\r?\n|\r/g, ' ') // Normalize line breaks
    .trim();
  
  return sanitized;
}

/**
 * Data flow disclosure information
 */
export const DATA_FLOW_DISCLOSURE = {
  whatWeSend: [
    {
      destination: 'Supabase Edge Functions (our server)',
      data: [
        'Your chat messages',
        'Booking context (prices, routes, dates)',
        'Session ID (anonymous)',
      ],
      purpose: 'To generate AI responses and search our knowledge base',
    },
    {
      destination: 'Groq AI (via our server)',
      data: [
        'Your question (anonymized)',
        'Relevant knowledge snippets',
      ],
      purpose: 'To generate helpful responses',
    },
  ],
  
  whatWeNeverSend: [
    'Your name or email',
    'Your Capital One login credentials',
    'Your credit card numbers',
    'Your loyalty program account numbers',
    'Booking confirmation numbers',
  ],
  
  whatWeStore: [
    {
      location: 'Your browser (chrome.storage.local)',
      data: [
        'Your settings/preferences',
        'Cached knowledge for offline access',
        'Recent conversation history (local only)',
      ],
      duration: 'Until you clear extension data',
    },
  ],
  
  whatWeLog: [
    {
      type: 'Error logs',
      data: 'Error messages without personal data',
      retention: '30 days',
    },
    {
      type: 'Usage analytics (if enabled)',
      data: 'Feature usage counts, no personal data',
      retention: '90 days',
    },
  ],
};
