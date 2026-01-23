// ============================================
// CAPITAL ONE TRAVEL STAYS CAPTURE
// Content script for capturing hotel/stay booking details
// from Capital One Travel portal
// ============================================

import {
  StayPortalCapture,
  StayPageType,
  StayAccommodationType,
  StaySearchContext,
  StayPropertyDetails,
  StayRoomSelection,
  StayCheckoutBreakdown,
  detectStayPageType,
  detectAccommodationType,
  getPortalEarnRate,
  parseStaySearchContextFromUrl,
  calculateNights,
  generateCaptureId,
} from '../lib/staysTypes';
import { ConfidenceLevel } from '../lib/types';
import {
  getEffectiveSelectors,
  getSelectorConfig,
  SiteSelectorConfig,
} from '../config/selectorsRegistry';

// ============================================
// PRICE EXTRACTION UTILITIES
// ============================================

/**
 * Parse a price string into a number
 * Handles: $1,234.56, 1,234.56, $1234, 1234.56 USD, etc.
 */
function parsePrice(priceText: string): { amount: number; currency: string } | null {
  if (!priceText) return null;
  
  const cleaned = priceText.trim();
  
  // Extract currency symbol or code
  let currency = 'USD';
  if (cleaned.includes('€')) currency = 'EUR';
  else if (cleaned.includes('£')) currency = 'GBP';
  else if (cleaned.includes('$')) currency = 'USD';
  else if (/\bUSD\b/i.test(cleaned)) currency = 'USD';
  else if (/\bEUR\b/i.test(cleaned)) currency = 'EUR';
  else if (/\bGBP\b/i.test(cleaned)) currency = 'GBP';
  
  // Extract numeric value
  const numericMatch = cleaned.match(/[\d,]+\.?\d*/);
  if (!numericMatch) return null;
  
  const numericStr = numericMatch[0].replace(/,/g, '');
  const amount = parseFloat(numericStr);
  
  if (isNaN(amount) || amount <= 0) return null;
  
  return { amount, currency };
}

/**
 * Parse miles string into number
 * Handles: "130,127 miles", "130127", etc.
 */
function parseMiles(milesText: string): number | null {
  if (!milesText) return null;
  
  const numericMatch = milesText.match(/[\d,]+/);
  if (!numericMatch) return null;
  
  const numericStr = numericMatch[0].replace(/,/g, '');
  const miles = parseInt(numericStr, 10);
  
  return isNaN(miles) ? null : miles;
}

/**
 * Parse nights from text like "(3 nights)"
 */
function parseNights(text: string): number | null {
  const match = text.match(/(\d+)\s*(?:night|nights)/i);
  return match ? parseInt(match[1], 10) : null;
}

// ============================================
// DOM QUERY UTILITIES
// ============================================

/**
 * Find element by multiple selector strategies
 */
function findElement(
  selectors: string[],
  container: Element | Document = document
): Element | null {
  for (const selector of selectors) {
    const el = container.querySelector(selector);
    if (el) return el;
  }
  return null;
}

/**
 * Find all elements matching any selector
 */
function findElements(
  selectors: string[],
  container: Element | Document = document
): Element[] {
  const results: Element[] = [];
  for (const selector of selectors) {
    results.push(...Array.from(container.querySelectorAll(selector)));
  }
  return results;
}

/**
 * Find element containing specific text
 */
function findElementByText(
  text: string | RegExp,
  tagName: string = '*',
  container: Element | Document = document
): Element | null {
  const elements = container.querySelectorAll(tagName);
  const pattern = typeof text === 'string' ? new RegExp(text, 'i') : text;
  
  for (const el of elements) {
    const elText = el.textContent?.trim() || '';
    if (pattern.test(elText)) return el;
  }
  return null;
}

/**
 * Get text content safely
 */
function getTextContent(el: Element | null): string {
  return el?.textContent?.trim() || '';
}

/**
 * Check if text looks like a form step header (not a hotel name)
 * These are things like "Step 1: Primary Traveler Information", "Traveler Details", etc.
 */
