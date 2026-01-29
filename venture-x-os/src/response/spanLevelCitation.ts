// ============================================
// SPAN-LEVEL CITATION GROUNDING SYSTEM
// Verifies claims against specific source spans
// ============================================

import { ChunkWithProvenance, SourceMetadata } from '../knowledge/sourceMetadata';

// ============================================
// TYPES
// ============================================

/**
 * A specific span of text from a source document
 */
export interface CitedSpan {
  /** Unique identifier for this span */
  id: string;
  
  /** ID of the chunk this span came from */
  chunkId: string;
  
  /** ID of the source document */
  docId: string;
  
  /** Character offset where span starts in the chunk */
  startOffset: number;
  
  /** Character offset where span ends in the chunk */
  endOffset: number;
  
  /** The actual span text */
  text: string;
  
  /** Source identifier (e.g., 'capitalone', 'reddit') */
  source: string;
  
  /** Trust tier of the source (1-4) */
  trustTier: number;
  
  /** When this content was retrieved */
  retrievedAt: string;
  
  /** URL to the source (if available) */
  url?: string;
  
  /** Title of the source document */
  title?: string;
}

/**
 * Result of grounding analysis for a single claim
 */
export interface ClaimGrounding {
  /** The claim being verified */
  claim: string;
  
  /** Spans that support this claim */
  supportingSpans: CitedSpan[];
  
  /** Whether the claim is grounded in sources */
  isGrounded: boolean;
  
  /** Confidence level of the grounding */
  confidence: GroundingConfidence;
  
  /** Similarity score between claim and best supporting span */
  similarityScore: number;
  
  /** Type of claim detected */
  claimType: ClaimType;
}

/**
 * Confidence levels for claim grounding
 */
export type GroundingConfidence = 'high' | 'medium' | 'low' | 'none';

/**
 * Types of claims we can identify
 */
export type ClaimType = 
  | 'factual'       // Verifiable facts (numbers, policies)
  | 'opinion'       // Subjective statements
  | 'procedural'    // How-to instructions
  | 'comparative'   // Comparisons between options
  | 'temporal'      // Time-sensitive information
  | 'unknown';

/**
 * Result of verifying grounding for an entire response
 */
export interface GroundingVerificationResult {
  /** All claims with their grounding status */
  claims: ClaimGrounding[];
  
  /** Whether all claims are grounded */
  overallGrounded: boolean;
  
  /** Claims that couldn't be verified */
  ungroundedClaims: string[];
  
  /** Summary statistics */
  stats: GroundingStats;
}

/**
 * Statistics about grounding verification
 */
export interface GroundingStats {
  totalClaims: number;
  groundedClaims: number;
  ungroundedClaims: number;
  highConfidenceClaims: number;
  lowTrustSourceClaims: number;
  averageConfidence: number;
}

// ============================================
// SPAN-LEVEL GROUNDER
// ============================================

export class SpanLevelGrounder {
  private readonly MIN_CLAIM_LENGTH = 15;
  private readonly MIN_OVERLAP_THRESHOLD = 0.25;
  private readonly HIGH_TRUST_THRESHOLD = 2;
  
