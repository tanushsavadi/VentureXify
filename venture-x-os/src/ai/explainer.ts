// ============================================
// AI EXPLAINER - Hybrid Model Implementation
// Uses Qwen for strict JSON verdicts, Llama for general chat
// ============================================

import { groqGenerate, groqGenerateTracked, GroqMessage } from './providers/groq';
import {
  TaskType,
  getGroqOptionsForTask,
  stripThinkBlocks,
  logModelCall,
  getModelForTask,
} from './modelPolicy';
import { PortalSnapshot, DirectSnapshot, ComparisonResult } from '../lib/compareTypes';

// ============================================
// AI EXPLANATION TYPE
// ============================================

export interface AIExplanation {
  headline: string;
  body: string[];
  proTip: string;
  caveats: string[];
}

// ============================================
// ZOD-LIKE VALIDATION (inline to avoid dependency)
// ============================================

function validateAIExplanation(data: unknown): AIExplanation | null {
  if (!data || typeof data !== 'object') return null;
  
  const obj = data as Record<string, unknown>;
  
  // Validate required string fields
  if (typeof obj.headline !== 'string' || !obj.headline) return null;
  if (typeof obj.proTip !== 'string' || !obj.proTip) return null;
  
  // Validate arrays
  if (!Array.isArray(obj.body) || obj.body.some(b => typeof b !== 'string')) return null;
  if (!Array.isArray(obj.caveats) || obj.caveats.some(c => typeof c !== 'string')) return null;
  
  return {
    headline: obj.headline,
    body: obj.body as string[],
    proTip: obj.proTip,
    caveats: obj.caveats as string[],
  };
}

// ============================================
// SYSTEM PROMPTS FOR DIFFERENT TASK TYPES
// ============================================

/** Base verdict prompt - used for both models */
const VERDICT_SYSTEM_PROMPT_BASE = `You are a Capital One Venture X expert assistant. Generate helpful explanations for travel booking comparisons.

RULES:
1. NEVER invent or modify numbers - only reference the facts provided
2. Be concise - 2-4 sentences maximum per section
3. Be confident and direct in tone
4. Focus on actionable insights

You must respond with ONLY valid JSON in this exact format:
{
  "headline": "short summary (max 8 words)",
  "body": ["point 1", "point 2", "point 3"],
  "proTip": "one actionable tip",
  "caveats": ["any warnings or considerations"]
}`;

/** Enhanced verdict prompt with more structure for Qwen */
const QWEN_VERDICT_SYSTEM_PROMPT = `You are a Capital One Venture X expert assistant. Generate helpful explanations for travel booking comparisons.

CRITICAL RULES:
1. NEVER invent or modify numbers - only reference the facts provided in the COMPARISON section
2. Be concise - 2-4 sentences maximum per section
3. Be confident and direct in tone
4. Focus on actionable insights
5. If a fact says "unknown" or is missing, acknowledge uncertainty

OUTPUT FORMAT:
You must respond with ONLY valid JSON in this exact format - no other text, no markdown:
{
  "headline": "short summary (max 8 words)",
  "body": ["point 1 explaining winner", "point 2 with key numbers", "point 3 with context"],
  "proTip": "one actionable tip based on the data",
  "caveats": ["any warnings based on assumptions or missing data"]
}

IMPORTANT: Do NOT output <think>…</think> tags or any internal reasoning. Output ONLY the JSON object. No preamble, no explanation, just valid JSON.`;

// ============================================
// GENERATE AI EXPLANATION FOR VERDICT
// Uses Qwen for strict JSON output
// ============================================

