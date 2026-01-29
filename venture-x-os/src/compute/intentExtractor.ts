// ============================================
// INTENT EXTRACTOR
// Extracts compute intents from user queries
// Uses LLM for classification, NOT for computation
// ============================================

import { groqGenerate, GroqMessage } from '../ai/providers/groq';
import { ComputeIntent, ComputeRequest } from './deterministicEngine';

// ============================================
// INTENT EXTRACTION PROMPT
// ============================================

const INTENT_EXTRACTION_PROMPT = `You are a query classifier for a Venture X credit card assistant.

Your ONLY job is to classify the user's query into one of these intents and extract any numerical parameters.

INTENTS:
1. "portal_vs_direct" - User wants to compare Portal booking vs Direct booking
   Required params: portalPrice, directPrice
   Optional params: bookingType (flight/hotel/rental/vacation_rental/other)

2. "travel_eraser" - User wants to calculate Travel Eraser (how many miles to erase a purchase)
   Required params: purchaseAmount
   Optional params: milesBalance

3. "transfer_cpp" - User wants to calculate cents per mile for a transfer partner redemption
   Required params: cashFare, milesRequired
   Optional params: taxesFees

4. "miles_earned" - User wants to know how many miles they'll earn
   Required params: amount, isPortal
   Optional params: bookingType

5. "break_even" - User wants to know the break-even portal premium
   Required params: directPrice
   Optional params: bookingType, milesValuation

6. "explain_only" - User is asking a general question that doesn't require calculation
   No params required

7. "need_more_info" - User's query requires calculation but is missing critical information
   List the missing params needed

RULES:
- Extract EXACT numbers from the query - DO NOT invent any
- If a price/amount is mentioned, extract it
- If no numbers are provided for a calculation query, use "need_more_info"
- Default bookingType to "flight" if not specified
- Be conservative - if unsure, use "need_more_info"

Respond with ONLY valid JSON in this format:
{
  "intent": "<intent_name>",
  "params": {
    "paramName": value
  },
  "missingParams": ["param1", "param2"] // only if intent is "need_more_info"
}

Examples:
- "Should I book through portal at $450 or direct at $400?" → portal_vs_direct with portalPrice=450, directPrice=400
- "How many miles to erase a $150 dinner?" → travel_eraser with purchaseAmount=150
- "What's the CPP if I use 60k miles for a $1200 flight?" → transfer_cpp with cashFare=1200, milesRequired=60000
- "Is portal worth it?" → need_more_info with missingParams=["portalPrice", "directPrice"]
- "How does Travel Eraser work?" → explain_only`;

// ============================================
// KEYWORD-BASED FALLBACK CLASSIFICATION
// Used when LLM is unavailable or fails
// ============================================

interface KeywordMatch {
  intent: ComputeIntent;
  keywords: RegExp[];
  requiredNumbers: number; // Minimum numbers needed to not be "need_more_info"
  numberExtractor?: (text: string) => Record<string, number | string | boolean | undefined>;
}

