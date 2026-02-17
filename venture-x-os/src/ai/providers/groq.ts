// ============================================
// GROQ PROVIDER - Hybrid Model Support
// Supports llama-3.1-8b-instant (fast) and qwen/qwen3-32b (precise)
// ============================================

import { stripThinkBlocks, hasThinkBlocks, logModelCall, type ModelCallLog } from '../modelPolicy';
import type { TaskType } from '../modelPolicy';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Default model for backward compatibility */
export const DEFAULT_MODEL = 'llama-3.1-8b-instant';

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Task type for logging (optional) */
  taskType?: TaskType;
  /** If true, strip <think> blocks from response */
  stripThinkBlocks?: boolean;
}

export interface GroqResponse {
  content: string;
  /** Whether <think> blocks were stripped */
  hadThinkBlocks: boolean;
  /** The model that was used */
  model: string;
}

/**
 * Generate text using Groq API
 * Supports both llama and qwen models with automatic think-block handling
 * 
 * @param messages - Array of chat messages
 * @param apiKey - Groq API key
 * @param options - Generation options including model override
 * @returns Generated text content
 */
export async function groqGenerate(
  messages: GroqMessage[],
  apiKey: string,
  options: GroqOptions = {}
): Promise<string> {
  const result = await groqGenerateWithMeta(messages, apiKey, options);
  return result.content;
}

/**
 * Generate text with metadata (for advanced use cases)
 * Returns response content plus metadata about processing
 */
export async function groqGenerateWithMeta(
  messages: GroqMessage[],
  apiKey: string,
  options: GroqOptions = {}
): Promise<GroqResponse> {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 800,
    stripThinkBlocks: shouldStrip = model.includes('qwen'),
  } = options;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(`Groq API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content || '';
  
  // Check for and optionally strip think blocks
  const hadThink = hasThinkBlocks(content);
  if (shouldStrip && hadThink) {
    content = stripThinkBlocks(content);
  }

  return {
    content,
    hadThinkBlocks: hadThink,
    model,
  };
}

/**
 * Generate text with full logging and validation tracking
 * Use this for verdict/recommendation flows where we need audit trail
 */
export async function groqGenerateTracked(
  messages: GroqMessage[],
  apiKey: string,
  options: GroqOptions & { taskType: TaskType }
): Promise<{ content: string; log: ModelCallLog }> {
  const { taskType, ...groqOptions } = options;
  
  const result = await groqGenerateWithMeta(messages, apiKey, groqOptions);
  
  const log: ModelCallLog = {
    task: taskType,
    model: result.model,
    temperature: groqOptions.temperature ?? 0.7,
    responseLength: result.content.length,
    hadThinkBlocks: result.hadThinkBlocks,
    validationPassed: true, // Will be updated by caller after validation
    fallbackUsed: false,
  };
  
  // Log the call
  logModelCall(log);
  
  return { content: result.content, log };
}

/**
 * Test if the API key is valid
 */
export async function testGroqConnection(apiKey: string): Promise<boolean> {
  try {
    const result = await groqGenerate(
      [{ role: 'user', content: 'Say "ok"' }],
      apiKey,
      { maxTokens: 5 }
    );
    return result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Test if a specific model is available
 */
export async function testModelAvailability(
  apiKey: string,
  model: string
): Promise<boolean> {
  try {
    const result = await groqGenerate(
      [{ role: 'user', content: 'Say "ok"' }],
      apiKey,
      { model, maxTokens: 5 }
    );
    return result.length > 0;
  } catch (error) {
    console.warn(`[Groq] Model ${model} test failed:`, error);
    return false;
  }
}
