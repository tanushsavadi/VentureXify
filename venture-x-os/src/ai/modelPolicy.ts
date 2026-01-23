// ============================================
// MODEL POLICY - Hybrid Groq Model Routing
// Routes different task types to optimal models:
// - qwen/qwen3-32b for strict JSON output (verdicts, precise recommendations)
// - llama-3.1-8b-instant for fast, low-stakes chat
// ============================================

import type { GroqOptions } from './providers/groq';

// ============================================
// TASK TYPES
// ============================================

export enum TaskType {
  /** Verdict explanation - requires strict JSON, no hallucinations */
  VERDICT_JSON = 'verdict_json',
  
  /** Autopilot recommendation that must be JSON */
  AUTOPILOT_RECO_JSON = 'autopilot_reco_json',
  
  /** General chat - freeform, still no invented numbers but less strict */
  CHAT_GENERAL = 'chat_general',
  
  /** UI draft text - fast, low stakes, chatty */
  UI_DRAFT = 'ui_draft',
}

// ============================================
// MODEL CONSTANTS
// ============================================

/** High-precision model for strict JSON outputs */
export const MODEL_QWEN_32B = 'qwen/qwen3-32b';

/** Fast model for general chat and drafts */
export const MODEL_LLAMA_8B = 'llama-3.1-8b-instant';

// ============================================
// MODEL POLICY CONFIG
// ============================================

interface ModelPolicyConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  /** If true, add anti-think-mode instruction to system prompt */
  suppressThinkMode: boolean;
}

const POLICY_MAP: Record<TaskType, ModelPolicyConfig> = {
  [TaskType.VERDICT_JSON]: {
    model: MODEL_QWEN_32B,
    temperature: 0.1,
    maxTokens: 600,
    suppressThinkMode: true,
  },
  
  [TaskType.AUTOPILOT_RECO_JSON]: {
    model: MODEL_QWEN_32B,
    temperature: 0.15,
    maxTokens: 500,
    suppressThinkMode: true,
  },
  
  [TaskType.CHAT_GENERAL]: {
    model: MODEL_LLAMA_8B,
    temperature: 0.6,
    maxTokens: 400,
    suppressThinkMode: false,
  },
  
  [TaskType.UI_DRAFT]: {
    model: MODEL_LLAMA_8B,
    temperature: 0.7,
    maxTokens: 300,
    suppressThinkMode: false,
  },
};

// ============================================
// PUBLIC API
// ============================================

/**
 * Get Groq options for a specific task type
 * These can be passed to groqGenerate() as overrides
 */
export function getGroqOptionsForTask(task: TaskType): GroqOptions {
  const config = POLICY_MAP[task];
  return {
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  };
}

/**
 * Check if task requires think-mode suppression
 */
export function shouldSuppressThinkMode(task: TaskType): boolean {
  return POLICY_MAP[task].suppressThinkMode;
}

/**
 * Get the model name for a task (for logging)
 */
export function getModelForTask(task: TaskType): string {
  return POLICY_MAP[task].model;
}

/**
 * Anti-think-mode instruction to append to system prompts for Qwen
 */
export const ANTI_THINK_INSTRUCTION = `

IMPORTANT: Do NOT output <think>…</think> tags or any internal reasoning. Output ONLY the requested JSON format. No preamble, no explanation, just valid JSON.`;

/**
 * Strips <think>...</think> blocks from Qwen responses
 * This is a safety measure in case the model still outputs them
 */
export function stripThinkBlocks(response: string): string {
  // Remove <think>...</think> blocks (case insensitive, multiline)
  // This regex handles both self-closing and content-containing think tags
  const stripped = response.replace(/<think>[\s\S]*?<\/think>/gi, '');
  
  // Also handle unclosed think tags at the start
  const withoutOpenTag = stripped.replace(/^<think>[\s\S]*?(?=\{)/i, '');
  
  return withoutOpenTag.trim();
}

/**
 * Validates that response doesn't contain think tags (for logging)
 */
export function hasThinkBlocks(response: string): boolean {
  return /<think>/i.test(response);
}

// ============================================
// LOGGING HELPERS
// ============================================

export interface ModelCallLog {
  task: TaskType;
  model: string;
  temperature: number;
  responseLength: number;
  hadThinkBlocks: boolean;
  validationPassed: boolean;
  fallbackUsed: boolean;
}

let debugMode = false;

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
}

export function logModelCall(log: ModelCallLog): void {
  if (!debugMode) return;
  
  const status = log.validationPassed ? '✓' : '✗';
  const fallback = log.fallbackUsed ? ' [FALLBACK]' : '';
  const think = log.hadThinkBlocks ? ' [THINK_STRIPPED]' : '';
  
  console.log(
    `[ModelPolicy] ${status} task=${log.task} model=${log.model} ` +
    `temp=${log.temperature} len=${log.responseLength}${think}${fallback}`
  );
}
