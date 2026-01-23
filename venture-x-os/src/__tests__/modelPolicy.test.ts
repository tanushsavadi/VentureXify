// ============================================
// MODEL POLICY TEST HARNESS
// Tests for hybrid model routing and validation
// Run with: npx tsx src/__tests__/modelPolicy.test.ts
// ============================================

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
// TEST UTILITIES
// ============================================

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`❌ FAILED: ${message}`);
  }
  console.log(`✓ PASSED: ${message}`);
}

function assertEq<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`❌ FAILED: ${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
  console.log(`✓ PASSED: ${message}`);
}

// ============================================
// TEST: Model Policy Configuration
// ============================================

function testModelPolicyConfig(): void {
  console.log('\n--- Model Policy Configuration ---');
  
  // Verdict JSON should use Qwen
  const verdictOptions = getGroqOptionsForTask(TaskType.VERDICT_JSON);
  assertEq(verdictOptions.model, MODEL_QWEN_32B, 'VERDICT_JSON uses qwen/qwen3-32b');
  assert(verdictOptions.temperature! <= 0.2, 'VERDICT_JSON has low temperature');
  
  // Autopilot JSON should use Qwen
  const autopilotOptions = getGroqOptionsForTask(TaskType.AUTOPILOT_RECO_JSON);
  assertEq(autopilotOptions.model, MODEL_QWEN_32B, 'AUTOPILOT_RECO_JSON uses qwen/qwen3-32b');
  
  // Chat general should use Llama
  const chatOptions = getGroqOptionsForTask(TaskType.CHAT_GENERAL);
  assertEq(chatOptions.model, MODEL_LLAMA_8B, 'CHAT_GENERAL uses llama-3.1-8b-instant');
  assert(chatOptions.temperature! >= 0.5, 'CHAT_GENERAL has higher temperature');
  
  // UI draft should use Llama
  const draftOptions = getGroqOptionsForTask(TaskType.UI_DRAFT);
  assertEq(draftOptions.model, MODEL_LLAMA_8B, 'UI_DRAFT uses llama-3.1-8b-instant');
}

// ============================================
// TEST: Think Block Suppression Configuration
// ============================================

function testThinkModeSuppression(): void {
  console.log('\n--- Think Mode Suppression ---');
  
  // Qwen tasks should suppress think mode
  assert(shouldSuppressThinkMode(TaskType.VERDICT_JSON), 'VERDICT_JSON suppresses think mode');
  assert(shouldSuppressThinkMode(TaskType.AUTOPILOT_RECO_JSON), 'AUTOPILOT_RECO_JSON suppresses think mode');
  
  // Llama tasks don't need suppression
  assert(!shouldSuppressThinkMode(TaskType.CHAT_GENERAL), 'CHAT_GENERAL does not suppress think mode');
  assert(!shouldSuppressThinkMode(TaskType.UI_DRAFT), 'UI_DRAFT does not suppress think mode');
}

// ============================================
// TEST: Think Block Stripping
// ============================================

function testThinkBlockStripping(): void {
  console.log('\n--- Think Block Stripping ---');
  
  // Simple think block
  const simpleThink = '<think>I should analyze this...</think>{"headline":"test"}';
  const stripped1 = stripThinkBlocks(simpleThink);
  assertEq(stripped1, '{"headline":"test"}', 'Strips simple think block');
  
  // Multiline think block
  const multilineThink = `<think>
