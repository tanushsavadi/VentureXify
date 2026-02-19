/**
 * Unit tests for Lightweight Re-ranker
 * 
 * @module __tests__/reranker.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  LightweightReranker,
  createReranker,
  defaultReranker,
  type RerankerConfig,
} from '../knowledge/retrieval/reranker';
import type { ChunkWithProvenance, SourceMetadata } from '../knowledge/sourceMetadata';

// ============================================
// TEST HELPERS
// ============================================

function createMockChunk(
  id: string,
  content: string,
  trustTier: 0 | 1 | 2 = 2,
  score: number = 0.8
): ChunkWithProvenance {
  const metadata: SourceMetadata = {
    id: `doc-${id}`,
    source: 'test',
    retrievedAt: new Date().toISOString(),
    trustTier,
    contentHash: 'abc123',
    version: 1,
    isActive: true,
  };

  return {
    id,
    content,
    metadata,
    score,
    freshnessStatus: 'fresh',
  };
}

function createMockChunks(count: number): ChunkWithProvenance[] {
  return Array.from({ length: count }, (_, i) => 
    createMockChunk(`chunk-${i}`, `Content for chunk ${i}`, 2, 0.8 - i * 0.01)
  );
}

// ============================================
// MOCK FETCH
// ============================================

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
  
  // Mock chrome.storage.local
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({ hf_api_key: 'test-api-key' }),
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ============================================
// TESTS: Constructor and Configuration
// ============================================

describe('LightweightReranker', () => {
  describe('constructor and configuration', () => {
    it('should create with default configuration', () => {
      const reranker = new LightweightReranker();
      const config = reranker.getConfig();
      
      expect(config.maxDocs).toBe(20);
      expect(config.timeoutMs).toBe(2000);
      expect(config.maxContentLength).toBe(300);
      expect(config.minScore).toBe(0.0);
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<RerankerConfig> = {
        maxDocs: 10,
        timeoutMs: 5000,
        minScore: 0.5,
      };
      
      const reranker = new LightweightReranker(customConfig);
      const config = reranker.getConfig();
      
      expect(config.maxDocs).toBe(10);
      expect(config.timeoutMs).toBe(5000);
      expect(config.minScore).toBe(0.5);
    });

    it('should allow setting API key', async () => {
      const reranker = new LightweightReranker();
      reranker.setApiKey('custom-key');
      
      // The key should be used in subsequent requests
      expect(await reranker.isAvailable()).toBe(true);
    });
  });

  // ============================================
  // TESTS: Basic Reranking
  // ============================================

  describe('rerank()', () => {
    it('should return empty results for empty input', async () => {
      const reranker = new LightweightReranker();
      
      const { results, stats } = await reranker.rerank('test query', []);
      
      expect(results).toHaveLength(0);
      expect(stats.inputCount).toBe(0);
      expect(stats.rerankedCount).toBe(0);
    });

    it('should rerank documents when API succeeds', async () => {
      const reranker = new LightweightReranker();
      const chunks = createMockChunks(5);
      
      // Mock successful API response with scores
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([0.9, 0.3, 0.7, 0.1, 0.5]),
      });
      
      const { results, stats } = await reranker.rerank('test query', chunks);
      
      expect(results).toHaveLength(5);
      expect(stats.rerankedCount).toBe(5);
      expect(stats.usedFallback).toBe(false);
      
      // Should be sorted by rerank score (after sigmoid)
      expect(results[0].document.id).toBe('chunk-0'); // 0.9 -> highest sigmoid
      expect(results[0].wasReranked).toBe(true);
    });

    it('should respect maxDocs limit', async () => {
      const reranker = new LightweightReranker({ maxDocs: 3 });
      const chunks = createMockChunks(10);
      
      // Mock response for only 3 docs
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([0.8, 0.6, 0.9]),
      });
      
      const { results, stats } = await reranker.rerank('test query', chunks);
      
      expect(results).toHaveLength(10);
      expect(stats.rerankedCount).toBe(3);
      
      // First 3 should be reranked
      expect(results[0].wasReranked).toBe(true);
      expect(results[1].wasReranked).toBe(true);
      expect(results[2].wasReranked).toBe(true);
      
      // Rest should not be reranked
      expect(results[3].wasReranked).toBe(false);
    });

    it('should truncate content to maxContentLength', async () => {
      const reranker = new LightweightReranker({ maxContentLength: 50 });
      const longContent = 'A'.repeat(500);
      const chunks = [createMockChunk('long', longContent)];
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([0.7]),
      });
      
      await reranker.rerank('test query', chunks);
      
      // Check that the request body has truncated content
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.inputs[0][1].length).toBeLessThanOrEqual(50);
    });
  });

  // ============================================
  // TESTS: Fallback Behavior
  // ============================================

  describe('fallback behavior', () => {
    it('should fallback when no API key available', async () => {
      vi.stubGlobal('chrome', {
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({}), // No API key
          },
        },
      });
      
      const reranker = new LightweightReranker();
      const chunks = createMockChunks(3);
      
      const { results, stats } = await reranker.rerank('test query', chunks);
      
      expect(results).toHaveLength(3);
      expect(stats.usedFallback).toBe(true);
      expect(stats.fallbackReason).toBe('no_api_key');
      
      // Should preserve original order
      expect(results[0].document.id).toBe('chunk-0');
      expect(results[1].document.id).toBe('chunk-1');
      expect(results[2].document.id).toBe('chunk-2');
    });

    it('should fallback on API error', async () => {
      const reranker = new LightweightReranker();
      const chunks = createMockChunks(3);
      
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });
      
      const { results, stats } = await reranker.rerank('test query', chunks);
      
      expect(stats.usedFallback).toBe(true);
      expect(stats.fallbackReason).toBe('api_error_500');
      expect(results).toHaveLength(3);
    });

    it('should fallback on network error', async () => {
      const reranker = new LightweightReranker();
      const chunks = createMockChunks(3);
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const { results, stats } = await reranker.rerank('test query', chunks);
      
      expect(stats.usedFallback).toBe(true);
      expect(stats.fallbackReason).toBe('exception');
      expect(results).toHaveLength(3);
    });

    it('should fallback on timeout', async () => {
      const reranker = new LightweightReranker({ timeoutMs: 100 });
      const chunks = createMockChunks(3);
      
      // Simulate a slow response
      mockFetch.mockImplementationOnce(() => 
        new Promise((_, reject) => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          setTimeout(() => reject(error), 50);
        })
      );
      
      const { stats } = await reranker.rerank('test query', chunks);
      
      expect(stats.usedFallback).toBe(true);
      expect(stats.fallbackReason).toBe('timeout');
    });

    it('should fallback on invalid response format', async () => {
      const reranker = new LightweightReranker();
      const chunks = createMockChunks(3);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve('not an array'),
      });
      
      const { stats } = await reranker.rerank('test query', chunks);
      
      expect(stats.usedFallback).toBe(true);
      expect(stats.fallbackReason).toBe('invalid_response');
    });

    it('should fallback when response array length mismatches', async () => {
      const reranker = new LightweightReranker();
      const chunks = createMockChunks(5);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([0.5, 0.6]), // Only 2 scores for 5 docs
      });
      
      const { stats } = await reranker.rerank('test query', chunks);
      
      expect(stats.usedFallback).toBe(true);
      expect(stats.fallbackReason).toBe('invalid_response');
    });
  });

  // ============================================
  // TESTS: Score Normalization
  // ============================================

  describe('score normalization', () => {
    it('should apply sigmoid to convert logits to probabilities', async () => {
      const reranker = new LightweightReranker();
      const chunks = createMockChunks(3);
      
      // High positive logit -> should be close to 1
      // Zero logit -> should be 0.5
      // Negative logit -> should be close to 0
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([5.0, 0.0, -5.0]),
      });
      
      const { results } = await reranker.rerank('test query', chunks);
      
      // After sigmoid: 5.0 -> ~0.993, 0.0 -> 0.5, -5.0 -> ~0.007
      expect(results[0].rerankScore).toBeCloseTo(0.993, 2);
      expect(results[1].rerankScore).toBeCloseTo(0.5, 2);
      expect(results[2].rerankScore).toBeCloseTo(0.007, 2);
    });

    it('should filter by minimum score', async () => {
      const reranker = new LightweightReranker({ minScore: 0.5 });
      const chunks = createMockChunks(3);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([2.0, 0.0, -2.0]),
      });
      
      const { results } = await reranker.rerank('test query', chunks);
      
      // Only first two should pass minScore of 0.5
      const rerankedResults = results.filter(r => r.wasReranked);
      expect(rerankedResults).toHaveLength(2);
    });
  });

  // ============================================
  // TESTS: Stats and Metrics
  // ============================================

  describe('statistics', () => {
    it('should track latency', async () => {
      const reranker = new LightweightReranker();
      const chunks = createMockChunks(3);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([0.7, 0.8, 0.6]),
      });
      
      const { stats } = await reranker.rerank('test query', chunks);
      
      expect(stats.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should accurately count input documents', async () => {
      const reranker = new LightweightReranker({ maxDocs: 5 });
      const chunks = createMockChunks(10);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([0.5, 0.6, 0.7, 0.8, 0.9]),
      });
      
      const { stats } = await reranker.rerank('test query', chunks);
      
      expect(stats.inputCount).toBe(10);
      expect(stats.rerankedCount).toBe(5);
    });
  });

  // ============================================
  // TESTS: Batch Processing
  // ============================================

  describe('batchRerank()', () => {
    it('should process multiple queries sequentially', async () => {
      const reranker = new LightweightReranker();
      
      const queries = [
        { query: 'query 1', documents: createMockChunks(2) },
        { query: 'query 2', documents: createMockChunks(3) },
      ];
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([0.7, 0.8]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([0.5, 0.6, 0.9]),
        });
      
      const results = await reranker.batchRerank(queries);
      
      expect(results).toHaveLength(2);
      expect(results[0].results).toHaveLength(2);
      expect(results[1].results).toHaveLength(3);
    });

    it('should handle empty batch', async () => {
      const reranker = new LightweightReranker();
      
      const results = await reranker.batchRerank([]);
      
      expect(results).toHaveLength(0);
    });
  });

  // ============================================
  // TESTS: Availability Check
  // ============================================

  describe('isAvailable()', () => {
    it('should return true when API key is available', async () => {
      const reranker = new LightweightReranker();
      reranker.setApiKey('test-key');
      
      const available = await reranker.isAvailable();
      
      expect(available).toBe(true);
    });

    it('should return true when API key is in storage', async () => {
      vi.stubGlobal('chrome', {
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({ hf_api_key: 'stored-key' }),
          },
        },
      });
      
      const reranker = new LightweightReranker();
      
      const available = await reranker.isAvailable();
      
      expect(available).toBe(true);
    });

    it('should return false when no API key available', async () => {
      vi.stubGlobal('chrome', {
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({}),
          },
        },
      });
      
      const reranker = new LightweightReranker();
      
      const available = await reranker.isAvailable();
      
      expect(available).toBe(false);
    });
  });

  // ============================================
  // TESTS: Factory Functions
  // ============================================

  describe('factory functions', () => {
    it('createReranker() should create a configured instance', () => {
      const reranker = createReranker({ maxDocs: 15 });
      
      expect(reranker).toBeInstanceOf(LightweightReranker);
      expect(reranker.getConfig().maxDocs).toBe(15);
    });

    it('defaultReranker should be a singleton instance', () => {
      expect(defaultReranker).toBeInstanceOf(LightweightReranker);
    });
  });

  // ============================================
  // TESTS: Ranking Preservation
  // ============================================

  describe('rank tracking', () => {
    it('should track original and new ranks', async () => {
      const reranker = new LightweightReranker();
      const chunks = createMockChunks(3);
      
      // Reverse the order with scores
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([0.1, 0.5, 0.9]),
      });
      
      const { results } = await reranker.rerank('test query', chunks);
      
      // Chunk 2 (score 0.9) should now be first
      expect(results[0].document.id).toBe('chunk-2');
      expect(results[0].originalRank).toBe(2);
      expect(results[0].newRank).toBe(0);
      
      // Chunk 0 (score 0.1) should now be last (among reranked)
      const chunk0 = results.find(r => r.document.id === 'chunk-0');
      expect(chunk0?.originalRank).toBe(0);
      expect(chunk0?.newRank).toBe(2);
    });
  });
});
