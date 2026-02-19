// ============================================
// CITATION FORMATTER
// Formats citations for display in responses
// ============================================

import { 
  CitedSpan, 
  ClaimGrounding, 
  GroundingVerificationResult,
  GroundingConfidence,
} from './spanLevelCitation';
import { SourceMetadata, sourceFreshnessManager } from '../knowledge/sourceMetadata';

// ============================================
// TYPES
// ============================================

/**
 * Options for formatting citations
 */
export interface CitationFormatOptions {
  /** Maximum length of quoted text */
  maxQuoteLength: number;
  
  /** Whether to include freshness warnings */
  showFreshnessWarnings: boolean;
  
  /** Whether to include trust tier badges */
  showTrustBadges: boolean;
  
  /** Format for inline citations */
  inlineFormat: 'number' | 'superscript' | 'bracket';
  
  /** Whether to show unverified markers */
  markUnverified: boolean;
  
  /** Maximum citations to show in footnotes */
  maxFootnotes: number;
}

/**
 * Default citation format options
 */
export const DEFAULT_CITATION_OPTIONS: CitationFormatOptions = {
  maxQuoteLength: 150,
  showFreshnessWarnings: true,
  showTrustBadges: true,
  inlineFormat: 'bracket',
  markUnverified: true,
  maxFootnotes: 10,
};

/**
 * Formatted citation output
 */
export interface FormattedCitation {
  /** Citation number/index */
  index: number;
  
  /** The quoted text (truncated if needed) */
  quote: string;
  
  /** Source attribution line */
  attribution: string;
  
  /** Trust badge (emoji) */
  trustBadge: string;
  
  /** Freshness indicator */
  freshnessIndicator?: string;
  
  /** Full formatted citation line */
  formatted: string;
  
  /** URL if available */
  url?: string;
}

/**
 * Response with inline citations and footnotes
 */
export interface CitedResponse {
  /** Response text with inline citation markers */
  body: string;
  
  /** Formatted footnotes */
  footnotes: FormattedCitation[];
  
  /** HTML/Markdown formatted full response */
  formattedFull: string;
  
  /** Statistics about citations */
  citationStats: {
    totalCitations: number;
    unverifiedClaims: number;
    highTrustCitations: number;
    lowTrustCitations: number;
  };
}

// ============================================
// CITATION FORMATTER CLASS
// ============================================

export class CitationFormatter {
  private options: CitationFormatOptions;
  
  // Source type labels
  private readonly SOURCE_LABELS: Record<string, string> = {
    'capitalone': '🏦 Capital One',
    'capitalone-official': '🏦 Capital One Official',
    'partner-official': '✈️ Partner Official',
    'curated': '📚 VentureX Guide',
    'tpg': '✈️ The Points Guy',
    'nerdwallet': '💳 NerdWallet',
    'doctorofcredit': '📊 Doctor of Credit',
    'flyertalk': '💬 FlyerTalk',
    'reddit': '📝 Reddit',
    'reddit-post': '📝 Reddit',
    'reddit-comment': '💬 Reddit Comment',
    'custom': '📄 Source',
  };
  
  // Trust tier badges (0-2 scale: 0=Official, 1=Guide, 2=Community)
  private readonly TRUST_BADGES: Record<number, string> = {
    0: '✓',   // Verified official (Capital One)
    1: '◐',   // Trusted guide (TPG, NerdWallet, etc.)
    2: '⚠',   // Community/unverified (Reddit, FlyerTalk)
  };
  
  constructor(options: Partial<CitationFormatOptions> = {}) {
    this.options = { ...DEFAULT_CITATION_OPTIONS, ...options };
  }
  
  // ============================================
  // PUBLIC METHODS
  // ============================================
  
  /**
   * Format a single span as a citation
   */
  formatSpanCitation(span: CitedSpan, index: number): FormattedCitation {
    const quote = this.truncateQuote(span.text);
    const attribution = this.formatAttribution(span);
    const trustBadge = this.getTrustBadge(span.trustTier);
    const freshnessIndicator = this.options.showFreshnessWarnings 
      ? this.getFreshnessIndicator(span)
      : undefined;
    
    const formatted = this.buildCitationLine(index, quote, attribution, trustBadge, freshnessIndicator);
    
    return {
      index,
      quote,
      attribution,
      trustBadge,
      freshnessIndicator,
      formatted,
      url: span.url,
    };
  }
  
