// ============================================
// STRICT SYSTEM PROMPT FOR VENTUREX AI
// LLM may ONLY use numbers explicitly provided
// It must NOT invent miles, prices, cpp values, etc.
// ============================================

/**
 * Core rules the AI must follow:
 * 1. NEVER invent numbers - only use what's explicitly provided
 * 2. If data is missing, say "I need X to calculate this"
 * 3. All computations are done by the deterministic engine, not the LLM
 * 4. LLM role is to EXPLAIN precomputed results, not compute new ones
 */

export const STRICT_SYSTEM_PROMPT = `You are VentureX AI, a Capital One Venture X card assistant.

## CRITICAL RULES - MUST FOLLOW

### Rule 1: NO INVENTED NUMBERS
You may ONLY use numbers explicitly provided in the CONTEXT block below.
You must NEVER:
- Invent mile amounts, prices, or transfer ratios
- Guess redemption costs or award pricing
- Create hypothetical examples with specific numbers
- Say "let's say" or "for example, 120,000 miles"

If a number isn't provided, you MUST say "I'd need [specific data] to calculate this."

### Rule 2: TRANSFER PARTNERS
You may mention these Capital One transfer partners exist:
- Turkish Miles&Smiles, Emirates Skywards, Avianca LifeMiles
- Air France/KLM Flying Blue, British Airways Avios
- Singapore KrisFlyer, Qantas Frequent Flyer

But you CANNOT:
- Quote award prices (they vary by route/date/cabin/availability)
- Claim specific cpp values for redemptions
- Suggest "typical" award costs

For transfer partner questions, respond:
"To evaluate a transfer, I need: (1) the award miles required, and (2) taxes/fees on the award ticket. Then I'll calculate: cpp = (cash fare − taxes) ÷ miles."

### Rule 3: TRAVEL ERASER
Travel Eraser facts (these are fixed):
- Rate: 1 cent per mile (1cpp) = 100 miles per $1
- Minimum: 5,000 miles ($50)
- Window: 90 days after purchase

You may only calculate Eraser amounts if given the purchase price.
Formula: miles_needed = price × 100

### Rule 4: CPP VALUATION
If user asks about mile valuation:
- Do NOT state "1.8cpp is standard" as fact
- SAY: "Mile valuation is subjective. Common benchmarks: 1cpp (Eraser floor), 1.5-2cpp (good transfer), 2.5cpp+ (excellent transfer). Your actual cpp depends on the specific redemption."

### Rule 5: WHAT YOU CAN DO
✓ Explain how strategies work (portal vs direct, eraser, transfers)
✓ Explain the math formulas without inventing numbers
✓ Use numbers from the CONTEXT block to explain calculations
✓ Ask for missing information needed to answer
✓ Cite sources from RAG context if provided

### Response Format
- Be concise (2-4 sentences for simple questions)
- Use bullet points for lists
- Start with an emoji for visual clarity
- If uncertain or missing data, be explicit about what you need`;

/**
 * Builds the full prompt with context injection
 */
export function buildPromptWithContext(
  userMessage: string,
  context: {
    portalPrice?: number;
    directPrice?: number;
    portalMiles?: number;
    directMiles?: number;
    portalNetCost?: number;
    directNetCost?: number;
    winner?: string;
    savings?: number;
    milesBalance?: number;
    creditRemaining?: number;
    route?: string;
    // Award context (only if user provides)
    awardMilesRequired?: number;
    awardTaxesFees?: number;
    awardPartner?: string;
  },
  ragContext?: string
): string {
  // Build the CONTEXT block with ONLY real data
  const contextLines: string[] = [];
  
  if (context.portalPrice !== undefined) {
    contextLines.push(`Portal price: $${context.portalPrice}`);
  }
  if (context.directPrice !== undefined) {
    contextLines.push(`Direct price: $${context.directPrice}`);
  }
  if (context.portalMiles !== undefined) {
    contextLines.push(`Portal miles earned: ${context.portalMiles.toLocaleString()} (5x)`);
  }
  if (context.directMiles !== undefined) {
    contextLines.push(`Direct miles earned: ${context.directMiles.toLocaleString()} (2x)`);
  }
  if (context.portalNetCost !== undefined) {
    contextLines.push(`Portal net effective cost: $${context.portalNetCost.toFixed(0)}`);
  }
  if (context.directNetCost !== undefined) {
    contextLines.push(`Direct net effective cost: $${context.directNetCost.toFixed(0)}`);
  }
  if (context.winner) {
    contextLines.push(`Recommendation: ${context.winner}`);
  }
  if (context.savings !== undefined) {
    contextLines.push(`Net savings: $${context.savings.toFixed(0)}`);
  }
  if (context.milesBalance !== undefined) {
    contextLines.push(`User's miles balance: ${context.milesBalance.toLocaleString()}`);
  }
  if (context.creditRemaining !== undefined) {
    contextLines.push(`Travel credit remaining: $${context.creditRemaining}`);
  }
  if (context.route) {
    contextLines.push(`Route: ${context.route}`);
  }
  
  // Award-specific context (only if provided by user)
  if (context.awardMilesRequired !== undefined) {
    contextLines.push(`Award miles required: ${context.awardMilesRequired.toLocaleString()}`);
  }
  if (context.awardTaxesFees !== undefined) {
    contextLines.push(`Award taxes/fees: $${context.awardTaxesFees}`);
  }
  if (context.awardPartner) {
    contextLines.push(`Award partner: ${context.awardPartner}`);
  }
  
  // Build the context section
  const contextSection = contextLines.length > 0
    ? `\n## CONTEXT (use ONLY these numbers)\n${contextLines.join('\n')}`
    : '\n## CONTEXT\nNo booking data provided yet.';
  
  // Build RAG section
  const ragSection = ragContext
    ? `\n## KNOWLEDGE BASE SOURCES\n${ragContext}`
    : '';
  
  return `${STRICT_SYSTEM_PROMPT}${contextSection}${ragSection}

## USER QUESTION
${userMessage}`;
}

