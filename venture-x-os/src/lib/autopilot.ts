// ============================================
// AUTOPILOT ENGINE - CONTEXT DETECTION & STRATEGY
// Pure deterministic logic + optional AI explanations
// ============================================

import { VENTURE_X_CONSTANTS } from './types';
import type { AIConfig, PersonalizationContext } from '../ai/types';
import { getExplanation, buildFallbackExplanation } from '../ai/explainer';

// ============================================
// PAGE CONTEXT TYPES
// ============================================

export type PageContext = 
  | 'checkout'
  | 'search_results'
  | 'booking_details'
  | 'account_balance'
  | 'rewards_summary'
  | 'trip_details'
  | 'payment'
  | 'confirmation'
  | 'browsing'
  | 'unknown';

export interface PageData {
  context: PageContext;
  url: string;
  domain: string;
  title: string;
  prices: number[];
  totalPrice: number | null;
  milesVisible: number | null;  // User's actual miles balance
  milesCost: number | null;     // Miles needed to pay for this booking
  creditsVisible: number | null;
  travelDates: string | null;
  destination: string | null;
  bookingType: 'flight' | 'hotel' | 'car' | 'package' | 'unknown';
  isPortal: boolean;
  rawText: string;
  timestamp: number;
}

export interface AutopilotTip {
  id: string;
  type: 'action' | 'insight' | 'warning' | 'opportunity';
  priority: 'high' | 'medium' | 'low';
  title: string;
  shortSummary: string;
  fullExplanation: string;
  suggestedActions: string[];
  savingsEstimate?: number;
  context: PageContext;
  pageUrl: string;
  timestamp: number;
  dismissed: boolean;
  actedOn: boolean;
}

export interface UserFinancialContext {
  milesBalance: number | null;
  travelCredits: number | null;
  annualFeeDate: string | null;
  eraserEligibleTransactions: {
    merchant: string;
    amount: number;
    date: string;
    daysLeft: number;
  }[];
  recentBookings: {
    type: string;
    amount: number;
    date: string;
    portal: boolean;
  }[];
}

// ============================================
// PAGE CONTEXT DETECTOR
// ============================================

