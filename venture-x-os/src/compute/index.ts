// ============================================
// COMPUTE MODULE - Deterministic Calculations
// All numerical computations happen here, NEVER in the LLM
// ============================================

export {
  DeterministicEngine,
  deterministicEngine,
  ComputeIntent,
  type ComputeRequest,
  type ComputeResult,
} from './deterministicEngine';

export {
  extractComputeIntent,
  extractIntentFromKeywords,
} from './intentExtractor';