const KEYWORD_MATCHERS: KeywordMatch[] = [
  {
    intent: ComputeIntent.PORTAL_VS_DIRECT,
    keywords: [
      /portal\s+vs\.?\s+direct/i,
      /direct\s+vs\.?\s+portal/i,
      /should\s+i\s+(book|use)\s+(through\s+)?portal/i,
      /portal\s+or\s+direct/i,
      /compare\s+(portal|direct)/i,
      /book\s+(direct|through\s+portal)/i,
    ],
    requiredNumbers: 2,
    numberExtractor: (text) => {
      const numbers = text.match(/\$?[\d,]+(?:\.\d{2})?/g)?.map(n => parseFloat(n.replace(/[$,]/g, ''))) || [];
      if (numbers.length >= 2) {
        // Assume format is "portal at X or direct at Y" or vice versa
        return { portalPrice: numbers[0], directPrice: numbers[1] };
      }
      return {};
    },
  },
  {
    intent: ComputeIntent.TRAVEL_ERASER,
    keywords: [
      /travel\s+eraser/i,
      /erase\s+a?\s*\$?[\d,]+/i,
      /how\s+many\s+miles?\s+to\s+erase/i,
      /eraser\s+for\s+a?\s*\$?[\d,]+/i,
      /miles?\s+(for|to)\s+erase/i,
    ],
    requiredNumbers: 1,
    numberExtractor: (text) => {
      const match = text.match(/\$?[\d,]+(?:\.\d{2})?/);
      return match ? { purchaseAmount: parseFloat(match[0].replace(/[$,]/g, '')) } : {};
    },
  },
  {
    intent: ComputeIntent.TRANSFER_CPP,
    keywords: [
      /cpp|cents?\s+per\s+mile/i,
      /transfer\s+partner/i,
      /\d+k?\s+miles?\s+(for|to|on)\s+(a\s+)?\$?[\d,]+/i,
      /\$?[\d,]+\s+(flight|ticket|booking)\s+(for|using)\s+\d+k?\s+miles?/i,
      /worth\s+transferring/i,
    ],
    requiredNumbers: 2,
    numberExtractor: (text) => {
      const milesMatch = text.match(/(\d+)k\s*miles?/i);
      const priceMatch = text.match(/\$?([\d,]+)(?:\s+(?:flight|ticket|fare|cash))?/i);
      const result: Record<string, number | undefined> = {};
      if (milesMatch) result.milesRequired = parseInt(milesMatch[1]) * 1000;
      if (priceMatch) result.cashFare = parseFloat(priceMatch[1].replace(/,/g, ''));
      return result;
    },
  },
  {
    intent: ComputeIntent.MILES_EARNED,
    keywords: [
      /how\s+many\s+miles?\s+(will|would|do)\s+i\s+earn/i,
      /miles?\s+earned?\s+on\s+\$?[\d,]+/i,
      /earn(ing)?\s+\d+x?\s+on/i,
    ],
    requiredNumbers: 1,
    numberExtractor: (text): Record<string, number | string | boolean | undefined> => {
      const match = text.match(/\$?([\d,]+(?:\.\d{2})?)/);
      const isPortal = /portal/i.test(text);
      return match ? { amount: parseFloat(match[1].replace(/,/g, '')), isPortal } : { isPortal };
    },
  },
  {
    intent: ComputeIntent.BREAK_EVEN,
    keywords: [
      /break[\s-]?even/i,
      /max(imum)?\s+premium/i,
      /how\s+much\s+more\s+(can|could)\s+i\s+pay/i,
      /worth\s+paying\s+extra/i,
    ],
    requiredNumbers: 1,
    numberExtractor: (text) => {
      const match = text.match(/\$?([\d,]+(?:\.\d{2})?)/);
      return match ? { directPrice: parseFloat(match[1].replace(/,/g, '')) } : {};
    },
  },
];

const EXPLAIN_ONLY_PATTERNS = [
  /how\s+does\s+(travel\s+eraser|portal|transfer|venture\s+x)\s+work/i,
  /what\s+is\s+(travel\s+eraser|the\s+portal|a\s+transfer\s+partner)/i,
  /explain\s+(travel\s+eraser|portal|transfers)/i,
  /tell\s+me\s+about/i,
  /benefits?\s+of/i,
  /what\s+are\s+(the\s+)?transfer\s+partners/i,
];

// ============================================
// MAIN EXTRACTION FUNCTIONS
// ============================================

/**
 * Extract compute intent from user message using LLM
 * Falls back to keyword matching if LLM fails
 */
export async function extractComputeIntent(
  message: string,
  context: Record<string, unknown>,
  apiKey?: string
): Promise<ComputeRequest> {
  // First, try keyword-based extraction (fast, no API call)
  const keywordResult = extractIntentFromKeywords(message);
  
  // If we got a confident match with all required params, use it
  if (keywordResult.intent !== ComputeIntent.NEED_MORE_INFO && 
      keywordResult.intent !== ComputeIntent.EXPLAIN_ONLY) {
    return keywordResult;
  }
  
  // If we have an API key, try LLM extraction for better understanding
  if (apiKey) {
    try {
      const llmResult = await extractIntentWithLLM(message, context, apiKey);
      return llmResult;
    } catch (error) {
      console.warn('[IntentExtractor] LLM extraction failed, using keyword fallback:', error);
    }
  }
  
  return keywordResult;
}