  /**
   * Add inline citations to response text based on grounding results
   */
  addInlineCitations(
    response: string,
    groundingResult: GroundingVerificationResult
  ): CitedResponse {
    let citedBody = response;
    const footnotes: FormattedCitation[] = [];
    let citationIndex = 1;
    
    // Track stats
    let unverifiedClaims = 0;
    let highTrustCitations = 0;
    let lowTrustCitations = 0;
    
    // Process each claim
    for (const { claim, supportingSpans, isGrounded, confidence } of groundingResult.claims) {
      if (!isGrounded && this.options.markUnverified) {
        // Mark ungrounded claims
        citedBody = this.addUnverifiedMarker(citedBody, claim);
        unverifiedClaims++;
      } else if (isGrounded && supportingSpans.length > 0) {
        // Add citation for grounded claims
        const bestSpan = supportingSpans[0];
        const marker = this.formatInlineMarker(citationIndex);
        
        // Try to add citation marker after the claim
        citedBody = this.insertCitationMarker(citedBody, claim, marker);
        
        // Create footnote
        if (footnotes.length < this.options.maxFootnotes) {
          const footnote = this.formatSpanCitation(bestSpan, citationIndex);
          footnotes.push(footnote);
          
          // Track trust level (0=Official, 1=Guide → high; 2=Community → low)
          if (bestSpan.trustTier <= 1) {
            highTrustCitations++;
          } else {
            lowTrustCitations++;
          }
        }
        
        citationIndex++;
      }
    }
    
    // Build full formatted response
    const formattedFull = this.buildFullResponse(citedBody, footnotes);
    
    return {
      body: citedBody,
      footnotes,
      formattedFull,
      citationStats: {
        totalCitations: footnotes.length,
        unverifiedClaims,
        highTrustCitations,
        lowTrustCitations,
      },
    };
  }
  