function isFormStepHeader(text: string): boolean {
  if (!text) return false;
  
  const formStepPatterns = [
    /^step\s*\d+/i,
    /traveler\s*(information|details)/i,
    /contact\s*(information|details)/i,
    /payment\s*(information|details|method)/i,
    /billing\s*(information|details|address)/i,
    /review\s*(and\s*)?(book|confirm|pay)/i,
    /confirm\s*(and\s*)?(book|pay)/i,
    /checkout/i,
    /booking\s*details/i,
    /rewards?\s*(&|and)?\s*payment/i,
    /primary\s*traveler/i,
    /guest\s*details/i,
    /enter\s*(all\s*)?required/i,
    /select\s*(or\s*)?add/i,
    /your\s*(?:trip|booking|reservation)\s*(?:details|summary)?$/i,
    // Checkout page section headers that are NOT hotel names
    /^apply\s*(?:travel\s*)?credits?$/i,                    // "Apply travel credits"
    /^select\s*an?\s*account$/i,                            // "Select an account"
    /^choose\s*(?:your\s*)?(?:payment|rewards?)/i,          // "Choose payment"
    /^combine\s*(?:travel\s*)?(?:offers|rewards?|credits?)/i, // "Combine travel offers..."
    /^your\s*premier\s*collection\s*benefits/i,             // "Your Premier Collection Benefits"
    /^included\s*in\s*your/i,                               // "Included in your travel credit balance"
    /^need\s*to\s*know$/i,                                  // "Need to know" (checkout section)
    /^what\s*(?:you\s*)?(?:need\s*to\s*)?know$/i,           // "What you need to know"
    /^important\s*(?:information|details)/i,                // "Important information"
    /^trip\s*(?:details|summary)$/i,                        // "Trip details", "Trip summary"
    /^room\s*(?:details|information)$/i,                    // "Room details"
    /^property\s*(?:details|information|rules)$/i,          // "Property details"
    // Capital One specific section headers
    /add\s*(?:one\s*of\s*)?your\s*(?:capital\s*one\s*)?(?:credit\s*)?cards?/i, // "Add one of your Capital One credit cards"
    /select\s*(?:a\s*)?payment/i,                           // "Select a payment"
    /add\s*a?\s*new\s*card/i,                               // "Add a new card"
    /saved\s*cards?/i,                                      // "Saved cards"
    /payment\s*options?/i,                                  // "Payment options"
  ];
  
  for (const pattern of formStepPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if text looks like a policy/refund statement rather than a hotel name
 * E.g., "Fully refundable by hotel until Mar 3" should NOT be captured as hotel name
 */
function isPolicyOrRefundText(text: string): boolean {
  if (!text) return false;
  
  const policyPatterns = [
    /^(?:fully|non|partially)\s*refundable/i,           // "Fully refundable...", "Non-refundable..."
    /refundable\s*(?:by|until|before|through)/i,        // "...refundable by hotel until..."
    /(?:free|no)\s*cancellation/i,                      // "Free cancellation..."
    /cancel(?:lation)?\s*(?:policy|before|by|until)/i,  // "Cancellation policy", "Cancel by..."
    /(?:until|before|by)\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*\d/i, // "until Mar 3"
    /(?:check.?in|check.?out)\s*(?:time|:\s*\d)/i,      // "Check-in time:", "Check-out: 11am"
    /(?:property|resort)\s*fee/i,                       // "Property fee", "Resort fee"
    /taxes?\s*(?:&|and)?\s*fees?/i,                     // "Taxes & fees"
    /(?:due|pay)\s*(?:today|now|at|upon)/i,             // "Due today", "Pay at check-in"
    /^(?:gallery|about|amenities|choose\s*room|reviews?|location|policies)$/i,  // Tab labels
    /per\s*night/i,                                     // "$XXX per night"
    /^\$[\d,]+/,                                        // "$2,891" (price)
    /^\d+\s*(?:night|guest|room|star)/i,               // "4 nights", "4 guests", "3 stars"
    /^(?:see\s*all|view\s*all|show\s*all)/i,           // "See all photos"
    /^back\s*to/i,                                      // "Back to results"
    /earn\s*\d+x?\s*miles/i,                           // "Earn 10x miles"
  ];
  
  for (const pattern of policyPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if text is a valid hotel name candidate
 */
function isValidHotelName(text: string): boolean {
  if (!text) return false;
  if (text.length < 4 || text.length > 100) return false;
  if (isFormStepHeader(text)) return false;
  if (isPolicyOrRefundText(text)) return false;
  
  // Skip if it's just a location (ends with state/country abbreviation)
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,?\s*[A-Z]{2}(?:,?\s*USA?)?$/i.test(text)) return false;
  if (/^[A-Z][a-z]+\s+City$/i.test(text)) return false;
  
  // Skip concatenated text (hotel name + star rating + city)
  // These patterns indicate text from a parent element, not just the hotel name
  if (/\d\s*stars?\s*[A-Z]/i.test(text)) return false;  // "5 starsBoston"
  if (/[a-z]\d\s*stars?/i.test(text)) return false;     // "Commonwealth5 stars"
  
  // Skip extension's own UI text patterns
  // The extension displays "Hotel Booking • Boston, MA, USA" in its badge
  if (text.includes('•')) return false;                 // Bullet separator used in extension UI
  if (/\d{4}-\d{2}-\d{2}/.test(text)) return false;    // Date pattern YYYY-MM-DD
  if (/booking\s*captured/i.test(text)) return false;  // "Booking captured" notification
  if (/compare\s*direct/i.test(text)) return false;    // "Compare Direct" button
  
  // Explicit Capital One / payment related text filter
  // These are NEVER hotel names
  const paymentRelatedPatterns = [
    /capital\s*one/i,                    // Anything mentioning "Capital One"
    /credit\s*cards?/i,                  // "credit card", "credit cards"
    /add\s*(?:a\s*)?(?:new\s*)?card/i,   // "Add a card", "Add new card"
    /select\s*(?:a\s*)?card/i,           // "Select a card"
    /saved\s*cards?/i,                   // "Saved cards"
    /payment\s*(?:method|option)/i,      // "Payment method"
    /rewards?\s*(?:&|and)?\s*payment/i,  // "Rewards & payment"
    /enter\s*(?:all\s*)?required/i,      // "Enter all required"
    /confirm\s*and\s*book/i,             // "Confirm and Book"
    /traveler\s*information/i,           // "Traveler Information"
    /primary\s*traveler/i,               // "Primary Traveler"
    /earn\s*\d+x?\s*(?:miles\s*)?on/i,   // "Earn 10X on hotels" - promotional text
    /\d+x\s*(?:miles\s*)?on\s*/i,        // "10X on hotels"
    /miles\s*on\s*(?:hotel|flight)/i,    // "miles on hotel bookings"
    /your\s*venture\s*x/i,               // "your Venture X card"
    /premier\s*(?:&|and)?\s*lifestyle/i, // "Premier & Lifestyle Collections"
    /collection[s]?\s*(?:benefit|with)/i, // "Collection Benefits"
    /phone\s*\n/i,                        // "Phone" followed by newline (form label)
    /edit\s*\n/i,                         // "Edit" followed by newline
    /your\s*premier\s*collection/i,       // "Your Premier Collection Benefits"
  ];
  
  for (const pattern of paymentRelatedPatterns) {
    if (pattern.test(text)) {
      console.log('[StaysCapture] Filtered out payment-related text:', text);
      return false;
    }
  }
  
  // Skip if text contains newlines (indicates concatenated multi-line content)
  if (text.includes('\n') && text.split('\n').length > 2) {
    console.log('[StaysCapture] Filtered out multi-line text:', text.substring(0, 50));
    return false;
  }
  
  return true;
}

/**
 * Find value near a label
 */
function findValueNearLabel(
  labelPattern: string | RegExp,
  container: Element | Document = document
): string | null {
  const labelEl = findElementByText(labelPattern, '*', container);
  if (!labelEl) return null;
  
  // Check next sibling
  const nextSibling = labelEl.nextElementSibling;
  if (nextSibling) {
    const text = getTextContent(nextSibling);
    if (text && text.length < 100) return text;
  }
  
  // Check parent's children
  const parent = labelEl.parentElement;
  if (parent) {
    for (const child of parent.children) {
      if (child === labelEl) continue;
      const text = getTextContent(child);
      if (text && /\$|[\d,]+/.test(text)) return text;
    }
  }
  
  return null;
}

// ============================================
// PROPERTY NAME HEURISTIC EXTRACTION
// Dynamic, site-agnostic property name detection
// Similar to priceHeuristics.ts but for text names
// ============================================

interface PropertyNameCandidate {
  text: string;
  score: number;
  confidence: ConfidenceLevel;
  element: Element;
  reasons: string[];
  penalties: string[];
}

/**
 * Extract property name candidates using heuristic scoring
 * NO hardcoded brand names - uses structural and semantic signals only
 */
function extractPropertyNameCandidates(pageType: StayPageType): PropertyNameCandidate[] {
  const candidates: PropertyNameCandidate[] = [];
  
  // Walk through all potential name elements
  const elements = document.querySelectorAll('h1, h2, h3, h4, span, div, p');
  
  for (const el of elements) {
    // Skip elements inside extension UI
    if (isInsideExtensionUI(el)) continue;
    
    // Skip elements with too many children (containers, not labels)
    if (el.children.length > 3) continue;
    
    // Get DIRECT text content only (not from nested children)
    let directText = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const nodeText = node.textContent?.trim() || '';
        if (nodeText) directText += (directText ? ' ' : '') + nodeText;
      }
    }
    
    // If no direct text, only use full text for leaf elements
    const text = directText || (el.children.length === 0 ? getTextContent(el) : '');
    
    // Skip empty, too short, or too long
    if (!text || text.length < 5 || text.length > 80) continue;
    
    // Skip if contains obvious garbage
    if (text.includes('\n') || text.includes('•') || text.includes('|')) continue;
    if (/\d{4}-\d{2}-\d{2}/.test(text)) continue; // Date pattern
    if (/^\$/.test(text) || /\$\d/.test(text)) continue; // Price
    if (/^\d+$/.test(text)) continue; // Just numbers
    
    // Score the candidate
    const scoreResult = scorePropertyNameCandidate(el, text, pageType);
    
    if (scoreResult.score > 0) {
      candidates.push({
        text,
        score: scoreResult.score,
        confidence: scoreResult.confidence,
        element: el,
        reasons: scoreResult.reasons,
        penalties: scoreResult.penalties,
      });
    }
  }
  
  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  
  // Log top candidates for debugging
  if (candidates.length > 0) {
    console.log('[StaysCapture] Top property name candidates:');
    candidates.slice(0, 5).forEach((c, i) => {
      console.log(`  ${i + 1}. "${c.text}" score=${c.score} +[${c.reasons.join(',')}] -[${c.penalties.join(',')}]`);
    });
  }
  
  return candidates;
}

/**
 * Score a property name candidate using ONLY structural and semantic signals
 * NO hardcoded brand names - this is fully dynamic
 */
function scorePropertyNameCandidate(
  el: Element,
  text: string,
  pageType: StayPageType
): { score: number; confidence: ConfidenceLevel; reasons: string[]; penalties: string[] } {
  let score = 50; // Base score
  const reasons: string[] = [];
  const penalties: string[] = [];
  const textLower = text.toLowerCase();
  
  // ========== POSITIVE SIGNALS (Structural) ==========
  
  // H1-H3 elements are more likely to be property names
  const tagName = el.tagName.toLowerCase();
  if (tagName === 'h1') {
    score += 25;
    reasons.push('h1');
  } else if (tagName === 'h2') {
    score += 20;
    reasons.push('h2');
  } else if (tagName === 'h3') {
    score += 15;
    reasons.push('h3');
  }
  
  // Large font size (property names are usually prominent)
  const computedStyle = window.getComputedStyle(el);
  const fontSize = parseFloat(computedStyle.fontSize);
  if (fontSize >= 20) {
    score += 15;
    reasons.push(`font${Math.round(fontSize)}px`);
  } else if (fontSize >= 16) {
    score += 8;
    reasons.push('medFont');
  }
  
  // Bold text
  const fontWeight = parseInt(computedStyle.fontWeight, 10) || 400;
  if (fontWeight >= 600) {
    score += 10;
    reasons.push('bold');
  }
  
  // ========== POSITIVE SIGNALS (Semantic) ==========
  
  // Check aria-label and data-testid
  const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
  const testId = el.getAttribute('data-testid')?.toLowerCase() || '';
  const classAttr = el.className?.toString().toLowerCase() || '';
  
  if (/property|hotel|lodging|name|title/i.test(ariaLabel)) {
    score += 25;
    reasons.push('ariaLabel');
  }
  
  if (/property|hotel|lodging|name|title/i.test(testId)) {
    score += 25;
    reasons.push('testId');
  }
  
  if (/property|hotel|lodging|name|title/i.test(classAttr)) {
    score += 15;
    reasons.push('className');
  }
  
  // ========== POSITIVE SIGNALS (Contextual) ==========
  
  // Near star rating element (property name is often near stars)
  const nearbyText = getNearbyTextContent(el, 2);
  const nearbyLower = nearbyText.toLowerCase();
  if (/★|star|stars|\d\s*star/i.test(nearbyLower)) {
    score += 20;
    reasons.push('nearStars');
  }
  
  // Near check-in/check-out dates
  if (/check.?in|check.?out/i.test(nearbyLower)) {
    score += 15;
    reasons.push('nearDates');
  }
  
  // In a card/summary container
  const inCardContainer = !!el.closest('[class*="card"], [class*="Card"], [class*="summary"], [class*="Summary"], [class*="property"], [class*="Property"]');
  if (inCardContainer) {
    score += 15;
    reasons.push('inCard');
  }
  
  // Near an image (property summaries usually have images)
  const nearImage = el.closest('section, article, div')?.querySelector('img');
  if (nearImage) {
    score += 10;
    reasons.push('nearImg');
  }
  
  // Checkout page boost
  if (pageType === 'checkout' || pageType === 'customize') {
    score += 10;
    reasons.push('checkoutPage');
  }
  
  // ========== POSITIVE SIGNALS (Text Pattern) ==========
  
  // Proper noun pattern: 2-5 Title Case words
  const words = text.split(/\s+/);
  const titleCaseWords = words.filter(w => /^[A-Z][a-z]/.test(w));
  if (words.length >= 2 && words.length <= 5 && titleCaseWords.length >= words.length * 0.6) {
    score += 15;
    reasons.push('titleCase');
  }
  
  // Contains common property name words (generic, not brand-specific)
  if (/hotel|inn|suites?|resort|lodge|villa|house|palace|residences?|collection/i.test(textLower)) {
    score += 25;
    reasons.push('hotelWord');
  }
  
  // Starts with "The" (common for hotels)
  if (/^the\s+/i.test(text)) {
    score += 10;
    reasons.push('startsThe');
  }
  
  // ========== NEGATIVE SIGNALS ==========
  
  // Form step headers
  if (isFormStepHeader(text)) {
    score -= 100;
    penalties.push('formHeader');
  }
  
  // Policy text
  if (isPolicyOrRefundText(text)) {
    score -= 100;
    penalties.push('policyText');
  }
  
  // Section headers (generic patterns)
  if (/^step\s*\d|^your\s|^select\s|^choose\s|^enter\s|^add\s|^primary\s|^contact\s|^payment\s|^billing/i.test(text)) {
    score -= 80;
    penalties.push('sectionHeader');
  }
  
  // FAQ/instructions
  if (/question|instruction|faq|how\s+to|what\s+is|frequently/i.test(textLower)) {
    score -= 80;
    penalties.push('faqText');
  }
  
  // Button/action text
  if (/confirm|book\s+now|continue|submit|select|choose|view\s+details/i.test(textLower)) {
    score -= 60;
    penalties.push('buttonText');
  }
  
  // Capital One / Venture X specific
  if (/capital\s*one|venture|credit|card|miles|rewards|earn\s*\d+x/i.test(textLower)) {
    score -= 100;
    penalties.push('capitalOne');
  }
  
  // Navigation text
  if (/gallery|amenities|reviews?|location|policies|details|about|overview/i.test(textLower) && words.length <= 2) {
    score -= 50;
    penalties.push('navText');
  }
  
  // Contact/form labels
  if (/phone|email|address|name|edit|delete|add\s+new/i.test(textLower) && words.length <= 3) {
    score -= 60;
    penalties.push('formLabel');
  }
  
  // Room type (not property name)
  if (/room|queen|king|bed|suite/i.test(textLower) && words.length <= 4 && !/hotel|inn|resort/i.test(textLower)) {
    score -= 40;
    penalties.push('roomType');
  }
  
  // Price-related
  if (/\$|price|cost|fee|total|tax|due/i.test(textLower)) {
    score -= 70;
    penalties.push('priceText');
  }
  
  // Date-related
  if (/night|check.?in|check.?out|arrival|departure|\d+\s*nights/i.test(textLower) && !/hotel|inn/i.test(textLower)) {
    score -= 40;
    penalties.push('dateText');
  }
  
  // Hidden or very small
  if (!isElementVisible(el)) {
    score -= 50;
    penalties.push('hidden');
  }
  if (fontSize < 12) {
    score -= 30;
    penalties.push('smallFont');
  }
  
  // Determine confidence based on score
  let confidence: ConfidenceLevel = 'LOW';
  if (score >= 100 && reasons.length >= 3) {
    confidence = 'HIGH';
  } else if (score >= 70 && reasons.length >= 2) {
    confidence = 'MED';
  }
  
  return { score: Math.max(0, score), confidence, reasons, penalties };
}

/**
 * Get text content from nearby elements for context
 */
function getNearbyTextContent(el: Element, depth: number = 2): string {
  const texts: string[] = [];
  
  // Parent chain
  let current: Element | null = el;
  for (let i = 0; i < depth && current; i++) {
    const parentEl: Element | null = current.parentElement;
    if (parentEl) {
      for (const child of parentEl.children) {
        const t = child.textContent?.trim();
        if (t && t.length < 100) texts.push(t);
      }
      current = parentEl;
    } else {
      break;
    }
  }
  
  // Siblings
  if (el.previousElementSibling) {
    texts.push(el.previousElementSibling.textContent?.trim() || '');
  }
  if (el.nextElementSibling) {
    texts.push(el.nextElementSibling.textContent?.trim() || '');
  }
  
  return texts.filter(Boolean).join(' ');
}

/**
 * Check if element is inside extension UI
 */
function isInsideExtensionUI(el: Element): boolean {
  return !!(
    el.closest('#vx-direct-helper') ||
    el.closest('#vx-auto-compare-widget') ||
    el.closest('[class*="venturex"]') ||
    el.closest('[class*="VentureX"]') ||
    el.closest('[id^="vx-"]')
  );
}

/**
 * Check if element is visible
 */
function isElementVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) < 0.1) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  return true;
}