  // Stop words to exclude from key term extraction
  private readonly STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'to', 'of', 'and',
    'or', 'in', 'on', 'at', 'for', 'with', 'about', 'against', 'between',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'from', 'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further',
    'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'but', 'if', 'this', 'that', 'these', 'those', 'it', 'its', 'your',
    'you', 'we', 'they', 'he', 'she', 'what', 'which', 'who', 'whom',
  ]);
  
  // Patterns that indicate factual claims
  private readonly FACTUAL_PATTERNS = [
    /\b(is|are|was|were|costs?|earns?|gives?|provides?|includes?|offers?)\b/i,
    /\b\d+(\.\d+)?/,  // Contains numbers
    /\$\d+/,  // Dollar amounts
    /\b\d+%/,  // Percentages
    /\bper\s+(mile|point|dollar|year|month)\b/i,
  ];
  
  // Patterns for opinion/subjective claims
  private readonly OPINION_PATTERNS = [
    /\b(best|worst|better|worse|great|terrible|excellent|poor)\b/i,
    /\b(i think|i believe|in my opinion|personally)\b/i,
    /\b(recommend|suggest|should|consider)\b/i,
  ];
  
  // Patterns for temporal claims
  private readonly TEMPORAL_PATTERNS = [
    /\b(currently|now|as of|since|until|starting|ending)\b/i,
    /\b(2024|2025|2026|january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  ];
  
  // Patterns for procedural claims
  private readonly PROCEDURAL_PATTERNS = [
    /\b(to do this|you can|you need to|steps?:|first|then|next|finally)\b/i,
    /\b(how to|guide|instructions?|process)\b/i,
  ];
  
  // ============================================
  // PUBLIC METHODS
  // ============================================
  
  /**
   * Verify grounding of claims in a response against retrieved chunks
   */
  async verifyGrounding(
    response: string,
    retrievedChunks: ChunkWithProvenance[]
  ): Promise<GroundingVerificationResult> {
    // Extract claims from response
    const claims = this.extractClaims(response);
    
    // Verify each claim
    const groundedClaims: ClaimGrounding[] = [];
    const ungroundedClaims: string[] = [];
    
    for (const claim of claims) {
      const claimType = this.classifyClaimType(claim);
      const supporting = this.findSupportingSpans(claim, retrievedChunks);
      const isGrounded = supporting.length > 0;
      const confidence = this.assessConfidence(supporting, claimType);
      const similarityScore = supporting.length > 0 
        ? Math.max(...supporting.map(s => this.calculateSimilarity(claim, s.text)))
        : 0;
      
      groundedClaims.push({
        claim,
        supportingSpans: supporting,
        isGrounded,
        confidence,
        similarityScore,
        claimType,
      });
      
      if (!isGrounded) {
        ungroundedClaims.push(claim);
      }
    }
    
    // Calculate stats
    const stats = this.calculateStats(groundedClaims);
    
    return {
      claims: groundedClaims,
      overallGrounded: ungroundedClaims.length === 0,
      ungroundedClaims,
      stats,
    };
  }
  
  /**
   * Find a single best supporting span for a claim
   */
  findBestSupportingSpan(
    claim: string,
    chunks: ChunkWithProvenance[]
  ): CitedSpan | null {
    const spans = this.findSupportingSpans(claim, chunks);
    
    if (spans.length === 0) {
      return null;
    }
    
    // Return span with best combination of trust and similarity
    return spans.reduce((best, current) => {
      const bestScore = this.calculateSpanScore(best, claim);
      const currentScore = this.calculateSpanScore(current, claim);
      return currentScore > bestScore ? current : best;
    });
  }
  
  /**
   * Extract key terms from text for matching
   */
  extractKeyTerms(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\W+/)
      .filter(word => 
        word.length > 2 && 
        !this.STOP_WORDS.has(word) &&
        !/^\d+$/.test(word)
      );
  }
  
  // ============================================
  // PRIVATE METHODS
  // ============================================
  
  /**
   * Extract factual claims from response text
   */
  private extractClaims(response: string): string[] {
    const claims: string[] = [];
    
    // Split into sentences
    const sentences = response
      .replace(/\n+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(s => s.length >= this.MIN_CLAIM_LENGTH);
    
    for (const sentence of sentences) {
      // Check if sentence makes a factual claim
      const isFactual = this.FACTUAL_PATTERNS.some(p => p.test(sentence));
      const isProcedural = this.PROCEDURAL_PATTERNS.some(p => p.test(sentence));
      const isTemporal = this.TEMPORAL_PATTERNS.some(p => p.test(sentence));
      
      // Include factual, procedural, and temporal claims
      if (isFactual || isProcedural || isTemporal) {
        // Clean up the sentence
        const cleaned = sentence
          .replace(/\[[\d,]+\]/g, '') // Remove existing citation markers
          .replace(/\s+/g, ' ')
          .trim();
        
        if (cleaned.length >= this.MIN_CLAIM_LENGTH) {
          claims.push(cleaned);
        }
      }
    }
    
    return claims;
  }
  
  /**
   * Classify the type of claim
   */
  private classifyClaimType(claim: string): ClaimType {
    if (this.TEMPORAL_PATTERNS.some(p => p.test(claim))) {
      return 'temporal';
    }
    if (this.PROCEDURAL_PATTERNS.some(p => p.test(claim))) {
      return 'procedural';
    }
    if (this.OPINION_PATTERNS.some(p => p.test(claim))) {
      return 'opinion';
    }
    if (/\b(vs|versus|compared|better|worse|than)\b/i.test(claim)) {
      return 'comparative';
    }
    if (this.FACTUAL_PATTERNS.some(p => p.test(claim))) {
      return 'factual';
    }
    return 'unknown';
  }
  
  /**
   * Find spans that support a given claim
   */
  private findSupportingSpans(
    claim: string, 
    chunks: ChunkWithProvenance[]
  ): CitedSpan[] {
    const supporting: CitedSpan[] = [];
    const claimTerms = this.extractKeyTerms(claim);
    
    // Also extract any numbers from the claim for stricter matching
    const claimNumbers = this.extractNumbers(claim);
    
    for (const chunk of chunks) {
      const chunkLower = chunk.content.toLowerCase();
      const chunkTerms = this.extractKeyTerms(chunk.content);
      
      // Calculate term overlap
      const matchedTerms = claimTerms.filter(term => 
        chunkLower.includes(term.toLowerCase())
      );
      
      const overlapRatio = claimTerms.length > 0 
        ? matchedTerms.length / claimTerms.length 
        : 0;
      
      // For claims with numbers, verify numbers are present in chunk
      const numbersMatch = claimNumbers.length === 0 || 
        claimNumbers.some(num => chunk.content.includes(num));
      
      // Require sufficient overlap AND number match (if numbers present)
      if (overlapRatio >= this.MIN_OVERLAP_THRESHOLD && numbersMatch) {
        const span = this.findBestSpanInChunk(claim, chunk);
        if (span) {
          supporting.push(span);
        }
      }
    }
    
    // Sort by trust tier (lower is better) then by similarity
    return supporting.sort((a, b) => {
      if (a.trustTier !== b.trustTier) {
        return a.trustTier - b.trustTier;
      }
      const simA = this.calculateSimilarity(claim, a.text);
      const simB = this.calculateSimilarity(claim, b.text);
      return simB - simA;
    });
  }
  
  /**
   * Find the best supporting span within a single chunk
   */
  private findBestSpanInChunk(
    claim: string, 
    chunk: ChunkWithProvenance
  ): CitedSpan | null {
    // Split chunk into sentences
    const sentences = chunk.content.split(/(?<=[.!?])\s+/);
    
    let bestScore = 0;
    let bestSentence = '';
    let bestOffset = 0;
    
    let offset = 0;
    for (const sentence of sentences) {
      const score = this.calculateSimilarity(claim, sentence);
      if (score > bestScore) {
        bestScore = score;
        bestSentence = sentence.trim();
        bestOffset = offset;
      }
      offset += sentence.length + 1;
    }
    
    // Require minimum similarity
    if (bestScore < this.MIN_OVERLAP_THRESHOLD) {
      return null;
    }
    
    return {
      id: `${chunk.id}_span_${bestOffset}`,
      chunkId: chunk.id,
      docId: chunk.metadata.id,
      startOffset: bestOffset,
      endOffset: bestOffset + bestSentence.length,
      text: bestSentence,
      source: chunk.metadata.source,
      trustTier: chunk.metadata.trustTier,
      retrievedAt: chunk.metadata.retrievedAt,
      url: chunk.metadata.url,
      title: chunk.metadata.title,
    };
  }
  
  /**
   * Calculate Jaccard similarity between two texts
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const terms1 = new Set(this.extractKeyTerms(text1));
    const terms2 = new Set(this.extractKeyTerms(text2));
    
    if (terms1.size === 0 || terms2.size === 0) {
      return 0;
    }
    
    const intersection = new Set([...terms1].filter(x => terms2.has(x)));
    const union = new Set([...terms1, ...terms2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  /**
   * Calculate overall score for a span (combining trust and similarity)
   */
  private calculateSpanScore(span: CitedSpan, claim: string): number {
    const similarity = this.calculateSimilarity(claim, span.text);
    
    // Trust factor: tier 1 = 1.0, tier 4 = 0.6
    const trustFactor = 1.0 - (span.trustTier - 1) * 0.1;
    
    return similarity * trustFactor;
  }
  
  /**
   * Extract numbers from text (for verification)
   */
  private extractNumbers(text: string): string[] {
    const numbers: string[] = [];
    
    // Match various number formats
    const patterns = [
      /\$[\d,]+(?:\.\d{2})?/g,  // Dollar amounts
      /\d+(?:,\d{3})*(?:\.\d+)?%?/g,  // Regular numbers and percentages
    ];
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        numbers.push(...matches);
      }
    }
    
    return [...new Set(numbers)];
  }
  
  /**
   * Assess confidence level based on supporting spans
   */
  private assessConfidence(
    spans: CitedSpan[], 
    claimType: ClaimType
  ): GroundingConfidence {
    if (spans.length === 0) {
      return 'none';
    }
    
    // Higher confidence if supported by high-trust sources
    const highTrustSpans = spans.filter(s => s.trustTier <= this.HIGH_TRUST_THRESHOLD);
    
    // Opinions get lower confidence even with sources
    if (claimType === 'opinion') {
      return highTrustSpans.length > 0 ? 'medium' : 'low';
    }
    
    // Temporal claims need fresh high-trust sources
    if (claimType === 'temporal') {
      return highTrustSpans.length > 0 ? 'medium' : 'low';
    }
    
    // Factual claims with high-trust sources get high confidence
    if (highTrustSpans.length > 0) {
      return 'high';
    }
    
    // Multiple low-trust sources provide medium confidence
    if (spans.length >= 2) {
      return 'medium';
    }
    
    return 'low';
  }
  
  /**
   * Calculate statistics for grounding results
   */
  private calculateStats(claims: ClaimGrounding[]): GroundingStats {
    const totalClaims = claims.length;
    const groundedClaims = claims.filter(c => c.isGrounded).length;
    const ungroundedClaims = totalClaims - groundedClaims;
    const highConfidenceClaims = claims.filter(c => c.confidence === 'high').length;
    const lowTrustSourceClaims = claims.filter(c => 
      c.supportingSpans.length > 0 && 
      c.supportingSpans[0].trustTier > this.HIGH_TRUST_THRESHOLD
    ).length;
    
    // Calculate average confidence as a number
    const confidenceMap = { high: 1, medium: 0.66, low: 0.33, none: 0 };
    const averageConfidence = totalClaims > 0
      ? claims.reduce((sum, c) => sum + confidenceMap[c.confidence], 0) / totalClaims
      : 0;
    
    return {
      totalClaims,
      groundedClaims,
      ungroundedClaims,
      highConfidenceClaims,
      lowTrustSourceClaims,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
    };
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const spanLevelGrounder = new SpanLevelGrounder();