export function detectPageContext(document: Document, url: string): PageData {
  const hostname = new URL(url).hostname;
  const pathname = new URL(url).pathname;
  const fullText = document.body?.innerText || '';
  const title = document.title;
  
  // Detect if on Capital One portal
  const isPortal = hostname.includes('capitalone.com');
  
  // Determine page context based on URL and content patterns
  let context: PageContext = 'unknown';
  
  if (pathname.includes('/book') || pathname.includes('/checkout') || 
      pathname.includes('/purchase') || fullText.includes('Confirm and Book') ||
      fullText.includes('Complete booking')) {
    context = 'checkout';
  } else if (pathname.includes('/search') || pathname.includes('/results') ||
             fullText.includes('Select a flight') || fullText.includes('Search results')) {
    context = 'search_results';
  } else if (pathname.includes('/trip') || pathname.includes('/itinerary') ||
             fullText.includes('Your trip') || fullText.includes('Itinerary')) {
    context = 'trip_details';
  } else if (pathname.includes('/rewards') || pathname.includes('/miles') ||
             fullText.includes('Miles balance') || fullText.includes('Rewards summary')) {
    context = 'rewards_summary';
  } else if (pathname.includes('/account') || pathname.includes('/balance') ||
             fullText.includes('Account overview') || fullText.includes('Available credit')) {
    context = 'account_balance';
  } else if (pathname.includes('/payment') || fullText.includes('Payment method')) {
    context = 'payment';
  } else if (pathname.includes('/confirm') || fullText.includes('Booking confirmed')) {
    context = 'confirmation';
  } else if (fullText.includes('price') || fullText.includes('$')) {
    context = 'browsing';
  }
  
  // Extract prices from page - support multiple currencies
  const usdPriceRegex = /\$[\d,]+(?:\.\d{2})?/g;
  const usdMatches = fullText.match(usdPriceRegex) || [];
  
  const multiCurrencyRegex = /(?:AED|EUR|GBP|CAD|AUD|INR|€|£)\s*[\d,]+(?:\.\d{2})?/gi;
  const multiCurrencyMatches = fullText.match(multiCurrencyRegex) || [];
  
  const allPriceMatches = [...usdMatches, ...multiCurrencyMatches];
  
  const prices = allPriceMatches
    .map(p => {
      const clean = p.replace(/[AED|EUR|GBP|CAD|AUD|INR|$€£,\s]/gi, '');
      return parseFloat(clean);
    })
    .filter(p => !isNaN(p) && p > 0);
  
  // Try to find total price
  let totalPrice: number | null = null;
  
  // SPECIAL HANDLING FOR GOOGLE FLIGHTS
  // Google Flights shows "AED X,XXX" with "Lowest total price" label
  const isGoogleFlights = url.includes('google.com') && url.includes('/travel/flights');
  
  if (isGoogleFlights) {
    // Priority 1: Look for price near "Lowest total price" label
    const lowestIdx = fullText.toLowerCase().indexOf('lowest total price');
    if (lowestIdx !== -1) {
      // Get text around "Lowest total price" - price is usually just before it
      const textAroundLowest = fullText.substring(Math.max(0, lowestIdx - 100), lowestIdx + 30);
      
      // Match "AED X,XXX" or other currency patterns
      const currencyMatch = textAroundLowest.match(/\b(AED|EUR|GBP|CAD|AUD|INR|JPY|SAR|QAR)\s*([\d,]+(?:\.\d{2})?)/i);
      if (currencyMatch) {
        const amount = parseFloat(currencyMatch[2].replace(/,/g, ''));
        if (amount > 100 && amount < 500000) {
          totalPrice = amount;
          console.log('[Autopilot] Found Google Flights price near "Lowest total price":', amount, currencyMatch[1]);
        }
      }
    }
    
    // Priority 2: Look for any AED/foreign currency prices on the page (first reasonable one)
    if (!totalPrice) {
      const foreignPattern = /\b(AED|EUR|GBP|CAD|AUD|INR|JPY|SAR|QAR)\s*([\d,]+(?:\.\d{2})?)/gi;
      let match;
      const foreignPrices: { currency: string; amount: number; index: number }[] = [];
      
      while ((match = foreignPattern.exec(fullText)) !== null) {
        const amount = parseFloat(match[2].replace(/,/g, ''));
        // Filter reasonable flight prices (AED 1000-100000, etc.)
        if (amount > 500 && amount < 200000) {
          foreignPrices.push({ currency: match[1], amount, index: match.index });
        }
      }
      
      // If we found foreign currency prices, prefer the one closest to "Lowest total price"
      if (foreignPrices.length > 0) {
        if (lowestIdx !== -1) {
          // Find the price closest to (and before) "Lowest total price"
          const nearestPrice = foreignPrices.find(p => p.index < lowestIdx && lowestIdx - p.index < 100);
          if (nearestPrice) {
            totalPrice = nearestPrice.amount;
            console.log('[Autopilot] Found Google Flights price (nearest to Lowest):', totalPrice);
          }
        }
        
        // Fallback: use the first reasonable price
        if (!totalPrice) {
          totalPrice = foreignPrices[0].amount;
          console.log('[Autopilot] Found Google Flights price (first foreign currency):', totalPrice);
        }
      }
    }
  }
  
  // Capital One Travel checkout patterns (if not Google Flights or price not found)
  if (!totalPrice) {
    const coTotalPatterns = [
      /Total[\s\n\r]+\$([\d,]+\.\d{2})\s*\/\s*[\d,]+\s*miles/i,
      /Total[\s\S]{0,30}\$([\d,]+\.\d{2})\s*\/\s*[\d,]+\s*miles/i,
      /\$([\d,]+\.\d{2})\s*\/\s*([\d,]+)\s*miles/gi,
    ];
    
    for (let i = 0; i < 2; i++) {
      const match = fullText.match(coTotalPatterns[i]);
      if (match) {
        const value = parseFloat(match[1].replace(/,/g, ''));
        if (value >= 50 && value < 20000) {
          totalPrice = value;
          break;
        }
      }
    }
  }
  
  // Try the "$XXX.XX / XX,XXX miles" pattern
  if (!totalPrice) {
    const milesFormatRegex = /\$([\d,]+\.\d{2})\s*\/\s*([\d,]+)\s*miles/gi;
    let match;
    const candidates: number[] = [];
    while ((match = milesFormatRegex.exec(fullText)) !== null) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      const milesNeeded = parseInt(match[2].replace(/,/g, ''));
      if (value >= 50 && value < 20000 && milesNeeded > value * 50) {
        candidates.push(value);
      }
    }
    if (candidates.length > 0) {
      totalPrice = Math.max(...candidates);
    }
  }
  
  // Other patterns
  if (!totalPrice) {
    const otherPatterns = [
      /Total[:\s]+\$([\d,]+\.\d{2})/i,
      /Trip\s+total[:\s]*\$([\d,]+\.\d{2})/i,
      /Grand\s+total[:\s]*\$([\d,]+\.\d{2})/i,
    ];
    
    for (const pattern of otherPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        const value = parseFloat(match[1].replace(/,/g, ''));
        if (value >= 50 && value < 20000) {
          totalPrice = value;
          break;
        }
      }
    }
  }
  
  // Last resort: largest price over $100 (but NOT for Google Flights - we already handled that)
  if (!totalPrice && prices.length > 0 && !isGoogleFlights) {
    const travelPrices = prices.filter(p => p >= 100 && p < 10000);
    if (travelPrices.length > 0) {
      totalPrice = Math.max(...travelPrices);
    }
  }
  
  // Extract miles BALANCE
  let milesVisible: number | null = null;
  const milesPatterns = [
    /Apply\s+Venture\s+X\s+rewards[:\s]*([\d,]+)\s*miles/i,
    /Apply\s+.*?rewards[:\s]*([\d,]+)\s*miles/i,
    /([\d,]+)\s*miles\s*available/i,
    /Miles\s*balance[\s\S]{0,20}([\d,]+)/i,
  ];
  for (const pattern of milesPatterns) {
    const match = fullText.match(pattern);
    if (match) {
      const value = parseInt(match[1].replace(/,/g, ''));
      if (value > 0 && value < 100000) {
        milesVisible = value;
        break;
      }
    }
  }
  
  // Extract miles COST
  let milesCost: number | null = null;
  const milesFormatMatches = fullText.matchAll(/\$([\d,]+(?:\.\d{2})?)\s*\/\s*([\d,]+)\s*miles/gi);
  let maxMilesCost = 0;
  for (const match of milesFormatMatches) {
    const price = parseFloat(match[1].replace(/,/g, ''));
    const miles = parseInt(match[2].replace(/,/g, ''));
    if (miles > maxMilesCost && price >= 50) {
      maxMilesCost = miles;
      milesCost = miles;
      if (!totalPrice || price > totalPrice) {
        totalPrice = price;
      }
    }
  }
  
  // Extract credits if visible
  let creditsVisible: number | null = null;
  const creditsMatch = fullText.match(/(?:credit|Credit)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i);
  if (creditsMatch) {
    creditsVisible = parseFloat(creditsMatch[1].replace(/,/g, ''));
  }
  
  // Detect booking type
  let bookingType: 'flight' | 'hotel' | 'car' | 'package' | 'unknown' = 'unknown';
  if (pathname.includes('/flights') || fullText.includes('flight') || 
      fullText.includes('airline') || fullText.includes('departure')) {
    bookingType = 'flight';
  } else if (pathname.includes('/hotels') || fullText.includes('hotel') ||
             fullText.includes('room') || fullText.includes('check-in')) {
    bookingType = 'hotel';
  } else if (pathname.includes('/cars') || fullText.includes('rental car')) {
    bookingType = 'car';
  }
  
  // Try to extract travel dates
  let travelDates: string | null = null;
  const dateMatch = fullText.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/gi);
  if (dateMatch && dateMatch.length >= 1) {
    travelDates = dateMatch.slice(0, 2).join(' - ');
  }
  
  // Try to extract destination
  let destination: string | null = null;
  const destMatch = fullText.match(/(?:to|→|Destination:?)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (destMatch) {
    destination = destMatch[1];
  }
  
  return {
    context,
    url,
    domain: hostname,
    title,
    prices,
    totalPrice,
    milesVisible,
    milesCost,
    creditsVisible,
    travelDates,
    destination,
    bookingType,
    isPortal,
    rawText: fullText.slice(0, 5000),
    timestamp: Date.now(),
  };
}