export async function generateAIExplanation(
  verdict: ComparisonResult,
  portalSnapshot: PortalSnapshot,
  directSnapshot: DirectSnapshot,
  apiKey: string
): Promise<AIExplanation> {
  const taskType = TaskType.VERDICT_JSON;
  const groqOptions = getGroqOptionsForTask(taskType);
  
  // Build fact block - AI can only reference these facts
  const facts = buildFactBlock(verdict, portalSnapshot, directSnapshot);
  
  const messages: GroqMessage[] = [
    { role: 'system', content: QWEN_VERDICT_SYSTEM_PROMPT },
    { role: 'user', content: `Explain this booking comparison based on these facts ONLY:\n\n${facts}\n\nRespond with valid JSON only.` },
  ];
  
  try {
    const { content: response, log } = await groqGenerateTracked(messages, apiKey, {
      ...groqOptions,
      taskType,
      stripThinkBlocks: true,
    });
    
    // Ensure any remaining think blocks are stripped
    const cleanedResponse = stripThinkBlocks(response);
    
    // Parse JSON response
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[AI Explainer] No JSON found in response, falling back to deterministic');
      log.validationPassed = false;
      log.fallbackUsed = true;
      logModelCall(log);
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    const validated = validateAIExplanation(parsed);
    
    if (!validated) {
      console.warn('[AI Explainer] Invalid response structure, falling back to deterministic');
      log.validationPassed = false;
      log.fallbackUsed = true;
      logModelCall(log);
      throw new Error('Invalid response structure');
    }
    
    // Verify no invented numbers
    const numbersInResponse = extractNumbers(JSON.stringify(validated));
    const allowedNumbers = extractNumbers(facts);
    
    // If AI invented numbers, fall back to deterministic
    const hasInventedNumbers = numbersInResponse.some(n => !allowedNumbers.includes(n) && n > 10);
    if (hasInventedNumbers) {
      console.warn(`[AI Explainer] AI invented numbers (model=${getModelForTask(taskType)}), falling back to deterministic`);
      log.validationPassed = false;
      log.fallbackUsed = true;
      logModelCall(log);
      return buildDeterministicExplanation(verdict);
    }
    
    // Success!
    log.validationPassed = true;
    logModelCall(log);
    
    return validated;
    
  } catch (error) {
    console.warn(`[AI Explainer] Generation failed (model=${getModelForTask(taskType)}):`, error);
    return buildDeterministicExplanation(verdict);
  }
}

// ============================================
// HELPERS
// ============================================

function buildFactBlock(
  verdict: ComparisonResult,
  portalSnapshot: PortalSnapshot,
  _directSnapshot: DirectSnapshot
): string {
  const portalPrice = verdict.portalPrice;
  const directPrice = verdict.directPrice;
  const winner = verdict.winner;
  const netDiff = verdict.netDifference;
  const portalPoints = verdict.portalPointsEarned;
  const directPoints = verdict.directPointsEarned;
  const breakEven = verdict.breakEvenPremium;
  
  let facts = `COMPARISON RESULT:
- Winner: ${winner === 'portal' ? 'Capital One Portal' : winner === 'direct' ? 'Book Direct' : 'Tie'}
- Net Advantage: $${netDiff.toFixed(0)}

PORTAL:
- Price: $${portalPrice.toFixed(0)}
- Miles Earned: ${portalPoints.toLocaleString()} (5x multiplier)

DIRECT:
- Price: $${directPrice.toFixed(0)}
- Miles Earned: ${directPoints.toLocaleString()} (2x multiplier)

ANALYSIS:
- Break-Even Premium: $${breakEven.toFixed(0)}
- Extra Miles from Portal: ${(portalPoints - directPoints).toLocaleString()}`;
  
  // Add itinerary context if available
  if (portalSnapshot.itinerary?.type === 'flight') {
    const flight = portalSnapshot.itinerary;
    if (flight.origin && flight.destination) {
      facts += `\n\nROUTE: ${flight.origin} → ${flight.destination}`;
    }
    if (flight.cabin) {
      facts += `\nCABIN: ${flight.cabin}`;
    }
  }
  
  return facts;
}

function extractNumbers(text: string): number[] {
  const matches = text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
  return matches.map(m => parseFloat(m.replace(/,/g, '')));
}