  /**
   * Format citations for a simple list of sources
   */
  formatSourceList(spans: CitedSpan[]): string {
    if (spans.length === 0) {
      return '';
    }
    
    const lines: string[] = ['**Sources:**'];
    
    const uniqueSpans = this.deduplicateSpans(spans);
    const toShow = uniqueSpans.slice(0, this.options.maxFootnotes);
    
    for (let i = 0; i < toShow.length; i++) {
      const citation = this.formatSpanCitation(toShow[i], i + 1);
      lines.push(citation.formatted);
    }
    
    if (uniqueSpans.length > this.options.maxFootnotes) {
      lines.push(`... and ${uniqueSpans.length - this.options.maxFootnotes} more sources`);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Format a confidence indicator for display
   */
  formatConfidenceIndicator(confidence: GroundingConfidence): string {
    switch (confidence) {
      case 'high':
        return '●●●';
      case 'medium':
        return '●●○';
      case 'low':
        return '●○○';
      case 'none':
        return '○○○';
    }
  }
  
  /**
   * Format provenance for UI display
   */
  formatProvenanceForUI(metadata: Partial<SourceMetadata>): string {
    const parts: string[] = [];
    
    // Source label
    const sourceKey = metadata.source?.toLowerCase() || 'custom';
    parts.push(this.SOURCE_LABELS[sourceKey] || this.SOURCE_LABELS.custom);
    
    // Verification date for official/guide sources (Tier 0-1)
    // NOTE: Use !== undefined check because Tier 0 is falsy in JS
    if (metadata.trustTier !== undefined && metadata.trustTier <= 1) {
      if (metadata.verifiedAt) {
        parts.push(`Verified ${this.formatDate(metadata.verifiedAt)}`);
      } else if (metadata.retrievedAt) {
        parts.push(`Retrieved ${this.formatDate(metadata.retrievedAt)}`);
      }
    }
    
    // For community sources (Tier 2), just show retrieval date
    if (metadata.trustTier !== undefined && metadata.trustTier >= 2 && metadata.retrievedAt) {
      parts.push(this.formatDate(metadata.retrievedAt));
    }
    
    return parts.join(' • ');
  }
  
  // ============================================
  // PRIVATE METHODS
  // ============================================
  
  /**
   * Truncate quote text to max length
   */
  private truncateQuote(text: string): string {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    
    if (cleaned.length <= this.options.maxQuoteLength) {
      return cleaned;
    }
    
    // Try to truncate at a word boundary
    const truncated = cleaned.slice(0, this.options.maxQuoteLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > this.options.maxQuoteLength * 0.7) {
      return truncated.slice(0, lastSpace) + '...';
    }
    
    return truncated + '...';
  }
  
  /**
   * Format source attribution
   */
  private formatAttribution(span: CitedSpan): string {
    const sourceLabel = this.SOURCE_LABELS[span.source.toLowerCase()] 
      || this.SOURCE_LABELS.custom;
    
    const parts = [sourceLabel];
    
    if (span.title) {
      parts.push(`"${span.title}"`);
    }
    
    if (span.retrievedAt) {
      parts.push(this.formatDate(span.retrievedAt));
    }
    
    return parts.join(' • ');
  }
  
  /**
   * Get trust badge emoji
   */
  private getTrustBadge(trustTier: number): string {
    if (!this.options.showTrustBadges) {
      return '';
    }
    
    return this.TRUST_BADGES[trustTier] || this.TRUST_BADGES[2];
  }
  
  /**
   * Get freshness indicator if content may be stale
   */
  private getFreshnessIndicator(span: CitedSpan): string | undefined {
    const metadata: Partial<SourceMetadata> = {
      id: span.docId,
      source: span.source,
      retrievedAt: span.retrievedAt,
      trustTier: span.trustTier as 0 | 1 | 2,
      contentHash: '',
      version: 1,
      isActive: true,
    };
    
    const display = sourceFreshnessManager.getFreshnessDisplay(metadata as SourceMetadata);
    
    if (display.color === 'yellow') {
      return '⏳';
    } else if (display.color === 'red') {
      return '⚠️';
    }
    
    return undefined;
  }
  
  /**
   * Build a formatted citation line
   */
  private buildCitationLine(
    index: number,
    quote: string,
    attribution: string,
    trustBadge: string,
    freshnessIndicator?: string
  ): string {
    const parts: string[] = [`[${index}]`];
    
    if (trustBadge) {
      parts.push(trustBadge);
    }
    
    if (freshnessIndicator) {
      parts.push(freshnessIndicator);
    }
    
    parts.push(`"${quote}"`);
    parts.push('—');
    parts.push(attribution);
    
    return parts.join(' ');
  }
  
  /**
   * Format inline citation marker
   */
  private formatInlineMarker(index: number): string {
    switch (this.options.inlineFormat) {
      case 'superscript':
        return `⁽${index}⁾`;
      case 'number':
        return `(${index})`;
      case 'bracket':
      default:
        return `[${index}]`;
    }
  }
  
  /**
   * Add unverified marker to a claim in the response
   */
  private addUnverifiedMarker(response: string, claim: string): string {
    // Find the claim in the response and add marker
    const escapedClaim = claim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedClaim})([.!?]?)`, 'i');
    
    return response.replace(regex, '$1 [unverified]$2');
  }
  
  /**
   * Insert citation marker after a claim in the response
   */
  private insertCitationMarker(response: string, claim: string, marker: string): string {
    // Find the claim and add marker at end
    const escapedClaim = claim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedClaim})([.!?]?)`, 'i');
    
    return response.replace(regex, `$1${marker}$2`);
  }
  
  /**
   * Build full formatted response with footnotes
   */
  private buildFullResponse(body: string, footnotes: FormattedCitation[]): string {
    if (footnotes.length === 0) {
      return body;
    }
    
    const lines = [body, '', '---', '**Sources:**'];
    
    for (const footnote of footnotes) {
      lines.push(footnote.formatted);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Deduplicate spans by document ID
   */
  private deduplicateSpans(spans: CitedSpan[]): CitedSpan[] {
    const seen = new Set<string>();
    const unique: CitedSpan[] = [];
    
    for (const span of spans) {
      if (!seen.has(span.docId)) {
        seen.add(span.docId);
        unique.push(span);
      }
    }
    
    return unique;
  }
  
  /**
   * Format date for display
   */
  private formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Quick format a single citation
 */
export function formatCitationWithSpan(span: CitedSpan, index: number): string {
  const formatter = new CitationFormatter();
  return formatter.formatSpanCitation(span, index).formatted;
}

/**
 * Quick add inline citations to a response
 */
export function addInlineCitations(
  response: string,
  grounding: GroundingVerificationResult,
  options?: Partial<CitationFormatOptions>
): CitedResponse {
  const formatter = new CitationFormatter(options);
  return formatter.addInlineCitations(response, grounding);
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const citationFormatter = new CitationFormatter();
