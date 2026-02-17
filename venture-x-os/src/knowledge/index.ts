// ============================================
// VENTUREX KNOWLEDGE BASE
// Centralized knowledge store with update capabilities
// ============================================

export interface KnowledgeEntry {
  id: string;
  category: 'card-basics' | 'travel-eraser' | 'portal-strategy' | 'transfer-partners' | 'lounges' | 'tips' | 'reddit-advice';
  title: string;
  content: string;
  lastUpdated: string;
  source?: string;
}

// ============================================
// STATIC KNOWLEDGE BASE (Embedded)
// This is the fallback/core knowledge that ships with the extension
// ============================================

export const STATIC_KNOWLEDGE: KnowledgeEntry[] = [
  // Card Basics
  {
    id: 'card-annual-fee',
    category: 'card-basics',
    title: 'Annual Fee',
    content: '$395 annual fee. Offset by $300 travel credit + 10,000 anniversary miles (~$180 value) = $480+ in credits.',
    lastUpdated: '2024-01-01',
    source: 'Capital One'
  },
  {
    id: 'card-earn-rates',
    category: 'card-basics',
    title: 'Earning Rates',
    content: 'Earn 2X miles on all purchases. Earn 5X miles on flights via Capital One Travel portal. Earn 10X miles on hotels and rental cars via portal.',
    lastUpdated: '2024-01-01',
    source: 'Capital One'
  },
  {
    id: 'card-credits',
    category: 'card-basics',
    title: 'Travel Credits',
    content: '$300 annual travel credit for Capital One Travel purchases. Auto-applied when booking through portal. Resets each cardmember year.',
    lastUpdated: '2024-01-01',
    source: 'Capital One'
  },
  {
    id: 'card-anniversary',
    category: 'card-basics',
    title: 'Anniversary Bonus',
    content: '10,000 anniversary bonus miles each year on card anniversary date. Worth ~$180 at 1.8cpp.',
    lastUpdated: '2024-01-01',
    source: 'Capital One'
  },
  
  // Travel Eraser
  {
    id: 'eraser-basics',
    category: 'travel-eraser',
    title: 'Travel Eraser Basics',
    content: 'Redeem miles at 1 cent per mile (1 cpp) to erase travel purchases. Works on ANY travel purchase in last 90 days - flights, hotels, Uber, Lyft, parking, etc.',
    lastUpdated: '2024-01-01',
    source: 'Capital One'
  },
  {
    id: 'eraser-minimum',
    category: 'travel-eraser',
    title: 'Eraser Minimum',
    content: 'Travel Eraser has NO MINIMUM — you can redeem any amount from $0.01 up at 1¢/mile. Partial redemptions are allowed.',
    lastUpdated: '2024-01-01',
    source: 'Capital One'
  },
  {
    id: 'eraser-value',
    category: 'travel-eraser',
    title: 'Eraser Value Analysis',
    content: 'Travel Eraser gives 1cpp - NOT the best value. Transfer partners often give 1.5-3+ cpp. Only use eraser for convenience or when transfers dont make sense.',
    lastUpdated: '2024-01-01',
    source: 'Reddit r/VentureX'
  },
  
  // Portal Strategy
  {
    id: 'portal-5x',
    category: 'portal-strategy',
    title: '5X Portal Strategy',
    content: 'Book flights through Capital One Travel to earn 5X miles. At 1.8cpp value, thats 9% return vs 2X (3.6%) on direct bookings.',
    lastUpdated: '2024-01-01',
    source: 'Community'
  },
  {
    id: 'portal-breakeven',
    category: 'portal-strategy',
    title: 'Portal Break-Even Math',
    content: 'Portal is worth it if price is within ~7% of direct. 5X at 1.8cpp = 9% back. 2X at 1.8cpp = 3.6% back. Difference = 5.4%.',
    lastUpdated: '2024-01-01',
    source: 'Community'
  },
  {
    id: 'portal-eraser-combo',
    category: 'portal-strategy',
    title: 'Portal + Eraser Combo',
    content: 'Book portal at 5X, then Travel Erase if needed. You keep the 5X miles but can erase at 1cpp. Net effect: pay cash, earn 5X, get statement credit.',
    lastUpdated: '2024-01-01',
    source: 'Reddit r/VentureX'
  },
  
  // Transfer Partners
  {
    id: 'transfer-ratio',
    category: 'transfer-partners',
    title: 'Transfer Ratio',
    content: 'All Capital One transfers are 1:1 ratio. 1,000 Capital One miles = 1,000 partner miles.',
    lastUpdated: '2024-01-01',
    source: 'Capital One'
  },
  {
    id: 'transfer-time',
    category: 'transfer-partners',
    title: 'Transfer Time',
    content: 'Transfers usually instant to 2 business days. Turkish and Emirates typically instant. Some partners may take longer.',
    lastUpdated: '2024-01-01',
    source: 'Community'
  },
  {
    id: 'partner-turkish',
    category: 'transfer-partners',
    title: 'Turkish Miles&Smiles',
    content: 'Great for Star Alliance business/first class. Sweet spots: US-Europe business ~45K one-way. Often has better award availability than United.',
    lastUpdated: '2024-01-01',
    source: 'Reddit'
  },
  {
    id: 'partner-emirates',
    category: 'transfer-partners',
    title: 'Emirates Skywards',
    content: 'Good for Emirates flights. Business class sweet spots exist. Watch for 20-30% transfer bonuses that happen periodically.',
    lastUpdated: '2024-01-01',
    source: 'Reddit'
  },
  {
    id: 'partner-avianca',
    category: 'transfer-partners',
    title: 'Avianca LifeMiles',
    content: 'Often cheapest Star Alliance awards. Good for booking partner flights. No fuel surcharges on many routes.',
    lastUpdated: '2024-01-01',
    source: 'Reddit'
  },
  {
    id: 'partner-flying-blue',
    category: 'transfer-partners',
    title: 'Air France/KLM Flying Blue',
    content: 'SkyTeam alliance awards. Monthly Promo Rewards with discounted awards. Good for Europe travel.',
    lastUpdated: '2024-01-01',
    source: 'Reddit'
  },
  {
    id: 'partner-avios',
    category: 'transfer-partners',
    title: 'British Airways Avios',
    content: 'Best for short-haul flights (distance-based pricing). Good for AA domestic flights. Also works on Iberia, Aer Lingus.',
    lastUpdated: '2024-01-01',
    source: 'Reddit'
  },
  
  // Lounges
  {
    id: 'lounge-priority-pass',
    category: 'lounges',
    title: 'Priority Pass',
    content: 'Unlimited Priority Pass Select visits. 2 guests free per visit. Access to 1,400+ lounges worldwide.',
    lastUpdated: '2024-01-01',
    source: 'Capital One'
  },
  {
    id: 'lounge-capital-one',
    category: 'lounges',
    title: 'Capital One Lounges',
    content: 'Premium lounges in DFW, DEN, IAD (Dulles). More locations coming. Unlimited guests. Premium food, drinks, showers.',
    lastUpdated: '2024-01-01',
    source: 'Capital One'
  },
  
  // Tips & Reddit Advice
  {
    id: 'tip-never-erase-1cpp',
    category: 'reddit-advice',
    title: 'Never Erase at 1cpp',
    content: 'Community consensus: Never use Travel Eraser at 1cpp if you can transfer for 1.5+ cpp. Only erase for convenience or small purchases.',
    lastUpdated: '2024-01-01',
    source: 'Reddit r/VentureX'
  },
  {
    id: 'tip-use-300-credit',
    category: 'reddit-advice',
    title: 'Use $300 Credit First',
    content: 'Always use your $300 travel credit before considering eraser. The credit is use-it-or-lose-it.',
    lastUpdated: '2024-01-01',
    source: 'Reddit r/VentureX'
  },
  {
    id: 'tip-portal-domestic',
    category: 'reddit-advice',
    title: 'Portal for Domestic Economy',
    content: 'Portal is best for simple domestic economy flights where prices match. For premium cabins or complex itineraries, transfer to partners.',
    lastUpdated: '2024-01-01',
    source: 'Reddit r/VentureX'
  },
  {
    id: 'tip-transfer-bonuses',
    category: 'reddit-advice',
    title: 'Watch for Transfer Bonuses',
    content: 'Capital One periodically offers 20-30% transfer bonuses to certain partners. Worth waiting for if youre not in a hurry.',
    lastUpdated: '2024-01-01',
    source: 'Reddit r/VentureX'
  },

  // Visa Infinite Benefits
  {
    id: 'visa-infinite-benefits',
    category: 'card-basics',
    title: 'Visa Infinite Benefits',
    content: 'The Venture X is a Visa Infinite card, which includes access to the Visa Infinite Luxury Hotel Collection with automatic room upgrades, late checkout, complimentary breakfast for two, and a $25 food & beverage credit at 900+ luxury hotels. Cardholders also get a 24/7 Visa Infinite Concierge service for travel, dining, and entertainment assistance.',
    lastUpdated: '2026-02-17',
    source: 'Capital One'
  },

  // Rental Car Benefits
  {
    id: 'rental-car-benefits',
    category: 'card-basics',
    title: 'Rental Car & CDW Benefits',
    content: 'The Venture X provides primary auto rental collision damage waiver (CDW) covering theft and collision damage on eligible rentals up to 15 consecutive days in the US and most international countries. You must decline the rental company\'s CDW to be eligible. Coverage does NOT include liability, personal injury, or personal belongings. The card also includes complimentary Hertz President\'s Circle elite status.',
    lastUpdated: '2026-02-17',
    source: 'Capital One'
  },

  // Travel Protection
  {
    id: 'travel-protection-insurance',
    category: 'card-basics',
    title: 'Travel Protection & Insurance',
    content: 'Venture X travel protection includes trip cancellation/interruption insurance (up to $5,000 per trip, $10,000 per year), trip delay reimbursement (up to $500 per ticket after 6+ hour delay for meals, lodging, essentials), lost luggage reimbursement (up to $3,000 per passenger), and baggage delay insurance (up to $500 for essentials after a 6+ hour delay).',
    lastUpdated: '2026-02-17',
    source: 'Capital One'
  },

  // Purchase Protection
  {
    id: 'purchase-protection',
    category: 'card-basics',
    title: 'Purchase Protection & Extended Warranty',
    content: 'The Venture X extends the manufacturer\'s warranty by up to 1 additional year on eligible items valued up to $10,000. Purchase security covers new purchases against damage or theft for 120 days from the date of purchase, up to $10,000 per claim and $50,000 per year. Price protection has been discontinued on most Capital One cards.',
    lastUpdated: '2026-02-17',
    source: 'Capital One'
  },

  // Cell Phone Protection
  {
    id: 'cell-phone-protection',
    category: 'card-basics',
    title: 'Cell Phone Protection',
    content: 'When you pay your monthly cell phone bill with the Venture X card, you get cell phone protection covering damage or theft up to $800 per claim with a $25 deductible. You can file up to 2 claims per 12-month period. Coverage extends to the primary account holder and all lines listed on the monthly bill.',
    lastUpdated: '2026-02-17',
    source: 'Capital One'
  },

  // Lounge Access Comprehensive
  {
    id: 'lounge-access-comprehensive',
    category: 'lounges',
    title: 'Lounge Access — Comprehensive Guide',
    content: 'Venture X includes Priority Pass Select (1,300+ lounges worldwide) and Capital One Lounges at DFW, DEN, IAD, and DCA with hot meals, craft cocktails, showers, and relaxation rooms. Plaza Premium Lounge access is also included. As of February 2025, the primary cardholder plus 2 guests are admitted free; authorized users can enter but no longer receive free guest access.',
    lastUpdated: '2026-02-17',
    source: 'Capital One'
  },

  // Authorized User Benefits
  {
    id: 'authorized-user-benefits',
    category: 'card-basics',
    title: 'Authorized User Benefits',
    content: 'Authorized users on the Venture X card are free — there is no additional annual fee. Authorized users earn the same miles rates (2X/5X/10X) and receive their own Priority Pass membership. However, as of February 2025, authorized users no longer receive complimentary guest lounge access; they can enter lounges themselves but cannot bring guests for free.',
    lastUpdated: '2026-02-17',
    source: 'Capital One'
  },

  // Global Entry / TSA PreCheck
  {
    id: 'global-entry-tsa-precheck',
    category: 'card-basics',
    title: 'Global Entry / TSA PreCheck Credit',
    content: 'The Venture X provides up to $100 in statement credits every 4 years for Global Entry ($100), TSA PreCheck (~$78), or NEXUS ($50) application fees. The credit is applied automatically when the fee is charged to the card. This benefit helps offset the annual fee and speeds up airport security and customs.',
    lastUpdated: '2026-02-17',
    source: 'Capital One'
  },
];

