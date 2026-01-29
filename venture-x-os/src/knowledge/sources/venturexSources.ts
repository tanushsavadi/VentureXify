// ============================================
// VENTUREX SOURCE REGISTRY - Tiered Authority Model
// ============================================
//
// Source Tiers:
// - Tier 0: Official Capital One sources (policy/truth)
// - Tier 1: High-quality third-party guides (TPG, OMAAT, etc.)
// - Tier 2: Community sources (Reddit, FlyerTalk)
//
// IMPORTANT: Policy questions MUST prioritize Tier 0.
// Tier 1/2 are for "community notes" or "optimization advice" only.
// ============================================

export type SourceTier = 0 | 1 | 2;

export type SourceCategory = 
  | 'policy'     // Official terms, rules, earning rates
  | 'howto'      // How-to guides from official sources
  | 'guide'      // Third-party explainer guides
  | 'news'       // News/updates about changes
  | 'community'; // User discussions, data points

export interface VentureXSource {
  url: string;
  title: string;
  tier: SourceTier;
  category: SourceCategory;
  notes?: string;
  expectedUpdateFrequencyDays?: number;
  effectiveFrom?: string; // ISO date string for time-sensitive content
  effectiveTo?: string;   // ISO date string for expiring content
}

// ============================================
// TIER 0 - Official Capital One Sources
// These are the ONLY sources for policy questions
// ============================================

export const VENTUREX_TIER0_OFFICIAL: VentureXSource[] = [
  {
    url: 'https://www.capitalone.com/credit-cards/venture-x/',
    title: 'Venture X – Official Card Page',
    tier: 0,
    category: 'policy',
    expectedUpdateFrequencyDays: 30,
  },
  {
    url: 'https://www.capitalone.com/learn-grow/more-than-money/all-about-venture-x/',
    title: 'All About Venture X (Official explainer + lounge rule changes)',
    tier: 0,
    category: 'policy',
    notes: 'Contains Feb 1, 2026 lounge/guest/AU changes. CRITICAL for time-sensitive rules.',
    expectedUpdateFrequencyDays: 14,
  },
  {
    url: 'https://www.capitalone.com/credit-cards/disclosures/airport-lounge-terms/',
    title: 'Airport Lounge Terms & Conditions',
    tier: 0,
    category: 'policy',
    notes: 'Official lounge access rules, guest policies, Priority Pass terms.',
    expectedUpdateFrequencyDays: 30,
  },
  {
    url: 'https://www.capitalone.com/learn-grow/more-than-money/how-to-enroll-priority-pass/',
    title: 'How to Enroll in Priority Pass (Official)',
    tier: 0,
    category: 'howto',
    expectedUpdateFrequencyDays: 90,
  },
  {
    url: 'https://www.capitalone.com/learn-grow/more-than-money/all-about-priority-pass-and-venture-x/',
    title: 'Priority Pass for Venture X (Official)',
    tier: 0,
    category: 'policy',
    expectedUpdateFrequencyDays: 30,
  },
  {
    url: 'https://www.capitalone.com/learn-grow/money-management/venture-miles-transfer-partnerships/',
    title: 'Venture Miles Transfer Partners (Official)',
    tier: 0,
    category: 'policy',
    notes: 'Official transfer partner list and ratios.',
    expectedUpdateFrequencyDays: 30,
  },
  {
    url: 'https://www.capitalone.com/credit-cards/benefits-guide/',
    title: 'Network Benefits Guides (Official entry point; Visa Infinite guide)',
    tier: 0,
    category: 'policy',
    expectedUpdateFrequencyDays: 90,
  },
];

// ============================================
// TIER 1 - High-Quality Third-Party Guides
// Useful for optimization, but NOT for policy truth
// ============================================

