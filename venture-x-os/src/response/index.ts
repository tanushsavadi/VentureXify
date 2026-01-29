// ============================================
// RESPONSE MODULE
// Unanswerable gate, citations, and response formatting
// ============================================

export {
  UnanswerableGate,
  unanswerableGate,
  type GateResult,
  type RetrievalQuality,
  type GroundingResult,
} from './unanswerableGate';

export {
  SpanLevelGrounder,
  spanLevelGrounder,
  type CitedSpan,
  type ClaimGrounding,
  type GroundingConfidence,
  type ClaimType,
  type GroundingVerificationResult,
  type GroundingStats,
} from './spanLevelCitation';

export {
  CitationFormatter,
  citationFormatter,
  formatCitationWithSpan,
  addInlineCitations,
  DEFAULT_CITATION_OPTIONS,
  type CitationFormatOptions,
  type FormattedCitation,
  type CitedResponse,
} from './citationFormatter';
