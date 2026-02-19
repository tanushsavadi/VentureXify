// ============================================
// SPAN-LEVEL CITATION TESTS
// Tests for citation grounding and formatting
// ============================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SpanLevelGrounder,
  spanLevelGrounder,
  type CitedSpan,
  type GroundingVerificationResult,
} from '../response/spanLevelCitation';
import {
  CitationFormatter,
  citationFormatter,
  formatCitationWithSpan,
} from '../response/citationFormatter';
import { ChunkWithProvenance, SourceMetadata } from '../knowledge/sourceMetadata';

// ============================================
// TEST DATA
// ============================================

function createMockChunk(
  id: string,
  content: string,
  source: string = 'capitalone',
  trustTier: 0 | 1 | 2 = 0
): ChunkWithProvenance {
  const metadata: SourceMetadata = {
    id,
    source,
    retrievedAt: new Date().toISOString(),
    trustTier,
    contentHash: 'abc123',
    version: 1,
    isActive: true,
    title: `Test Document ${id}`,
    url: `https://example.com/doc/${id}`,
  };
  
  return {
    id,
    content,
    metadata,
    score: 0.85,
    rankPosition: 1,
    freshnessStatus: 'fresh',
    daysOld: 5,
  };
}

function createMockSpan(
  id: string,
  text: string,
  source: string = 'capitalone',
  trustTier: number = 1
): CitedSpan {
  return {
    id,
    chunkId: `chunk_${id}`,
    docId: `doc_${id}`,
    startOffset: 0,
    endOffset: text.length,
    text,
    source,
    trustTier,
    retrievedAt: new Date().toISOString(),
    url: `https://example.com/${id}`,
    title: `Source ${id}`,
  };
}

// ============================================
// SPAN-LEVEL GROUNDER TESTS
// ============================================

describe('SpanLevelGrounder', () => {
  let grounder: SpanLevelGrounder;
  
  beforeEach(() => {
    grounder = new SpanLevelGrounder();
  });
  
  describe('extractKeyTerms', () => {
    it('should extract meaningful terms', () => {
      const terms = grounder.extractKeyTerms('The annual fee is $395 for the Venture X card');
      
      expect(terms).toContain('annual');
      expect(terms).toContain('fee');
      expect(terms).toContain('venture');
      expect(terms).toContain('card');
      // Stop words should be excluded
      expect(terms).not.toContain('the');
      expect(terms).not.toContain('is');
      expect(terms).not.toContain('for');
    });
    
    it('should handle empty strings', () => {
      const terms = grounder.extractKeyTerms('');
      expect(terms).toEqual([]);
    });
    
    it('should filter short words', () => {
      const terms = grounder.extractKeyTerms('I am a VX cardholder');
      
      expect(terms).toContain('cardholder');
      expect(terms).not.toContain('am');
      expect(terms).not.toContain('vx'); // Too short
    });
  });
  
  describe('verifyGrounding', () => {
    it('should verify grounded claims', async () => {
      const response = 'The annual fee is $395. You earn 5x miles on portal bookings.';
      const chunks = [
        createMockChunk('1', 'The Capital One Venture X card has an annual fee of $395.'),
        createMockChunk('2', 'Earn 5x miles per dollar on flights and hotels booked through the Capital One Travel portal.'),
      ];
      
      const result = await grounder.verifyGrounding(response, chunks);
      
      expect(result.overallGrounded).toBe(true);
      expect(result.ungroundedClaims.length).toBe(0);
      expect(result.claims.length).toBeGreaterThan(0);
    });
    
    it('should detect ungrounded claims', async () => {
      const response = 'The annual fee is $395. You get 100,000 bonus miles.';
      const chunks = [
        createMockChunk('1', 'The Capital One Venture X card has an annual fee of $395.'),
        // No chunk mentioning 100,000 bonus miles
      ];
      
      const result = await grounder.verifyGrounding(response, chunks);
      
      expect(result.overallGrounded).toBe(false);
      expect(result.ungroundedClaims.length).toBeGreaterThan(0);
    });
    
    it('should return empty stats for empty response', async () => {
      const result = await grounder.verifyGrounding('', []);
      
      expect(result.claims.length).toBe(0);
      expect(result.overallGrounded).toBe(true); // No claims = all grounded
      expect(result.stats.totalClaims).toBe(0);
    });
    
    it('should assess confidence correctly', async () => {
      const response = 'The annual fee is $395.';
      const highTrustChunks = [
        createMockChunk('1', 'Annual fee: $395', 'capitalone', 1),
      ];
      const highTrustResult = await grounder.verifyGrounding(response, highTrustChunks);
      
      // High trust source should give higher confidence
      expect(highTrustResult.claims[0]?.confidence).not.toBe('none');
    });
  });
  
  describe('findBestSupportingSpan', () => {
    it('should find best matching span', () => {
      const claim = 'The annual fee is $395';
      const chunks = [
        createMockChunk('1', 'Welcome to the card page. The annual fee is $395 per year.'),
        createMockChunk('2', 'Our card offers great benefits.'),
      ];
      
      const span = grounder.findBestSupportingSpan(claim, chunks);
      
      expect(span).not.toBeNull();
      expect(span?.text).toContain('annual fee');
    });
    
    it('should return null when no match found', () => {
      const claim = 'You get unlimited lounge access';
      const chunks = [
        createMockChunk('1', 'The annual fee is $395.'),
      ];
      
      const span = grounder.findBestSupportingSpan(claim, chunks);
      
      expect(span).toBeNull();
    });
    
    it('should prefer high-trust sources', () => {
      const claim = 'The annual fee is $395';
      const chunks = [
        createMockChunk('1', 'Reddit says annual fee is $395', 'reddit', 2),
        createMockChunk('2', 'Official: Annual fee is $395', 'capitalone', 0),
      ];
      
      const span = grounder.findBestSupportingSpan(claim, chunks);
      
      expect(span).not.toBeNull();
      // Should prefer the official source (Tier 0)
      expect(span?.trustTier).toBe(0);
    });
  });
  
  describe('claim type classification', () => {
    it('should classify temporal claims', async () => {
      const response = 'As of January 2024, the annual fee is $395.';
      const chunks = [
        createMockChunk('1', 'Starting January 2024, the annual fee will be $395.'),
      ];
      
      const result = await grounder.verifyGrounding(response, chunks);
      
      const temporalClaim = result.claims.find(c => c.claimType === 'temporal');
      expect(temporalClaim).toBeDefined();
    });
    
    it('should classify factual claims with numbers', async () => {
      const response = 'You earn 5x miles per dollar.';
      const chunks = [
        createMockChunk('1', 'Earn 5x miles per dollar on portal bookings.'),
      ];
      
      const result = await grounder.verifyGrounding(response, chunks);
      
      expect(result.claims.length).toBeGreaterThan(0);
      expect(result.claims[0]?.claimType).toBe('factual');
    });
  });
});