/**
 * Validates that the AI response doesn't contain hallucinated numbers
 * This is a safety check - returns warnings if suspicious patterns found
 */
export function validateResponse(
  response: string,
  providedNumbers: number[]
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  // Extract all numbers from response
  const numbersInResponse = response.match(/\d[\d,]*(?:\.\d+)?/g) || [];
  const parsedNumbers = numbersInResponse.map(n => parseFloat(n.replace(/,/g, '')));
  
  // Common hallucination patterns
  const suspiciousPatterns = [
    /let's say [\d,]+/i,
    /for example[,:]? [\d,]+/i,
    /approximately [\d,]+ miles/i,
    /around [\d,]+ miles/i,
    /roughly [\d,]+ miles/i,
    /typical(?:ly)? [\d,]+/i,
    /usually [\d,]+/i,
    /standard [\d\.]+cpp/i,
    /\d+[,\d]* miles (?:for|to|on) (?:a |the )?(?:business|first|economy)/i,
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(response)) {
      warnings.push(`Possible hallucination detected: ${pattern.source}`);
    }
  }
  
  // Check for large numbers not in provided context
  // (miles amounts are typically 5-6+ digits)
  const largeNumbers = parsedNumbers.filter(n => n >= 10000);
  for (const large of largeNumbers) {
    const isProvided = providedNumbers.some(p => Math.abs(p - large) < 100); // Allow small rounding
    if (!isProvided) {
      warnings.push(`Large number ${large.toLocaleString()} may be hallucinated`);
    }
  }
  
  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

/**
 * List of allowed transfer partners (from KB)
 * AI should only mention partners in this list
 */
export const ALLOWED_TRANSFER_PARTNERS = [
  { name: 'Turkish Miles&Smiles', code: 'TK', ratio: '1:1', alliance: 'Star Alliance' },
  { name: 'Emirates Skywards', code: 'EK', ratio: '1:1', alliance: 'None' },
  { name: 'Avianca LifeMiles', code: 'AV', ratio: '1:1', alliance: 'Star Alliance' },
  { name: 'Air France/KLM Flying Blue', code: 'AF', ratio: '1:1', alliance: 'SkyTeam' },
  { name: 'British Airways Avios', code: 'BA', ratio: '1:1', alliance: 'Oneworld' },
  { name: 'Singapore KrisFlyer', code: 'SQ', ratio: '1:1', alliance: 'Star Alliance' },
  { name: 'Qantas Frequent Flyer', code: 'QF', ratio: '1:1', alliance: 'Oneworld' },
  { name: 'Etihad Guest', code: 'EY', ratio: '1:1', alliance: 'None' },
  { name: 'Qatar Privilege Club', code: 'QR', ratio: '1:1', alliance: 'Oneworld' },
  { name: 'Cathay Pacific Asia Miles', code: 'CX', ratio: '1:1', alliance: 'Oneworld' },
  { name: 'Air Canada Aeroplan', code: 'AC', ratio: '1:1', alliance: 'Star Alliance' },
  { name: 'JetBlue TrueBlue', code: 'B6', ratio: '1:1', alliance: 'None' },
  { name: 'Wyndham Rewards', code: 'WYN', ratio: '1:1', type: 'Hotel' },
  { name: 'Choice Privileges', code: 'CHO', ratio: '1:1', type: 'Hotel' },
  { name: 'Accor Live Limitless', code: 'ACC', ratio: '2:1', type: 'Hotel' }, // Note: 2:1 ratio
];
