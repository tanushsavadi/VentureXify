/**
 * Unit tests for Trust Telemetry Service and PII Redaction
 * 
 * @module __tests__/telemetry.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// PII REDACTION TESTS
// ============================================

import {
  redactPII,
  detectAndRedactPII,
  containsPII,
  redactPIIFromObject,
  safeLog,
  createSafeLogger,
  hashText,
  createAnonymizedId,
  sanitizeUserInput,
} from '../privacy/logRedaction';

describe('PII Redaction', () => {
  describe('redactPII()', () => {
    it('should redact email addresses', () => {
      const input = 'Contact me at john.doe@example.com for more info';
      const result = redactPII(input);
      
      expect(result).toBe('Contact me at [EMAIL] for more info');
      expect(result).not.toContain('john.doe@example.com');
    });

    it('should redact multiple email addresses', () => {
      const input = 'Email john@test.com or jane@test.org';
      const result = redactPII(input);
      
      expect(result).toBe('Email [EMAIL] or [EMAIL]');
    });

    it('should redact phone numbers', () => {
      const tests = [
        { input: 'Call me at (555) 123-4567', expected: 'Call me at [PHONE]' },
        { input: 'Phone: 555-123-4567', expected: 'Phone: [PHONE]' },
        { input: 'Cell: +1 555 123 4567', expected: 'Cell: [PHONE]' },
      ];
      
      tests.forEach(({ input, expected }) => {
        expect(redactPII(input)).toBe(expected);
      });
    });

    it('should redact credit card numbers', () => {
      const tests = [
        { input: 'Card: 4111-1111-1111-1111', expected: 'Card: [CARD]' },
        { input: 'CC: 4111 1111 1111 1111', expected: 'CC: [CARD]' },
        { input: 'Number: 4111111111111111', expected: 'Number: [CARD]' },
      ];
      
      tests.forEach(({ input, expected }) => {
        expect(redactPII(input)).toBe(expected);
      });
    });

    it('should redact confirmation codes', () => {
      const input = 'Your confirmation code is ABC123';
      const result = redactPII(input);
      
      expect(result).toBe('Your confirmation code is [CONF_CODE]');
    });

    it('should redact URLs with personal data keywords', () => {
      const tests = [
        'https://site.com/account/12345',
        'https://site.com/profile/john',
        'https://site.com/booking/ABC123',
        'https://site.com/confirmation/XYZ789',
      ];
      
      tests.forEach(input => {
        expect(redactPII(input)).toBe('[URL_REDACTED]');
      });
    });

    it('should redact names with prefixes', () => {
      const tests = [
        { input: 'Mr. John Smith', expected: '[NAME]' },
        { input: 'Mrs. Jane Doe', expected: '[NAME]' },
        { input: 'Dr. Alice Johnson', expected: '[NAME]' },
      ];
      
      tests.forEach(({ input, expected }) => {
        expect(redactPII(input)).toBe(expected);
      });
    });

    it('should redact Bearer tokens', () => {
      const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      const result = redactPII(input);
      
      expect(result).toContain('Bearer [TOKEN]');
    });

    it('should redact JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature';
      const result = redactPII(jwt);
      
      expect(result).toBe('[JWT]');
    });

    it('should handle null/undefined input', () => {
      expect(redactPII(null as unknown as string)).toBe(null);
      expect(redactPII(undefined as unknown as string)).toBe(undefined);
    });

    it('should preserve non-PII text', () => {
      const input = 'The flight costs $450 and departs at 3:00 PM';
      const result = redactPII(input);
      
      expect(result).toBe(input);
    });
  });

  describe('detectAndRedactPII()', () => {
    it('should return detection result with types', () => {
      const input = 'Email: test@example.com, Phone: 555-123-4567';
      const result = detectAndRedactPII(input);
      
      expect(result.detected).toBe(true);
      expect(result.types).toContain('email');
      expect(result.types).toContain('phone');
      expect(result.redactionCount).toBeGreaterThanOrEqual(2);
    });

    it('should return no detection for clean text', () => {
      const input = 'This is a clean message with no PII';
      const result = detectAndRedactPII(input);
      
      expect(result.detected).toBe(false);
      expect(result.types).toHaveLength(0);
      expect(result.redactionCount).toBe(0);
    });
  });

  describe('containsPII()', () => {
    it('should return true when PII is present', () => {
      expect(containsPII('test@example.com')).toBe(true);
      expect(containsPII('4111-1111-1111-1111')).toBe(true);
      expect(containsPII('555-123-4567')).toBe(true);
    });

    it('should return false when no PII is present', () => {
      expect(containsPII('Hello world')).toBe(false);
      expect(containsPII('Flight to Paris')).toBe(false);
    });
  });

  describe('redactPIIFromObject()', () => {
    it('should redact PII from nested objects', () => {
      const obj = {
        user: {
          email: 'test@example.com',
          name: 'John',
        },
        message: 'Contact at test@example.com',
      };
      
      const result = redactPIIFromObject(obj);
      
      expect(result.user.email).toBe('[EMAIL]');
      expect(result.message).toBe('Contact at [EMAIL]');
      expect(result.user.name).toBe('John'); // No redaction needed
    });

    it('should redact PII from arrays', () => {
      const arr = [
        'email1@test.com',
        'Clean text',
        'email2@test.com',
      ];
      
      const result = redactPIIFromObject(arr);
      
      expect(result[0]).toBe('[EMAIL]');
      expect(result[1]).toBe('Clean text');
      expect(result[2]).toBe('[EMAIL]');
    });

    it('should handle primitives', () => {
      expect(redactPIIFromObject(null)).toBe(null);
      expect(redactPIIFromObject(undefined)).toBe(undefined);
      expect(redactPIIFromObject(42)).toBe(42);
      expect(redactPIIFromObject(true)).toBe(true);
    });
  });

  describe('sanitizeUserInput()', () => {
    it('should redact PII and truncate', () => {
      const input = 'Contact test@example.com or john@test.org for help with your order';
      const result = sanitizeUserInput(input, 50);
      
      expect(result.length).toBeLessThanOrEqual(50);
      expect(result).not.toContain('test@example.com');
      expect(result).not.toContain('john@test.org');
      expect(result).toContain('[EMAIL]');
    });

    it('should remove control characters', () => {
      const input = 'Hello\x00World\x0BTest';
      const result = sanitizeUserInput(input);
      
      expect(result).toBe('HelloWorldTest');
    });

    it('should normalize line breaks', () => {
      const input = 'Line1\r\nLine2\rLine3\nLine4';
      const result = sanitizeUserInput(input);
      
      expect(result).toBe('Line1 Line2 Line3 Line4');
    });
  });

  describe('hashText()', () => {
    it('should return a 16-character hex string', async () => {
      const result = await hashText('test string');
      
      expect(result).toHaveLength(16);
      expect(result).toMatch(/^[0-9a-f]+$/);
    });

    it('should produce consistent hashes', async () => {
      const hash1 = await hashText('same input');
      const hash2 = await hashText('same input');
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', async () => {
      const hash1 = await hashText('input 1');
      const hash2 = await hashText('input 2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('createAnonymizedId()', () => {
    it('should create ID with anon_ prefix', async () => {
      const id = await createAnonymizedId('test@example.com');
      
      expect(id.startsWith('anon_')).toBe(true);
      expect(id.length).toBe(21); // 'anon_' + 16 chars
    });
  });

  describe('safeLog()', () => {
    beforeEach(() => {
      vi.spyOn(console, 'info').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should redact PII in log messages', () => {
      safeLog('info', 'User email: test@example.com');
      
      expect(console.info).toHaveBeenCalledWith(
        '[VentureX] User email: [EMAIL]',
        undefined
      );
    });

    it('should redact PII in log data', () => {
      safeLog('warn', 'Warning', { email: 'test@example.com' });
      
      expect(console.warn).toHaveBeenCalledWith(
        '[VentureX] Warning',
        { email: '[EMAIL]' }
      );
    });
  });

  describe('createSafeLogger()', () => {
    beforeEach(() => {
      vi.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should create logger with context prefix', () => {
      const logger = createSafeLogger('TestModule');
      logger.info('Test message');
      
      expect(console.info).toHaveBeenCalledWith(
        '[VentureX] [TestModule] Test message',
        undefined
      );
    });
  });
});

// ============================================
// TRUST TELEMETRY TESTS
// ============================================

import {
  TrustTelemetryService,
  createTelemetryService,
  defaultTelemetryService,
  useTrustTelemetry,
} from '../telemetry/trustTelemetry';
import type { ChunkWithProvenance, SourceMetadata } from '../knowledge/sourceMetadata';

function createMockChunk(id: string): ChunkWithProvenance {
  const metadata: SourceMetadata = {
    id: `doc-${id}`,
    source: 'test',
    retrievedAt: new Date().toISOString(),
    trustTier: 3,
    contentHash: 'abc123',
    version: 1,
    isActive: true,
  };

  return {
    id,
    content: 'Test content',
    metadata,
    score: 0.8,
    freshnessStatus: 'fresh',
  };
}

describe('TrustTelemetryService', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
    
    // Mock chrome.storage.session
    vi.stubGlobal('chrome', {
      storage: {
        session: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    });

    // Mock crypto.randomUUID
    vi.stubGlobal('crypto', {
      randomUUID: () => 'test-uuid-1234',
      subtle: {
        digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('configuration', () => {
    it('should be disabled by default', () => {
      const service = new TrustTelemetryService();
      
      expect(service.isEnabled()).toBe(false);
    });

    it('should be enabled when configured with endpoint', () => {
      const service = new TrustTelemetryService({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
      });
      
      expect(service.isEnabled()).toBe(true);
    });

    it('should allow runtime configuration', () => {
      const service = new TrustTelemetryService();
      
      expect(service.isEnabled()).toBe(false);
      
      service.configure({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
      });
      
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('logNegativeFeedback()', () => {
    it('should not send events when disabled', async () => {
      const service = new TrustTelemetryService({ enabled: false });
      
      await service.logNegativeFeedback(
        'test query',
        'test response',
        [createMockChunk('1')],
        'User comment'
      );
      
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should queue events when enabled', async () => {
      const service = new TrustTelemetryService({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
        maxQueueSize: 10,
      });
      
      await service.logNegativeFeedback(
        'test query',
        'test response',
        [createMockChunk('1')],
        'User comment'
      );
      
      const stats = service.getStats();
      expect(stats.queueSize).toBe(1);
    });

    it('should flush when queue is full', async () => {
      const service = new TrustTelemetryService({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
        maxQueueSize: 2,
      });
      
      await service.logNegativeFeedback('q1', 'r1', [], 'c1');
      await service.logNegativeFeedback('q2', 'r2', [], 'c2');
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should redact PII in feedback text', async () => {
      const service = new TrustTelemetryService({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
        maxQueueSize: 1,
      });
      
      await service.logNegativeFeedback(
        'test query',
        'test response',
        [],
        'My email is test@example.com'
      );
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const event = callBody.events[0];
      
      expect(event.feedbackText).not.toContain('test@example.com');
      expect(event.feedbackText).toContain('[EMAIL]');
    });
  });

  describe('logPositiveFeedback()', () => {
    it('should create positive feedback event', async () => {
      const service = new TrustTelemetryService({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
        maxQueueSize: 1,
      });
      
      await service.logPositiveFeedback(
        'test query',
        'test response',
        [createMockChunk('1')],
        { computeIntentUsed: true }
      );
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const event = callBody.events[0];
      
      expect(event.eventType).toBe('feedback_positive');
      expect(event.computeIntentUsed).toBe(true);
    });
  });

  describe('logClaimDisputed()', () => {
    it('should create claim disputed event', async () => {
      const service = new TrustTelemetryService({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
        maxQueueSize: 1,
      });
      
      await service.logClaimDisputed(
        'The annual fee is $500',
        [{ docId: 'doc-1', trustTier: 2 } as any],
        'Actually it is $395'
      );
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const event = callBody.events[0];
      
      expect(event.eventType).toBe('claim_disputed');
      expect(event.disputedClaim).toContain('annual fee');
    });
  });

  describe('logSourceQuestioned()', () => {
    it('should create source questioned event', async () => {
      const service = new TrustTelemetryService({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
        maxQueueSize: 1,
      });
      
      await service.logSourceQuestioned('source-1', 4, 'This source is unreliable');
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const event = callBody.events[0];
      
      expect(event.eventType).toBe('source_questioned');
      expect(event.retrievalIds).toContain('source-1');
      expect(event.retrievalTrustTiers).toContain(4);
    });
  });

  describe('logStaleContent()', () => {
    it('should create stale content event', async () => {
      const service = new TrustTelemetryService({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
        maxQueueSize: 1,
      });
      
      await service.logStaleContent('source-1', '2024-01-01T00:00:00Z');
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const event = callBody.events[0];
      
      expect(event.eventType).toBe('stale_content');
      expect(event.responsePreview).toContain('Retrieved at:');
    });
  });

  describe('logInjectionBlocked()', () => {
    it('should create injection blocked event', async () => {
      const service = new TrustTelemetryService({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
        maxQueueSize: 1,
      });
      
      await service.logInjectionBlocked('source-1', 4, 'ignore previous');
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const event = callBody.events[0];
      
      expect(event.eventType).toBe('injection_blocked');
      expect(event.responsePreview).toContain('Pattern:');
    });
  });

  describe('flush()', () => {
    it('should send all queued events', async () => {
      const service = new TrustTelemetryService({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
        maxQueueSize: 100,
      });
      
      await service.logNegativeFeedback('q1', 'r1', []);
      await service.logNegativeFeedback('q2', 'r2', []);
      await service.logPositiveFeedback('q3', 'r3', []);
      
      const statsBefore = service.getStats();
      expect(statsBefore.queueSize).toBe(3);
      
      await service.flush();
      
      const statsAfter = service.getStats();
      expect(statsAfter.queueSize).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.events).toHaveLength(3);
    });

    it('should not call API for empty queue', async () => {
      const service = new TrustTelemetryService({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
      });
      
      await service.flush();
      
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should fail silently on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const service = new TrustTelemetryService({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
        maxQueueSize: 1,
      });
      
      // Should not throw
      await expect(
        service.logNegativeFeedback('q', 'r', [])
      ).resolves.not.toThrow();
    });

    it('should fail silently on API error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      
      const service = new TrustTelemetryService({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
        maxQueueSize: 1,
      });
      
      // Should not throw
      await expect(
        service.logNegativeFeedback('q', 'r', [])
      ).resolves.not.toThrow();
    });
  });

  describe('getStats()', () => {
    it('should return accurate statistics', () => {
      const service = new TrustTelemetryService({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
      });
      
      const stats = service.getStats();
      
      expect(stats).toEqual({
        queueSize: 0,
        enabled: true,
        hasEndpoint: true,
      });
    });
  });

  describe('dispose()', () => {
    it('should clean up resources', async () => {
      const service = new TrustTelemetryService({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
        flushInterval: 100,
      });
      
      await service.logNegativeFeedback('q', 'r', []);
      
      service.dispose();
      
      const stats = service.getStats();
      expect(stats.queueSize).toBe(0);
    });
  });

  describe('factory functions', () => {
    it('createTelemetryService should create configured instance', () => {
      const service = createTelemetryService({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
      });
      
      expect(service.isEnabled()).toBe(true);
    });

    it('defaultTelemetryService should be a singleton', () => {
      expect(defaultTelemetryService).toBeInstanceOf(TrustTelemetryService);
    });

    it('useTrustTelemetry should return default service', () => {
      const service = useTrustTelemetry();
      
      expect(service).toBe(defaultTelemetryService);
    });
  });

  describe('session ID management', () => {
    it('should generate consistent session ID', async () => {
      const service = new TrustTelemetryService({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
        maxQueueSize: 1,
      });
      
      await service.logNegativeFeedback('q1', 'r1', []);
      const call1Body = JSON.parse(mockFetch.mock.calls[0][1].body);
      
      mockFetch.mockClear();
      
      await service.logNegativeFeedback('q2', 'r2', []);
      const call2Body = JSON.parse(mockFetch.mock.calls[0][1].body);
      
      // Same session ID for both events
      expect(call1Body.events[0].sessionId).toBe(call2Body.events[0].sessionId);
    });
  });

  describe('browser detection', () => {
    it('should detect browser type from user agent', async () => {
      vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 Chrome/91.0' });
      
      const service = new TrustTelemetryService({
        enabled: true,
        endpoint: 'https://api.example.com/telemetry',
        maxQueueSize: 1,
      });
      
      await service.logNegativeFeedback('q', 'r', []);
      
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.events[0].browserType).toBe('chrome');
    });
  });
});