// ============================================
// STRATEGY ENGINE - PURE DETERMINISTIC LOGIC
// ============================================

export interface Strategy {
  name: string;
  outOfPocket: number;
  milesEarned: number;
  milesUsed: number;
  netMilesGain: number;
  totalValue: number;
  applicable: boolean;
  reason: string;
}

export interface StrategyAnalysis {
  total: number;
  creditApplied: number;
  amountDue: number;
  milesBalance: number;
  milesCost: number | null;
  strategies: Strategy[];
  bestStrategy: Strategy;
  lastUpdated: number;
  dataSource: 'page' | 'manual' | 'mixed';
}

export function analyzeStrategies(
  pageData: PageData,
  userContext: UserFinancialContext
): StrategyAnalysis | null {
  const rawText = pageData.rawText;
  
  // Parse Amount Due
  let amountDue: number | null = null;
  const amountDuePatterns = [
    /Amount\s*due[\s\S]{0,10}\$([\d,]+(?:\.\d{2})?)/i,
    /Amount\s+due[:\s]*\$([\d,]+(?:\.\d{2})?)/i,
    /Amount\s*due[^\$]{0,15}\$([\d,]+(?:\.\d{2})?)/i,
  ];
  
  for (const pattern of amountDuePatterns) {
    const match = rawText.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      if (value >= 0 && value < 5000) {
        amountDue = value;
        break;
      }
    }
  }
  
  // Parse credit applied
  let creditApplied = 0;
  const creditPatterns = [
    /Travel\s*credits?\s*applied[\s\S]{0,10}-?\s*\$([\d,]+(?:\.\d{2})?)/i,
    /credits?\s*applied[^\$]{0,15}-?\$([\d,]+(?:\.\d{2})?)/i,
    /-\$([\d,]+(?:\.\d{2})?)/,
  ];
  
  for (const pattern of creditPatterns) {
    const match = rawText.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ''));
      if (value >= 50 && value <= 300) {
        creditApplied = value;
        break;
      }
    }
  }
  
  // Fallback: assume $300 if "travel credits" text found
  if (rawText.toLowerCase().includes('travel credits') && creditApplied === 0) {
    creditApplied = 300;
  }
  
  const total = pageData.totalPrice || 0;
  
  // Calculate amount due if not found directly
  if (amountDue === null && total > 0 && creditApplied > 0) {
    amountDue = total - creditApplied;
  }
  
  let effectiveAmountDue: number;
  if (amountDue !== null && amountDue > 0) {
    effectiveAmountDue = amountDue;
  } else if (total > 0 && creditApplied > 0) {
    effectiveAmountDue = total - creditApplied;
  } else {
    effectiveAmountDue = total;
  }
  
  const milesBalance = pageData.milesVisible || userContext.milesBalance || 0;
  const milesCost = pageData.milesCost;
  const eraserQueue = userContext.eraserEligibleTransactions || [];
  const pendingEraserValue = eraserQueue.reduce((sum, t) => sum + t.amount, 0);
  
  const strategies: Strategy[] = [];
  
  // STRATEGY A: Portal + Credit
  if (pageData.isPortal) {
    const milesEarned = Math.round(effectiveAmountDue * 5);
    const milesValue = milesEarned * 0.01;
    strategies.push({
      name: 'Portal + Credit',
      outOfPocket: effectiveAmountDue,
      milesEarned: milesEarned,
      milesUsed: 0,
      netMilesGain: milesEarned,
      totalValue: creditApplied + milesValue,
      applicable: true,
      reason: creditApplied > 0
        ? `Pay $${effectiveAmountDue.toFixed(2)}, use $${creditApplied.toFixed(0)} credit, earn ${milesEarned} miles`
        : `Pay $${effectiveAmountDue.toFixed(2)}, earn ${milesEarned} miles (5x)`
    });
  }
  
  // STRATEGY B: Portal + Earn 5x + Erase Later
  if (pageData.isPortal) {
    const milesEarned = Math.round(effectiveAmountDue * 5);
    const milesToErase = Math.round(effectiveAmountDue * 100);
    const netGain = milesEarned - milesToErase;
    const canAffordErase = milesBalance >= milesToErase;
    
    strategies.push({
      name: 'Portal + Earn 5x + Erase Later',
      outOfPocket: 0,
      milesEarned: milesEarned,
      milesUsed: milesToErase,
      netMilesGain: netGain,
      totalValue: effectiveAmountDue + creditApplied,
      applicable: canAffordErase,
      reason: canAffordErase
        ? `Pay $${effectiveAmountDue.toFixed(2)}, earn ${milesEarned} miles (5x), later erase with ${milesToErase.toLocaleString()} miles`
        : `Need ${milesToErase.toLocaleString()} miles to erase, you have ${milesBalance.toLocaleString()}`
    });
    
    if (pendingEraserValue > 0) {
      strategies.push({
        name: 'Portal + Save Miles',
        outOfPocket: effectiveAmountDue,
        milesEarned: milesEarned,
        milesUsed: 0,
        netMilesGain: milesEarned,
        totalValue: creditApplied + (milesEarned * 0.017),
        applicable: true,
        reason: `Pay $${effectiveAmountDue.toFixed(2)}, earn ${milesEarned} miles. Save miles for better redemptions.`
      });
    }
  }
  
  // STRATEGY C: Pay with Miles
  if (milesCost && milesCost > 0) {
    const cpp = (total / milesCost) * 100;
    const canAfford = milesBalance >= milesCost;
    strategies.push({
      name: 'Pay with Miles',
      outOfPocket: canAfford ? 0 : effectiveAmountDue,
      milesEarned: 0,
      milesUsed: canAfford ? milesCost : 0,
      netMilesGain: canAfford ? -milesCost : 0,
      totalValue: canAfford ? total : 0,
      applicable: canAfford && cpp >= 1.0,
      reason: canAfford
        ? `Redeem ${milesCost.toLocaleString()} miles at ${cpp.toFixed(2)}cpp`
        : `Need ${milesCost.toLocaleString()} miles, you have ${milesBalance.toLocaleString()}`
    });
  }
  
  // STRATEGY D: Direct + Eraser
  if (!pageData.isPortal) {
    const milesEarned = Math.round(total * 2);
    const milesToErase = Math.round(total * 100);
    const canAffordErase = milesBalance >= milesToErase;
    strategies.push({
      name: 'Direct + Eraser',
      outOfPocket: canAffordErase ? 0 : total,
      milesEarned: milesEarned,
      milesUsed: canAffordErase ? milesToErase : 0,
      netMilesGain: canAffordErase ? milesEarned - milesToErase : milesEarned,
      totalValue: canAffordErase ? total : milesEarned * 0.01,
      applicable: true,
      reason: `Book direct, earn ${milesEarned} miles (2x)${canAffordErase ? `, erase with ${milesToErase.toLocaleString()} miles` : ''}`
    });
  }
  
  // STRATEGY E: Transfer Partners
  if (total >= 300 && milesBalance >= 10000) {
    const transferCpp = 0.017;
    const transferValue = milesBalance * transferCpp;
    strategies.push({
      name: 'Transfer Partners',
      outOfPocket: 0,
      milesEarned: 0,
      milesUsed: Math.round(total / transferCpp),
      netMilesGain: -Math.round(total / transferCpp),
      totalValue: transferValue,
      applicable: milesBalance >= Math.round(total / transferCpp),
      reason: `Transfer miles to airline partners for ~1.7cpp value. Best for premium cabin flights.`
    });
  }
  
  // Find best strategy
  const applicableStrategies = strategies.filter(s => s.applicable);
  const bestStrategy = applicableStrategies.length > 0
    ? applicableStrategies.reduce((best, current) =>
        current.totalValue > best.totalValue ? current : best
      , applicableStrategies[0])
    : strategies[0];
  
  return {
    total,
    creditApplied,
    amountDue: effectiveAmountDue,
    milesBalance,
    milesCost,
    strategies,
    bestStrategy,
    lastUpdated: Date.now(),
    dataSource: 'page'
  };
}