/**
 * Keyword-based intent extraction (no API call needed)
 */
export function extractIntentFromKeywords(message: string): ComputeRequest {
  // Check for explain-only patterns first
  for (const pattern of EXPLAIN_ONLY_PATTERNS) {
    if (pattern.test(message)) {
      return {
        intent: ComputeIntent.EXPLAIN_ONLY,
        params: {},
      };
    }
  }
  
  // Try each keyword matcher
  for (const matcher of KEYWORD_MATCHERS) {
    for (const keyword of matcher.keywords) {
      if (keyword.test(message)) {
        const params = matcher.numberExtractor?.(message) || {};
        const numValues = Object.values(params).filter(v => typeof v === 'number').length;
        
        if (numValues >= matcher.requiredNumbers) {
          return {
            intent: matcher.intent,
            params: params as Record<string, number | string | boolean | undefined>,
          };
        } else {
          // Matched the intent but missing required numbers
          return {
            intent: ComputeIntent.NEED_MORE_INFO,
            params: params as Record<string, number | string | boolean | undefined>,
            missingParams: getMissingParams(matcher.intent, params),
          };
        }
      }
    }
  }
  
  // No keyword match - default to explain_only (let knowledge base handle it)
  return {
    intent: ComputeIntent.EXPLAIN_ONLY,
    params: {},
  };
}

/**
 * LLM-based intent extraction (more accurate but requires API call)
 */
async function extractIntentWithLLM(
  message: string,
  context: Record<string, unknown>,
  apiKey: string
): Promise<ComputeRequest> {
  const contextStr = Object.entries(context)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  
  const userPrompt = contextStr
    ? `Context:\n${contextStr}\n\nUser query: "${message}"`
    : `User query: "${message}"`;
  
  const messages: GroqMessage[] = [
    { role: 'system', content: INTENT_EXTRACTION_PROMPT },
    { role: 'user', content: userPrompt },
  ];
  
  const response = await groqGenerate(messages, apiKey, {
    model: 'qwen/qwen3-32b',
    temperature: 0.1,
    maxTokens: 256,
  });
  
  // Parse JSON response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in LLM response');
  }
  
  const parsed = JSON.parse(jsonMatch[0]);
  
  // Validate and normalize the response
  const validIntents = Object.values(ComputeIntent);
  const intent = validIntents.includes(parsed.intent as ComputeIntent)
    ? (parsed.intent as ComputeIntent)
    : ComputeIntent.EXPLAIN_ONLY;
  
  return {
    intent,
    params: parsed.params || {},
    missingParams: parsed.missingParams,
  };
}

/**
 * Get list of missing params for an intent
 */
function getMissingParams(
  intent: ComputeIntent,
  providedParams: Record<string, unknown>
): string[] {
  const requiredParams: Record<ComputeIntent, string[]> = {
    [ComputeIntent.PORTAL_VS_DIRECT]: ['portalPrice', 'directPrice'],
    [ComputeIntent.TRAVEL_ERASER]: ['purchaseAmount'],
    [ComputeIntent.TRANSFER_CPP]: ['cashFare', 'milesRequired'],
    [ComputeIntent.MILES_EARNED]: ['amount'],
    [ComputeIntent.BREAK_EVEN]: ['directPrice'],
    [ComputeIntent.EXPLAIN_ONLY]: [],
    [ComputeIntent.NEED_MORE_INFO]: [],
  };
  
  const required = requiredParams[intent] || [];
  return required.filter(p => providedParams[p] === undefined);
}

// ============================================
// EXPORTS
// ============================================

export type { ComputeIntent, ComputeRequest };