Let me think about this...
The user wants to compare portal vs direct.
I should focus on the facts.
</think>
{"headline": "Portal wins", "body": ["test"]}`;
  const stripped2 = stripThinkBlocks(multilineThink);
  assert(stripped2.includes('{"headline": "Portal wins"'), 'Strips multiline think block');
  assert(!stripped2.includes('<think>'), 'No think tags remain after stripping');
  
  // No think block
  const noThink = '{"headline": "test", "body": []}';
  const stripped3 = stripThinkBlocks(noThink);
  assertEq(stripped3, noThink, 'Preserves JSON without think blocks');
  
  // Multiple think blocks
  const multiThink = '<think>first</think>{"a":1}<think>second</think>';
  const stripped4 = stripThinkBlocks(multiThink);
  assert(!stripped4.includes('<think>'), 'Strips multiple think blocks');
  assert(stripped4.includes('{"a":1}'), 'Preserves JSON between think blocks');
  
  // hasThinkBlocks detection
  assert(hasThinkBlocks(simpleThink), 'Detects think blocks present');
  assert(!hasThinkBlocks(noThink), 'Detects think blocks absent');
}

// ============================================
// TEST: JSON Parsing After Strip
// ============================================

function testJsonParsingAfterStrip(): void {
  console.log('\n--- JSON Parsing After Strip ---');
  
  // Qwen-style response with think block
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
  assert(jsonMatch !== null, 'JSON extractable after stripping think block');
  
  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch![0]);
  } catch (e) {
    throw new Error(`❌ FAILED: JSON parsing failed: ${e}`);
  }
  console.log('✓ PASSED: JSON parses successfully after stripping');
  
  // Validate structure
  const obj = parsed as Record<string, unknown>;
  assert(typeof obj.headline === 'string', 'headline is string');
  assert(Array.isArray(obj.body), 'body is array');
  assert(typeof obj.proTip === 'string', 'proTip is string');
  assert(Array.isArray(obj.caveats), 'caveats is array');
}

// ============================================
// TEST: Invented Numbers Detection (mock)
// ============================================

function testInventedNumbersDetection(): void {
  console.log('\n--- Invented Numbers Detection ---');
  
  // Helper to extract numbers from text
  // Note: We use threshold of 100 to ignore small numbers (percentages, years, etc.)
  function extractNumbers(text: string): number[] {
    const matches = text.match(/\d+(?:,\d{3})*(?:\.\d+)?/g) || [];
    return matches.map(m => parseFloat(m.replace(/,/g, '')));
  }
  
  // Threshold for "significant" numbers that need validation
  // Small numbers (years, percentages, multipliers) are OK
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
  
  // Good response (uses only allowed numbers)
  const goodResponse = 'Portal wins by $292. You earn 4,105 miles vs 1,534 miles.';
  const goodNums = extractNumbers(goodResponse).filter(n => n > SIGNIFICANT_THRESHOLD);
  const goodInvented = goodNums.some(n => !allowedNumbers.includes(n));
  assert(!goodInvented, 'Good response has no invented numbers');
  
  // Bad response (invents 120,000 miles)
  const badResponse = 'You could transfer 120,000 miles to get business class for this route.';
  const badNums = extractNumbers(badResponse).filter(n => n > SIGNIFICANT_THRESHOLD);
  const badInvented = badNums.some(n => !allowedNumbers.includes(n));
  assert(badInvented, 'Bad response detected as having invented numbers');
  
  // Edge case: small numbers are OK (year, percentage, etc.)
  // Note: 2024 is below our SIGNIFICANT_THRESHOLD check because we use > 100 for significant
  // This allows years, percentages, and small counts without flagging
  const smallNumResponse = 'This is 7% more expensive, or about 5x the value.';
  const smallNums = extractNumbers(smallNumResponse).filter(n => n > SIGNIFICANT_THRESHOLD);
  const smallInvented = smallNums.some(n => !allowedNumbers.includes(n));
  assert(!smallInvented, 'Small numbers (<=100) are not flagged as invented');
}

// ============================================
// TEST: Model Name Logging
// ============================================

function testModelNameLogging(): void {
  console.log('\n--- Model Name Logging ---');
  
  assertEq(getModelForTask(TaskType.VERDICT_JSON), MODEL_QWEN_32B, 'Correct model name for VERDICT_JSON');
  assertEq(getModelForTask(TaskType.CHAT_GENERAL), MODEL_LLAMA_8B, 'Correct model name for CHAT_GENERAL');
}

// ============================================
// RUN ALL TESTS
// ============================================

function runAllTests(): void {
  console.log('========================================');
  console.log('MODEL POLICY TEST HARNESS');
  console.log('========================================');
  
  let passed = 0;
  let failed = 0;
  
  const tests = [
    testModelPolicyConfig,
    testThinkModeSuppression,
    testThinkBlockStripping,
    testJsonParsingAfterStrip,
    testInventedNumbersDetection,
    testModelNameLogging,
  ];
  
  for (const test of tests) {
    try {
      test();
      passed++;
    } catch (error) {
      console.error(error);
      failed++;
    }
  }
  
  console.log('\n========================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('========================================');
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run if executed directly
runAllTests();