export function buildDeterministicExplanation(verdict: ComparisonResult): AIExplanation {
  const { 
    winner, 
    portalPrice, 
    directPrice, 
    portalPointsEarned, 
    directPointsEarned,
    netDifference,
    breakEvenPremium,
  } = verdict;
  
  let headline: string;
  let body: string[];
  let proTip: string;
  const caveats: string[] = [];
  
  if (winner === 'portal') {
    headline = `Portal wins by ~$${netDifference.toFixed(0)}`;
    body = [
      `Portal: $${portalPrice.toLocaleString()} → ${portalPointsEarned.toLocaleString()} miles (5x)`,
      `Direct: $${directPrice.toLocaleString()} → ${directPointsEarned.toLocaleString()} miles (2x)`,
      `The extra ${(portalPointsEarned - directPointsEarned).toLocaleString()} miles from Portal are worth more than the ${portalPrice > directPrice ? `$${(portalPrice - directPrice).toFixed(0)} premium` : 'savings'}.`,
    ];
    proTip = `You can pay up to $${breakEvenPremium.toFixed(0)} more on Portal before Direct becomes better.`;
  } else if (winner === 'direct') {
    headline = `Direct wins by ~$${netDifference.toFixed(0)}`;
    body = [
      `Direct: $${directPrice.toLocaleString()} → ${directPointsEarned.toLocaleString()} miles (2x)`,
      `Portal: $${portalPrice.toLocaleString()} → ${portalPointsEarned.toLocaleString()} miles (5x)`,
      `The $${(portalPrice - directPrice).toFixed(0)} Portal premium exceeds the ${(portalPointsEarned - directPointsEarned).toLocaleString()} extra miles value.`,
    ];
    proTip = `Book direct and consider Travel Eraser for 1¢/mile redemption if needed.`;
  } else {
    headline = `It's a wash — pick based on preference`;
    body = [
      `Portal: $${portalPrice.toLocaleString()} → ${portalPointsEarned.toLocaleString()} miles`,
      `Direct: $${directPrice.toLocaleString()} → ${directPointsEarned.toLocaleString()} miles`,
      `Net difference is under $5 — not material.`,
    ];
    proTip = `Portal gives better points; Direct may have better policies.`;
  }
  
  // Add caveats
  if (Math.abs(portalPrice - directPrice) < 10) {
    caveats.push('Prices are very close — double-check both before booking.');
  }
  if (portalPrice > directPrice * 1.3) {
    caveats.push('Portal premium is high (>30%). Verify pricing is current.');
  }
  
  return { headline, body, proTip, caveats };
}

// ============================================
// LEGACY COMPATIBILITY EXPORTS
// For backward compatibility with existing autopilot.ts
// ============================================

import type { AIConfig, PersonalizationContext } from './types';

/**
 * Build basic fallback explanation (non-AI) for PersonalizationContext
 * Used by autopilot.ts
 */
export function buildFallbackExplanation(ctx: PersonalizationContext): string {
  const parts: string[] = [];
  
  // Credit usage
  if (ctx.creditApplied > 0) {
    parts.push(`Your $${ctx.creditApplied} travel credit is applied, dropping your cost to just $${ctx.outOfPocket.toFixed(0)}.`);
  }
  
  // Miles earning
  if (ctx.milesEarned > 0) {
    parts.push(`You'll earn ${ctx.milesEarned.toLocaleString()} miles (${ctx.bestStrategyName.includes('Portal') ? '5x' : '2x'}).`);
  }
  
  // Portal vs Direct comparison
  if (ctx.directPrice !== null && ctx.directPrice !== undefined) {
    const priceDelta = ctx.portalPrice - ctx.directPrice;
    if (priceDelta > 0) {
      parts.push(`Portal is $${priceDelta.toFixed(0)} more than direct, but the extra miles earned offset the difference.`);
    } else if (priceDelta < -10) {
      parts.push(`Direct is $${Math.abs(priceDelta).toFixed(0)} more expensive, making Portal the clear winner.`);
    }
  }
  
  // Expiring eraser items
  if (ctx.expiringItems && ctx.expiringItems.length > 0) {
    const total = ctx.expiringItems.reduce((s, i) => s + i.amount, 0);
    parts.push(`Note: You have $${total.toFixed(0)} in eraser-eligible purchases expiring soon.`);
  }
  
  return parts.join(' ') || `${ctx.bestStrategyName} offers the best value for this booking.`;
}