// ============================================
// KNOWLEDGE BASE MANAGER
// ============================================

class KnowledgeBaseManager {
  private entries: KnowledgeEntry[] = STATIC_KNOWLEDGE;
  private cloudLastFetched: number = 0;
  private cloudUrl: string | null = null;
  
  constructor() {
    // Load any cached cloud knowledge on init
    this.loadCachedCloudKnowledge();
  }
  
  /**
   * Get all knowledge entries
   */
  getAll(): KnowledgeEntry[] {
    return this.entries;
  }
  
  /**
   * Get entries by category
   */
  getByCategory(category: KnowledgeEntry['category']): KnowledgeEntry[] {
    return this.entries.filter(e => e.category === category);
  }
  
  /**
   * Search knowledge base (simple keyword matching)
   */
  search(query: string): KnowledgeEntry[] {
    const q = query.toLowerCase();
    return this.entries.filter(e => 
      e.title.toLowerCase().includes(q) ||
      e.content.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q)
    );
  }
  
  /**
   * Format knowledge for AI context
   */
  formatForAI(limit: number = 20): string {
    const entries = this.entries.slice(0, limit);
    
    let formatted = '## VentureX Knowledge Base\n\n';
    
    const categories = [...new Set(entries.map(e => e.category))];
    
    for (const cat of categories) {
      const catEntries = entries.filter(e => e.category === cat);
      formatted += `### ${cat.replace('-', ' ').toUpperCase()}\n`;
      
      for (const entry of catEntries) {
        formatted += `- **${entry.title}**: ${entry.content}\n`;
      }
      formatted += '\n';
    }
    
    return formatted;
  }
  
  /**
   * Format relevant knowledge for a specific query
   */
  formatRelevantForAI(query: string, limit: number = 10): string {
    const relevant = this.search(query);
    
    if (relevant.length === 0) {
      return this.formatForAI(limit);
    }
    
    let formatted = '## Relevant Knowledge\n\n';
    
    for (const entry of relevant.slice(0, limit)) {
      formatted += `- **${entry.title}**: ${entry.content}\n`;
    }
    
    return formatted;
  }
  
  /**
   * Load cached cloud knowledge from storage
   */
  private async loadCachedCloudKnowledge() {
    try {
      const stored = await chrome.storage.local.get(['vx_cloud_knowledge', 'vx_cloud_knowledge_time']);
      if (stored.vx_cloud_knowledge && Array.isArray(stored.vx_cloud_knowledge)) {
        // Merge cloud knowledge with static (cloud takes precedence for matching IDs)
        const cloudEntries = stored.vx_cloud_knowledge as KnowledgeEntry[];
        const staticIds = new Set(STATIC_KNOWLEDGE.map(e => e.id));
        
        // Add cloud entries that don't exist in static
        for (const cloud of cloudEntries) {
          if (!staticIds.has(cloud.id)) {
            this.entries.push(cloud);
          }
        }
        
        this.cloudLastFetched = stored.vx_cloud_knowledge_time || 0;
        console.log('[Knowledge] Loaded cached cloud knowledge:', cloudEntries.length, 'entries');
      }
    } catch (e) {
      console.log('[Knowledge] No cached cloud knowledge found');
    }
  }
  
  /**
   * Fetch updates from cloud (if configured)
   * This could fetch from:
   * - A simple JSON endpoint
   * - Supabase
   * - Firebase
   * - Your own backend
   */
  async fetchCloudUpdates(cloudUrl?: string): Promise<boolean> {
    const url = cloudUrl || this.cloudUrl;
    if (!url) {
      console.log('[Knowledge] No cloud URL configured');
      return false;
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.entries && Array.isArray(data.entries)) {
        // Cache to storage
        await chrome.storage.local.set({
          vx_cloud_knowledge: data.entries,
          vx_cloud_knowledge_time: Date.now(),
        });
        
        // Merge with current entries
        const cloudEntries = data.entries as KnowledgeEntry[];
        const existingIds = new Set(this.entries.map(e => e.id));
        
        for (const cloud of cloudEntries) {
          if (!existingIds.has(cloud.id)) {
            this.entries.push(cloud);
          } else {
            // Update existing entry
            const idx = this.entries.findIndex(e => e.id === cloud.id);
            if (idx >= 0) {
              this.entries[idx] = cloud;
            }
          }
        }
        
        this.cloudLastFetched = Date.now();
        console.log('[Knowledge] Cloud knowledge updated:', cloudEntries.length, 'entries');
        return true;
      }
      
      return false;
    } catch (e) {
      console.error('[Knowledge] Failed to fetch cloud updates:', e);
      return false;
    }
  }
  
  /**
   * Set cloud URL for updates
   */
  setCloudUrl(url: string) {
    this.cloudUrl = url;
  }
  
  /**
   * Add custom entry (for user additions)
   */
  addEntry(entry: Omit<KnowledgeEntry, 'id' | 'lastUpdated'>) {
    const newEntry: KnowledgeEntry = {
      ...entry,
      id: `custom-${Date.now()}`,
      lastUpdated: new Date().toISOString().split('T')[0],
    };
    this.entries.push(newEntry);
    
    // Persist custom entries
    this.persistCustomEntries();
  }
  
  private async persistCustomEntries() {
    const custom = this.entries.filter(e => e.id.startsWith('custom-'));
    await chrome.storage.local.set({ vx_custom_knowledge: custom });
  }
}

// Singleton instance
export const knowledgeBase = new KnowledgeBaseManager();

// Helper to format knowledge for system prompt
export function getKnowledgeForAI(query?: string): string {
  if (query) {
    return knowledgeBase.formatRelevantForAI(query);
  }
  return knowledgeBase.formatForAI();
}