export const VENTUREX_TIER1_GUIDES: VentureXSource[] = [
  {
    url: 'https://thepointsguy.com/guide/capital-one-venture-x-card-review/',
    title: 'TPG – Venture X Review/Guide',
    tier: 1,
    category: 'guide',
    notes: 'Affiliate content - may emphasize positives.',
    expectedUpdateFrequencyDays: 60,
  },
  {
    url: 'https://thepointsguy.com/credit-cards/capital-one-set-to-change-lounge-access/',
    title: 'TPG – Lounge Access Changes (news/updates)',
    tier: 1,
    category: 'news',
    expectedUpdateFrequencyDays: 7,
  },
  {
    url: 'https://onemileatatime.com/guides/capital-one-venture-x/',
    title: 'OMAAT – Venture X Guide',
    tier: 1,
    category: 'guide',
    notes: 'High quality, regularly updated.',
    expectedUpdateFrequencyDays: 30,
  },
  {
    url: 'https://www.nerdwallet.com/travel/learn/how-to-maximize-venture-x-card',
    title: 'NerdWallet – How to Maximize Venture X',
    tier: 1,
    category: 'guide',
    expectedUpdateFrequencyDays: 60,
  },
  {
    url: 'https://frequentmiler.com/capital-one-venture-x-card-complete-guide/',
    title: 'Frequent Miler – Venture X Complete Guide',
    tier: 1,
    category: 'guide',
    expectedUpdateFrequencyDays: 60,
  },
  {
    url: 'https://www.doctorofcredit.com/?s=venture+x',
    title: 'Doctor of Credit – Venture X updates/search',
    tier: 1,
    category: 'news',
    notes: 'Breaking news on changes, often first to report.',
    expectedUpdateFrequencyDays: 7,
  },
];

// ============================================
// TIER 2 - Community Sources
// Great for data points, but label as "anecdotal"
// ============================================

export const VENTUREX_TIER2_COMMUNITY: VentureXSource[] = [
  {
    url: 'https://www.reddit.com/r/VentureX/',
    title: 'Reddit – r/VentureX',
    tier: 2,
    category: 'community',
    notes: 'User experiences, data points, edge cases.',
    expectedUpdateFrequencyDays: 14,
  },
  {
    url: 'https://www.flyertalk.com/forum/capital-one-rewards-340/',
    title: 'FlyerTalk – Capital One Rewards Forum',
    tier: 2,
    category: 'community',
    notes: 'Detailed user reports, historical data.',
    expectedUpdateFrequencyDays: 14,
  },
];

// ============================================
// Combined exports
// ============================================

export const ALL_VENTUREX_SOURCES: VentureXSource[] = [
  ...VENTUREX_TIER0_OFFICIAL,
  ...VENTUREX_TIER1_GUIDES,
  ...VENTUREX_TIER2_COMMUNITY,
];

export function getSourcesByTier(tier: SourceTier): VentureXSource[] {
  return ALL_VENTUREX_SOURCES.filter(s => s.tier === tier);
}

export function getSourcesByCategory(category: SourceCategory): VentureXSource[] {
  return ALL_VENTUREX_SOURCES.filter(s => s.category === category);
}

export function getPolicySources(): VentureXSource[] {
  // ONLY Tier 0 sources for policy questions
  return VENTUREX_TIER0_OFFICIAL.filter(s => s.category === 'policy');
}

export function getOptimizationSources(): VentureXSource[] {
  // Tier 0 + Tier 1 for optimization advice
  return ALL_VENTUREX_SOURCES.filter(s => s.tier <= 1);
}

// ============================================
// Effective Date Extraction
// Detects phrases like "Beginning February 1, 2026"
// ============================================

const EFFECTIVE_DATE_PATTERNS = [
  /(?:beginning|starting|effective|as of)\s+(\w+\s+\d{1,2},?\s+\d{4})/gi,
  /(?:through|until|ending)\s+(\w+\s+\d{1,2},?\s+\d{4})/gi,
  /(?:from|after)\s+(\w+\s+\d{1,2},?\s+\d{4})/gi,
  /(\d{1,2}\/\d{1,2}\/\d{4})/g,
  /(\d{4}-\d{2}-\d{2})/g,
];

export interface ExtractedDate {
  type: 'effective_from' | 'effective_to' | 'mentioned';
  date: string; // ISO format
  originalText: string;
}