// ============================================
// PROPERTY DETAILS EXTRACTION
// ============================================

function extractPropertyDetails(pageType: StayPageType): StayPropertyDetails | null {
  let propertyName = '';
  let propertyId: string | undefined;
  let city = '';
  let address = '';
  let starRating: number | undefined;
  let guestRating: number | undefined;
  let reviewCount: number | undefined;
  let brandName: string | undefined;
  let confidence: ConfidenceLevel = 'MED';
  
  console.log('[StaysCapture] Extracting property details for page type:', pageType);
  
  // Get full page text for pattern matching
  const propPageText = document.body.innerText;
  
  // ==========================================
  // STRATEGY -2: Use Selector Registry (HIGHEST PRIORITY)
  // The extraction pipeline registry has pre-defined selectors for Capital One
  // ==========================================
  const hostname = window.location.hostname;
  const siteConfig = getSelectorConfig(hostname);
  
  if (siteConfig && siteConfig.selectors.propertyName) {
    console.log('[StaysCapture] Using selector registry for property name extraction');
    const propertyNameSelectors = siteConfig.selectors.propertyName;
    
    for (const selector of propertyNameSelectors) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          const text = getTextContent(el);
          if (text && isValidHotelName(text)) {
            propertyName = text;
            confidence = 'HIGH';
            console.log('[StaysCapture] Found property name from registry selector:', selector, '->', propertyName);
            break;
          }
        }
      } catch (e) {
        // Selector might be invalid, continue to next
        console.warn('[StaysCapture] Invalid selector:', selector, e);
      }
    }
  }
  
  // Also try to get effective selectors (includes user overrides)
  if (!propertyName) {
    getEffectiveSelectors(hostname, 'propertyName').then(selectors => {
      if (selectors.length > 0) {
        console.log('[StaysCapture] Effective selectors for propertyName:', selectors);
      }
    }).catch(() => {
      // Ignore errors from async call
    });
  }
  
  // ==========================================
  // STRATEGY -1: Extract lodgingId from URL (useful for identification)
  // ==========================================
  const urlParams = new URLSearchParams(window.location.search);
  const lodgingId = urlParams.get('lodgingId');
  if (lodgingId) {
    propertyId = lodgingId;
    console.log('[StaysCapture] Found lodgingId from URL:', propertyId);
  }
  
  // ==========================================
  // STRATEGY 0: URL-based extraction
  // The URL slug sometimes contains the actual property name
  // BUT we must skip navigation segments like "book", "shop", "availability"
  // ==========================================
  
  // Common path segments that are NOT hotel names
  const navigationSegments = new Set([
    'book', 'shop', 'availability', 'customize', 'checkout', 'search',
    'results', 'details', 'reserve', 'confirm', 'payment', 'review'
  ]);
  
  // Extract from URL path - handles /stays/, /hotels/, /premium-stays/, /vacation-rentals/ patterns
  // Look for actual hotel name slugs in the path
  const pathSegments = window.location.pathname.split('/').filter(Boolean);
  
  // Find segments after the category (stays/hotels/premium-stays/vacation-rentals)
  let foundCategory = false;
  for (const segment of pathSegments) {
    const segLower = segment.toLowerCase();
    
    // Start looking after we pass the category
    if (['stays', 'hotels', 'premium-stays', 'vacation-rentals'].includes(segLower)) {
      foundCategory = true;
      continue;
    }
    
    // Skip navigation segments
    if (!foundCategory || navigationSegments.has(segLower)) {
      continue;
    }
    
    // Skip UUIDs (they contain mostly hex chars with dashes)
    if (/^[a-f0-9-]{20,}$/i.test(segment)) {
      continue;
    }
    
    // Skip if it's too short (likely a code, not a name)
    if (segment.length < 4) {
      continue;
    }
    
    // This looks like a hotel name slug!
    propertyName = decodeURIComponent(segment)
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();
    confidence = 'HIGH';
    console.log('[StaysCapture] Found property name from URL slug:', propertyName);
    break;
  }
  
  // ==========================================
  // STRATEGY 0.5: Shop/Checkout page specific - look for main page header
  // On shop pages (room selection) and checkout pages, the hotel name is typically the main h1
  // or in a booking summary card. These strategies look for hotel-like names.
  // ==========================================
  
  const shouldSearchHeadings = pageType === 'shop' || pageType === 'checkout' || pageType === 'customize';
  if (!propertyName && shouldSearchHeadings) {
    console.log('[StaysCapture]', pageType, 'page - looking for main header...');
    
    // Use extraction pipeline's heuristic approach - dynamic scoring without hardcoded names
    // Similar to priceHeuristics.ts but for property names
    if (!propertyName) {
      const candidates = extractPropertyNameCandidates(pageType);
      if (candidates.length > 0) {
        propertyName = candidates[0].text;
        confidence = candidates[0].confidence;
        console.log('[StaysCapture] Property name from heuristic extraction:', propertyName, 'score:', candidates[0].score);
      }
    }
    
    // PRIORITY -2: DIRECT TEXT SEARCH for "Hotel [Name]" pattern using TreeWalker
    if (!propertyName) {
      // Walk the DOM looking for text nodes that match hotel name patterns
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const text = node.textContent?.trim() || '';
            // Look for patterns like "Hotel Commonwealth", "The Ritz-Carlton", etc.
            // Must be between 10-50 chars and look like a hotel name (strict)
            if (text.length >= 10 && text.length <= 50) {
              // Match "Hotel [Name]" strictly
              if (/^Hotel\s+[A-Z][a-zA-Z]+(?:\s+[A-Z]?[a-zA-Z]*)*$/i.test(text)) {
                // Make sure it's not inside a form field or button
                const parent = node.parentElement;
                if (parent && !['INPUT', 'TEXTAREA', 'BUTTON', 'A'].includes(parent.tagName)) {
                  return NodeFilter.FILTER_ACCEPT;
                }
              }
            }
            return NodeFilter.FILTER_REJECT;
          }
        }
      );
      
      let textNode;
      while ((textNode = walker.nextNode())) {
        const text = textNode.textContent?.trim() || '';
        if (text && !text.includes('\n') && !/\d/.test(text) && isValidHotelName(text)) {
          propertyName = text;
          confidence = 'HIGH';
          console.log('[StaysCapture] Found property name from direct text search:', propertyName);
          break;
        }
      }
    }
    
    // PRIORITY -1.5: Look for elements containing "Hotel" text that are headings or title-like
    // Be VERY careful to only get direct text content, not aggregated from children
    if (!propertyName) {
      const hotelTextElements = document.querySelectorAll('h1, h2, h3, h4, h5, span, div, p');
      for (const el of hotelTextElements) {
        // STRATEGY A: Get DIRECT text content only (not from children)
        // This prevents getting "Hotel Commonwealth5 starsBoston" from parent
        const directText = Array.from(el.childNodes)
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent?.trim() || '')
          .join(' ')
          .trim();
        
        // STRATEGY B: If element has NO child elements, get full text
        const hasNoChildren = el.children.length === 0;
        const fullText = hasNoChildren ? getTextContent(el) : '';
        
        // Prefer direct text, fall back to full text only if no children
        const textToCheck = directText || fullText;
        
        // Skip if empty or too long
        if (!textToCheck || textToCheck.length < 5 || textToCheck.length > 60) continue;
        
        // Must look like a hotel name: "Hotel [Name]" or "[Name] Hotel"
        // Be strict - must match specific patterns
        const isHotelPattern = /^Hotel\s+[A-Z][a-zA-Z\s&'\-]+$/i.test(textToCheck) ||
                              /^[A-Z][a-zA-Z\s&'\-]+\s+Hotel$/i.test(textToCheck) ||
                              /^The\s+[A-Z][a-zA-Z\s&'\-]+$/i.test(textToCheck);
        
        // Also match known luxury brand patterns with clean text (no extra stuff)
        const isLuxuryBrand = /^(?:Montage|Four Seasons|Ritz-Carlton|St\.\s*Regis|Park Hyatt|Waldorf|Mandarin Oriental|Peninsula|Aman|Rosewood|Stein Eriksen|Auberge|Pendry|Thompson|Edition|1 Hotel|Faena|Limelight)\s*[A-Za-z\s&'\-]*$/i.test(textToCheck);
        
        if ((isHotelPattern || isLuxuryBrand) && isValidHotelName(textToCheck)) {
          propertyName = textToCheck;
          confidence = 'HIGH';
          console.log('[StaysCapture] Found property name from Hotel text element:', propertyName);
          break;
        }
      }
    }
    
    // PRIORITY -1: Look for star rating pattern and get the hotel name NEAR it
    // On Capital One checkout page, the structure is:
    //   "★ 5 stars Boston" (star rating with city)
    //   "Hotel Commonwealth" (hotel name is BELOW the star rating!)
    // This is the MOST RELIABLE method!
    if (!propertyName) {
      // Use a more targeted approach - look for SMALL elements with star rating text
      const allElements = document.querySelectorAll('span, div, p');
      for (const el of allElements) {
        // Get DIRECT text only to find the actual star rating element
        const directText = Array.from(el.childNodes)
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent?.trim() || '')
          .join(' ')
          .trim();
        
        const text = directText || getTextContent(el);
        // Match "★ N stars" pattern (with optional city after)
        if (/★\s*\d\s*stars?/i.test(text) && text.length < 50 && el.children.length < 3) {
          console.log('[StaysCapture] Found star rating element:', text);
          
          // STRATEGY A: Look in PARENT container for hotel name
          // The hotel name is usually a sibling or nearby element in the same card
          let parent = el.parentElement;
          for (let depth = 0; depth < 6 && parent && !propertyName; depth++) {
            // Look for all text elements in this container
            const textElements = parent.querySelectorAll('h1, h2, h3, h4, h5, span, div, p');
            for (const textEl of textElements) {
              const textContent = getTextContent(textEl);
              // Skip the star rating itself, addresses, and short text
              if (textContent &&
                  textContent !== text &&
                  !textContent.includes('★') &&
                  !textContent.includes('Check-in') &&
                  !textContent.includes('Check-out') &&
                  !/^\d+\s+[A-Za-z]+\s+(Ave|St|Rd|Blvd|Dr|Way|Lane|Place|Court)/i.test(textContent) && // Skip addresses
                  isValidHotelName(textContent)) {
                propertyName = textContent;
                confidence = 'HIGH';
                console.log('[StaysCapture] Found property name near star rating:', propertyName);
                break;
              }
            }
            if (propertyName) break;
            parent = parent.parentElement;
          }
          
          // STRATEGY B: Check next siblings directly
          if (!propertyName) {
            let nextEl = el.nextElementSibling;
            let sibCount = 0;
            while (nextEl && !propertyName && sibCount < 5) {
              const nextText = getTextContent(nextEl);
              if (nextText && isValidHotelName(nextText)) {
                propertyName = nextText;
                confidence = 'HIGH';
                console.log('[StaysCapture] Found property name as next sibling of star rating:', propertyName);
                break;
              }
              nextEl = nextEl.nextElementSibling;
              sibCount++;
            }
          }
          
          if (propertyName) break;
        }
      }
    }
    
    // PRIORITY 0: On checkout pages, look for hotel name in the LEFT SUMMARY PANEL
    // This is the card with the hotel image, name, address, and dates - most reliable source!
    // The summary panel usually contains the hotel image followed by the name
    if (!propertyName && (pageType === 'checkout' || pageType === 'customize')) {
      // Look for elements that contain check-in/check-out dates - hotel name is usually nearby
      const checkInEl = findElementByText(/check.?in/i, 'span, div');
      if (checkInEl) {
        // Walk up to find the card container
        let cardContainer = checkInEl.closest('section, article, [class*="card"], [class*="summary"], [class*="booking"]');
        if (!cardContainer) {
          // Try parent traversal up to 5 levels
          let parent = checkInEl.parentElement;
          for (let i = 0; i < 5 && parent; i++) {
            const parentClass = parent.className?.toLowerCase() || '';
            if (parentClass.includes('card') || parentClass.includes('summary') || parentClass.includes('booking') || parentClass.includes('property')) {
              cardContainer = parent;
              break;
            }
            parent = parent.parentElement;
          }
        }
        
        if (cardContainer) {
          // Find the most prominent heading in this card
          const cardHeadings = cardContainer.querySelectorAll('h1, h2, h3, h4, [class*="title"], [class*="name"]');
          for (const heading of cardHeadings) {
            const text = getTextContent(heading);
            if (text && isValidHotelName(text)) {
              propertyName = text;
              confidence = 'HIGH';
              console.log('[StaysCapture] Found property name from checkout summary card:', propertyName);
              break;
            }
          }
        }
      }
      
      // Also try looking near hotel images
      if (!propertyName) {
        const hotelImages = document.querySelectorAll('img[src*="hotel"], img[src*="lodging"], img[alt*="hotel" i], img[alt*="property" i]');
        for (const img of hotelImages) {
          const imgParent = img.closest('section, article, div');
          if (imgParent) {
            const nearbyHeadings = imgParent.querySelectorAll('h1, h2, h3, h4');
            for (const heading of nearbyHeadings) {
              const text = getTextContent(heading);
              if (text && isValidHotelName(text)) {
                propertyName = text;
                confidence = 'HIGH';
                console.log('[StaysCapture] Found property name near hotel image:', propertyName);
                break;
              }
            }
            if (propertyName) break;
          }
        }
      }
    }
    
    // PRIORITY 1: Look for "About the [Hotel Name]" pattern - this is VERY reliable on Capital One
    // The section heading "About the Limelight Mammoth" or "About the Stein Eriksen Residences" always contains the real hotel name
    if (!propertyName) {
      const aboutPattern = /About\s+the\s+(.+)/i;
      const allHeadings = document.querySelectorAll('h1, h2, h3, h4');
      for (const heading of allHeadings) {
        const text = getTextContent(heading);
        const aboutMatch = text.match(aboutPattern);
        if (aboutMatch && aboutMatch[1]) {
          const extractedName = aboutMatch[1].trim();
          // Make sure it's a valid hotel name (not a policy, location, or generic text)
          if (isValidHotelName(extractedName)) {
            propertyName = extractedName;
            confidence = 'HIGH';
            console.log('[StaysCapture] Found property name from "About the..." heading:', propertyName);
            break;
          }
        }
      }
    }
    
    // PRIORITY 2: Look for the FIRST valid heading (h1 preferred, then h2, h3)
    // The hotel name is almost always the most prominent heading that's NOT a policy/nav text
    // This works for ANY hotel name without hardcoded brand lists
    if (!propertyName) {
      // Sort headings by prominence: h1 > h2 > h3 > h4
      const headingsByLevel = [
        ...document.querySelectorAll('h1'),
        ...document.querySelectorAll('h2'),
        ...document.querySelectorAll('h3'),
        ...document.querySelectorAll('h4'),
      ];
      
      for (const heading of headingsByLevel) {
        const text = getTextContent(heading);
        // CRITICAL: Use isValidHotelName to filter out policy text, prices, nav items
        if (text && isValidHotelName(text)) {
          // Skip if it's the "About the..." heading (we extract from INSIDE that)
          if (/^about\s+the\s+/i.test(text)) continue;
          // Skip if it's clearly navigation (Gallery, Amenities, etc.)
          if (/^(?:gallery|amenities|reviews?|location|policies|rooms?|photos?)$/i.test(text)) continue;
          
          propertyName = text;
          confidence = 'HIGH';
          console.log('[StaysCapture] Found property name from prominent heading:', propertyName);
          break;
        }
      }
    }
    
    // PRIORITY 3: On shop/checkout pages, the hotel name is usually the prominent h1 at the top
    // or displayed prominently in a property card/header section
    if (!propertyName) {
      const shopPageSelectors = [
        // Main page header h1 (most common on shop pages)
        'main h1',
        'header h1',
        '[role="main"] h1',
        // Specific Capital One patterns observed
        '[class*="lodging"] h1',
        '[class*="Lodging"] h1',
        '[class*="property"] h1',
        '[class*="Property"] h1',
        '[class*="hotel-details"] h1',
        '[class*="HotelDetails"] h1',
        // Capital One specific - property header card
        '[class*="PropertyHeader"] h1',
        '[class*="property-header"] h1',
        '[class*="stay-header"] h1',
        '[class*="StayHeader"] h1',
        // Premium stays specific
        '[class*="premium"] h1',
        '[class*="Premium"] h1',
        '[class*="luxury"] h1',
        '[class*="Luxury"] h1',
        // Star rating section often has property name nearby
        '[class*="star-rating"] ~ h1, [class*="StarRating"] ~ h1',
        '[class*="star"] + h1, [class*="Star"] + h1',
        // Generic prominent headings
        'h1[class*="title"]',
        'h1[class*="Title"]',
        'h1[class*="name"]',
        'h1[class*="Name"]',
        // Try first prominent heading in main content area
        'section h1',
        'article h1',
      ];
      
      for (const selector of shopPageSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            const text = getTextContent(el);
            // CRITICAL: Use isValidHotelName to filter out policy text, prices, etc.
            if (text && isValidHotelName(text)) {
              propertyName = text;
              confidence = 'HIGH';
              console.log('[StaysCapture] Found property name from shop page header:', propertyName);
              break;
            }
          }
        } catch (e) {
          // Continue to next selector
        }
      }
    }
    
    // PRIORITY 4 & 5 are now combined into PRIORITY 2 above (structural heading search)
    // No separate keyword-based search needed - structural approach is more robust
  }
  
  // ==========================================
  // STRATEGY 1: Look in the hotel info card/panel
  // On checkout pages, the hotel info is often in a summary card
  // ==========================================
  
  if (!propertyName) {
    // Look for elements near hotel images, star ratings, or address info
    // These are typically in a summary panel, not in form headers
    const hotelCardSelectors = [
      // Look for elements with specific data attributes
      '[data-testid="property-name"]',
      '[data-testid="hotel-name"]',
      '[data-testid="lodging-name"]',
      '[data-testid="lodging-title"]',
      // Look in card/summary sections
      '[class*="property-card"] h1, [class*="property-card"] h2, [class*="property-card"] h3',
      '[class*="PropertyCard"] h1, [class*="PropertyCard"] h2, [class*="PropertyCard"] h3',
      '[class*="hotel-card"] h1, [class*="hotel-card"] h2, [class*="hotel-card"] h3',
      '[class*="HotelCard"] h1, [class*="HotelCard"] h2, [class*="HotelCard"] h3',
      '[class*="summary-card"] h2, [class*="summary-card"] h3',
      '[class*="booking-summary"] h2, [class*="booking-summary"] h3',
      '[class*="trip-summary"] h2, [class*="trip-summary"] h3',
      // Capital One specific patterns
      '[class*="lodging-header"] h1, [class*="lodging-header"] h2',
      '[class*="LodgingHeader"] h1, [class*="LodgingHeader"] h2',
      // Look near images (hotel summary usually has an image)
      'img[alt*="hotel" i] ~ h2, img[alt*="hotel" i] ~ h3',
      'img[alt*="property" i] ~ h2, img[alt*="property" i] ~ h3',
    ];
    
    for (const selector of hotelCardSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = getTextContent(el);
        // Use isValidHotelName for consistent validation
        if (text && isValidHotelName(text)) {
          propertyName = text;
          confidence = 'HIGH';
          console.log('[StaysCapture] Found property name from hotel card:', propertyName);
          break;
        }
      }
    }
  }
  
  // ==========================================
  // STRATEGY 2: Text-based search with filtering
  // Look for hotel-like names near addresses or star ratings
  // ==========================================
  
  if (!propertyName) {
    // Find elements that contain address patterns (street number + name)
    const addressElements = document.querySelectorAll('*');
    for (const el of addressElements) {
      const text = el.textContent?.trim() || '';
      // Look for address pattern: "123 Street Name, City"
      if (/^\d+\s+[A-Za-z\s]+(?:Ave|St|Rd|Blvd|Dr|Way|Lane|Court|Circle|Place),/.test(text)) {
        // Found an address - look for hotel name in nearby siblings or parent
        const parent = el.parentElement;
        if (parent) {
          // Look at previous siblings and parent's previous children
          const allText = parent.textContent || '';
          // Find the largest text block before the address that looks like a name
          const headings = parent.querySelectorAll('h1, h2, h3, h4, [class*="title"], [class*="name"]');
          for (const heading of headings) {
            const headingText = getTextContent(heading);
            // Use isValidHotelName for consistent validation
            if (headingText && isValidHotelName(headingText)) {
              propertyName = headingText;
              confidence = 'HIGH';
              console.log('[StaysCapture] Found property name near address:', propertyName);
              break;
            }
          }
          if (propertyName) break;
        }
      }
    }
  }
  
  // ==========================================
  // STRATEGY 3: Look for specific hotel brand patterns in text
  // ==========================================
  
  if (!propertyName) {
    const hotelBrandPatterns = [
      // "Hotel [Name]" or "[Name] Hotel" - common naming convention
      /Hotel\s+[A-Z][a-zA-Z\s&'\-]+(?=[,\n]|$)/i,
      /[A-Z][a-zA-Z\s&'\-]+\s+Hotel(?=[,\n]|$)/i,
      // "The [Name]" pattern for boutique hotels
      /The\s+[A-Z][a-zA-Z\s&'\-]+(?=[,\n]|$)/,
      // Premium brands that might not have "Hotel" in name (including Limelight)
      /(?:Montage|Four Seasons|Ritz-Carlton|St\. Regis|Park Hyatt|Waldorf Astoria|Mandarin Oriental|Peninsula|Aman|Rosewood|Stein Eriksen|Auberge|Pendry|Thompson|Edition|1 Hotel|Faena|Limelight)[^,\n]*/i,
      // Major chain patterns
      /(?:Holiday Inn|Hampton Inn|Hilton|Marriott|Hyatt|Sheraton|Westin|Doubletree|Courtyard|Residence Inn|SpringHill Suites|Fairfield Inn)[^,\n]*/i,
      // Generic hotel/resort/residences patterns
      /([A-Z][a-zA-Z\s&']+(?:Inn|Suites|Resort|Lodge|Villa|Villas|Chateau|Palace|Residences|Collection|House)[^,\n]*)/,
    ];
    
    for (const pattern of hotelBrandPatterns) {
      const match = propPageText.match(pattern);
      // Use isValidHotelName to filter out policy text
      if (match && match[0].length < 100 && isValidHotelName(match[0].trim())) {
        propertyName = match[0].trim();
        confidence = 'HIGH';
        console.log('[StaysCapture] Found property name from brand pattern:', propertyName);
        break;
      }
    }
  }
  
  // ==========================================
  // STRATEGY 4: DOM-based extraction with filtering
  // ==========================================
  
  if (!propertyName) {
    // Property name - look for headings but EXCLUDE form step headers and policy text
    const nameSelectors = [
      'h1[data-testid="property-name"]',
      'h1[class*="property-name"]',
      'h1[class*="PropertyName"]',
      '[data-testid="lodging-title"] h1',
      '.property-header h1',
    ];
    
    for (const selector of nameSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = getTextContent(el);
        // Use isValidHotelName for consistent validation
        if (text && isValidHotelName(text)) {
          propertyName = text;
          confidence = 'HIGH';
          break;
        }
      }
    }
  }
  
  // ==========================================
  // STRATEGY 5: Find h2/h3 elements near star ratings
  // ==========================================
  
  if (!propertyName) {
    // Look for star rating element and find nearby hotel name
    const starElements = document.querySelectorAll('[class*="star"], [aria-label*="star"]');
    for (const starEl of starElements) {
      const parent = starEl.closest('div, section, article');
      if (parent) {
        const headings = parent.querySelectorAll('h1, h2, h3, h4');
        for (const heading of headings) {
          const text = getTextContent(heading);
          // Use isValidHotelName for consistent validation
          if (text && isValidHotelName(text)) {
            propertyName = text;
            confidence = 'MED';
            console.log('[StaysCapture] Found property name near star rating:', propertyName);
            break;
          }
        }
        if (propertyName) break;
      }
    }
  }
  
  // Try extracting from breadcrumbs or visible header text if name not found
  if (!propertyName) {
    const breadcrumb = findElementByText(/residence|residences|hotel|inn|suites|marriott|hilton|hyatt|holiday|montage|four seasons|ritz|stein|eriksen|pendry|auberge|thompson|limelight/i, 'span, a, li, h2, h3, h4');
    if (breadcrumb) {
      const text = getTextContent(breadcrumb);
      // Use isValidHotelName for consistent validation
      if (text && isValidHotelName(text)) {
        propertyName = text;
        confidence = 'HIGH';
        console.log('[StaysCapture] Found property name from breadcrumb/header:', propertyName);
      }
    }
  }
  
  // City/Location
  const locationSelectors = [
    '[data-testid="property-location"]',
    '[class*="property-location"]',
    '[class*="PropertyLocation"]',
    '.property-address',
    'address',
  ];
  
  const locationEl = findElement(locationSelectors);
  if (locationEl) {
    const locationText = getTextContent(locationEl);
    // Try to parse city from "123 Main St, City, State"
    const parts = locationText.split(',');
    if (parts.length >= 2) {
      city = parts[parts.length - 2]?.trim() || parts[0]?.trim();
    } else {
      city = locationText;
    }
    address = locationText;
  }
  
  // Star rating - look for patterns like "★ 5 stars" or "5 star" or "5-star"
  // Also check for star ratings near the hotel name (common on shop pages)
  const starPatterns = [
    /★\s*(\d(?:\.\d)?)\s*(?:star|stars)?/i,   // "★ 5 stars"
    /(\d(?:\.\d)?)\s*(?:star|stars|★)/i,      // "5 stars" or "5 ★"
    /star\s*(\d(?:\.\d)?)/i,                   // "star 5"
    /(\d(?:\.\d)?)-star/i,                     // "5-star"
  ];
  
  // First try to find star rating from page text (more reliable)
  for (const pattern of starPatterns) {
    const match = propPageText.match(pattern);
    if (match) {
      const rating = parseFloat(match[1]);
      if (rating >= 1 && rating <= 5) {
        starRating = rating;
        console.log('[StaysCapture] Found star rating from page text:', starRating);
        break;
      }
    }
  }
  
  // Fallback: Look for specific star elements in DOM
  if (!starRating) {
    const starEl = findElementByText(/★?\s*\d\s*stars?/i, 'span, div');
    if (starEl) {
      const starText = getTextContent(starEl);
      for (const pattern of starPatterns) {
        const match = starText.match(pattern);
        if (match) {
          const rating = parseFloat(match[1]);
          if (rating >= 1 && rating <= 5) {
            starRating = rating;
            console.log('[StaysCapture] Found star rating from DOM:', starRating);
            break;
          }
        }
      }
    }
  }
  
  // Guest rating
  const ratingSelectors = [
    '[data-testid="guest-rating"]',
    '[class*="rating-score"]',
    '[class*="ReviewScore"]',
  ];
  
  const ratingEl = findElement(ratingSelectors);
  if (ratingEl) {
    const ratingText = getTextContent(ratingEl);
    const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
    if (ratingMatch) {
      guestRating = parseFloat(ratingMatch[1]);
    }
  }
  
  // Review count
  const reviewEl = findElementByText(/\d+\s*reviews?/i, 'span, div');
  if (reviewEl) {
    const reviewText = getTextContent(reviewEl);
    const reviewMatch = reviewText.match(/([\d,]+)\s*reviews?/i);
    if (reviewMatch) {
      reviewCount = parseInt(reviewMatch[1].replace(/,/g, ''), 10);
    }
  }
  
  // Brand detection
  const brandPatterns = [
    /marriott/i, /hilton/i, /hyatt/i, /ihg/i, /wyndham/i,
    /best western/i, /radisson/i, /accor/i, /choice hotels/i,
  ];
  
  const pageText = document.body.innerText;
  for (const pattern of brandPatterns) {
    if (pattern.test(pageText) || pattern.test(propertyName)) {
      const match = pageText.match(pattern) || propertyName.match(pattern);
      if (match) {
        brandName = match[0].replace(/\b\w/g, c => c.toUpperCase());
        break;
      }
    }
  }
  
  if (!propertyName) {
    return null;
  }
  
  // Determine accommodation type
  const accommodationType = detectAccommodationType(
    window.location.href,
    document.body.innerText
  );
  
  return {
    propertyName,
    propertyId,
    city: city || undefined,
    address: address || undefined,
    starRating,
    guestRating,
    reviewCount,
    brandName,
    accommodationType,
    confidence,
    extractedAt: Date.now(),
  };
}

// ============================================
// ROOM SELECTION EXTRACTION
// ============================================

function extractRoomSelection(): StayRoomSelection | null {
  let roomName = '';
  let refundableLabel: string | undefined;
  let isRefundable: boolean | undefined;
  let mealPlan: string | undefined;
  let perNight: number | undefined;
  let totalCash: number | undefined;
  let totalMiles: number | undefined;
  let currency = 'USD';
  let confidence: ConfidenceLevel = 'MED';
  
  // Room name - look for selected room or room type header
  const roomNameSelectors = [
    '[data-testid="selected-room-name"]',
    '[class*="room-name"]',
    '[class*="RoomName"]',
    '[class*="selected-room"] h2',
    '[class*="selected-room"] h3',
    '.room-selection h2',
    '.room-selection h3',
  ];
  
  const roomNameEl = findElement(roomNameSelectors);
  if (roomNameEl) {
    roomName = getTextContent(roomNameEl);
    confidence = 'HIGH';
  }
  
  // Try finding from "Room type" or "Room:" label
  if (!roomName) {
    const roomLabelValue = findValueNearLabel(/room\s*(?:type)?:?/i);
    if (roomLabelValue) {
      roomName = roomLabelValue;
    }
  }
  
  // Refundable/cancellation policy
  const refundableEl = findElementByText(
    /(?:fully\s*)?refundable|free\s*cancellation|non.?refundable|cancel/i,
    'span, div, p'
  );
  if (refundableEl) {
    refundableLabel = getTextContent(refundableEl);
    isRefundable = /fully\s*refundable|free\s*cancellation/i.test(refundableLabel);
  }
  
  // Meal plan
  const mealEl = findElementByText(
    /breakfast\s*(?:included)?|free\s*breakfast|meal\s*plan/i,
    'span, div, li'
  );
  if (mealEl) {
    mealPlan = getTextContent(mealEl);
  }
  
  // Per night price
  const perNightEl = findElementByText(/per\s*night/i, 'span, div');
  if (perNightEl) {
    // Look for price near this element
    const parent = perNightEl.parentElement;
    if (parent) {
      const priceText = getTextContent(parent);
      const parsed = parsePrice(priceText);
      if (parsed) {
        perNight = parsed.amount;
        currency = parsed.currency;
      }
    }
  }
  
  // Total price for stay
  const totalPatterns = [
    /total\s*(?:for\s*stay)?:?\s*\$?([\d,]+\.?\d*)/i,
    /\$?([\d,]+\.?\d*)\s*(?:\(\d+\s*nights?\))?/i,
  ];
  
  const totalEl = findElementByText(/total|nights?\)/i, 'span, div');
  if (totalEl) {
    const parent = totalEl.parentElement;
    if (parent) {
      const text = getTextContent(parent);
      const parsed = parsePrice(text);
      if (parsed) {
        totalCash = parsed.amount;
        currency = parsed.currency;
      }
    }
  }
  
  // Miles equivalent
  const milesEl = findElementByText(/miles/i, 'span, div');
  if (milesEl) {
    const parent = milesEl.parentElement;
    if (parent) {
      const milesText = getTextContent(parent);
      const miles = parseMiles(milesText);
      if (miles) {
        totalMiles = miles;
      }
    }
  }
  
  if (!roomName) {
    return null;
  }
  
  return {
    roomName,
    refundableLabel,
    isRefundable,
    mealPlan,
    perNight,
    totalCash,
    totalMiles,
    currency,
    confidence,
    extractedAt: Date.now(),
  };
}

// ============================================
// CHECKOUT BREAKDOWN EXTRACTION
// ============================================

function extractCheckoutBreakdown(): StayCheckoutBreakdown | null {
  let roomSubtotal = 0;
  let taxesFees = 0;
  let dueTodayCash = 0; // This should be PRE-credit "Due Today" amount
  let dueTodayMiles: number | undefined;
  let roomNights: string | undefined;
  let creditApplied: number | undefined;
  let amountDueAfterCredit: number | undefined; // Post-credit final amount
  let payAtProperty: number | undefined;        // Additional service fee due at check-in
  let payAtPropertyLabel: string | undefined;   // e.g., "Additional Service Fee (Due at check-in)"
  let totalAllIn: number | undefined;           // Total including pay-at-property
  let currency = 'USD';
  let confidence: ConfidenceLevel = 'LOW';
  
  console.log('[StaysCapture] Extracting checkout breakdown...');
  
  // Get full page text for pattern matching (more reliable than DOM traversal)
  const pageText = document.body.innerText;
  
  // ==========================================
  // STRATEGY 1: Text pattern matching on page content
  // ==========================================
  
  // Room x N nights $XXX.XX pattern
  const roomNightsMatch = pageText.match(/Room\s*x\s*(\d+)\s*nights?\s*\$?([\d,]+\.?\d*)/i);
  if (roomNightsMatch) {
    roomNights = `${roomNightsMatch[1]} nights`;
    const parsed = parsePrice(roomNightsMatch[2]);
    if (parsed) {
      roomSubtotal = parsed.amount;
      confidence = 'HIGH';
    }
  }
  
  // Taxes & fees $XX.XX pattern
  const taxesMatch = pageText.match(/Taxes?\s*(?:&|and)?\s*fees?\s*\$?([\d,]+\.?\d*)/i);
  if (taxesMatch) {
    const parsed = parsePrice(taxesMatch[1]);
    if (parsed) {
      taxesFees = parsed.amount;
      confidence = 'HIGH';
    }
  }
  
  // Due Today $XXX.XX / XX,XXX miles pattern - THIS IS THE PRE-CREDIT PRICE
  const dueTodayMatch = pageText.match(/Due\s*Today\s*\$?([\d,]+\.?\d*)\s*(?:\/\s*([\d,]+)\s*miles)?/i);
  if (dueTodayMatch) {
    const parsed = parsePrice(dueTodayMatch[1]);
    if (parsed) {
      dueTodayCash = parsed.amount;
      currency = parsed.currency;
      confidence = 'HIGH';
    }
    if (dueTodayMatch[2]) {
      dueTodayMiles = parseMiles(dueTodayMatch[2]) || undefined;
    }
  }
  
  // Travel credits applied pattern - CAPTURE THIS FIRST before Amount due
  const creditsMatch = pageText.match(/(?:Total\s*)?(?:travel\s*)?credits?\s*applied:?\s*-?\$?([\d,]+\.?\d*)/i);
  if (creditsMatch) {
    const parsed = parsePrice(creditsMatch[1]);
    if (parsed) {
      creditApplied = parsed.amount;
    }
  }
  
  // Amount due: $XXX.XX (final amount AFTER credits - DO NOT use as dueTodayCash!)
  const amountDueMatch = pageText.match(/Amount\s*due:?\s*\$?([\d,]+\.?\d*)/i);
  if (amountDueMatch) {
    const parsed = parsePrice(amountDueMatch[1]);
    if (parsed) {
      amountDueAfterCredit = parsed.amount;
      
      // If we didn't find "Due Today", we can try to reconstruct it from Amount due + credit
      if (!dueTodayCash && creditApplied) {
        dueTodayCash = parsed.amount + creditApplied;
        confidence = 'MED';
      } else if (!dueTodayCash) {
        // Last resort: use Amount due if we have no other price
        dueTodayCash = parsed.amount;
        confidence = 'MED';
      }
    }
  }
  
  // Additional Service Fee (Due at check-in) pattern - this is the PAY AT PROPERTY fee
  // Matches: "Additional Service Fee (Due at check-in) $25.02" or similar
  const serviceFeePattterns = [
    /Additional\s*Service\s*Fee\s*(?:\(Due\s*(?:at\s*)?check.?in\))?\s*\$?([\d,]+\.?\d*)/i,
    /(?:Resort|Service|Property)\s*Fee\s*(?:\(Due\s*(?:at\s*)?check.?in\))?\s*\$?([\d,]+\.?\d*)/i,
    /Due\s*(?:at\s*)?(?:check.?in|property|hotel)[:.]?\s*\$?([\d,]+\.?\d*)/i,
    /Pay\s*(?:at\s*)?(?:check.?in|property|hotel)[:.]?\s*\$?([\d,]+\.?\d*)/i,
  ];
  
  for (const pattern of serviceFeePattterns) {
    const serviceFeeMatch = pageText.match(pattern);
    if (serviceFeeMatch) {
      const parsed = parsePrice(serviceFeeMatch[1]);
      if (parsed && parsed.amount > 0 && parsed.amount < dueTodayCash) { // Sanity check: should be less than main price
        payAtProperty = parsed.amount;
        // Try to extract the full label for display
        const fullMatch = pageText.match(/(Additional\s*Service\s*Fee[^$\n]*)/i) ||
                         pageText.match(/(Resort\s*Fee[^$\n]*)/i) ||
                         pageText.match(/(Property\s*Fee[^$\n]*)/i);
        if (fullMatch) {
          payAtPropertyLabel = fullMatch[1].trim();
        } else {
          payAtPropertyLabel = 'Additional Service Fee (Due at check-in)';
        }
        console.log('[StaysCapture] Found pay at property fee:', payAtProperty, payAtPropertyLabel);
        break;
      }
    }
  }
  
  // Total: $XXX.XX pattern - this is the ALL-IN total (dueTodayCash + payAtProperty)
  // Note: This is BEFORE credit is applied
  const totalMatch = pageText.match(/^Total\s*\$?([\d,]+\.?\d*)/im);
  if (totalMatch) {
    const parsed = parsePrice(totalMatch[1]);
    if (parsed && parsed.amount > 0) {
      totalAllIn = parsed.amount;
      console.log('[StaysCapture] Found total all-in:', totalAllIn);
    }
  }
  
  // ==========================================
  // STRATEGY 2: DOM-based extraction (fallback)
  // ==========================================
  
  if (!dueTodayCash) {
    // Look for "Checkout Breakdown" or similar section
    const breakdownSection = findElementByText(
      /checkout\s*breakdown|price\s*breakdown|your\s*(?:trip|stay)\s*(?:summary)?/i,
      'h2, h3, div, section'
    );
    
    const container = breakdownSection?.closest('section, div[class*="breakdown"], div[class*="summary"]') || document;
    
    // Room subtotal
    if (!roomSubtotal) {
      const roomSubtotalValue = findValueNearLabel(/room|subtotal|accommodation/i, container);
      if (roomSubtotalValue) {
        const parsed = parsePrice(roomSubtotalValue);
        if (parsed) {
          roomSubtotal = parsed.amount;
          currency = parsed.currency;
          confidence = 'MED';
        }
      }
    }
    
    // Try to find nights info
    if (!roomNights) {
      const nightsEl = findElementByText(/\d+\s*nights?/i, 'span, div', container);
      if (nightsEl) {
        roomNights = getTextContent(nightsEl);
      }
    }
    
    // Taxes & fees
    if (!taxesFees) {
      const taxesValue = findValueNearLabel(/taxes?\s*(?:&|and)?\s*fees?/i, container);
      if (taxesValue) {
        const parsed = parsePrice(taxesValue);
        if (parsed) {
          taxesFees = parsed.amount;
          confidence = 'MED';
        }
      }
    }
    
    // Due today - most important!
    const dueTodaySelectors = [
      /due\s*today/i,
      /total\s*due/i,
      /amount\s*due/i,
      /pay\s*now/i,
    ];
    
    for (const pattern of dueTodaySelectors) {
      const value = findValueNearLabel(pattern, container);
      if (value) {
        const parsed = parsePrice(value);
        if (parsed) {
          dueTodayCash = parsed.amount;
          currency = parsed.currency;
          confidence = 'HIGH';
          break;
        }
      }
    }
  }
  
  // Fallback: look for largest price on page as due today
  if (!dueTodayCash) {
    const priceElements = findElements([
      '[class*="price"]',
      '[class*="total"]',
      '[data-testid*="price"]',
    ]);
    
    let maxPrice = 0;
    for (const el of priceElements) {
      const text = getTextContent(el);
      const parsed = parsePrice(text);
      if (parsed && parsed.amount > maxPrice && parsed.amount < 100000) {
        maxPrice = parsed.amount;
        currency = parsed.currency;
      }
    }
    
    if (maxPrice > 0) {
      dueTodayCash = maxPrice;
      confidence = 'LOW';
    }
  }
  
  // Miles option (if not found via pattern)
  if (!dueTodayMiles) {
    const milesMatch = pageText.match(/([\d,]+)\s*miles/i);
    if (milesMatch) {
      dueTodayMiles = parseMiles(milesMatch[1]) || undefined;
    }
  }
  
  // Determine if credit was already applied by the portal
  const creditAlreadyApplied = !!(creditApplied && creditApplied > 0);
  
  console.log('[StaysCapture] Breakdown extracted:', {
    roomSubtotal,
    roomNights,
    taxesFees,
    dueTodayCash,
    dueTodayMiles,
    payAtProperty,
    payAtPropertyLabel,
    totalAllIn,
    creditApplied,
    amountDueAfterCredit,
    creditAlreadyApplied,
    confidence,
  });
  
  if (!dueTodayCash) {
    return null;
  }
  
  // If we don't have room subtotal, try to compute from total - taxes
  if (!roomSubtotal && dueTodayCash && taxesFees) {
    roomSubtotal = dueTodayCash - taxesFees;
  }
  
  // Compute totalAllIn if not found but we have payAtProperty
  if (!totalAllIn && payAtProperty && dueTodayCash) {
    totalAllIn = dueTodayCash + payAtProperty;
  }
  
  return {
    roomSubtotal,
    roomNights,
    taxesFees,
    dueTodayCash,           // PRE-credit price (the true portal price!)
    dueTodayMiles,
    payAtProperty,          // Additional service fee due at check-in
    payAtPropertyLabel,     // Label for the pay-at-property fee
    totalAllIn,             // Total including pay-at-property
    amountDueAfterCredit,   // POST-credit price (what user actually pays if credit applied)
    creditApplied,          // Amount of credit the portal applied
    creditAlreadyApplied,   // TRUE if portal already applied credit
    currency,
    confidence,
    extractedAt: Date.now(),
  };
}

// ============================================
// SEARCH CONTEXT EXTRACTION
// ============================================

function extractSearchContext(): StaySearchContext | null {
  // Start with URL params
  const urlContext = parseStaySearchContextFromUrl(window.location.href);
  
  let place = urlContext.place || '';
  let checkIn = urlContext.checkIn || '';
  let checkOut = urlContext.checkOut || '';
  let adults = urlContext.adults || 2;
  let rooms = urlContext.rooms || 1;
  let children = urlContext.children;
  let source: 'url' | 'dom' = urlContext.source as 'url' | 'dom' || 'url';
  
  // Try to get/validate from DOM
  const searchBarSelectors = [
    '[data-testid="search-form"]',
    '[class*="search-bar"]',
    '[class*="SearchBar"]',
    'form[action*="stays"]',
  ];
  
  const searchBar = findElement(searchBarSelectors);
  
  if (!place) {
    // Look for destination input
    const destEl = findElement([
      '[data-testid="destination-input"]',
      '[placeholder*="Where"]',
      '[aria-label*="destination"]',
      'input[name*="destination"]',
    ], searchBar || document);
    
    if (destEl && destEl instanceof HTMLInputElement) {
      place = destEl.value;
      source = 'dom';
    }
  }
  
  // Look for date displays
  if (!checkIn || !checkOut) {
    const dateEl = findElementByText(/\w+\s+\d{1,2}/i, 'span, div, button');
    if (dateEl) {
      const dateContainer = dateEl.closest('[class*="date"]') || dateEl.parentElement;
      if (dateContainer) {
        // Try to parse date range like "Jan 25 - Jan 28"
        const dateText = getTextContent(dateContainer);
        const dateRangeMatch = dateText.match(/(\w+\s+\d{1,2})(?:\s*[-–]\s*)(\w+\s+\d{1,2})/);
        if (dateRangeMatch) {
          // Convert to ISO format (simplified - assumes current year)
          const year = new Date().getFullYear();
          try {
            const start = new Date(`${dateRangeMatch[1]} ${year}`);
            const end = new Date(`${dateRangeMatch[2]} ${year}`);
            if (!isNaN(start.getTime())) checkIn = start.toISOString().split('T')[0];
            if (!isNaN(end.getTime())) checkOut = end.toISOString().split('T')[0];
            source = 'dom';
          } catch (e) {
            // Ignore date parsing errors
          }
        }
      }
    }
  }
  
  // Look for combined "N Travelers, M Room" pattern (common on Capital One)
  const combinedGuestRoomEl = findElementByText(/\d+\s*(?:travelers?|guests?|adults?),?\s*\d+\s*rooms?/i, 'span, div, button');
  if (combinedGuestRoomEl) {
    const combinedText = getTextContent(combinedGuestRoomEl);
    // Match "4 Travelers, 1 Room" pattern
    const combinedMatch = combinedText.match(/(\d+)\s*(?:travelers?|guests?|adults?),?\s*(\d+)\s*rooms?/i);
    if (combinedMatch) {
      adults = parseInt(combinedMatch[1], 10);
      rooms = parseInt(combinedMatch[2], 10);
      source = 'dom';
      console.log('[StaysCapture] Found combined guest/room pattern:', { adults, rooms });
    }
  }
  
  // Look for guest count (fallback if combined not found)
  if (adults <= 2) { // Only override if we didn't get a good value
    const guestEl = findElementByText(/\d+\s*(?:guest|adult|traveler)/i, 'span, div, button');
    if (guestEl) {
      const guestText = getTextContent(guestEl);
      const guestMatch = guestText.match(/(\d+)\s*(?:guest|adult|traveler)/i);
      if (guestMatch) {
        const guestCount = parseInt(guestMatch[1], 10);
        if (guestCount > adults) {
          adults = guestCount;
          source = 'dom';
        }
      }
    }
  }
  
  // Look for room count (fallback if combined not found)
  if (rooms <= 1) { // Only override if we didn't get a good value
    const roomEl = findElementByText(/\d+\s*room/i, 'span, div, button');
    if (roomEl) {
      const roomText = getTextContent(roomEl);
      const roomMatch = roomText.match(/(\d+)\s*room/i);
      if (roomMatch) {
        const roomCount = parseInt(roomMatch[1], 10);
        if (roomCount > rooms) {
          rooms = roomCount;
        }
      }
    }
  }
  
  const nights = checkIn && checkOut ? calculateNights(checkIn, checkOut) : 0;
  
  if (!place && !checkIn) {
    return null;
  }
  
  return {
    place,
    checkIn,
    checkOut,
    nights,
    adults,
    children,
    rooms,
    source,
    extractedAt: Date.now(),
  };
}

// ============================================
// MAIN CAPTURE FUNCTION
// ============================================

export function captureStayFromPortal(): StayPortalCapture | null {
  console.log('[StaysCapture] Starting capture...');
  
  const url = window.location.href;
  const pageType = detectStayPageType(url);
  
  console.log('[StaysCapture] Page type:', pageType);
  
  if (pageType === 'unknown') {
    console.log('[StaysCapture] Not a recognized stays page');
    return null;
  }
  
  // Extract search context
  const searchContext = extractSearchContext();
  
  // For checkout AND shop pages, we can be more lenient - use defaults if needed
  const isCheckoutPage = pageType === 'checkout' || pageType === 'customize';
  const isShopPage = pageType === 'shop';
  const allowPartialCapture = isCheckoutPage || isShopPage;
  
  if (!searchContext && !allowPartialCapture) {
    console.log('[StaysCapture] Could not extract search context');
    return null;
  }
  
  // Create fallback search context for checkout/shop pages
  const finalSearchContext = searchContext || {
    place: '',
    checkIn: '',
    checkOut: '',
    nights: 1,
    adults: 2,
    rooms: 1,
    source: 'dom' as const,
    extractedAt: Date.now(),
  };
  
  console.log('[StaysCapture] Search context:', finalSearchContext);
  
  // Extract property details
  let property = extractPropertyDetails(pageType);
  
  // For checkout/shop pages, create a minimal property if extraction fails
  if (!property && allowPartialCapture) {
    console.log('[StaysCapture] Creating minimal property for', pageType, 'page');
    property = {
      propertyName: 'Hotel Booking',
      accommodationType: 'hotel' as const,
      confidence: 'LOW' as const,
      extractedAt: Date.now(),
    };
  }
  
  if (!property) {
    console.log('[StaysCapture] Could not extract property details');
    return null;
  }
  
  console.log('[StaysCapture] Property:', property);
  
  // Extract room selection (if on shop/customize page)
  let selectedRoom: StayRoomSelection | undefined;
  if (pageType === 'shop' || pageType === 'customize' || pageType === 'checkout') {
    selectedRoom = extractRoomSelection() || undefined;
    console.log('[StaysCapture] Room selection:', selectedRoom);
  }
  
  // Extract checkout breakdown (if on customize/checkout page)
  let checkoutBreakdown: StayCheckoutBreakdown | undefined;
  if (isCheckoutPage) {
    checkoutBreakdown = extractCheckoutBreakdown() || undefined;
    console.log('[StaysCapture] Checkout breakdown:', checkoutBreakdown);
  }
  
  // Determine best price to use
  let totalAmount = 0;
  let totalCurrency = 'USD';
  let totalConfidence: ConfidenceLevel = 'LOW';
  let totalLabel: 'perNight' | 'total' | 'dueToday' = 'total';
  let totalSource: 'dom' | 'url' | 'computed' = 'dom';
  
  // Priority: checkout due today > room total > per night * nights
  if (checkoutBreakdown?.dueTodayCash) {
    totalAmount = checkoutBreakdown.dueTodayCash;
    totalCurrency = checkoutBreakdown.currency;
    totalConfidence = checkoutBreakdown.confidence;
    totalLabel = 'dueToday';
  } else if (selectedRoom?.totalCash) {
    totalAmount = selectedRoom.totalCash;
    totalCurrency = selectedRoom.currency || 'USD';
    totalConfidence = selectedRoom.confidence;
    totalLabel = 'total';
  } else if (selectedRoom?.perNight && finalSearchContext.nights) {
    totalAmount = selectedRoom.perNight * finalSearchContext.nights;
    totalCurrency = selectedRoom.currency || 'USD';
    totalConfidence = 'LOW';
    totalLabel = 'total';
    totalSource = 'computed';
  }
  
  // For shop pages, allow partial capture even without price
  // We can still capture hotel name, dates, location for pre-comparison setup
  if (!totalAmount && !isShopPage) {
    console.log('[StaysCapture] Could not determine total price');
    return null;
  }
  
  // For shop pages without price, mark as pending price capture
  if (!totalAmount && isShopPage) {
    console.log('[StaysCapture] Shop page capture - price will be captured on checkout');
    totalConfidence = 'LOW';
    totalLabel = 'total';
    totalSource = 'computed';
  }
  
  // Get earn rate based on accommodation type
  const earnRate = getPortalEarnRate(property.accommodationType);
  const milesEarned = Math.floor(totalAmount) * earnRate;
  
  // Get miles equivalent if shown
  const portalMilesEquivalent = checkoutBreakdown?.dueTodayMiles || selectedRoom?.totalMiles;
  
  const capture: StayPortalCapture = {
    captureId: generateCaptureId(),
    bookingType: 'stay',
    accommodationType: property.accommodationType,
    pageType,
    
    searchContext: finalSearchContext,
    property,
    selectedRoom,
    checkoutBreakdown,
    
    totalPrice: {
      amount: totalAmount,
      currency: totalCurrency,
      confidence: totalConfidence,
      label: totalLabel,
      source: totalSource,
      extractedAt: Date.now(),
    },
    
    portalMilesEquivalent,
    portalEarnRate: earnRate,
    milesEarned,
    
    portalUrl: url,
    capturedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    version: 1,
  };
  
  console.log('[StaysCapture] Complete capture:', capture);
  
  return capture;
}

// ============================================
// AUTO-CAPTURE WITH MUTATION OBSERVER
// ============================================

let captureTimeout: ReturnType<typeof setTimeout> | null = null;
let lastCapture: StayPortalCapture | null = null;

function debouncedCapture(callback: (capture: StayPortalCapture) => void): void {
  if (captureTimeout) {
    clearTimeout(captureTimeout);
  }
  
  captureTimeout = setTimeout(() => {
    const capture = captureStayFromPortal();
    
    if (capture) {
      // Check if capture has meaningfully changed
      const hasChanged = !lastCapture || 
        lastCapture.totalPrice.amount !== capture.totalPrice.amount ||
        lastCapture.property.propertyName !== capture.property.propertyName ||
        lastCapture.pageType !== capture.pageType;
      
      if (hasChanged) {
        lastCapture = capture;
        callback(capture);
      }
    }
  }, 500);
}

/**
 * Start auto-capturing stay details on page changes
 */
export function startStayAutoCapture(
  onCapture: (capture: StayPortalCapture) => void
): () => void {
  console.log('[StaysCapture] Starting auto-capture observer');
  
  // Initial capture
  debouncedCapture(onCapture);
  
  // Watch for DOM changes
  const observer = new MutationObserver(() => {
    debouncedCapture(onCapture);
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  
  // Watch for URL changes (SPA navigation)
  let lastUrl = window.location.href;
  const urlChecker = setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      debouncedCapture(onCapture);
    }
  }, 1000);
  
  // Return cleanup function
  return () => {
    observer.disconnect();
    clearInterval(urlChecker);
    if (captureTimeout) {
      clearTimeout(captureTimeout);
    }
  };
}

// ============================================
// MESSAGE HANDLER FOR CONTENT SCRIPT
// ============================================

export function handleStayCaptureMessage(
  message: { type: string; sessionId?: string },
  sendResponse: (response: unknown) => void
): boolean {
  if (message.type === 'VX_COMPARE_CAPTURE_PORTAL_STAY') {
    console.log('[StaysCapture] Received capture request');
    
    const capture = captureStayFromPortal();
    
    if (capture) {
      // Send to background
      chrome.runtime.sendMessage({
        type: 'VX_STAY_PORTAL_CAPTURED',
        sessionId: message.sessionId,
        payload: {
          stayCapture: capture,
        },
      });
      
      sendResponse({ success: true, capture });
    } else {
      sendResponse({ success: false, error: 'Could not capture stay details' });
    }
    
    return true;
  }
  
  if (message.type === 'FORCE_CAPTURE_PORTAL_STAY') {
    console.log('[StaysCapture] Force capture requested');
    
    // Reset last capture to force re-capture
    lastCapture = null;
    
    const capture = captureStayFromPortal();
    
    if (capture) {
      sendResponse({ success: true, capture });
      
      // Broadcast update
      chrome.runtime.sendMessage({
        type: 'VX_STAY_PORTAL_CAPTURED',
        payload: {
          stayCapture: capture,
        },
      });
    } else {
      sendResponse({ success: false, error: 'Could not capture stay details' });
    }
    
    return true;
  }
  
  return false;
}

// ============================================
// EXPORTS
// ============================================

export {
  parsePrice,
  parseMiles,
  parseNights,
  findElement,
  findElements,
  findElementByText,
  getTextContent,
  findValueNearLabel,
};