// ============================================
// CITATION FORMATTER TESTS
// ============================================

describe('CitationFormatter', () => {
  let formatter: CitationFormatter;
  
  beforeEach(() => {
    formatter = new CitationFormatter();
  });
  
  describe('formatSpanCitation', () => {
    it('should format citation with all components', () => {
      const span = createMockSpan('1', 'The annual fee is $395.', 'capitalone', 0);
      
      const citation = formatter.formatSpanCitation(span, 1);
      
      expect(citation.index).toBe(1);
      expect(citation.quote).toContain('annual fee');
      expect(citation.trustBadge).toBe('✓'); // Tier 0 (Official) badge
      expect(citation.formatted).toContain('[1]');
    });
    
    it('should truncate long quotes', () => {
      const longText = 'A'.repeat(300);
      const span = createMockSpan('1', longText, 'capitalone', 1);
      
      const citation = formatter.formatSpanCitation(span, 1);
      
      expect(citation.quote.length).toBeLessThanOrEqual(153); // 150 + "..."
      expect(citation.quote.endsWith('...')).toBe(true);
    });
    
    it('should show correct trust badges (0-2 scale)', () => {
      const tier0 = formatter.formatSpanCitation(createMockSpan('1', 'Test', 'capitalone', 0), 1);
      const tier1 = formatter.formatSpanCitation(createMockSpan('2', 'Test', 'tpg', 1), 2);
      const tier2 = formatter.formatSpanCitation(createMockSpan('3', 'Test', 'reddit', 2), 3);
      
      expect(tier0.trustBadge).toBe('✓');   // Tier 0: Official
      expect(tier1.trustBadge).toBe('◐');   // Tier 1: Guide
      expect(tier2.trustBadge).toBe('⚠');   // Tier 2: Community
    });
  });
  
  describe('addInlineCitations', () => {
    it('should add citations to grounded claims', () => {
      const response = 'The annual fee is $395. You earn 5x miles on portal bookings.';
      const grounding: GroundingVerificationResult = {
        claims: [
          {
            claim: 'The annual fee is $395',
            supportingSpans: [createMockSpan('1', 'Annual fee: $395')],
            isGrounded: true,
            confidence: 'high',
            similarityScore: 0.8,
            claimType: 'factual',
          },
          {
            claim: 'You earn 5x miles on portal bookings',
            supportingSpans: [createMockSpan('2', 'Earn 5x miles per dollar')],
            isGrounded: true,
            confidence: 'high',
            similarityScore: 0.7,
            claimType: 'factual',
          },
        ],
        overallGrounded: true,
        ungroundedClaims: [],
        stats: {
          totalClaims: 2,
          groundedClaims: 2,
          ungroundedClaims: 0,
          highConfidenceClaims: 2,
          lowTrustSourceClaims: 0,
          averageConfidence: 1.0,
        },
      };
      
      const result = formatter.addInlineCitations(response, grounding);
      
      expect(result.body).toContain('[1]');
      expect(result.body).toContain('[2]');
      expect(result.footnotes.length).toBe(2);
      expect(result.citationStats.totalCitations).toBe(2);
    });
    
    it('should mark ungrounded claims as unverified', () => {
      const response = 'You get 100,000 bonus miles.';
      const grounding: GroundingVerificationResult = {
        claims: [
          {
            claim: 'You get 100,000 bonus miles',
            supportingSpans: [],
            isGrounded: false,
            confidence: 'none',
            similarityScore: 0,
            claimType: 'factual',
          },
        ],
        overallGrounded: false,
        ungroundedClaims: ['You get 100,000 bonus miles'],
        stats: {
          totalClaims: 1,
          groundedClaims: 0,
          ungroundedClaims: 1,
          highConfidenceClaims: 0,
          lowTrustSourceClaims: 0,
          averageConfidence: 0,
        },
      };
      
      const result = formatter.addInlineCitations(response, grounding);
      
      expect(result.body).toContain('[unverified]');
      expect(result.citationStats.unverifiedClaims).toBe(1);
    });
    
    it('should track high vs low trust citations', () => {
      const response = 'The annual fee is $395.';
      const grounding: GroundingVerificationResult = {
        claims: [
          {
            claim: 'The annual fee is $395',
            supportingSpans: [createMockSpan('1', 'Annual fee: $395', 'reddit', 2)],
            isGrounded: true,
            confidence: 'low',
            similarityScore: 0.6,
            claimType: 'factual',
          },
        ],
        overallGrounded: true,
        ungroundedClaims: [],
        stats: {
          totalClaims: 1,
          groundedClaims: 1,
          ungroundedClaims: 0,
          highConfidenceClaims: 0,
          lowTrustSourceClaims: 1,
          averageConfidence: 0.33,
        },
      };
      
      const result = formatter.addInlineCitations(response, grounding);
      
      expect(result.citationStats.lowTrustCitations).toBe(1);
      expect(result.citationStats.highTrustCitations).toBe(0);
    });
  });
  
  describe('formatSourceList', () => {
    it('should format source list', () => {
      const spans = [
        createMockSpan('1', 'Source 1 content', 'capitalone', 1),
        createMockSpan('2', 'Source 2 content', 'tpg', 2),
      ];
      
      const result = formatter.formatSourceList(spans);
      
      expect(result).toContain('**Sources:**');
      expect(result).toContain('[1]');
      expect(result).toContain('[2]');
    });
    
    it('should return empty string for no sources', () => {
      const result = formatter.formatSourceList([]);
      expect(result).toBe('');
    });
    
    it('should limit to max footnotes', () => {
      const spans = Array.from({ length: 15 }, (_, i) => 
        createMockSpan(`${i}`, `Source ${i} content`, 'capitalone', 1)
      );
      
      const customFormatter = new CitationFormatter({ maxFootnotes: 5 });
      const result = customFormatter.formatSourceList(spans);
      
      expect(result).toContain('[5]');
      expect(result).not.toContain('[6]');
      expect(result).toContain('... and 10 more sources');
    });
  });
  
  describe('formatConfidenceIndicator', () => {
    it('should return correct indicators', () => {
      expect(formatter.formatConfidenceIndicator('high')).toBe('●●●');
      expect(formatter.formatConfidenceIndicator('medium')).toBe('●●○');
      expect(formatter.formatConfidenceIndicator('low')).toBe('●○○');
      expect(formatter.formatConfidenceIndicator('none')).toBe('○○○');
    });
  });
  
  describe('formatProvenanceForUI', () => {
    it('should format provenance with verification date', () => {
      const metadata: Partial<SourceMetadata> = {
        source: 'capitalone',
        trustTier: 1,
        verifiedAt: '2024-01-15T00:00:00Z',
        retrievedAt: '2024-01-10T00:00:00Z',
      };
      
      const result = formatter.formatProvenanceForUI(metadata);
      
      expect(result).toContain('🏦 Capital One');
      expect(result).toContain('Verified');
    });
    
    it('should show retrieval date for low trust sources', () => {
      const metadata: Partial<SourceMetadata> = {
        source: 'reddit',
        trustTier: 2,
        retrievedAt: '2024-01-10T00:00:00Z',
      };
      
      const result = formatter.formatProvenanceForUI(metadata);
      
      expect(result).toContain('📝 Reddit');
      expect(result).toContain('Jan 2024');
    });
  });
});

// ============================================
// CONVENIENCE FUNCTION TESTS
// ============================================

describe('Convenience Functions', () => {
  it('formatCitationWithSpan should work', () => {
    const span = createMockSpan('1', 'Test content', 'capitalone', 1);
    const result = formatCitationWithSpan(span, 1);
    
    expect(result).toContain('[1]');
    expect(result).toContain('Test content');
  });
});

// ============================================
// SINGLETON TESTS
// ============================================

describe('Singleton Instances', () => {
  it('spanLevelGrounder should be available', () => {
    expect(spanLevelGrounder).toBeInstanceOf(SpanLevelGrounder);
  });
  
  it('citationFormatter should be available', () => {
    expect(citationFormatter).toBeInstanceOf(CitationFormatter);
  });
});