export function extractEffectiveDates(content: string): ExtractedDate[] {
  const results: ExtractedDate[] = [];
  
  for (const pattern of EFFECTIVE_DATE_PATTERNS) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const dateStr = match[1];
      const fullMatch = match[0].toLowerCase();
      
      try {
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          let type: ExtractedDate['type'] = 'mentioned';
          
          if (fullMatch.includes('beginning') || fullMatch.includes('starting') || 
              fullMatch.includes('effective') || fullMatch.includes('from') ||
              fullMatch.includes('after')) {
            type = 'effective_from';
          } else if (fullMatch.includes('through') || fullMatch.includes('until') ||
                     fullMatch.includes('ending')) {
            type = 'effective_to';
          }
          
          results.push({
            type,
            date: parsedDate.toISOString().split('T')[0],
            originalText: match[0],
          });
        }
      } catch {
        // Skip unparseable dates
      }
    }
  }
  
  return results;
}

// ============================================
// Query Intent Detection for Tier Filtering
// ============================================

const POLICY_INTENT_KEYWORDS = [
  'earn', 'earning', 'rate', 'rates', 'multiplier', 'miles per',
  'annual fee', 'credit', 'travel credit', '$300', '$395',
  'lounge', 'priority pass', 'guest', 'access',
  'transfer', 'partner', 'ratio',
  'terms', 'condition', 'rule', 'policy', 'requirement',
  'eligible', 'eligibility', 'qualify',
  'eraser', 'redemption', 'minimum',
  'tsa', 'precheck', 'global entry',
  'visa infinite', 'benefit',
];

const OPTIMIZATION_INTENT_KEYWORDS = [
  'best', 'maximize', 'optimal', 'strategy', 'tip',
  'worth', 'value', 'cpp', 'cent per',
  'should i', 'better', 'compare', 'vs',
  'recommend', 'suggest', 'advice',
  'sweet spot', 'hack', 'trick',
];

export type QueryIntent = 'policy' | 'optimization' | 'general';

export function detectQueryIntent(query: string): QueryIntent {
  const lower = query.toLowerCase();
  
  // Check for policy-related keywords first (more strict)
  const policyScore = POLICY_INTENT_KEYWORDS.filter(kw => lower.includes(kw)).length;
  const optimizationScore = OPTIMIZATION_INTENT_KEYWORDS.filter(kw => lower.includes(kw)).length;
  
  // If asking about specific terms/rules, it's policy
  if (policyScore >= 2 && policyScore > optimizationScore) {
    return 'policy';
  }
  
  // If asking for advice/optimization
  if (optimizationScore >= 2 || lower.includes('should i') || lower.includes('worth')) {
    return 'optimization';
  }
  
  // Default to general (allows all tiers with proper labeling)
  return 'general';
}

export function getAllowedTiersForIntent(intent: QueryIntent): SourceTier[] {
  switch (intent) {
    case 'policy':
      return [0]; // ONLY Tier 0 for policy questions
    case 'optimization':
      return [0, 1]; // Tier 0 + 1 for optimization
    case 'general':
      return [0, 1, 2]; // All tiers for general questions
    default:
      return [0]; // Default to strictest
  }
}

// ============================================
// Travel Credit Policy Constants
// CRITICAL: Credit portion earns 0 miles
// ============================================

export const TRAVEL_CREDIT_POLICY = {
  // Per Capital One: "Rewards will not be earned on the Credit."
  creditEarnsRewards: false,
  
  // The $300 credit applies to Capital One Travel bookings
  creditAmount: 300,
  
  // How to calculate miles when credit is applied:
  // Miles earned = multiplier × (price - creditApplied)
  calculateMilesWithCredit: (
    price: number,
    creditApplied: number,
    multiplier: number
  ): number => {
    const rewardableAmount = Math.max(0, price - creditApplied);
    return Math.floor(rewardableAmount * multiplier);
  },
  
  // Explanation text for UI
  getExplanation: (creditApplied: number): string => {
    if (creditApplied > 0) {
      return `Note: The $${creditApplied} travel credit doesn't earn miles (per Capital One terms). Miles are calculated on the amount charged after credit.`;
    }
    return '';
  },
};
