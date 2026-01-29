// ============================================
// SOURCE PROVENANCE & METADATA
// Tracks source freshness, trust tier, and verification status
// ============================================

// ============================================
// SOURCE METADATA INTERFACE
// ============================================

export interface SourceMetadata {
  // Identity
  id: string;
  source: string;          // e.g., 'capitalone', 'reddit', 'tpg'
  url?: string;
  title?: string;
  
  // Timestamps
  retrievedAt: string;     // When we scraped/indexed this
  publishedAt?: string;    // When the original was published
  effectiveDate?: string;  // When the info becomes valid
  expiresAt?: string;      // When the info is no longer valid
  
  // Trust
  trustTier: 1 | 2 | 3 | 4;
  verifiedAt?: string;     // Last manual verification
  verifiedBy?: string;     // Who verified (system or human)
  
  // Content
  contentHash: string;     // SHA-256 hash for change detection
  version: number;         // Version number for this content
  isActive: boolean;       // Is this the current version?
}

// ============================================
// CHUNK WITH PROVENANCE
// ============================================

export interface ChunkWithProvenance {
  id: string;
  content: string;
  embedding?: number[];
  
  // Source info
  metadata: SourceMetadata;
  
  // Retrieval info
  score?: number;          // Similarity score (0-1)
  rankPosition?: number;   // Position in results
  
  // Freshness
  freshnessStatus: 'fresh' | 'stale' | 'expired' | 'unknown';
  daysOld?: number;
}

// ============================================
// FRESHNESS CONFIGURATION
// ============================================

export interface FreshnessConfig {
  // How old before content is "stale"?
  staleDaysThreshold: Record<string, number>;
  
  // How old before content is "expired"?
  expiredDaysThreshold: Record<string, number>;
}

export const DEFAULT_FRESHNESS_CONFIG: FreshnessConfig = {
  staleDaysThreshold: {
    // Official sources stay fresh longer
    'capitalone': 90,          // 3 months
    'capitalone-official': 90,
    
    // Editorial sources
    'tpg': 60,                 // 2 months
    'nerdwallet': 60,
    'doctorofcredit': 30,      // DoC is more time-sensitive
    
    // Community sources go stale faster
    'flyertalk': 30,
    'reddit': 14,              // Reddit posts go stale quickly
    
    // Default
    'default': 30,
  },
  
  expiredDaysThreshold: {
    'capitalone': 180,         // 6 months
    'capitalone-official': 180,
    'tpg': 120,                // 4 months
    'nerdwallet': 120,
    'doctorofcredit': 60,
    'flyertalk': 90,
    'reddit': 60,
    'default': 90,
  },
};

// ============================================
// SOURCE FRESHNESS MANAGER
// ============================================

export class SourceFreshnessManager {
  private config: FreshnessConfig;
  
  constructor(config: FreshnessConfig = DEFAULT_FRESHNESS_CONFIG) {
    this.config = config;
  }
  
  /**
   * Calculate freshness status for a source
   */
  calculateFreshness(metadata: SourceMetadata): {
    status: 'fresh' | 'stale' | 'expired' | 'unknown';
    daysOld: number | undefined;
    message?: string;
  } {
    // If no timestamp, we can't determine freshness
    const timestamp = metadata.retrievedAt || metadata.publishedAt;
    if (!timestamp) {
      return { status: 'unknown', daysOld: undefined };
    }
    
    const sourceKey = metadata.source.toLowerCase();
    const staleThreshold = this.config.staleDaysThreshold[sourceKey] 
      ?? this.config.staleDaysThreshold.default;
    const expiredThreshold = this.config.expiredDaysThreshold[sourceKey]
      ?? this.config.expiredDaysThreshold.default;
    
    const daysOld = this.daysSince(timestamp);
    
    // Check explicit expiration first
    if (metadata.expiresAt) {
      const expirationDate = new Date(metadata.expiresAt);
      if (expirationDate < new Date()) {
        return {
          status: 'expired',
          daysOld,
          message: `Content expired on ${expirationDate.toLocaleDateString()}`,
        };
      }
    }
    
    // Check age-based freshness
    if (daysOld >= expiredThreshold) {
      return {
        status: 'expired',
        daysOld,
        message: `Content is ${daysOld} days old (limit: ${expiredThreshold})`,
      };
    }
    
    if (daysOld >= staleThreshold) {
      return {
        status: 'stale',
        daysOld,
        message: `Content may be outdated (${daysOld} days old)`,
      };
    }
    
    return {
      status: 'fresh',
      daysOld,
    };
  }
  
  /**
   * Check if source needs re-verification
   */
  needsReverification(metadata: SourceMetadata): boolean {
    // High-trust sources need less frequent verification
    const reverifyDays = metadata.trustTier <= 2 ? 90 : 30;
    
    if (!metadata.verifiedAt) {
      return true;
    }
    
    return this.daysSince(metadata.verifiedAt) >= reverifyDays;
  }
  
  /**
   * Get freshness display for UI
   */
  getFreshnessDisplay(metadata: SourceMetadata): {
    label: string;
    color: 'green' | 'yellow' | 'red' | 'gray';
    tooltip: string;
  } {
    const freshness = this.calculateFreshness(metadata);
    
    switch (freshness.status) {
      case 'fresh':
        return {
          label: 'Current',
          color: 'green',
          tooltip: `Verified within ${freshness.daysOld} days`,
        };
      case 'stale':
        return {
          label: 'May be outdated',
          color: 'yellow',
          tooltip: freshness.message || `Information is ${freshness.daysOld} days old`,
        };
      case 'expired':
        return {
          label: 'Outdated',
          color: 'red',
          tooltip: freshness.message || 'This information may no longer be accurate',
        };
      default:
        return {
          label: 'Unknown',
          color: 'gray',
          tooltip: 'Unable to verify when this information was last updated',
        };
    }
  }
  
  /**
   * Filter sources by freshness
   */
  filterFreshSources(chunks: ChunkWithProvenance[]): ChunkWithProvenance[] {
    return chunks.filter(chunk => {
      const freshness = this.calculateFreshness(chunk.metadata);
      return freshness.status === 'fresh' || freshness.status === 'stale';
    });
  }
  
  /**
   * Sort sources by freshness and trust
   */
  sortByFreshnessAndTrust(chunks: ChunkWithProvenance[]): ChunkWithProvenance[] {
    return [...chunks].sort((a, b) => {
      // First, sort by trust tier (lower is better)
      if (a.metadata.trustTier !== b.metadata.trustTier) {
        return a.metadata.trustTier - b.metadata.trustTier;
      }
      
      // Then by freshness status
      const freshnessOrder = { fresh: 0, stale: 1, expired: 2, unknown: 3 };
      const aFreshness = this.calculateFreshness(a.metadata);
      const bFreshness = this.calculateFreshness(b.metadata);
      
      if (freshnessOrder[aFreshness.status] !== freshnessOrder[bFreshness.status]) {
        return freshnessOrder[aFreshness.status] - freshnessOrder[bFreshness.status];
      }
      
      // Finally by retrieval score
      return (b.score || 0) - (a.score || 0);
    });
  }
  
  // ============================================
  // PRIVATE HELPERS
  // ============================================
  
  private daysSince(timestamp: string): number {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
}

// ============================================
// CONTENT HASH UTILITIES
// ============================================

/**
 * Generate a content hash for change detection
 */
export async function generateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/**
 * Check if content has changed by comparing hashes
 */
export function hasContentChanged(oldHash: string, newHash: string): boolean {
  return oldHash !== newHash;
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const sourceFreshnessManager = new SourceFreshnessManager();