export async function generateSmartTip(
  pageData: PageData,
  userContext: UserFinancialContext,
  aiConfig?: AIConfig | null
): Promise<AutopilotTip | null> {
  if (pageData.context !== 'checkout') {
    return generateFallbackTip(pageData, userContext);
  }
  
  const analysis = analyzeStrategies(pageData, userContext);
  if (!analysis) return null;
  
  const { total, creditApplied, amountDue, milesBalance, bestStrategy, strategies } = analysis;
  
  const otherStrategies = strategies.filter(s => s.name !== bestStrategy.name && s.applicable);
  
  // Build personalization context for AI
  const personalizationCtx: PersonalizationContext = {
    milesBalance,
    travelCreditRemaining: Math.max(0, 300 - creditApplied),
    creditRenewalDate: userContext.annualFeeDate,
    eraserQueueTotal: userContext.eraserEligibleTransactions.reduce((sum, t) => sum + t.amount, 0),
    expiringItems: userContext.eraserEligibleTransactions
      .filter(t => t.daysLeft <= 14)
      .map(t => ({ amount: t.amount, daysLeft: t.daysLeft })),
    bookingType: pageData.bookingType === 'package' ? 'unknown' : pageData.bookingType,
    destination: pageData.destination,
    totalPrice: total,
    bestStrategyName: bestStrategy.name,
    portalPrice: total,
    directPrice: null,  // Will be populated if comparison data available
    milesEarned: bestStrategy.milesEarned,
    creditApplied,
    outOfPocket: amountDue,
  };
  
  // Generate explanation (AI or fallback)
  let explanation: string;
  
  if (aiConfig?.enabled && aiConfig.apiKey) {
    try {
      explanation = await getExplanation(personalizationCtx, aiConfig);
      console.log('🤖 [Autopilot] AI explanation generated');
    } catch (error) {
      console.warn('⚠️ [Autopilot] AI failed, using fallback:', error);
      explanation = buildBasicExplanation(bestStrategy, creditApplied, milesBalance, otherStrategies);
    }
  } else {
    explanation = buildBasicExplanation(bestStrategy, creditApplied, milesBalance, otherStrategies);
  }
  
  return {
    id: crypto.randomUUID(),
    type: creditApplied > 0 ? 'action' : 'insight',
    priority: creditApplied > 0 ? 'high' : 'medium',
    title: creditApplied > 0 ? `🎉 Save $${creditApplied.toFixed(0)} + Earn ${bestStrategy.milesEarned} Miles` : bestStrategy.name,
    shortSummary: `Pay $${amountDue.toFixed(2)}, save $${creditApplied.toFixed(0)}, earn ${bestStrategy.milesEarned} miles`,
    fullExplanation: explanation,
    suggestedActions: [
      'Complete booking now',
      creditApplied > 0 ? 'Credit auto-applied ✓' : 'Check for better direct rates',
      bestStrategy.milesEarned > 0 ? `Earning ${bestStrategy.milesEarned} miles` : 'Consider transfer partners'
    ],
    savingsEstimate: bestStrategy.totalValue,
    context: pageData.context,
    pageUrl: pageData.url,
    timestamp: Date.now(),
    dismissed: false,
    actedOn: false,
  };
}

