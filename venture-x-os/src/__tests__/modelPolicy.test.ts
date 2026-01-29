// ============================================
// MODEL POLICY TEST HARNESS
// Tests for hybrid model routing and validation
// ============================================

import { describe, it, expect } from 'vitest';
import {
  TaskType,
  getGroqOptionsForTask,
  shouldSuppressThinkMode,
  stripThinkBlocks,
  hasThinkBlocks,
  getModelForTask,
  MODEL_QWEN_32B,
  MODEL_LLAMA_8B,
} from '../ai/modelPolicy';

// ============================================
// TEST: Model Policy Configuration
// ============================================

describe('Model Policy Configuration', () => {
  it('should use qwen/qwen3-32b for VERDICT_JSON', () => {
    const verdictOptions = getGroqOptionsForTask(TaskType.VERDICT_JSON);
    expect(verdictOptions.model).toBe(MODEL_QWEN_32B);
  });

  it('should have low temperature for VERDICT_JSON', () => {
    const verdictOptions = getGroqOptionsForTask(TaskType.VERDICT_JSON);
    expect(verdictOptions.temperature).toBeLessThanOrEqual(0.2);
  });

  it('should use qwen/qwen3-32b for AUTOPILOT_RECO_JSON', () => {
    const autopilotOptions = getGroqOptionsForTask(TaskType.AUTOPILOT_RECO_JSON);
    expect(autopilotOptions.model).toBe(MODEL_QWEN_32B);
  });

  it('should use llama-3.1-8b-instant for CHAT_GENERAL', () => {
    const chatOptions = getGroqOptionsForTask(TaskType.CHAT_GENERAL);
    expect(chatOptions.model).toBe(MODEL_LLAMA_8B);
  });

  it('should have higher temperature for CHAT_GENERAL', () => {
    const chatOptions = getGroqOptionsForTask(TaskType.CHAT_GENERAL);
    expect(chatOptions.temperature).toBeGreaterThanOrEqual(0.5);
  });

  it('should use llama-3.1-8b-instant for UI_DRAFT', () => {
    const draftOptions = getGroqOptionsForTask(TaskType.UI_DRAFT);
    expect(draftOptions.model).toBe(MODEL_LLAMA_8B);
  });
});

// ============================================
// TEST: Think Block Suppression Configuration
// ============================================

describe('Think Mode Suppression', () => {
  it('should suppress think mode for VERDICT_JSON', () => {
    expect(shouldSuppressThinkMode(TaskType.VERDICT_JSON)).toBe(true);
  });

  it('should suppress think mode for AUTOPILOT_RECO_JSON', () => {
    expect(shouldSuppressThinkMode(TaskType.AUTOPILOT_RECO_JSON)).toBe(true);
  });

  it('should not suppress think mode for CHAT_GENERAL', () => {
    expect(shouldSuppressThinkMode(TaskType.CHAT_GENERAL)).toBe(false);
  });

  it('should not suppress think mode for UI_DRAFT', () => {
    expect(shouldSuppressThinkMode(TaskType.UI_DRAFT)).toBe(false);
  });
});

// ============================================
// TEST: Think Block Stripping
// ============================================

describe('Think Block Stripping', () => {
  it('should strip simple think block', () => {
    const simpleThink = '<think>I should analyze this...</think>{"headline":"test"}';
    const stripped = stripThinkBlocks(simpleThink);
    expect(stripped).toBe('{"headline":"test"}');
  });

  it('should strip multiline think block', () => {
    const multilineThink = `<think>
Let me think about this...
The user wants to compare portal vs direct.
I should focus on the facts.
</think>
{"headline": "Portal wins", "body": ["test"]}`;
    const stripped = stripThinkBlocks(multilineThink);
    expect(stripped).toContain('{"headline": "Portal wins"');
    expect(stripped).not.toContain('<think>');
  });

  it('should preserve JSON without think blocks', () => {
    const noThink = '{"headline": "test", "body": []}';
    const stripped = stripThinkBlocks(noThink);
    expect(stripped).toBe(noThink);
  });

  it('should strip multiple think blocks', () => {
    const multiThink = '<think>first</think>{"a":1}<think>second</think>';
    const stripped = stripThinkBlocks(multiThink);
    expect(stripped).not.toContain('<think>');
    expect(stripped).toContain('{"a":1}');
  });

  it('should detect think blocks present', () => {
    const withThink = '<think>I should analyze this...</think>{"headline":"test"}';
    expect(hasThinkBlocks(withThink)).toBe(true);
  });

  it('should detect think blocks absent', () => {
    const noThink = '{"headline": "test", "body": []}';
    expect(hasThinkBlocks(noThink)).toBe(false);
  });
});