/** System prompt for personalized recommendations using Llama (faster) */
const LLAMA_RECOMMENDATION_SYSTEM_PROMPT = `You are a Capital One Venture X expert advisor. Generate personalized, concise booking recommendations.

Key Venture X benefits:
- $300 annual travel credit (use it or lose it)
- 5x miles on portal bookings, 2x elsewhere
- Travel Eraser: redeem miles at 1cpp on past travel purchases (90 day window)
- Transfer partners: 1:1 ratio, typically 1.5-2cpp value for premium cabin awards

Your recommendations should:
1. Be specific with numbers (don't round excessively)
2. Consider user's current miles balance and redemption goals
3. Keep it to 2-3 sentences max
4. Use one relevant emoji at the start
5. Never explain basic card features - assume they know
6. NEVER invent numbers not provided in the context`;

/**
 * Get explanation - returns AI-enhanced or fallback explanation
 * Uses Llama for freeform recommendations (faster), with strict no-hallucination rules
 */
export async function getExplanation(
  ctx: PersonalizationContext,
  config: AIConfig | null
): Promise<string> {
  if (config?.enabled && config.apiKey) {
    const taskType = TaskType.CHAT_GENERAL;
    const groqOptions = getGroqOptionsForTask(taskType);
    
    try {
      const messages: GroqMessage[] = [
        {
          role: 'system',
          content: LLAMA_RECOMMENDATION_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: `Generate a personalized recommendation for this situation:
- Miles balance: ${ctx.milesBalance.toLocaleString()}
- Travel credit remaining: $${ctx.travelCreditRemaining}
- Booking total: $${ctx.totalPrice.toFixed(2)}
- Credit applied: $${ctx.creditApplied}
- Out of pocket: $${ctx.outOfPocket.toFixed(2)}
- Miles earned: ${ctx.milesEarned.toLocaleString()}
- Best strategy: ${ctx.bestStrategyName}
- Booking type: ${ctx.bookingType}${ctx.destination ? ` to ${ctx.destination}` : ''}

Write a 2-3 sentence recommendation. Start with an emoji. Use ONLY the numbers provided above.`
        },
      ];
      
      const response = await groqGenerate(messages, config.apiKey, groqOptions);
      
      let text = response.trim();
      
      // Ensure it starts with an emoji
      if (!/^[\p{Emoji}]/u.test(text)) {
        const emoji = ctx.creditApplied > 0 ? '🎉' : ctx.milesEarned > 3000 ? '✈️' : '💡';
        text = `${emoji} ${text}`;
      }
      
      // Quick validation: check for obviously invented large numbers
      const allowedNumbers = [
        ctx.milesBalance, ctx.travelCreditRemaining, ctx.totalPrice,
        ctx.creditApplied, ctx.outOfPocket, ctx.milesEarned,
      ];
      const responseNumbers = extractNumbers(text).filter(n => n > 100);
      const hasInvented = responseNumbers.some(n => 
        !allowedNumbers.some(allowed => Math.abs(allowed - n) < 10)
      );
      
      if (hasInvented) {
        console.warn(`[AI Explainer] Recommendation contains invented numbers (model=${getModelForTask(taskType)}), using fallback`);
        return buildFallbackExplanation(ctx);
      }
      
      return text;
    } catch (error) {
      console.warn(`[AI Explainer] Recommendation failed (model=${getModelForTask(taskType)}):`, error);
      return buildFallbackExplanation(ctx);
    }
  }
  
  return buildFallbackExplanation(ctx);
}

// ============================================
// EXPORTS
// ============================================

export { buildFactBlock, VERDICT_SYSTEM_PROMPT_BASE as VERDICT_SYSTEM_PROMPT };