/**
 * Build basic (non-AI) explanation
 */
function buildBasicExplanation(
  bestStrategy: Strategy,
  creditApplied: number,
  milesBalance: number,
  otherStrategies: Strategy[]
): string {
  let explanation = `${bestStrategy.reason}\n\n`;
  
  if (creditApplied > 0) {
    explanation += `✅ Your $300 travel credit is applied - saving you $${creditApplied.toFixed(0)}!\n\n`;
  }
  
  explanation += `📊 Strategy Comparison:\n`;
  explanation += `• ${bestStrategy.name}: $${bestStrategy.outOfPocket.toFixed(2)} out of pocket, ${bestStrategy.milesEarned > 0 ? `+${bestStrategy.milesEarned} miles earned` : ''}\n`;
  
  otherStrategies.slice(0, 2).forEach(s => {
    explanation += `• ${s.name}: ${s.reason}\n`;
  });
  
  if (milesBalance > 0) {
    explanation += `\n💳 Your miles balance: ${milesBalance.toLocaleString()} miles`;
  }
  
  return explanation;
}

export function generateFallbackTip(
  pageData: PageData,
  userContext: UserFinancialContext
): AutopilotTip | null {
  const tips: AutopilotTip[] = [];
  
  // Check for expiring eraser transactions
  const expiringItems = userContext.eraserEligibleTransactions.filter(t => t.daysLeft <= 14);
  if (expiringItems.length > 0) {
    const totalExpiring = expiringItems.reduce((sum, t) => sum + t.amount, 0);
    tips.push({
      id: crypto.randomUUID(),
      type: 'warning',
      priority: 'high',
      title: 'Eraser Items Expiring Soon!',
      shortSummary: `${expiringItems.length} transaction(s) worth $${totalExpiring.toFixed(0)} expiring within 2 weeks`,
      fullExplanation: `You have travel purchases that will no longer be eligible for Travel Eraser soon. Act now if you want to redeem miles for these transactions.`,
      suggestedActions: expiringItems.map(t => `Use eraser on ${t.merchant}: $${t.amount}`),
      savingsEstimate: totalExpiring,
      context: pageData.context,
      pageUrl: pageData.url,
      timestamp: Date.now(),
      dismissed: false,
      actedOn: false,
    });
  }
  
  // Rewards summary page tips
  if (pageData.context === 'rewards_summary' && userContext.milesBalance) {
    const eraserValue = userContext.milesBalance * 0.01;
    const transferValue = userContext.milesBalance * 0.017;
    tips.push({
      id: crypto.randomUUID(),
      type: 'insight',
      priority: 'low',
      title: 'Miles Value Overview',
      shortSummary: `${userContext.milesBalance.toLocaleString()} miles = $${eraserValue.toFixed(0)}-${transferValue.toFixed(0)} value`,
      fullExplanation: `Your current miles balance of ${userContext.milesBalance.toLocaleString()} is worth $${eraserValue.toFixed(0)} via Travel Eraser (1¢/mile) or potentially $${transferValue.toFixed(0)}+ via transfer partners at 1.7¢/mile.`,
      suggestedActions: ['View transfer partners', 'Check eraser eligible purchases'],
      savingsEstimate: undefined,
      context: pageData.context,
      pageUrl: pageData.url,
      timestamp: Date.now(),
      dismissed: false,
      actedOn: false,
    });
  }
  
  if (tips.length > 0) {
    tips.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    return tips[0];
  }
  
  return null;
}

// ============================================
// MAIN AUTOPILOT FUNCTION
// ============================================

export async function runAutopilot(
  pageData: PageData,
  userContext: UserFinancialContext,
  aiConfig?: AIConfig | null
): Promise<AutopilotTip | null> {
  console.log('🚀 [Autopilot] runAutopilot called');
  console.log('📄 [Autopilot] Page context:', pageData.context);
  console.log('💰 [Autopilot] Total price:', pageData.totalPrice ? `$${pageData.totalPrice}` : 'None');
  console.log('🌐 [Autopilot] Is Portal:', pageData.isPortal);
  console.log('🤖 [Autopilot] AI enabled:', aiConfig?.enabled ?? false);
  
  // Deterministic strategy engine with optional AI explanations
  const tip = await generateSmartTip(pageData, userContext, aiConfig);
  
  if (tip) {
    console.log('✅ [Autopilot] Strategy tip generated:', tip.title);
  }
  
  return tip;
}