// ============================================
// TEST: JSON Parsing After Strip
// ============================================

describe('JSON Parsing After Strip', () => {
  it('should parse JSON correctly after stripping Qwen-style think block', () => {
    const qwenResponse = `<think>
The user is comparing $821 portal vs $767 direct.
Portal earns 4,105 miles at 5x, direct earns 1,534 at 2x.
The extra 2,571 miles from portal are worth about $46 at 1.8cpp.
Portal out-of-pocket after $300 credit: $521
So portal net cost: $521 - $74 = $447
Direct net cost: $767 - $28 = $739
Portal wins by $292.
</think>
{
  "headline": "Portal wins by ~$292",
  "body": [
    "Portal: $821 with $300 credit = $521 out of pocket",
    "You earn 4,105 miles (5x) vs 1,534 miles (2x) on direct",
    "Extra 2,571 miles worth ~$46 at 1.8¢/mile"
  ],
  "proTip": "Book via portal to maximize both credit usage and miles earning.",
  "caveats": ["Verify the $300 credit hasn't been used this year"]
}`;

    const stripped = stripThinkBlocks(qwenResponse);
    
    // Extract JSON
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    expect(jsonMatch).not.toBeNull();
    
    // Parse JSON
    const parsed = JSON.parse(jsonMatch![0]);
    expect(typeof parsed.headline).toBe('string');
    expect(Array.isArray(parsed.body)).toBe(true);
    expect(typeof parsed.proTip).toBe('string');
    expect(Array.isArray(parsed.caveats)).toBe(true);
  });
});

// ============================================
// TEST: Invented Numbers Detection (mock)
// ============================================

describe('Invented Numbers Detection', () => {
  // Helper to extract numbers from text
  function extractNumbers(text: string): number[] {
    const matches = text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
    return matches.map(m => parseFloat(m.replace(/,/g, '')));
  }
  
  const SIGNIFICANT_THRESHOLD = 100;
  
  // Provided facts
  const facts = `
    Portal price: $821
    Direct price: $767
    Portal miles: 4,105
    Direct miles: 1,534
    Net advantage: $292
  `;
  const allowedNumbers = extractNumbers(facts);

  it('should detect no invented numbers in good response', () => {
    const goodResponse = 'Portal wins by $292. You earn 4,105 miles vs 1,534 miles.';
    const goodNums = extractNumbers(goodResponse).filter(n => n > SIGNIFICANT_THRESHOLD);
    const goodInvented = goodNums.some(n => !allowedNumbers.includes(n));
    expect(goodInvented).toBe(false);
  });

  it('should detect invented numbers in bad response', () => {
    const badResponse = 'You could transfer 120,000 miles to get business class for this route.';
    const badNums = extractNumbers(badResponse).filter(n => n > SIGNIFICANT_THRESHOLD);
    const badInvented = badNums.some(n => !allowedNumbers.includes(n));
    expect(badInvented).toBe(true);
  });

  it('should not flag small numbers (<=100) as invented', () => {
    const smallNumResponse = 'This is 7% more expensive, or about 5x the value.';
    const smallNums = extractNumbers(smallNumResponse).filter(n => n > SIGNIFICANT_THRESHOLD);
    const smallInvented = smallNums.some(n => !allowedNumbers.includes(n));
    expect(smallInvented).toBe(false);
  });
});

// ============================================
// TEST: Model Name Logging
// ============================================

describe('Model Name Logging', () => {
  it('should return correct model name for VERDICT_JSON', () => {
    expect(getModelForTask(TaskType.VERDICT_JSON)).toBe(MODEL_QWEN_32B);
  });

  it('should return correct model name for CHAT_GENERAL', () => {
    expect(getModelForTask(TaskType.CHAT_GENERAL)).toBe(MODEL_LLAMA_8B);
  });
});
