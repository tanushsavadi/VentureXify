// ============================================
// EXTRACTION MODULE - Index
// ============================================
// Engineering-grade extraction pipeline for VentureXify
// Export all extraction utilities

// Core types
export * from './types';

// Money parsing
export {
  parseMoney,
  parseAllPrices,
  formatMoney,
  compareMoney,
  convertMoney,
  getCurrencyInfo,
  looksLikePrice,
  extractBestPrice,
  type ParseMoneyOptions,
  type ParseMoneyResult
} from './parseMoney';

// Heuristic extraction
export {
  extractPriceHeuristically,
  extractFlightPrice as extractFlightPriceHeuristic,
  extractStayPrice as extractStayPriceHeuristic,
  hasExtractablePrice,
  getAllPriceCandidates,
  type HeuristicOptions,
} from './priceHeuristics';

// Extraction pipeline
export {
  runExtractionPipeline,
  extractPrice,
  extractFlightPrice,
  extractStayPrice,
  needsExtraction,
  getExtractionSummary,
  type PipelineOptions,
  type PipelineResult
} from './pipeline';

// SPA watching
export {
  SPAWatcher,
  waitForStablePrice,
  type SPAWatchOptions,
} from './spaWatch';

// Health monitoring
export {
  recordExtractionEvent,
  getSiteHealth,
  generateDebugPayload,
  copyDebugPayload,
  isSiteDegraded,
} from './health';

// DOM utilities
export {
  isVisible,
  isInViewport,
  isVentureXWidget,
  getTextContent,
  getDirectTextContent,
  getCleanText,
  getNearbyText,
  findElement,
  findElements,
  findByText,
  findAllByText,
  findByAriaLabel,
  findByTestId,
  findContainer,
  findPriceElements,
  findTotalPriceElement,
  getDomPath,
  getXPath,
  generateStableSelector,
  generateStructuralSelector,
  generateSelectorStrategies,
  getRelevantStyles,
  hasStrikethrough,
  getFontSize,
  isBold
} from './domUtils';

// Element picker
export {
  activatePicker,
  deactivatePicker,
  isPickerActive,
  promptUserPick,
  getUserOverrides,
  getOverride,
  saveOverride,
  recordOverrideSuccess,
  recordOverrideFailure,
  clearSiteOverrides,
  extractWithOverride,
  createOverrideFromPicker,
  type UserOverride,
  type PickerOptions,
  type PickerResult
} from './elementPicker';
