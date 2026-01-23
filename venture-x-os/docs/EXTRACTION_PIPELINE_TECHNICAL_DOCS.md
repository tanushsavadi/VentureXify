# VentureX-OS Extraction Pipeline Technical Documentation

**Version:** 1.3.0
**Last Updated:** January 21, 2026
**Status:** Production

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architectural Overview](#2-architectural-overview)
3. [Component Documentation](#3-component-documentation)
4. [Configuration Options](#4-configuration-options)
5. [Process Flows](#5-process-flows)
6. [Data Schema Definitions](#6-data-schema-definitions)
7. [Error Handling & Exception Management](#7-error-handling--exception-management)
8. [Performance Considerations](#8-performance-considerations)
9. [Code Examples](#9-code-examples)
10. [Edge Cases & Limitations](#10-edge-cases--limitations)
11. [Testing Strategies](#11-testing-strategies)
12. [Troubleshooting Guide](#12-troubleshooting-guide)
13. [Glossary](#13-glossary)

**Appendices:**
- [Appendix A: File Reference](#appendix-a-file-reference)
- [Appendix B: Quick Reference](#appendix-b-quick-reference)
- [Appendix C: Advanced Topics](#appendix-c-advanced-topics)
  - [C.1 Fingerprint Match Confidence Gating](#c1-fingerprint-match-confidence-gating)
  - [C.2 Unified Price Semantics (PriceBreakdown Model)](#c2-unified-price-semantics-pricebreakdown-model)
  - [C.3 Documentation-to-Code Synchronization](#c3-documentation-to-code-synchronization)
  - [C.4 Tier 3 Throttling Strategy](#c4-tier-3-throttling-strategy)
  - [C.5 Override Lifecycle & Context Signatures](#c5-override-lifecycle--context-signatures)
  - [C.6 Privacy Redaction Layer](#c6-privacy-redaction-layer)
  - [C.7 Triple-Gate Comparison Requirements](#c7-triple-gate-comparison-requirements)
  - [C.8 Candidate De-Duplication](#c8-candidate-de-duplication)
  - [C.9 Picker Semantic Confirmation Flow](#c9-picker-semantic-confirmation-flow)
  - [C.10 Probabilistic Currency Detection](#c10-probabilistic-currency-detection)
  - [C.11 Ground-Truth Proxy Health Metrics](#c11-ground-truth-proxy-health-metrics)
  - [C.12 Hard-Ceiling Disqualifiers](#c12-hard-ceiling-disqualifiers)
  - [C.13 Ambiguity-Aware Confidence](#c13-ambiguity-aware-confidence)
  - [C.14 Page Intent Classifier](#c14-page-intent-classifier)
  - [C.15 Fixture-Based DOM Regression Suite](#c15-fixture-based-dom-regression-suite)
  - [C.16 Locale Lexicon Support](#c16-locale-lexicon-support)
  - [C.17 Unreachable Environment UX](#c17-unreachable-environment-ux)
- [Appendix D: Changelog](#appendix-d-changelog)

---

## 1. Executive Summary

### 1.1 Purpose

The VentureX-OS Extraction Pipeline is a sophisticated, multi-tier data extraction system designed to reliably capture travel booking prices from diverse web sources. It serves as the foundational component of the VentureX browser extension, enabling automated price comparison between travel portals (Capital One Travel) and direct airline/hotel booking sites.

### 1.2 Scope

The pipeline handles:
- **Flight price extraction** from Google Flights, Delta, United, American Airlines, and other carriers
- **Hotel/Stay price extraction** from booking portals and direct hotel sites
- **Portal price extraction** from Capital One Travel for both flights and accommodations
- **Real-time price monitoring** on Single Page Applications (SPAs)
- **User-assisted capture** when automated extraction fails

### 1.3 Role in System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VentureX-OS Architecture                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌──────────────────────┐    ┌───────────────────────┐  │
│  │   Browser   │───▶│  Content Scripts     │───▶│  EXTRACTION PIPELINE  │  │
│  │   Tab/DOM   │    │  (Injected per site) │    │  (This Documentation) │  │
│  └─────────────┘    └──────────────────────┘    └───────────┬───────────┘  │
│                                                              │              │
│                     ┌────────────────────────────────────────┘              │
│                     ▼                                                       │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      Background Service Worker                        │  │
│  │  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │  │
│  │  │   Router    │  │ Compare          │  │  Strategy Engine        │  │  │
│  │  │  (Messages) │  │ Controller       │  │  (Points Calculation)   │  │  │
│  │  └─────────────┘  └─────────────────┘  └─────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────┐    ┌─────────────────────────────────────┐  │
│  │   Side Panel UI           │    │   Chrome Storage                    │  │
│  │   (React Components)      │◀──▶│   (Preferences, Sessions, History) │  │
│  └───────────────────────────┘    └─────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.4 Key Design Principles

1. **Graceful Degradation**: The pipeline uses a 5-tier fallback system, ensuring extraction succeeds even when primary methods fail
2. **Confidence-Aware**: All extractions carry confidence levels (HIGH, MEDIUM, LOW, NONE) with strict promotion rules
3. **SPA-Ready**: Built for modern single-page applications with mutation observers and navigation hooks
4. **Site-Agnostic Heuristics**: Works on unsupported sites through intelligent price detection algorithms
5. **User-Recoverable**: When automation fails, users can manually select price elements

---

## 2. Architectural Overview

### 2.1 Multi-Tier Extraction Architecture

The extraction pipeline implements a 5-tier hierarchical approach:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXTRACTION TIER HIERARCHY                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   TIER 1: SELECTOR PRIMARY (Fastest, Highest Confidence)                   │
│   ─────────────────────────────────────────────────────────────────────    │
│   Uses site-specific CSS selectors from SELECTOR_REGISTRY                  │
│   Confidence: HIGH when matched with data-testid or semantic markers       │
│                                                                             │
│         │ Falls through on failure                                          │
│         ▼                                                                   │
│   TIER 2: SEMANTIC EXTRACTION                                               │
│   ─────────────────────────────────────────────────────────────────────    │
│   Uses ARIA labels, role attributes, and semantic HTML patterns            │
│   Confidence: MEDIUM-HIGH depending on anchor evidence                     │
│                                                                             │
│         │ Falls through on failure                                          │
│         ▼                                                                   │
│   TIER 3: HEURISTIC EXTRACTION (Site-Agnostic)                             │
│   ─────────────────────────────────────────────────────────────────────    │
│   Scans all visible elements, scores candidates with ML-inspired algorithm │
│   Confidence: LOW-MEDIUM based on scoring and anchor evidence              │
│                                                                             │
│         │ Falls through on failure                                          │
│         ▼                                                                   │
│   TIER 4: USER-ASSISTED (Element Picker)                                   │
│   ─────────────────────────────────────────────────────────────────────    │
│   User clicks on price element, system learns selector for future use      │
│   Confidence: HIGH (user-verified)                                         │
│                                                                             │
│         │ Falls through on failure                                          │
│         ▼                                                                   │
│   TIER 5: LLM FALLBACK (Future)                                            │
│   ─────────────────────────────────────────────────────────────────────    │
│   Send DOM snippet to AI model for extraction (not yet implemented)        │
│   Confidence: MEDIUM (model-dependent)                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                              EXTRACTION DATA FLOW                                  │
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│   ┌─────────────┐                                                                  │
│   │  Web Page   │                                                                  │
│   │    DOM      │                                                                  │
│   └──────┬──────┘                                                                  │
│          │                                                                         │
│          ▼                                                                         │
│   ┌──────────────────────────────────────────────────────────────────────────┐    │
│   │                         INPUT STAGE                                       │    │
│   │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐   │    │
│   │  │  SPA Watcher    │  │  URL Detection  │  │  Selector Registry      │   │    │
│   │  │  (Navigation)   │  │  (Site Config)  │  │  (Site-Specific Rules) │   │    │
│   │  └────────┬────────┘  └────────┬────────┘  └────────────┬────────────┘   │    │
│   └───────────┼────────────────────┼────────────────────────┼────────────────┘    │
│               │                    │                        │                      │
│               ▼                    ▼                        ▼                      │
│   ┌──────────────────────────────────────────────────────────────────────────┐    │
│   │                         EXTRACTION STAGE                                  │    │
│   │                                                                           │    │
│   │   ┌───────────────┐   ┌───────────────┐   ┌───────────────────────┐     │    │
│   │   │ Tier 1:       │──▶│ Tier 2:       │──▶│ Tier 3:               │     │    │
│   │   │ Selector      │   │ Semantic      │   │ Heuristic             │     │    │
│   │   └───────────────┘   └───────────────┘   │ (priceHeuristics.ts)  │     │    │
│   │                                           └───────────────────────┘     │    │
│   │                                                     │                    │    │
│   │                  Raw Text + Element Reference       │                    │    │
│   └─────────────────────────────────────────────────────┼────────────────────┘    │
│                                                         │                          │
│                                                         ▼                          │
│   ┌──────────────────────────────────────────────────────────────────────────┐    │
│   │                         PARSING STAGE                                     │    │
│   │  ┌─────────────────────────────────────────────────────────────────────┐ │    │
│   │  │                      parseMoney()                                    │ │    │
│   │  │  - Currency symbol detection (40+ currencies)                       │ │    │
│   │  │  - Locale-aware number parsing (1,234.56 vs 1.234,56)              │ │    │
│   │  │  - Qualifier detection ("per night", "from", "avg")                 │ │    │
│   │  │  - Smart separator inference                                        │ │    │
│   │  └─────────────────────────────────────────────────────────────────────┘ │    │
│   └──────────────────────────────────────────────────────────────────────────┘    │
│                                                         │                          │
│                                                         ▼                          │
│   ┌──────────────────────────────────────────────────────────────────────────┐    │
│   │                         VALIDATION STAGE                                  │    │
│   │  ┌─────────────────────────────────────────────────────────────────────┐ │    │
│   │  │  Confidence Determination (determineConfidence)                     │ │    │
│   │  │  - Anchor Evidence Check (total keywords, aria-labels, containers) │ │    │
│   │  │  - Disqualifying Qualifier Check (per night, from, starting)        │ │    │
│   │  │  - Threshold Gates (MEDIUM requires 2+ anchors, HIGH requires 3+)  │ │    │
│   │  └─────────────────────────────────────────────────────────────────────┘ │    │
│   └──────────────────────────────────────────────────────────────────────────┘    │
│                                                         │                          │
│                                                         ▼                          │
│   ┌──────────────────────────────────────────────────────────────────────────┐    │
│   │                         OUTPUT STAGE                                      │    │
│   │  ┌─────────────────────────────────────────────────────────────────────┐ │    │
│   │  │  ExtractionResult / PipelineResult                                  │ │    │
│   │  │  {                                                                   │ │    │
│   │  │    success: boolean,                                                │ │    │
│   │  │    price: Money | null,                                             │ │    │
│   │  │    confidence: ConfidenceLevel,                                     │ │    │
│   │  │    method: ExtractionMethod,                                        │ │    │
│   │  │    evidence: Evidence[],                                            │ │    │
│   │  │    tier: ExtractionTier,                                            │ │    │
│   │  │    ...                                                              │ │    │
│   │  │  }                                                                   │ │    │
│   │  └─────────────────────────────────────────────────────────────────────┘ │    │
│   └──────────────────────────────────────────────────────────────────────────┘    │
│                                                         │                          │
│                                                         ▼                          │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│   │  Health Monitor │  │  Compare Flow   │  │  Strategy Engine / UI Display  │  │
│   │  (Metrics)      │  │  (Session)      │  │  (Points Calculation)          │  │
│   └─────────────────┘  └─────────────────┘  └─────────────────────────────────┘  │
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 File Organization

```
venture-x-os/src/
├── lib/extraction/                    # Core extraction library
│   ├── pipeline.ts                    # Main orchestrator (5-tier system)
│   ├── types.ts                       # Type definitions & factory functions
│   ├── index.ts                       # Public API exports
│   ├── parseMoney.ts                  # Currency parsing engine
│   ├── priceHeuristics.ts             # Site-agnostic price scoring
│   ├── domUtils.ts                    # DOM traversal utilities
│   ├── spaWatch.ts                    # SPA navigation monitoring
│   ├── health.ts                      # Extraction health monitoring
│   └── elementPicker.ts               # User-assisted capture (Tier 4)
│
├── config/
│   └── selectorsRegistry.ts           # Site-specific selector configs
│
├── content/
│   ├── directCapture.ts               # Airline direct site extractors
│   ├── portalCapture.ts               # Capital One Travel extractor
│   ├── staysCapture.ts                # Hotel stays extraction
│   ├── staysDirectCapture.ts          # Direct hotel site extraction
│   └── extractors/
│       └── flights/
│           └── googleFlights.ts       # Google Flights specific logic
│
└── lib/
    ├── compareTypes.ts                # Compare session type definitions
    └── storage.ts                     # Chrome storage abstraction
```

---

## 3. Component Documentation

### 3.1 Pipeline Orchestrator ([`pipeline.ts`](../src/lib/extraction/pipeline.ts))

#### 3.1.1 Responsibilities

The pipeline orchestrator is the central coordinator that:
- Executes extraction tiers in sequence
- Manages fallback logic between tiers
- Aggregates and normalizes results
- Enforces confidence thresholds
- Records health metrics

#### 3.1.2 Key Interfaces

```typescript
// Pipeline configuration options
interface PipelineOptions {
  skipTiers?: ExtractionTier[];      // Skip specific tiers
  forceTier?: ExtractionTier;        // Force a single tier
  minConfidence?: ConfidenceLevel;   // Minimum acceptable confidence
  timeout?: number;                  // Extraction timeout (ms)
  waitForStability?: boolean;        // Wait for SPA stability
  siteOverrides?: SelectorOverride[];// User-defined selector overrides
}

// Extended result with tier tracking
interface PipelineResult extends ExtractionResult {
  tier: ExtractionTier;
  tiersAttempted: ExtractionTier[];
  tierResults: Map<ExtractionTier, ExtractionResult>;
}
```

#### 3.1.3 Core Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `runExtractionPipeline` | `(options?: PipelineOptions) => Promise<PipelineResult>` | Main entry point - runs all tiers |
| `runSingleTier` | `(tier: ExtractionTier, options?: PipelineOptions) => Promise<ExtractionResult>` | Execute a single tier |
| `shouldPromoteConfidence` | `(result: ExtractionResult) => ConfidenceLevel` | Apply confidence promotion rules |

#### 3.1.4 Tier Execution Logic

```typescript
// Simplified execution flow
async function runExtractionPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const tierOrder: ExtractionTier[] = [
    'SELECTOR_PRIMARY',
    'SEMANTIC',
    'HEURISTIC',
    'USER_ASSISTED',
    'LLM_FALLBACK'
  ];

  for (const tier of tierOrder) {
    if (options.skipTiers?.includes(tier)) continue;
    
    const result = await runSingleTier(tier, options);
    
    if (result.success && meetsConfidenceThreshold(result, options.minConfidence)) {
      return { ...result, tier, tiersAttempted };
    }
    
    tiersAttempted.push(tier);
  }
  
  return createFailedResult('All tiers exhausted');
}
```

---

### 3.2 Type System ([`types.ts`](../src/lib/extraction/types.ts))

#### 3.2.1 Core Types

##### Confidence Levels

```typescript
type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

// Confidence semantics:
// HIGH:   Price is definitively the final total (3+ anchor signals)
// MEDIUM: Strong indication this is the total (2 anchor signals)
// LOW:    Best guess, may be per-night or partial (1 anchor or heuristic)
// NONE:   Extraction failed or no price found
```

##### Money Representation

```typescript
interface Money {
  amount: number;           // Numeric value (e.g., 1234.56)
  currency: string;         // ISO 4217 code (e.g., 'USD', 'EUR')
  formatted: string;        // Display string (e.g., '$1,234.56')
  raw: string;              // Original extracted text
}
```

##### Extraction Result

```typescript
interface ExtractionResult {
  success: boolean;
  price: Money | null;
  confidence: ConfidenceLevel;
  method: ExtractionMethod;
  evidence: Evidence[];
  element?: HTMLElement;
  selector?: string;
  warnings: string[];
  debugInfo?: Record<string, unknown>;
  extractedAt: number;
}
```

##### Evidence Types

```typescript
type Evidence = 
  | { type: 'TOTAL_KEYWORD'; keyword: string; distance: number }
  | { type: 'ARIA_LABEL'; label: string; element: string }
  | { type: 'DATA_TESTID'; testId: string }
  | { type: 'SUMMARY_CONTAINER'; containerClass: string }
  | { type: 'CHECKOUT_PROXIMITY'; buttonText: string; distance: number }
  | { type: 'SEMANTIC_STRUCTURE'; role: string; landmark: string }
  | { type: 'USER_SELECTED'; timestamp: number }
  | { type: 'SELECTOR_MATCH'; selector: string; priority: number };
```

#### 3.2.2 Factory Functions

```typescript
// Create a successful extraction result
function createSuccessResult(
  price: Money,
  method: ExtractionMethod,
  confidence: ConfidenceLevel,
  evidence: Evidence[],
  options?: Partial<ExtractionResult>
): ExtractionResult;

// Create a failed extraction result
function createFailedResult(
  reason: string,
  method: ExtractionMethod,
  warnings?: string[]
): ExtractionResult;

// Merge multiple results, preferring higher confidence
function mergeResults(results: ExtractionResult[]): ExtractionResult;
```

---

### 3.3 Price Heuristics Engine ([`priceHeuristics.ts`](../src/lib/extraction/priceHeuristics.ts))

#### 3.3.1 Overview

The heuristics engine is the heart of site-agnostic extraction. It scans the DOM for potential price elements and scores them using a weighted algorithm inspired by machine learning feature engineering.

#### 3.3.2 Scoring System

```typescript
// Scoring constants
const SCORING = {
  // Positive signals (increase likelihood this is THE price)
  TOTAL_KEYWORD_ADJACENT: 30,      // "Total" within 100px
  ARIA_TOTAL: 25,                  // aria-label contains "total"
  DATA_TESTID_TOTAL: 35,           // data-testid contains "total"
  SUMMARY_CONTAINER: 20,           // Inside price summary section
  CHECKOUT_BUTTON_NEARBY: 25,      // Near "Book Now" or "Continue"
  LARGE_FONT: 15,                  // fontSize > 20px
  BOLD_WEIGHT: 10,                 // fontWeight >= 600
  SEMANTIC_PRICE_CLASS: 15,        // class contains "price", "total", "amount"
  
  // Negative signals (decrease likelihood)
  PER_NIGHT_QUALIFIER: -40,        // "per night" nearby
  FROM_PREFIX: -35,                // "from $X" pattern
  STARTING_AT: -35,                // "starting at" pattern
  STRIKETHROUGH: -50,              // text-decoration: line-through
  SMALL_FONT: -20,                 // fontSize < 14px
  FADED_OPACITY: -25,              // opacity < 0.7
  SEARCH_RESULT_CONTEXT: -30,      // Multiple similar prices visible
};
```

#### 3.3.3 Candidate Interface

```typescript
interface ScoredCandidate {
  element: HTMLElement;
  text: string;
  parsedMoney: ParseMoneyResult;
  score: number;
  signals: SignalMatch[];
  anchorEvidence: Evidence[];      // Evidence that this IS a total
  hasDisqualifyingQualifier: boolean;  // per-night, from, etc.
}
```

#### 3.3.4 Core Algorithm

```typescript
async function extractPriceHeuristically(): Promise<ExtractionResult> {
  // Step 1: Find all potential price elements
  const candidates = findPriceCandidates(document.body);
  
  // Step 2: Parse and score each candidate
  const scoredCandidates: ScoredCandidate[] = candidates
    .map(el => scoreCandidate(el))
    .filter(c => c.parsedMoney.success)
    .sort((a, b) => b.score - a.score);
  
  // Step 3: Apply confidence discipline
  const topCandidate = scoredCandidates[0];
  if (!topCandidate) return createFailedResult('No candidates found');
  
  const confidence = determineConfidence(topCandidate);
  
  return createSuccessResult(
    topCandidate.parsedMoney.money,
    'HEURISTIC',
    confidence,
    topCandidate.anchorEvidence
  );
}
```

#### 3.3.5 Confidence Determination Logic

```typescript
function determineConfidence(candidate: ScoredCandidate): ConfidenceLevel {
  const { score, anchorEvidence, hasDisqualifyingQualifier } = candidate;
  
  // Gate 1: Disqualifying qualifiers cap confidence
  if (hasDisqualifyingQualifier) {
    return 'LOW';  // Cannot exceed LOW with qualifiers
  }
  
  // Gate 2: Anchor count determines ceiling
  const anchorCount = anchorEvidence.length;
  
  if (anchorCount >= 3 && score >= 60) {
    return 'HIGH';
  }
  
  if (anchorCount >= 2 && score >= 40) {
    return 'MEDIUM';
  }
  
  if (anchorCount >= 1 || score >= 20) {
    return 'LOW';
  }
  
  return 'NONE';
}
```

---

### 3.4 Currency Parser ([`parseMoney.ts`](../src/lib/extraction/parseMoney.ts))

#### 3.4.1 Purpose

Parses monetary values from free-form text strings, handling:
- 40+ international currencies
- Locale-specific number formats
- Ambiguous separators (1,234 vs 1.234)
- Qualifier detection

#### 3.4.2 Supported Currencies

```typescript
const CURRENCIES: CurrencyConfig[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', locale: 'ar-AE' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', locale: 'en-CA' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  // ... 32 more currencies
];
```

#### 3.4.3 Parse Result Interface

```typescript
interface ParseMoneyResult {
  success: boolean;
  money: Money | null;
  confidence: number;          // 0-100 parsing confidence
  warnings: string[];
  qualifiers: PriceQualifier[];// 'per_night', 'from', 'starting', etc.
  originalText: string;
  currencyDetectionMethod: 'symbol' | 'code' | 'context' | 'fallback';
}

type PriceQualifier = 
  | 'per_night'
  | 'per_person'
  | 'from'
  | 'starting'
  | 'average'
  | 'before_taxes'
  | 'excluding_fees';
```

#### 3.4.4 Separator Detection Algorithm

```typescript
function detectSeparators(numericPart: string): SeparatorInfo {
  // Examples of ambiguous cases:
  // "1,234" - Is this 1234 or 1.234 (European)?
  // "1.234" - Is this 1.234 or 1234 (European)?
  // "1,234.56" - Clearly US format
  // "1.234,56" - Clearly European format
  
  const commas = (numericPart.match(/,/g) || []).length;
  const dots = (numericPart.match(/\./g) || []).length;
  
  // If both present, last one is decimal
  if (commas && dots) {
    const lastComma = numericPart.lastIndexOf(',');
    const lastDot = numericPart.lastIndexOf('.');
    return {
      thousandsSep: lastComma > lastDot ? '.' : ',',
      decimalSep: lastComma > lastDot ? ',' : '.',
      confidence: 95
    };
  }
  
  // Single separator - check position and digits after
  // If 3 digits after, it's likely thousands separator
  // If 1-2 digits after, it's likely decimal separator
  // ...
}
```

---

### 3.5 SPA Watcher ([`spaWatch.ts`](../src/lib/extraction/spaWatch.ts))

#### 3.5.1 Purpose

Modern travel sites are Single Page Applications that:
- Don't trigger traditional page loads
- Update content dynamically via JavaScript
- Use History API for navigation
- May have multiple prices updating asynchronously

The SPA Watcher ensures reliable extraction by monitoring for stability.

#### 3.5.2 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SPA WATCHER ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                    History API Hooks                             │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────┐   │  │
│   │  │ pushState   │  │ replaceState│  │ popstate event        │   │  │
│   │  │ (wrapped)   │  │ (wrapped)   │  │ (listener)            │   │  │
│   │  └──────┬──────┘  └──────┬──────┘  └───────────┬───────────┘   │  │
│   │         │                │                     │                │  │
│   │         └────────────────┴─────────────────────┘                │  │
│   │                          │                                       │  │
│   │                          ▼                                       │  │
│   │              ┌───────────────────────┐                          │  │
│   │              │   onNavigate(url)     │                          │  │
│   │              │   - Resets stability  │                          │  │
│   │              │   - Triggers re-extract│                          │  │
│   │              └───────────────────────┘                          │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                   MutationObserver                               │  │
│   │  ┌─────────────────────────────────────────────────────────────┐│  │
│   │  │ Observing: document.body                                     ││  │
│   │  │ Config: { childList: true, subtree: true, characterData }   ││  │
│   │  │                                                              ││  │
│   │  │ On Mutation:                                                  ││  │
│   │  │  1. Debounce (100ms)                                         ││  │
│   │  │  2. Check if price-related nodes changed                     ││  │
│   │  │  3. If yes, reset stability window                           ││  │
│   │  │  4. Emit 'contentChanged' event                              ││  │
│   │  └─────────────────────────────────────────────────────────────┘│  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                   Stability Detection                            │  │
│   │  ┌─────────────────────────────────────────────────────────────┐│  │
│   │  │ StabilityInfo {                                              ││  │
│   │  │   isStable: boolean;                                        ││  │
│   │  │   stableReadCount: number;    // Consecutive same values    ││  │
│   │  │   lastValue: string;          // Last extracted price text  ││  │
│   │  │   windowStartMs: number;      // Stability window start     ││  │
│   │  │   requiredStableMs: 700;      // Must be stable for 700ms   ││  │
│   │  │   requiredReadCount: 2;       // At least 2 identical reads ││  │
│   │  │ }                                                            ││  │
│   │  └─────────────────────────────────────────────────────────────┘│  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 3.5.3 Key Functions

```typescript
class SPAWatcher {
  // Start watching for navigation/content changes
  start(options?: SPAWatchOptions): void;
  
  // Stop watching and cleanup
  stop(): void;
  
  // Wait for price to stabilize
  waitForStablePrice(
    extractor: () => Promise<ExtractionResult>,
    options?: StabilityOptions
  ): Promise<ExtractionResult>;
  
  // Check if content has changed since last check
  hasContentChanged(): boolean;
  
  // Get current stability info
  getStabilityInfo(): StabilityInfo;
}
```

#### 3.5.4 Stability Window Algorithm

```typescript
async function waitForStablePrice(
  extractor: () => Promise<ExtractionResult>,
  options: StabilityOptions = {}
): Promise<ExtractionResult> {
  const {
    requiredStableMs = 700,
    requiredReadCount = 2,
    maxWaitMs = 5000,
    pollIntervalMs = 200
  } = options;
  
  let stableReadCount = 0;
  let lastValue: string | null = null;
  let stableStartTime: number | null = null;
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const result = await extractor();
    const currentValue = result.price?.raw || null;
    
    if (currentValue === lastValue && lastValue !== null) {
      stableReadCount++;
      
      if (!stableStartTime) {
        stableStartTime = Date.now();
      }
      
      const stableDuration = Date.now() - stableStartTime;
      
      if (stableDuration >= requiredStableMs && stableReadCount >= requiredReadCount) {
        // Promote confidence due to stability
        return {
          ...result,
          confidence: promoteConfidence(result.confidence),
          evidence: [
            ...result.evidence,
            { type: 'STABILITY_CONFIRMED', readCount: stableReadCount, durationMs: stableDuration }
          ]
        };
      }
    } else {
      // Value changed, reset stability tracking
      stableReadCount = 1;
      stableStartTime = Date.now();
      lastValue = currentValue;
    }
    
    await sleep(pollIntervalMs);
  }
  
  // Timeout - return best result with stability warning
  return {
    ...lastResult,
    warnings: [...lastResult.warnings, 'Price may not be fully loaded (stability timeout)']
  };
}
```

---

### 3.6 Health Monitor ([`health.ts`](../src/lib/extraction/health.ts))

#### 3.6.1 Purpose

Tracks extraction success rates per site to:
- Detect degradation (site changed, selectors broke)
- Prioritize selector registry updates
- Generate debug payloads for issue reporting
- Enable/disable sites based on reliability

#### 3.6.2 Health Metrics

```typescript
interface ExtractionHealth {
  siteKey: string;
  hostname: string;
  
  // Success metrics
  totalAttempts: number;
  successfulExtractions: number;
  successRate: number;              // 0-100
  
  // Confidence distribution
  confidenceBreakdown: {
    high: number;
    medium: number;
    low: number;
    none: number;
  };
  
  // Tier usage
  tierBreakdown: {
    [key in ExtractionTier]: number;
  };
  
  // Trend tracking
  recentSuccessRate: number;        // Last 10 attempts
  trend: 'improving' | 'stable' | 'degrading';
  
  // Timestamps
  firstSeen: number;
  lastAttempt: number;
  lastSuccess: number;
}
```

#### 3.6.3 Key Functions

```typescript
// Record an extraction event
function recordExtractionEvent(
  hostname: string,
  result: ExtractionResult,
  tier: ExtractionTier
): void;

// Get health for a specific site
function getSiteHealth(hostname: string): ExtractionHealth | null;

// Check if site is degraded (may need selector update)
function isSiteDegraded(hostname: string, threshold?: number): boolean;

// Generate debug payload for issue reporting
function generateDebugPayload(
  result: ExtractionResult,
  options?: DebugOptions
): DebugPayload;
```

#### 3.6.4 Degradation Detection

```typescript
function isSiteDegraded(hostname: string, threshold: number = 50): boolean {
  const health = getSiteHealth(hostname);
  if (!health) return false;
  
  // Check 1: Overall success rate below threshold
  if (health.successRate < threshold) return true;
  
  // Check 2: Recent trend is degrading
  if (health.trend === 'degrading' && health.recentSuccessRate < health.successRate - 20) {
    return true;
  }
  
  // Check 3: High confidence extractions dropping
  const highConfidenceRate = health.confidenceBreakdown.high / health.totalAttempts;
  if (highConfidenceRate < 0.3 && health.totalAttempts > 10) {
    return true;
  }
  
  return false;
}
```

---

### 3.7 Element Picker ([`elementPicker.ts`](../src/lib/extraction/elementPicker.ts))

#### 3.7.1 Purpose

Tier 4 user-assisted extraction enables users to manually select price elements when automated extraction fails. The system then:
- Generates optimal CSS selectors for the chosen element
- Stores the override for future extractions
- Tracks success/failure to auto-retire bad overrides

#### 3.7.2 Picker UI Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ELEMENT PICKER FLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   1. User triggers picker (e.g., "Select price manually" button)       │
│      │                                                                  │
│      ▼                                                                  │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ activatePicker()                                                  │  │
│   │  - Inject overlay CSS                                            │  │
│   │  - Add mouseover highlight listener                              │  │
│   │  - Add click capture listener                                    │  │
│   │  - Show instruction toast                                        │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│      │                                                                  │
│      ▼                                                                  │
│   2. User hovers over elements (highlight shows)                       │
│      │                                                                  │
│      ▼                                                                  │
│   3. User clicks on price element                                      │
│      │                                                                  │
│      ▼                                                                  │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ onElementSelected(element)                                        │  │
│   │  - Generate selector strategies                                   │  │
│   │  - Parse money from element text                                  │  │
│   │  - Show confirmation dialog with parsed price                    │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│      │                                                                  │
│      ▼                                                                  │
│   4. User confirms or tries again                                      │
│      │                                                                  │
│      ▼                                                                  │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ saveUserOverride(override)                                        │  │
│   │  - Store in Chrome storage                                       │  │
│   │  - Associate with site hostname                                  │  │
│   │  - Initialize success/fail counters                              │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│      │                                                                  │
│      ▼                                                                  │
│   5. deactivatePicker() - Cleanup and return result                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 3.7.3 Selector Generation Strategies

```typescript
interface UserOverride {
  siteKey: string;
  field: 'totalPrice' | 'taxesFees' | 'perNight';
  selectors: string[];             // Multiple strategies, ordered by specificity
  createdAt: number;
  successCount: number;
  failCount: number;
  source: 'user_pick' | 'manual' | 'auto_learned';
}

function generateSelectorStrategies(element: HTMLElement): string[] {
  const strategies: string[] = [];
  
  // Strategy 1: data-testid (most stable)
  if (element.dataset.testid) {
    strategies.push(`[data-testid="${element.dataset.testid}"]`);
  }
  
  // Strategy 2: ID (if not dynamic-looking)
  if (element.id && !looksLikeDynamicId(element.id)) {
    strategies.push(`#${element.id}`);
  }
  
  // Strategy 3: Aria label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    strategies.push(`[aria-label="${ariaLabel}"]`);
  }
  
  // Strategy 4: Stable class combination
  const stableClasses = getStableClasses(element);
  if (stableClasses.length) {
    strategies.push(`.${stableClasses.join('.')}`);
  }
  
  // Strategy 5: Parent context + tag
  const parent = element.parentElement;
  if (parent) {
    const parentSelector = getSimpleSelector(parent);
    strategies.push(`${parentSelector} > ${element.tagName.toLowerCase()}`);
  }
  
  // Strategy 6: nth-child fallback
  strategies.push(generateNthChildPath(element));
  
  return strategies;
}
```

---

### 3.8 Selector Registry ([`selectorsRegistry.ts`](../src/config/selectorsRegistry.ts))

#### 3.8.1 Purpose

Centralized configuration for site-specific selectors, enabling:
- Fast updates without code changes
- Version tracking for cache invalidation
- Feature flags for site behaviors
- Confidence modifiers for known-difficult sites

#### 3.8.2 Site Configuration Structure

```typescript
interface SiteSelectorConfig {
  siteKey: string;              // Hostname pattern (e.g., 'delta.com')
  siteName: string;             // Display name
  version: string;              // Config version (YYYY-MM-DD)
  lastUpdated: string;
  siteType: 'airline' | 'portal' | 'hotel' | 'metasearch' | 'ota';
  bookingType: 'flight' | 'stay' | 'rental' | 'multi';
  
  selectors: {
    totalPrice: PriceSelectorConfig;
    taxesFees?: PriceSelectorConfig;
    perNight?: PriceSelectorConfig;
    basePrice?: PriceSelectorConfig;
    checkoutContainer?: string[];
    
    // Entity selectors
    airlineName?: string[];
    flightTimes?: string[];
    propertyName?: string[];
    roomType?: string[];
  };
  
  regex?: SiteRegexPatterns;
  featureFlags?: SiteFeatureFlags;
  confidenceModifier?: number;  // -20 to +20
  notes?: string;
  knownIssues?: string[];
}

interface PriceSelectorConfig {
  primary: string[];      // Most reliable selectors
  fallback?: string[];    // Try if primary fails
  semantic?: string[];    // ARIA/role-based selectors
  container?: string[];   // Narrow search scope
}
```

#### 3.8.3 Feature Flags

```typescript
interface SiteFeatureFlags {
  usesShadowDom?: boolean;           // Components in shadow DOM
  isSPA?: boolean;                   // Needs mutation observer
  obfuscatedClassesLikely?: boolean; // Heuristics over selectors
  lazyLoadsCheckout?: boolean;       // Wait for content
  usesIframes?: boolean;             // Price in iframe
  frequentABTests?: boolean;         // Selectors change often
  multiCurrencyDisplay?: boolean;    // Multiple currencies shown
}
```

#### 3.8.4 Example Configuration

```typescript
{
  siteKey: 'google.com/travel/flights',
  siteName: 'Google Flights',
  version: '2026-01-21',
  lastUpdated: '2026-01-21',
  siteType: 'metasearch',
  bookingType: 'flight',
  selectors: {
    totalPrice: {
      primary: [
        '[class*="FpEdX"] span',
        '[class*="YMlIz"]',
        '[class*="gOatQ"]',
      ],
      fallback: [
        '[aria-label*="total" i]',
        '[aria-label*="price" i]',
      ],
      semantic: [
        '[role="heading"] + div [class*="price"]',
      ],
      container: [
        '[class*="booking-options"]',
        '.gws-flights-book__booking-option',
      ],
    },
  },
  featureFlags: {
    isSPA: true,
    obfuscatedClassesLikely: true,
    frequentABTests: true,
  },
  confidenceModifier: -5,  // Less confident due to obfuscation
  knownIssues: [
    'Class names change frequently',
    'Multi-currency display can confuse extraction',
  ],
}
```

---

### 3.9 Site-Specific Extractors

#### 3.9.1 Google Flights Extractor ([`googleFlights.ts`](../src/content/extractors/flights/googleFlights.ts))

**Responsibilities:**
- Extract prices from Google Flights search and booking pages
- Handle obfuscated class names that change frequently
- Detect booking stage (search → selection → checkout)
- Extract flight fingerprint (route, dates, times)

**Key Functions:**

```typescript
// Main extraction entry point
function extractGoogleFlightsPrice(): ExtractionResult;

// Full capture with itinerary fingerprint
function captureGoogleFlight(): FlightCapture;

// Detect current booking stage
function detectGoogleFlightsStage(): 'search' | 'details' | 'checkout';
```

#### 3.9.2 Direct Capture ([`directCapture.ts`](../src/content/directCapture.ts))

**Responsibilities:**
- Extract prices from airline direct booking sites (Delta, United, AA)
- Map airline codes to extractor configurations
- Track trip context across navigation
- Coordinate with compare session flow

**Extractor Registry:**

```typescript
const AIRLINE_EXTRACTORS: Map<string, AirlineExtractorConfig> = new Map([
  ['delta.com', {
    name: 'Delta Air Lines',
    code: 'DL',
    extractPrice: extractDeltaPrice,
    extractFingerprint: extractDeltaFingerprint,
    detectStage: detectDeltaStage,
  }],
  ['united.com', {
    name: 'United Airlines',
    code: 'UA',
    extractPrice: extractUnitedPrice,
    // ...
  }],
  ['aa.com', {
    name: 'American Airlines',
    code: 'AA',
    extractPrice: extractAAPrice,
    // ...
  }],
  ['google.com/travel/flights', {
    name: 'Google Flights',
    code: 'GF',
    extractPrice: extractGoogleFlightsPrice,
    // ...
  }],
]);
```

#### 3.9.3 Portal Capture ([`portalCapture.ts`](../src/content/portalCapture.ts))

**Responsibilities:**
- Extract prices from Capital One Travel portal
- Handle both flights and hotels/stays
- Extract itinerary fingerprint for comparison matching
- Detect booking stage and page type

**Key Functions:**

```typescript
// Capture portal snapshot for comparison
async function capturePortalSnapshot(): Promise<PortalSnapshot>;

// Extract flight fingerprint from portal page
function extractFlightFingerprint(): FlightFingerprint | null;

// Extract hotel fingerprint from portal page
function extractHotelFingerprint(): HotelFingerprint | null;

// Detect current page type
function detectPortalPageType(): 'search' | 'details' | 'checkout' | 'unknown';
```

---

### 3.10 DOM Utilities ([`domUtils.ts`](../src/lib/extraction/domUtils.ts))

#### 3.10.1 Key Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `isElementVisible` | `(el: HTMLElement) => boolean` | Check if element is in viewport and not hidden |
| `getVisibleText` | `(el: HTMLElement) => string` | Get text content excluding hidden children |
| `findClosestWithText` | `(el: HTMLElement, text: string | RegExp, maxDistance?: number) => HTMLElement \| null` | Find nearby element containing text |
| `getComputedNumericStyle` | `(el: HTMLElement, prop: string) => number` | Get numeric CSS property value |
| `measureDistance` | `(el1: HTMLElement, el2: HTMLElement) => number` | Calculate pixel distance between elements |
| `isInSummaryContainer` | `(el: HTMLElement) => boolean` | Check if element is in a price summary section |
| `getAncestorWithClass` | `(el: HTMLElement, classPattern: RegExp) => HTMLElement \| null` | Find ancestor matching class pattern |
| `shadowDomQuery` | `(selector: string, root?: Element) => Element[]` | Query selector that pierces shadow DOM |

---

## 4. Configuration Options

### 4.1 Pipeline Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `skipTiers` | `ExtractionTier[]` | `[]` | Tiers to skip in execution |
| `forceTier` | `ExtractionTier` | `undefined` | Execute only this tier |
| `minConfidence` | `ConfidenceLevel` | `'LOW'` | Minimum acceptable confidence |
| `timeout` | `number` | `10000` | Overall extraction timeout (ms) |
| `waitForStability` | `boolean` | `true` | Wait for SPA content to stabilize |
| `siteOverrides` | `SelectorOverride[]` | `[]` | User-defined selector overrides |

### 4.2 SPA Watcher Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `debounceMs` | `number` | `100` | Debounce time for mutation events |
| `watchInterval` | `number` | `200` | Poll interval for stability checks |
| `maxWaitMs` | `number` | `5000` | Maximum wait for stability |
| `requiredStableMs` | `number` | `700` | Duration price must be stable |
| `requiredReadCount` | `number` | `2` | Consecutive identical reads required |

### 4.3 Health Monitor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `retentionDays` | `number` | `30` | Days to retain health metrics |
| `degradationThreshold` | `number` | `50` | Success rate below which site is "degraded" |
| `recentWindow` | `number` | `10` | Recent attempts for trend calculation |

### 4.4 Environment Variables

The extraction pipeline doesn't use environment variables directly, but respects these Chrome storage settings:

| Key | Type | Description |
|-----|------|-------------|
| `vx_extraction_debug` | `boolean` | Enable verbose console logging |
| `vx_selector_overrides` | `UserSelectorOverride[]` | User-defined selector overrides |
| `vx_extraction_health` | `ExtractionHealth[]` | Persisted health metrics |

---

## 5. Process Flows

### 5.1 Main Extraction Sequence

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MAIN EXTRACTION SEQUENCE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  START                                                                      │
│    │                                                                        │
│    ▼                                                                        │
│  ┌─────────────────────────────────────────────┐                           │
│  │ 1. Detect Site & Load Config                 │                           │
│  │    - getSelectorConfig(hostname)             │                           │
│  │    - Load user overrides                     │                           │
│  │    - Check feature flags                     │                           │
│  └───────────────────┬─────────────────────────┘                           │
│                      │                                                      │
│                      ▼                                                      │
│  ┌─────────────────────────────────────────────┐                           │
│  │ 2. Initialize SPA Watcher (if SPA)          │                           │
│  │    - Hook History API                        │                           │
│  │    - Setup MutationObserver                  │                           │
│  └───────────────────┬─────────────────────────┘                           │
│                      │                                                      │
│                      ▼                                                      │
│  ┌─────────────────────────────────────────────┐                           │
│  │ 3. Wait for Initial Stability               │                           │
│  │    - Poll until content stabilizes          │                           │
│  │    - Timeout after maxWaitMs                │                           │
│  └───────────────────┬─────────────────────────┘                           │
│                      │                                                      │
│                      ▼                                                      │
│  ┌─────────────────────────────────────────────┐                           │
│  │ 4. Run Extraction Pipeline                   │                           │
│  │    - Execute tiers sequentially             │                           │
│  │    - Stop on first success meeting threshold │                           │
│  └───────────────────┬─────────────────────────┘                           │
│                      │                                                      │
│          ┌──────────┴──────────┐                                           │
│          │                     │                                            │
│          ▼                     ▼                                            │
│    ┌──────────┐          ┌──────────┐                                      │
│    │ SUCCESS  │          │ FAILURE  │                                      │
│    └────┬─────┘          └────┬─────┘                                      │
│         │                     │                                             │
│         ▼                     ▼                                             │
│  ┌─────────────────┐   ┌─────────────────┐                                 │
│  │ 5a. Record      │   │ 5b. Prompt User │                                 │
│  │     Health      │   │     for Manual  │                                 │
│  │     Metrics     │   │     Selection   │                                 │
│  └────────┬────────┘   └────────┬────────┘                                 │
│           │                     │                                           │
│           ▼                     ▼                                           │
│  ┌─────────────────┐   ┌─────────────────┐                                 │
│  │ 6a. Return      │   │ 6b. Save User   │                                 │
│  │     Result      │   │     Override    │                                 │
│  └─────────────────┘   └────────┬────────┘                                 │
│                                 │                                           │
│                                 ▼                                           │
│                        ┌─────────────────┐                                 │
│                        │ 6c. Return      │                                 │
│                        │     Result      │                                 │
│                        └─────────────────┘                                 │
│                                                                             │
│  END                                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Tier Fallback Decision Tree

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TIER FALLBACK DECISION TREE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ┌────────────────────────┐                               │
│                    │ TIER 1: SELECTOR       │                               │
│                    │ PRIMARY                │                               │
│                    └───────────┬────────────┘                               │
│                                │                                            │
│               ┌────────────────┼────────────────┐                           │
│               │                │                │                           │
│               ▼                ▼                ▼                           │
│        ┌─────────┐      ┌─────────┐      ┌─────────┐                       │
│        │ Matched │      │ Matched │      │  No     │                       │
│        │ HIGH    │      │ LOW/MED │      │ Match   │                       │
│        │ conf    │      │ conf    │      │         │                       │
│        └────┬────┘      └────┬────┘      └────┬────┘                       │
│             │                │                │                             │
│             ▼                ▼                ▼                             │
│        ┌─────────┐      ┌─────────────────────────┐                        │
│        │ RETURN  │      │ Continue to TIER 2      │                        │
│        │ SUCCESS │      │ (save as fallback)      │                        │
│        └─────────┘      └───────────┬─────────────┘                        │
│                                     │                                       │
│                    ┌────────────────┴────────────────┐                     │
│                    │ TIER 2: SEMANTIC                │                     │
│                    └───────────┬────────────────────┘                      │
│                                │                                            │
│               ┌────────────────┼────────────────┐                           │
│               │                │                │                           │
│               ▼                ▼                ▼                           │
│        ┌─────────┐      ┌─────────┐      ┌─────────┐                       │
│        │ Matched │      │ Matched │      │  No     │                       │
│        │ HIGH    │      │ MED     │      │ Match   │                       │
│        └────┬────┘      └────┬────┘      └────┬────┘                       │
│             │                │                │                             │
│             ▼                │                ▼                             │
│        ┌─────────┐           │      ┌─────────────────────────┐            │
│        │ RETURN  │           │      │ Continue to TIER 3      │            │
│        │ SUCCESS │           │      │                         │            │
│        └─────────┘           │      └───────────┬─────────────┘            │
│                              │                  │                           │
│                              │  ┌───────────────┘                           │
│                              │  │                                           │
│                              ▼  ▼                                           │
│                    ┌────────────────────────────┐                           │
│                    │ TIER 3: HEURISTIC          │                           │
│                    └───────────┬────────────────┘                           │
│                                │                                            │
│              ┌─────────────────┼──────────────────┐                         │
│              │                 │                  │                         │
│              ▼                 ▼                  ▼                         │
│       ┌──────────┐      ┌──────────┐      ┌──────────┐                     │
│       │ Found    │      │ Found    │      │  No      │                     │
│       │ MED+     │      │ LOW      │      │ Candidate│                     │
│       │ conf     │      │ conf     │      │          │                     │
│       └────┬─────┘      └────┬─────┘      └────┬─────┘                     │
│            │                 │                 │                            │
│            ▼                 ▼                 ▼                            │
│       ┌──────────┐      ┌──────────┐    ┌────────────────┐                 │
│       │ RETURN   │      │Compare vs│    │ TIER 4: USER   │                 │
│       │ SUCCESS  │      │ Tier 1/2 │    │ ASSISTED       │                 │
│       └──────────┘      │ fallback │    └───────┬────────┘                 │
│                         │ best wins│            │                           │
│                         └────┬─────┘            ▼                           │
│                              │           ┌──────────────┐                   │
│                              ▼           │ User picks   │                   │
│                         ┌──────────┐     │ element      │                   │
│                         │ RETURN   │     └───────┬──────┘                   │
│                         │ BEST     │             │                          │
│                         └──────────┘             ▼                          │
│                                          ┌──────────────┐                   │
│                                          │ RETURN or    │                   │
│                                          │ TIER 5 (LLM) │                   │
│                                          └──────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Compare Flow Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     COMPARE SESSION FLOW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │ User on Portal  │                                                        │
│  │ (C1 Travel)     │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           ▼ Clicks "Compare Direct"                                         │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ 1. PORTAL CAPTURE                                                │       │
│  │    - runExtractionPipeline() on portal page                      │       │
│  │    - Extract price + itinerary fingerprint                       │       │
│  │    - Create CompareSession with status='PORTAL_CAPTURED'        │       │
│  └───────────────────────────┬─────────────────────────────────────┘       │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ 2. OPEN DIRECT TAB                                               │       │
│  │    - Look up airline from fingerprint                            │       │
│  │    - Open airline direct booking site                            │       │
│  │    - Session status='DIRECT_OPENED'                              │       │
│  └───────────────────────────┬─────────────────────────────────────┘       │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ 3. USER REPRODUCES SEARCH                                        │       │
│  │    - User enters same search criteria on direct site             │       │
│  │    - Extension monitors for checkout page                        │       │
│  │    - SPA Watcher detects navigation                              │       │
│  └───────────────────────────┬─────────────────────────────────────┘       │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ 4. DIRECT CAPTURE                                                │       │
│  │    - Detect checkout/booking page                                │       │
│  │    - runExtractionPipeline() on direct page                      │       │
│  │    - Session status='DIRECT_CAPTURED'                            │       │
│  └───────────────────────────┬─────────────────────────────────────┘       │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ 5. COMPARISON                                                    │       │
│  │    - Calculate price difference                                  │       │
│  │    - Apply points/miles calculation                              │       │
│  │    - Determine winner (portal vs direct)                         │       │
│  │    - Session status='DONE'                                       │       │
│  └───────────────────────────┬─────────────────────────────────────┘       │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │ 6. DISPLAY RESULT                                                │       │
│  │    - Show DecisionCard in side panel                             │       │
│  │    - Save to history                                             │       │
│  │    - Record health metrics                                       │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 State Transitions

```typescript
// Compare Session State Machine
type CompareSessionStatus =
  | 'INIT'              // Session created, nothing captured
  | 'PORTAL_CAPTURED'   // Portal price extracted
  | 'DIRECT_OPENED'     // Direct tab opened
  | 'DIRECT_CAPTURED'   // Direct price extracted
  | 'DONE'              // Comparison complete
  | 'FAILED'            // Unrecoverable error
  | 'CANCELLED';        // User cancelled

// Valid state transitions
const VALID_TRANSITIONS: Record<CompareSessionStatus, CompareSessionStatus[]> = {
  'INIT':             ['PORTAL_CAPTURED', 'FAILED', 'CANCELLED'],
  'PORTAL_CAPTURED':  ['DIRECT_OPENED', 'FAILED', 'CANCELLED'],
  'DIRECT_OPENED':    ['DIRECT_CAPTURED', 'FAILED', 'CANCELLED'],
  'DIRECT_CAPTURED':  ['DONE', 'FAILED'],
  'DONE':             [],  // Terminal state
  'FAILED':           [],  // Terminal state
  'CANCELLED':        [],  // Terminal state
};
```

---

## 6. Data Schema Definitions

### 6.1 Input Formats

#### 6.1.1 Raw DOM Input

The pipeline operates on the live DOM. Input can come from:

| Source | Description | Example |
|--------|-------------|---------|
| `document.body` | Full page scan for heuristics | Used by Tier 3 |
| `element.textContent` | Text from specific element | Used by Tier 1/2 |
| `element.getAttribute()` | Attribute values | aria-label, data-testid |
| `window.getComputedStyle()` | CSS property values | font-size, visibility |

#### 6.1.2 Site Configuration Input

```typescript
// Input from selectorsRegistry.ts
interface SelectorRegistryInput {
  siteKey: string;
  selectors: PriceSelectorConfig;
  featureFlags?: SiteFeatureFlags;
}
```

### 6.2 Intermediate Representations

#### 6.2.1 Parsed Money Result

```typescript
interface ParseMoneyResult {
  success: boolean;
  money: {
    amount: number;
    currency: string;
    formatted: string;
    raw: string;
  } | null;
  confidence: number;              // 0-100
  warnings: string[];
  qualifiers: PriceQualifier[];
  originalText: string;
  currencyDetectionMethod: 'symbol' | 'code' | 'context' | 'fallback';
}
```

#### 6.2.2 Scored Candidate (Heuristics)

```typescript
interface ScoredCandidate {
  element: HTMLElement;
  text: string;
  parsedMoney: ParseMoneyResult;
  score: number;
  signals: Array<{
    type: string;
    value: number;
    description: string;
  }>;
  anchorEvidence: Evidence[];
  hasDisqualifyingQualifier: boolean;
  boundingRect: DOMRect;
}
```

#### 6.2.3 Stability Info

```typescript
interface StabilityInfo {
  isStable: boolean;
  stableReadCount: number;
  lastValue: string | null;
  windowStartMs: number;
  lastChangeMs: number;
}
```

### 6.3 Output Structures

#### 6.3.1 Extraction Result

```typescript
interface ExtractionResult {
  // Core result
  success: boolean;
  price: Money | null;
  confidence: ConfidenceLevel;
  method: ExtractionMethod;
  
  // Evidence chain
  evidence: Evidence[];
  
  // Element reference
  element?: HTMLElement;
  selector?: string;
  
  // Diagnostics
  warnings: string[];
  debugInfo?: Record<string, unknown>;
  
  // Timing
  extractedAt: number;
  durationMs?: number;
}
```

#### 6.3.2 Pipeline Result

```typescript
interface PipelineResult extends ExtractionResult {
  tier: ExtractionTier;
  tiersAttempted: ExtractionTier[];
  tierResults: Map<ExtractionTier, ExtractionResult>;
  totalDurationMs: number;
}
```

#### 6.3.3 Flight Capture

```typescript
interface FlightCapture {
  type: 'flight';
  price: Money;
  confidence: ConfidenceLevel;
  fingerprint: FlightFingerprint;
  pageType: 'search' | 'details' | 'checkout';
  siteName: string;
  capturedAt: number;
}

interface FlightFingerprint {
  type: 'flight';
  origin?: string;           // IATA code
  destination?: string;      // IATA code
  departDate?: string;       // YYYY-MM-DD
  returnDate?: string;       // YYYY-MM-DD
  cabin?: 'economy' | 'premium' | 'business' | 'first';
  paxCount?: number;
  flightNumbers?: string[];
  operatingCarrier?: string;
  operatingCarrierName?: string;
  
  // Outbound details
  departureTime?: string;
  arrivalTime?: string;
  duration?: string;
  stops?: number;
  
  // Return details
  returnDepartureTime?: string;
  returnArrivalTime?: string;
  returnDuration?: string;
  returnStops?: number;
}
```

#### 6.3.4 Stay Capture

```typescript
interface StayCapture {
  type: 'stay';
  price: Money;
  priceType: 'total' | 'perNight';
  confidence: ConfidenceLevel;
  fingerprint: HotelFingerprint;
  pageType: 'search' | 'details' | 'checkout';
  siteName: string;
  capturedAt: number;
}

interface HotelFingerprint {
  type: 'hotel';
  hotelName?: string;
  city?: string;
  checkinDate?: string;
  checkoutDate?: string;
  nights?: number;
  roomCount?: number;
  guestCount?: number;
  brandCode?: string;
}
```

### 6.4 Field Mappings & Type Transformations

| Source Field | Intermediate Type | Output Field | Transformation |
|--------------|-------------------|--------------|----------------|
| Raw price text | `string` | `Money.amount` | Parse number, handle separators |
| Currency symbol | `string` | `Money.currency` | Map symbol to ISO code |
| Element | `HTMLElement` | `Evidence[]` | Extract attributes, compute signals |
| Computed styles | `CSSStyleDeclaration` | `score: number` | Apply scoring weights |
| textContent | `string` | `qualifiers[]` | Detect "per night", "from", etc. |

---

## 7. Error Handling & Exception Management

### 7.1 Error Categories

```typescript
// Custom error types
class ExtractionError extends Error {
  constructor(
    message: string,
    public code: ExtractionErrorCode,
    public recoverable: boolean,
    public tier?: ExtractionTier
  ) {
    super(message);
  }
}

type ExtractionErrorCode =
  | 'SELECTOR_NOT_FOUND'      // CSS selector matched nothing
  | 'PARSE_FAILED'            // Money parsing failed
  | 'CONFIDENCE_TOO_LOW'      // Below threshold
  | 'TIMEOUT'                 // Extraction took too long
  | 'STABILITY_TIMEOUT'       // Price never stabilized
  | 'DOM_CHANGED'             // Element removed during extraction
  | 'INVALID_CURRENCY'        // Unrecognized currency
  | 'AMBIGUOUS_PRICE'         // Multiple equally-scored candidates
  | 'SITE_NOT_SUPPORTED'      // No config for site
  | 'USER_CANCELLED'          // User cancelled picker
  | 'STORAGE_ERROR';          // Chrome storage failed
```

### 7.2 Retry Logic

```typescript
// Retry configuration per tier
const RETRY_CONFIG: Record<ExtractionTier, RetryConfig> = {
  'SELECTOR_PRIMARY': { maxAttempts: 2, delayMs: 100 },
  'SEMANTIC': { maxAttempts: 2, delayMs: 100 },
  'HEURISTIC': { maxAttempts: 1, delayMs: 0 },      // No retry - deterministic
  'USER_ASSISTED': { maxAttempts: 3, delayMs: 500 }, // User may retry
  'LLM_FALLBACK': { maxAttempts: 2, delayMs: 1000 }, // Rate limiting
};

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < config.maxAttempts) {
        await sleep(config.delayMs * attempt); // Exponential backoff
      }
    }
  }
  
  throw lastError;
}
```

### 7.3 Fallback Mechanisms

```typescript
// Fallback chain for price extraction
async function extractWithFallbacks(): Promise<ExtractionResult> {
  // 1. Try site-specific selectors
  const selectorResult = await trySelectorExtraction();
  if (selectorResult.success && selectorResult.confidence !== 'NONE') {
    return selectorResult;
  }
  
  // 2. Try semantic extraction
  const semanticResult = await trySemanticExtraction();
  if (semanticResult.success && semanticResult.confidence !== 'NONE') {
    return mergeResults([selectorResult, semanticResult]);
  }
  
  // 3. Try heuristic extraction
  const heuristicResult = await tryHeuristicExtraction();
  if (heuristicResult.success) {
    return mergeResults([selectorResult, semanticResult, heuristicResult]);
  }
  
  // 4. User-assisted fallback
  if (await shouldPromptUser()) {
    return await promptUserPick();
  }
  
  // 5. Return best partial result
  return mergeResults([selectorResult, semanticResult, heuristicResult]);
}
```

### 7.4 Dead Letter Queue (Failed Extractions)

```typescript
interface FailedExtraction {
  id: string;
  url: string;
  hostname: string;
  timestamp: number;
  error: {
    code: ExtractionErrorCode;
    message: string;
    stack?: string;
  };
  domSnapshot?: string;  // Sanitized HTML snippet
  tierResults: Map<ExtractionTier, ExtractionResult>;
}

// Store failed extractions for debugging
async function recordFailedExtraction(
  error: ExtractionError,
  context: ExtractionContext
): Promise<void> {
  const failed: FailedExtraction = {
    id: generateId(),
    url: sanitizeUrl(window.location.href),
    hostname: window.location.hostname,
    timestamp: Date.now(),
    error: {
      code: error.code,
      message: error.message,
      stack: error.stack,
    },
    tierResults: context.tierResults,
  };
  
  // Add to queue (limit to last 50)
  const queue = await getFailedExtractionQueue();
  queue.unshift(failed);
  await saveFailedExtractionQueue(queue.slice(0, 50));
}
```

### 7.5 Logging Strategy

```typescript
// Log levels for extraction events
type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface ExtractionLog {
  level: LogLevel;
  timestamp: number;
  message: string;
  context: {
    hostname: string;
    tier?: ExtractionTier;
    selector?: string;
    confidence?: ConfidenceLevel;
    durationMs?: number;
  };
  data?: Record<string, unknown>;
}

// Logging functions
function logExtraction(log: ExtractionLog): void {
  if (!isDebugEnabled()) return;
  
  const prefix = `[VentureX:Extraction]`;
  const formatted = `${prefix} [${log.level}] ${log.message}`;
  
  switch (log.level) {
    case 'DEBUG': console.debug(formatted, log.context, log.data); break;
    case 'INFO':  console.info(formatted, log.context, log.data); break;
    case 'WARN':  console.warn(formatted, log.context, log.data); break;
    case 'ERROR': console.error(formatted, log.context, log.data); break;
  }
}
```

---

## 8. Performance Considerations

### 8.1 Throughput Metrics

| Operation | Target Time | Typical Time | Max Time |
|-----------|-------------|--------------|----------|
| Selector extraction (Tier 1) | <50ms | 10-30ms | 100ms |
| Semantic extraction (Tier 2) | <100ms | 30-60ms | 200ms |
| Heuristic extraction (Tier 3) | <300ms | 100-200ms | 500ms |
| Full pipeline (all tiers) | <500ms | 150-300ms | 1000ms |
| Stability wait (SPA) | ~700ms | 700-1500ms | 5000ms |
| Element picker activation | <100ms | 50ms | 200ms |

### 8.2 Bottleneck Identification

| Bottleneck | Cause | Impact | Mitigation |
|------------|-------|--------|------------|
| DOM scanning (Tier 3) | Iterating all visible elements | High CPU on large pages | Limit scan to checkout containers |
| getComputedStyle calls | Layout thrashing | Slow on complex DOM | Batch style reads |
| Regex matching | Complex patterns on long text | CPU spikes | Use indexOf before regex |
| MutationObserver | High mutation rate on SPAs | Memory/CPU | Debounce callbacks |
| Chrome storage reads | Async storage access | Latency | Cache overrides in memory |

### 8.3 Optimization Techniques

#### 8.3.1 Element Filtering

```typescript
// Filter candidates before expensive operations
function filterCandidateElements(elements: HTMLElement[]): HTMLElement[] {
  return elements.filter(el => {
    // Quick visibility check
    if (el.offsetParent === null) return false;
    
    // Skip known non-price elements
    const tag = el.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'svg', 'path'].includes(tag)) {
      return false;
    }
    
    // Skip very small elements
    const rect = el.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return false;
    
    // Text content check
    const text = el.textContent?.trim() || '';
    if (text.length < 2 || text.length > 50) return false;
    
    return true;
  });
}
```

#### 8.3.2 Batched Style Reading

```typescript
// Batch getComputedStyle calls
function batchGetStyles(elements: HTMLElement[]): Map<HTMLElement, CSSStyleDeclaration> {
  const styles = new Map<HTMLElement, CSSStyleDeclaration>();
  
  // Force layout once
  document.body.offsetHeight;
  
  // Read all styles in one pass
  for (const el of elements) {
    styles.set(el, window.getComputedStyle(el));
  }
  
  return styles;
}
```

#### 8.3.3 Selector Caching

```typescript
// Cache selector results
const selectorCache = new Map<string, WeakRef<Element>>();

function cachedQuerySelector(selector: string): Element | null {
  const cached = selectorCache.get(selector);
  if (cached) {
    const element = cached.deref();
    if (element && document.contains(element)) {
      return element;
    }
  }
  
  const element = document.querySelector(selector);
  if (element) {
    selectorCache.set(selector, new WeakRef(element));
  }
  
  return element;
}
```

### 8.4 Scalability Patterns

#### 8.4.1 Lazy Loading Configuration

```typescript
// Load site config only when needed
const configCache = new Map<string, SiteSelectorConfig | null>();

async function getConfigLazy(hostname: string): Promise<SiteSelectorConfig | null> {
  if (configCache.has(hostname)) {
    return configCache.get(hostname)!;
  }
  
  const config = getSelectorConfig(hostname);
  configCache.set(hostname, config);
  return config;
}
```

#### 8.4.2 Incremental Health Updates

```typescript
// Update health metrics incrementally
async function updateHealthIncremental(
  hostname: string,
  result: ExtractionResult
): Promise<void> {
  const key = `health:${hostname}`;
  const stored = await chrome.storage.local.get(key);
  
  const current = stored[key] || createEmptyHealth(hostname);
  
  // Update only changed fields
  current.totalAttempts++;
  if (result.success) {
    current.successfulExtractions++;
  }
  current.lastAttempt = Date.now();
  current.successRate = (current.successfulExtractions / current.totalAttempts) * 100;
  
  await chrome.storage.local.set({ [key]: current });
}
```

### 8.5 Memory Management

```typescript
// Cleanup large objects after extraction
function cleanupExtractionContext(context: ExtractionContext): void {
  // Clear element references
  context.candidateElements = [];
  context.tierResults.clear();
  
  // Clear DOM snapshots
  context.domSnapshot = undefined;
  
  // Force GC hint (not guaranteed)
  if (window.gc) window.gc();
}
```

---

## 9. Code Examples

### 9.1 Basic Extraction

```typescript
// Basic price extraction from current page
import { runExtractionPipeline } from '@/lib/extraction';

async function extractCurrentPagePrice() {
  const result = await runExtractionPipeline({
    minConfidence: 'MEDIUM',
    timeout: 5000,
  });
  
  if (result.success) {
    console.log(`Extracted price: ${result.price.formatted}`);
    console.log(`Confidence: ${result.confidence}`);
    console.log(`Method: ${result.method} (Tier ${result.tier})`);
  } else {
    console.error('Extraction failed:', result.warnings);
  }
  
  return result;
}
```

### 9.2 SPA-Aware Extraction

```typescript
// Extraction with SPA stability waiting
import { runExtractionPipeline, SPAWatcher } from '@/lib/extraction';

async function extractSPAPrice() {
  const watcher = new SPAWatcher();
  
  try {
    // Start watching for changes
    watcher.start({ debounceMs: 100 });
    
    // Wait for stable price
    const result = await watcher.waitForStablePrice(
      () => runExtractionPipeline({ waitForStability: false }),
      {
        requiredStableMs: 700,
        requiredReadCount: 2,
        maxWaitMs: 5000,
      }
    );
    
    return result;
  } finally {
    watcher.stop();
  }
}
```

### 9.3 Custom Heuristic Extraction

```typescript
// Direct use of heuristic engine
import { extractPriceHeuristically, ScoringConfig } from '@/lib/extraction/priceHeuristics';

async function extractWithCustomScoring() {
  // Custom scoring weights
  const customScoring: Partial<ScoringConfig> = {
    TOTAL_KEYWORD_ADJACENT: 50,  // Boost "Total" keyword
    CHECKOUT_BUTTON_NEARBY: 40,  // Boost checkout context
    PER_NIGHT_QUALIFIER: -60,    // Heavily penalize "per night"
  };
  
  const result = await extractPriceHeuristically({
    scoringOverrides: customScoring,
    containerSelector: '[class*="summary"]', // Narrow scope
  });
  
  return result;
}
```

### 9.4 Manual Price Parsing

```typescript
// Direct use of money parser
import { parseMoney } from '@/lib/extraction/parseMoney';

function parseUserInput(input: string) {
  const result = parseMoney(input, { defaultCurrency: 'USD' });
  
  if (result.success) {
    console.log(`Amount: ${result.money.amount}`);
    console.log(`Currency: ${result.money.currency}`);
    console.log(`Qualifiers: ${result.qualifiers.join(', ')}`);
  }
  
  return result;
}

// Examples:
parseUserInput('$1,234.56');        // USD 1234.56
parseUserInput('€1.234,56');        // EUR 1234.56
parseUserInput('1,234 AED');        // AED 1234
parseUserInput('from $500/night');  // USD 500, qualifiers: ['from', 'per_night']
```

### 9.5 User Override Management

```typescript
// Save and use user selector overrides
import {
  saveUserOverride,
  getUserOverrides,
  getEffectiveSelectors,
} from '@/config/selectorsRegistry';

// Save a user-selected element as override
async function saveUserSelection(element: HTMLElement) {
  const selectors = generateSelectorStrategies(element);
  
  await saveUserOverride({
    siteKey: window.location.hostname,
    field: 'totalPrice',
    selectors,
    source: 'user_pick',
  });
}

// Get effective selectors (user overrides + registry)
async function getSelectorsForSite() {
  const selectors = await getEffectiveSelectors(
    window.location.hostname,
    'totalPrice'
  );
  
  console.log('Selectors to try:', selectors);
  return selectors;
}
```

### 9.6 Health Monitoring Integration

```typescript
// Record extraction and check site health
import {
  recordExtractionEvent,
  getSiteHealth,
  isSiteDegraded,
} from '@/lib/extraction/health';

async function extractWithHealthTracking() {
  const hostname = window.location.hostname;
  
  // Check if site is known to be degraded
  if (isSiteDegraded(hostname)) {
    console.warn(`Site ${hostname} has degraded extraction reliability`);
    // Consider skipping Tier 1 selectors
  }
  
  const result = await runExtractionPipeline();
  
  // Record the result for health tracking
  recordExtractionEvent(hostname, result, result.tier);
  
  // Log current health
  const health = getSiteHealth(hostname);
  console.log(`Site health: ${health.successRate}% success rate`);
  
  return result;
}
```

### 9.7 Compare Flow Integration

```typescript
// Portal to Direct comparison flow
import { capturePortalSnapshot } from '@/content/portalCapture';
import { captureDirectPrice } from '@/content/directCapture';
import { createEmptySession } from '@/lib/compareTypes';

async function runComparison(portalTabId: number, portalUrl: string) {
  // 1. Create session
  const session = createEmptySession(portalTabId, portalUrl);
  
  // 2. Capture portal price
  const portalSnapshot = await capturePortalSnapshot();
  session.portalSnapshot = portalSnapshot;
  session.status = 'PORTAL_CAPTURED';
  
  // 3. Wait for user to navigate to direct site
  // (handled by background script)
  
  // 4. Capture direct price
  const directSnapshot = await captureDirectPrice();
  session.directSnapshot = directSnapshot;
  session.status = 'DIRECT_CAPTURED';
  
  // 5. Calculate comparison
  const comparison = calculateComparison(portalSnapshot, directSnapshot);
  session.status = 'DONE';
  
  return { session, comparison };
}
```

### 9.8 Element Picker Integration

```typescript
// Activate element picker for manual selection
import {
  activatePicker,
  deactivatePicker,
  onElementPicked,
} from '@/lib/extraction/elementPicker';

async function promptUserForPriceElement(): Promise<ExtractionResult> {
  return new Promise((resolve, reject) => {
    // Activate picker mode
    activatePicker({
      instructions: 'Click on the total price element',
      highlightColor: 'rgba(59, 130, 246, 0.3)',
    });
    
    // Handle element selection
    onElementPicked(async (element) => {
      deactivatePicker();
      
      // Parse the selected element
      const text = element.textContent || '';
      const parsed = parseMoney(text);
      
      if (parsed.success) {
        // Save override for future use
        await saveUserOverride({
          siteKey: window.location.hostname,
          field: 'totalPrice',
          selectors: generateSelectorStrategies(element),
          source: 'user_pick',
        });
        
        resolve(createSuccessResult(
          parsed.money,
          'USER_SELECTED',
          'HIGH',
          [{ type: 'USER_SELECTED', timestamp: Date.now() }]
        ));
      } else {
        reject(new ExtractionError(
          'Could not parse price from selected element',
          'PARSE_FAILED',
          true
        ));
      }
    });
  });
}
```

---

## 10. Edge Cases & Limitations

### 10.1 Handled Edge Cases

| Edge Case | Description | Handling Strategy |
|-----------|-------------|-------------------|
| Dynamic class names | Google Flights changes classes | Heuristic fallback (Tier 3) |
| Multiple prices visible | Search results page | Score based on context, prefer checkout proximity |
| Price updates mid-extraction | SPA async loading | Stability window (700ms) |
| Currency symbol ambiguity | `$` = USD, CAD, AUD | Use locale hints, default to USD |
| Separator ambiguity | `1,234` vs `1.234` | Smart separator detection |
| Per-night vs total | Hotels show both | Qualifier detection, context scoring |
| Strikethrough prices | Original vs discounted | Skip `text-decoration: line-through` |
| Shadow DOM | Web components | `shadowDomQuery()` utility |
| iframes | Price in iframe | Cross-origin limitations apply |
| Lazy-loaded checkout | Content appears late | Wait for stability, MutationObserver |

### 10.2 Known Limitations

#### 10.2.1 Cross-Origin Restrictions

```
⚠️ LIMITATION: Cannot extract prices from cross-origin iframes

Affected sites:
- Some OTAs embed booking widgets in iframes
- Third-party payment processors

Workaround: User-assisted capture (Tier 4) for visible iframe content
```

#### 10.2.2 Heavy JavaScript Sites

```
⚠️ LIMITATION: Sites with heavy client-side rendering may timeout

Symptoms:
- Extraction returns NONE confidence
- Stability never achieved

Workaround:
- Increase timeout settings
- Wait for specific elements to appear
- User-assisted capture
```

#### 10.2.3 Currency Conversion

```
⚠️ LIMITATION: No automatic currency conversion

The pipeline extracts prices as displayed. If portal shows USD
and direct shows EUR, comparison requires manual conversion.

Future enhancement: Integration with exchange rate API
```

#### 10.2.4 Points/Miles Pricing

```
⚠️ LIMITATION: Points-only prices not fully supported

The pipeline is optimized for cash prices. Points prices
(e.g., "50,000 miles + $50") have limited parsing support.

Future enhancement: Dedicated points price parser
```

### 10.3 Boundary Conditions

| Condition | Behavior |
|-----------|----------|
| Price = $0.00 | Valid extraction (free booking possible) |
| Price > $1,000,000 | Valid but flagged with warning |
| Price < $1.00 | Valid but flagged (possible per-unit price) |
| No currency detected | Falls back to USD with warning |
| Multiple currencies | Extracts first detected, warns about others |
| RTL text (Arabic) | Supported via CSS direction detection |
| Very long price text (>100 chars) | Truncated for parsing |

---

## 11. Testing Strategies

### 11.1 Unit Testing

#### 11.1.1 parseMoney Tests

```typescript
// test/parseMoney.test.ts
import { parseMoney } from '@/lib/extraction/parseMoney';

describe('parseMoney', () => {
  describe('US format', () => {
    it('parses standard USD format', () => {
      const result = parseMoney('$1,234.56');
      expect(result.success).toBe(true);
      expect(result.money?.amount).toBe(1234.56);
      expect(result.money?.currency).toBe('USD');
    });
    
    it('handles no cents', () => {
      const result = parseMoney('$500');
      expect(result.money?.amount).toBe(500);
    });
  });
  
  describe('European format', () => {
    it('parses German Euro format', () => {
      const result = parseMoney('€1.234,56');
      expect(result.money?.amount).toBe(1234.56);
      expect(result.money?.currency).toBe('EUR');
    });
  });
  
  describe('qualifiers', () => {
    it('detects per-night qualifier', () => {
      const result = parseMoney('$150/night');
      expect(result.qualifiers).toContain('per_night');
    });
    
    it('detects from qualifier', () => {
      const result = parseMoney('from $299');
      expect(result.qualifiers).toContain('from');
    });
  });
});
```

#### 11.1.2 Heuristics Tests

```typescript
// test/priceHeuristics.test.ts
import { scoreCandidate, determineConfidence } from '@/lib/extraction/priceHeuristics';

describe('scoreCandidate', () => {
  it('scores total keyword proximity high', () => {
    const candidate = createMockCandidate({
      text: '$500',
      nearbyText: 'Total',
    });
    
    const scored = scoreCandidate(candidate);
    expect(scored.score).toBeGreaterThanOrEqual(30);
    expect(scored.anchorEvidence).toContainEqual(
      expect.objectContaining({ type: 'TOTAL_KEYWORD' })
    );
  });
  
  it('penalizes per-night prices', () => {
    const candidate = createMockCandidate({
      text: '$150',
      nearbyText: 'per night',
    });
    
    const scored = scoreCandidate(candidate);
    expect(scored.hasDisqualifyingQualifier).toBe(true);
    expect(scored.score).toBeLessThan(0);
  });
});

describe('determineConfidence', () => {
  it('returns HIGH with 3+ anchors and high score', () => {
    const candidate = createMockScoredCandidate({
      score: 70,
      anchorEvidence: [
        { type: 'TOTAL_KEYWORD', keyword: 'Total', distance: 50 },
        { type: 'ARIA_LABEL', label: 'Total price' },
        { type: 'CHECKOUT_PROXIMITY', buttonText: 'Continue' },
      ],
    });
    
    expect(determineConfidence(candidate)).toBe('HIGH');
  });
  
  it('caps at LOW with disqualifying qualifier', () => {
    const candidate = createMockScoredCandidate({
      score: 80,
      anchorEvidence: [/* many anchors */],
      hasDisqualifyingQualifier: true,
    });
    
    expect(determineConfidence(candidate)).toBe('LOW');
  });
});
```

### 11.2 Integration Testing

#### 11.2.1 Full Pipeline Tests

```typescript
// test/pipeline.integration.test.ts
import { runExtractionPipeline } from '@/lib/extraction';

describe('Extraction Pipeline Integration', () => {
  beforeEach(() => {
    // Setup mock DOM
    document.body.innerHTML = `
      <div class="checkout-summary">
        <span data-testid="total-price">$1,234.56</span>
        <button>Continue to payment</button>
      </div>
    `;
  });
  
  it('extracts price with HIGH confidence from data-testid', async () => {
    const result = await runExtractionPipeline();
    
    expect(result.success).toBe(true);
    expect(result.price?.amount).toBe(1234.56);
    expect(result.confidence).toBe('HIGH');
    expect(result.tier).toBe('SELECTOR_PRIMARY');
  });
  
  it('falls back to heuristics when selectors fail', async () => {
    // Remove data-testid
    document.querySelector('[data-testid]')?.removeAttribute('data-testid');
    
    const result = await runExtractionPipeline();
    
    expect(result.success).toBe(true);
    expect(result.tier).toBe('HEURISTIC');
  });
});
```

### 11.3 Site-Specific Testing

```typescript
// test/sites/googleFlights.test.ts
import { extractGoogleFlightsPrice } from '@/content/extractors/flights/googleFlights';

describe('Google Flights Extractor', () => {
  beforeEach(() => {
    // Load Google Flights mock HTML
    document.body.innerHTML = loadFixture('googleFlights/checkout.html');
  });
  
  it('extracts price from booking page', () => {
    const result = extractGoogleFlightsPrice();
    
    expect(result.success).toBe(true);
    expect(result.method).toBe('SELECTOR');
  });
  
  it('handles obfuscated class names', () => {
    // Simulate class name change
    document.querySelector('.gOatQ')?.classList.replace('gOatQ', 'xYz123');
    
    const result = extractGoogleFlightsPrice();
    
    // Should fall back to heuristics
    expect(result.success).toBe(true);
    expect(result.method).toBe('HEURISTIC');
  });
});
```

### 11.4 Regression Testing

```typescript
// Snapshot testing for extraction results
describe('Extraction Regression Tests', () => {
  const testCases = loadTestCases('./fixtures/regression/');
  
  testCases.forEach(({ name, html, expectedPrice, expectedConfidence }) => {
    it(`extracts correctly for: ${name}`, async () => {
      document.body.innerHTML = html;
      
      const result = await runExtractionPipeline();
      
      expect(result.price?.amount).toBe(expectedPrice);
      expect(result.confidence).toBe(expectedConfidence);
    });
  });
});
```

### 11.5 Performance Testing

```typescript
// test/performance/extraction.perf.test.ts
describe('Extraction Performance', () => {
  it('completes full pipeline under 500ms', async () => {
    document.body.innerHTML = loadFixture('complex-checkout.html');
    
    const start = performance.now();
    await runExtractionPipeline();
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(500);
  });
  
  it('handles large DOMs efficiently', async () => {
    // Generate large DOM
    document.body.innerHTML = generateLargeDOM(1000);
    
    const start = performance.now();
    await runExtractionPipeline();
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(1000);
  });
});
```

---

## 12. Troubleshooting Guide

### 12.1 Common Issues

#### Issue: Extraction returns `confidence: 'NONE'`

**Symptoms:**
- Pipeline reports success=false
- No price captured

**Diagnostic Steps:**
1. Open browser DevTools console
2. Run `vxDebug.runExtraction()` (if debug mode enabled)
3. Check tier results for each attempted tier
4. Look for warnings in result

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Site not in registry | Add site config to `selectorsRegistry.ts` |
| Selectors outdated | Update selectors, check for class name changes |
| Price in iframe | Cannot extract cross-origin, use manual entry |
| JavaScript blocking | Increase timeout, ensure content loads |
| Price format unrecognized | Check `parseMoney` support for currency |

**Resolution:**
```javascript
// Check what's happening
const result = await runExtractionPipeline({ minConfidence: 'NONE' });
console.log('Tier results:', result.tierResults);
console.log('Warnings:', result.warnings);
```

---

#### Issue: Wrong price extracted

**Symptoms:**
- Price captured but incorrect
- Usually extracts per-night instead of total

**Diagnostic Steps:**
1. Check `result.qualifiers` for detected qualifiers
2. Inspect `result.element` to see which element was selected
3. Review `result.evidence` for scoring signals

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Per-night price scored higher | Check nearby "Total" label exists |
| Search result price captured | Ensure on checkout page |
| Strikethrough price captured | CSS detection may have failed |
| Multiple totals (subtotal vs grand) | Add more specific container selectors |

**Resolution:**
```javascript
// Force heuristic with narrowed scope
const result = await runExtractionPipeline({
  forceTier: 'HEURISTIC',
  containerSelector: '[class*="checkout-summary"]',
});
```

---

#### Issue: Extraction is slow (>1s)

**Symptoms:**
- Pipeline takes several seconds
- UI feels unresponsive

**Diagnostic Steps:**
1. Check `result.durationMs` for timing
2. Profile with DevTools Performance tab
3. Check if stability timeout triggered

**Common Causes:**

| Cause | Solution |
|-------|----------|
| Stability never achieved | Price changing, increase stability window |
| Large DOM | Add container selector to narrow scan |
| Many MutationObserver callbacks | Increase debounce time |
| Slow selectors | Use simpler selectors, avoid `:has()` |

**Resolution:**
```javascript
// Reduce scope and timeout
const result = await runExtractionPipeline({
  timeout: 3000,
  waitForStability: false,  // Skip if causing issues
});
```

---

#### Issue: Element picker doesn't highlight

**Symptoms:**
- Picker activated but no highlight on hover
- Click doesn't register

**Diagnostic Steps:**
1. Check for CSS conflicts
2. Verify picker overlay was injected
3. Check for pointer-events: none on page

**Common Causes:**

| Cause | Solution |
|-------|----------|
| CSS conflict | Increase z-index of picker overlay |
| Shadow DOM | Picker may not work in shadow DOM |
| Pointer events blocked | Check page's pointer-events CSS |

**Resolution:**
```javascript
// Manually inject picker styles
activatePicker({
  overlayZIndex: 2147483647,  // Max z-index
  highlightColor: 'rgba(255, 0, 0, 0.5)',  // More visible
});
```

---

### 12.2 Debug Commands

```javascript
// Enable debug mode
await chrome.storage.local.set({ vx_extraction_debug: true });

// Run extraction with full logging
const result = await runExtractionPipeline({ debug: true });

// Generate debug payload for reporting
const debugPayload = generateDebugPayload(result, {
  includeDomSnapshot: true,
  includeScreenshot: false,  // Privacy concern
});
console.log(JSON.stringify(debugPayload, null, 2));

// Check site health
const health = getSiteHealth(window.location.hostname);
console.log('Site health:', health);

// List user overrides
const overrides = await getUserOverrides();
console.log('User overrides:', overrides);

// Clear overrides for current site
await clearOverridesForSite(window.location.hostname);
```

### 12.3 Log Interpretation

```
[VentureX:Extraction] [INFO] Starting pipeline
  context: { hostname: 'delta.com', timeout: 10000 }

[VentureX:Extraction] [DEBUG] Tier 1 (SELECTOR_PRIMARY) starting
  context: { tier: 'SELECTOR_PRIMARY', selectors: ['[data-testid="totalPrice"]', ...] }

[VentureX:Extraction] [WARN] Selector '[data-testid="totalPrice"]' matched but element hidden
  context: { selector: '[data-testid="totalPrice"]', visibility: 'hidden' }

[VentureX:Extraction] [DEBUG] Tier 2 (SEMANTIC) starting
  context: { tier: 'SEMANTIC' }

[VentureX:Extraction] [INFO] Extraction complete
  context: {
    success: true,
    confidence: 'MEDIUM',
    tier: 'SEMANTIC',
    durationMs: 245
  }
```

---

## 13. Glossary

### A

**Anchor Evidence**
: Signals that confirm a price element is truly the final total, such as nearby "Total" text, `aria-label` attributes, or proximity to checkout buttons. Required for confidence promotion.

### C

**Candidate (Price Candidate)**
: A DOM element that potentially contains a price value. Identified by text pattern matching during the heuristic scan phase.

**Confidence Level**
: A categorical assessment of extraction reliability: HIGH (3+ anchors), MEDIUM (2 anchors), LOW (1 anchor or heuristic guess), NONE (extraction failed).

**Compare Session**
: A tracked workflow comparing portal price vs. direct booking price. Manages state across multiple page navigations.

### D

**Dead Letter Queue**
: Storage for failed extraction attempts, used for debugging and improving extraction accuracy over time.

**Disqualifying Qualifier**
: Text patterns like "per night", "from", or "starting at" that indicate a price is not the final total. Caps confidence at LOW.

### E

**Element Picker**
: User-assisted extraction mode (Tier 4) where users click on the price element, teaching the system for future extractions.

**Evidence**
: Structured data capturing why a price was selected, including keyword proximity, ARIA attributes, and semantic signals.

**Extraction Tier**
: One of five hierarchical extraction strategies: SELECTOR_PRIMARY, SEMANTIC, HEURISTIC, USER_ASSISTED, LLM_FALLBACK.

### F

**Fingerprint (Itinerary Fingerprint)**
: Structured data identifying a specific booking (flight route, dates, hotel name, etc.) used to match portal and direct prices.

### H

**Health Monitor**
: System tracking extraction success rates per site to detect degradation and prioritize selector updates.

**Heuristic Extraction**
: Site-agnostic price detection using scoring algorithms that evaluate multiple signals (font size, proximity to "Total", etc.).

### M

**Money**
: Canonical representation of a monetary value with amount, currency code, and display format.

**MutationObserver**
: Browser API used to detect DOM changes in Single Page Applications, triggering re-extraction when content updates.

### P

**Pipeline**
: The orchestrating system that executes extraction tiers in sequence, managing fallbacks and result aggregation.

**Portal**
: A travel booking aggregator like Capital One Travel that earns points/miles. Contrasted with "direct" airline/hotel sites.

### Q

**Qualifier**
: Text patterns near a price that modify its meaning: "per night", "from", "avg", "before taxes", etc.

### S

**Selector Registry**
: Centralized configuration storing CSS selectors, regex patterns, and feature flags for each supported site.

**Semantic Extraction**
: Extraction using ARIA attributes, role attributes, and HTML5 semantic structure rather than CSS classes.

**SPA (Single Page Application)**
: Web applications that dynamically update content without full page reloads. Requires special handling via MutationObserver and History API hooks.

**Stability Window**
: Time period during which a price must remain unchanged to be considered reliably extracted. Default: 700ms with 2+ identical readings.

### T

**Tier**
: See "Extraction Tier".

### U

**User Override**
: A selector configuration saved from user-assisted extraction (Tier 4), taking precedence over built-in registry selectors.

---

## Appendix A: File Reference

| File | Lines | Purpose |
|------|-------|---------|
| [`pipeline.ts`](../src/lib/extraction/pipeline.ts) | ~400 | Main orchestrator |
| [`types.ts`](../src/lib/extraction/types.ts) | ~650 | Type definitions |
| [`parseMoney.ts`](../src/lib/extraction/parseMoney.ts) | ~700 | Currency parsing |
| [`priceHeuristics.ts`](../src/lib/extraction/priceHeuristics.ts) | ~1100 | Heuristic scoring |
| [`spaWatch.ts`](../src/lib/extraction/spaWatch.ts) | ~650 | SPA monitoring |
| [`health.ts`](../src/lib/extraction/health.ts) | ~535 | Health tracking |
| [`elementPicker.ts`](../src/lib/extraction/elementPicker.ts) | ~710 | User-assisted capture |
| [`domUtils.ts`](../src/lib/extraction/domUtils.ts) | ~350 | DOM utilities |
| [`selectorsRegistry.ts`](../src/config/selectorsRegistry.ts) | ~770 | Site configurations |
| [`googleFlights.ts`](../src/content/extractors/flights/googleFlights.ts) | ~465 | Google Flights extractor |
| [`directCapture.ts`](../src/content/directCapture.ts) | ~1530 | Airline extractors |
| [`portalCapture.ts`](../src/content/portalCapture.ts) | ~1440 | Portal extractor |

---

## Appendix B: Quick Reference

### Confidence Requirements

| Level | Anchor Count | Score | Qualifiers |
|-------|--------------|-------|------------|
| HIGH | ≥3 | ≥60 | None |
| MEDIUM | ≥2 | ≥40 | None |
| LOW | ≥1 | ≥20 | Allowed |
| NONE | 0 | <20 | Any |

### Scoring Quick Reference

| Signal | Points |
|--------|--------|
| `data-testid="total"` | +35 |
| "Total" keyword nearby | +30 |
| `aria-label="total"` | +25 |
| Checkout button nearby | +25 |
| Summary container | +20 |
| Large font | +15 |
| "per night" nearby | -40 |
| "from" prefix | -35 |
| Strikethrough style | -50 |

### Tier Priority

1. **SELECTOR_PRIMARY** - Fastest, use site config
2. **SEMANTIC** - ARIA/role attributes
3. **HEURISTIC** - Score-based selection
4. **USER_ASSISTED** - Manual pick
5. **LLM_FALLBACK** - AI extraction (future)

---

## Appendix C: Advanced Topics

### C.1 Fingerprint Match Confidence Gating

**⚠️ CRITICAL: This section documents the three-stage validity system that prevents "correct price, wrong trip" failures.**

#### C.1.1 The Problem

Extraction accuracy alone is insufficient. A comparison can fail in *meaning* even when both prices are correctly extracted:

- Portal capture: DXB → JFK, Economy, Delta, Mar 15, $1,200
- Direct capture: DXB → JFK, Basic Economy (no bags), Delta, Mar 15, $950

Both extractions are "correct" but the comparison is **invalid** because the products differ.

#### C.1.2 Fingerprint Match Confidence

```typescript
type FingerprintMatchConfidence = 'STRICT' | 'MEDIUM' | 'LOW' | 'MISMATCH';

interface FingerprintMatchResult {
  confidence: FingerprintMatchConfidence;
  matchedFields: string[];
  mismatchedFields: string[];
  uncertainFields: string[];
  warnings: string[];
  canProceedWithComparison: boolean;
}
```

#### C.1.3 Match Requirements by Field

| Field | Required for STRICT | Required for MEDIUM | Notes |
|-------|---------------------|---------------------|-------|
| origin | ✅ Exact match | ✅ Exact match | IATA code |
| destination | ✅ Exact match | ✅ Exact match | IATA code |
| departDate | ✅ Exact match | ✅ Exact match | YYYY-MM-DD |
| returnDate | ✅ Exact match | ⚠️ Within 1 day | Can be off by 1 due to timezone |
| cabin | ✅ Exact match | ⚠️ Same tier | economy/premium/business/first |
| paxCount | ✅ Exact match | ⚠️ Reasonably close | 2 vs 3 = MEDIUM, 1 vs 4 = MISMATCH |
| operatingCarrier | ✅ Exact match | ⚠️ Same alliance | Codeshare handling |
| flightNumbers | ⚠️ Any overlap | ⚠️ Any overlap | Not always extractable |
| stops | ⚠️ Within 1 | ⚠️ Within 1 | 0 vs 2 = MISMATCH |

#### C.1.4 Comparison Gating Logic

```typescript
function shouldProceedWithComparison(
  matchResult: FingerprintMatchResult,
  priceConfidence: ConfidenceLevel
): ComparisonDecision {
  // Gate 1: Hard stop on fingerprint mismatch
  if (matchResult.confidence === 'MISMATCH') {
    return {
      proceed: false,
      reason: 'FINGERPRINT_MISMATCH',
      message: 'Itineraries do not match - comparison would be invalid',
      suggestedAction: 'Review itinerary details before comparing',
    };
  }
  
  // Gate 2: Require STRICT match for high-stakes recommendations
  if (matchResult.confidence === 'LOW') {
    return {
      proceed: false,
      reason: 'INSUFFICIENT_MATCH_DATA',
      message: 'Could not verify itinerary match with sufficient confidence',
      suggestedAction: 'Manually confirm both bookings are for the same itinerary',
    };
  }
  
  // Gate 3: Price confidence interacts with fingerprint confidence
  if (matchResult.confidence === 'MEDIUM' && priceConfidence === 'LOW') {
    return {
      proceed: true,
      showWarning: true,
      warningMessage: 'Moderate confidence in itinerary match - verify details',
    };
  }
  
  // Gate 4: STRICT fingerprint + HIGH price = full confidence
  return {
    proceed: true,
    showWarning: false,
  };
}
```

#### C.1.5 Hotel/Stay Fingerprint Matching

| Field | Required for STRICT | Required for MEDIUM | Notes |
|-------|---------------------|---------------------|-------|
| hotelName | ✅ Fuzzy match (>80% similarity) | ⚠️ Brand + city match | "Marriott Times Square" |
| city | ✅ Exact match | ✅ Exact match | |
| checkinDate | ✅ Exact match | ✅ Exact match | |
| checkoutDate | ✅ Exact match | ✅ Exact match | |
| nights | ✅ Derived match | ✅ Derived match | Computed from dates |
| roomCount | ✅ Exact match | ⚠️ Within 1 | |
| roomType | ⚠️ Category match | ⚠️ Best effort | "King" vs "1 King Bed" |
| cancellationPolicy | ⚠️ Best effort | ❌ Not required | Hard to extract |

#### C.1.6 UI Implications

When fingerprint match is uncertain:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ⚠️ ITINERARY MATCH VERIFICATION REQUIRED                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  We couldn't fully verify these bookings are for the same itinerary.   │
│                                                                         │
│  Portal:                    Direct:                                     │
│  DXB → JFK                  DXB → JFK                                   │
│  Mar 15 - Mar 22            Mar 15 - Mar 22                             │
│  Economy                    ⚠️ Basic Economy                            │
│  2 passengers               2 passengers                                │
│                                                                         │
│  ⚠️ Cabin class may differ. Basic Economy typically excludes:          │
│     • Seat selection                                                    │
│     • Carry-on bags                                                     │
│     • Changes/refunds                                                   │
│                                                                         │
│  [ Compare Anyway ]    [ Cancel ]                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### C.2 Unified Price Semantics (PriceBreakdown Model)

**⚠️ CRITICAL: This section documents the semantic model for price extraction that prevents "correct number, wrong meaning" failures.**

#### C.2.1 The Problem

Travel sites display multiple price-like numbers:

- Subtotal vs Total
- Per-night vs Total stay
- Per-person vs All travelers
- Before taxes vs After taxes
- "Due now" vs "Due at property"
- Base fare vs All-in price

Without semantic clarity, extracting "the right number" can still produce wrong results.

#### C.2.2 PriceBreakdown Type

```typescript
interface PriceBreakdown {
  // What we extracted
  extractedField: ExtractedPriceField;
  
  // The values
  base?: Money;           // Base fare/rate before taxes
  taxes?: Money;          // Taxes amount
  fees?: Money;           // Service fees, resort fees, etc.
  total: Money;           // Final amount
  
  // Semantic flags
  isPerUnit: boolean;     // true if per-night, per-person, etc.
  unitType?: 'night' | 'person' | 'room' | 'ticket';
  unitCount?: number;     // How many units
  
  // Payment timing
  paymentTiming: 'due_now' | 'due_later' | 'split' | 'unknown';
  dueNowAmount?: Money;
  dueLaterAmount?: Money;
  
  // Completeness
  includesTaxes: boolean | 'unknown';
  includesFees: boolean | 'unknown';
  
  // Extraction metadata
  confidence: ConfidenceLevel;
  extractionEvidence: Evidence[];
}

type ExtractedPriceField =
  | 'TOTAL_ALL_IN'           // Best case: total including everything
  | 'TOTAL_BEFORE_TAXES'     // Common: need to find taxes separately
  | 'BASE_ONLY'              // Just the base fare/rate
  | 'TAXES_FEES_ONLY'        // Just the tax portion
  | 'PER_UNIT_RATE'          // Per-night, per-person, etc.
  | 'DUE_NOW_PARTIAL'        // Split payment - immediate portion
  | 'AMBIGUOUS';             // Couldn't determine semantics
```

#### C.2.3 Extractor Declaration Requirements

Every price extractor MUST declare what it extracted:

```typescript
interface ExtractionResult {
  // ... existing fields ...
  
  // NEW: Required semantic declaration
  priceBreakdown: PriceBreakdown;
  
  // Confidence in semantic correctness (separate from extraction confidence)
  semanticConfidence: ConfidenceLevel;
}

// Example: Hotel extractor declaring per-night extraction
function extractHotelPrice(): ExtractionResult {
  const perNightPrice = extractVisiblePrice();
  const nights = extractNightCount();
  
  return {
    success: true,
    price: {
      amount: perNightPrice.amount * nights,
      currency: perNightPrice.currency,
      formatted: formatMoney(perNightPrice.amount * nights, perNightPrice.currency),
      raw: perNightPrice.raw,
    },
    confidence: 'MEDIUM',
    
    // Semantic declaration
    priceBreakdown: {
      extractedField: 'PER_UNIT_RATE',
      base: perNightPrice,
      total: {
        amount: perNightPrice.amount * nights,
        currency: perNightPrice.currency,
        formatted: formatMoney(perNightPrice.amount * nights, perNightPrice.currency),
        raw: `${perNightPrice.raw} × ${nights} nights`,
      },
      isPerUnit: true,
      unitType: 'night',
      unitCount: nights,
      paymentTiming: 'unknown',
      includesTaxes: 'unknown',  // Couldn't determine
      includesFees: 'unknown',
      confidence: 'MEDIUM',
      extractionEvidence: [...],
    },
    semanticConfidence: 'LOW',  // Per-unit computation is uncertain
    
    warnings: [
      'Price computed from per-night rate × nights',
      'Tax inclusion status unknown',
    ],
  };
}
```

#### C.2.4 Semantic Comparison Validation

Before comparing portal vs direct:

```typescript
function validateSemanticCompatibility(
  portal: PriceBreakdown,
  direct: PriceBreakdown
): SemanticCompatibilityResult {
  const issues: string[] = [];
  
  // Check 1: Both should be totals, not per-unit
  if (portal.isPerUnit !== direct.isPerUnit) {
    issues.push(`Comparing ${portal.unitType ? 'per-' + portal.unitType : 'per-unit'} vs total`);
  }
  
  // Check 2: Tax inclusion should match
  if (portal.includesTaxes !== direct.includesTaxes) {
    if (portal.includesTaxes === true && direct.includesTaxes === false) {
      issues.push('Portal includes taxes, direct does not');
    } else if (portal.includesTaxes === false && direct.includesTaxes === true) {
      issues.push('Direct includes taxes, portal does not');
    }
  }
  
  // Check 3: Payment timing should be comparable
  if (portal.paymentTiming !== direct.paymentTiming) {
    if (portal.paymentTiming === 'due_now' && direct.paymentTiming === 'split') {
      issues.push('Portal shows full amount due now, direct has split payment');
    }
  }
  
  // Check 4: Currency must match (no auto-conversion)
  if (portal.total.currency !== direct.total.currency) {
    issues.push(`Currency mismatch: ${portal.total.currency} vs ${direct.total.currency}`);
  }
  
  return {
    compatible: issues.length === 0,
    issues,
    canProceedWithWarning: issues.length <= 1 && !issues.some(i => i.includes('Currency')),
  };
}
```

#### C.2.5 Heuristic Field Detection

For Tier 3 heuristic extraction, determine *which* field was likely extracted:

```typescript
function classifyExtractedPrice(
  candidate: ScoredCandidate,
  context: PageContext
): ExtractedPriceField {
  const { text, nearbyLabels, containerContext } = candidate;
  
  // Check for total indicators
  const totalIndicators = [
    /\btotal\b/i,
    /\ball[- ]in\b/i,
    /\bdue\s*today\b/i,
    /\btrip\s*total\b/i,
    /\bgrand\s*total\b/i,
  ];
  
  const hasTotalIndicator = nearbyLabels.some(label =>
    totalIndicators.some(re => re.test(label))
  );
  
  // Check for per-unit indicators
  const perUnitIndicators = [
    /\bper\s*night\b/i,
    /\b\/\s*night\b/i,
    /\bnightly\b/i,
    /\bper\s*person\b/i,
    /\beach\b/i,
  ];
  
  const hasPerUnitIndicator = nearbyLabels.some(label =>
    perUnitIndicators.some(re => re.test(label))
  );
  
  // Check for partial indicators
  const partialIndicators = [
    /\bbase\s*fare\b/i,
    /\bbefore\s*tax/i,
    /\bsubtotal\b/i,
    /\broom\s*rate\b/i,
  ];
  
  const hasPartialIndicator = nearbyLabels.some(label =>
    partialIndicators.some(re => re.test(label))
  );
  
  // Classification logic
  if (hasPerUnitIndicator) {
    return 'PER_UNIT_RATE';
  }
  
  if (hasPartialIndicator) {
    return 'TOTAL_BEFORE_TAXES';
  }
  
  if (hasTotalIndicator) {
    // Check if taxes mentioned separately nearby
    const taxesMentioned = nearbyLabels.some(l => /tax|fee/i.test(l));
    return taxesMentioned ? 'TOTAL_BEFORE_TAXES' : 'TOTAL_ALL_IN';
  }
  
  // Context-based fallback
  if (context.pageType === 'checkout' && containerContext.includes('summary')) {
    return 'TOTAL_ALL_IN';  // Likely the final total
  }
  
  return 'AMBIGUOUS';
}
```

---

### C.3 Documentation-to-Code Synchronization

**⚠️ CRITICAL: This section documents the system for keeping documentation accurate as code evolves.**

#### C.3.1 The Problem

Documentation drift causes:
- Developers "fix" things based on outdated docs and break real logic
- Contributors don't know what guarantees the system provides
- Confidence thresholds, scoring weights, and gates silently diverge

#### C.3.2 Auto-Generated Constants Documentation

The following tables are auto-generated from code. DO NOT EDIT MANUALLY.

<!-- AUTO-GENERATED START: CONFIDENCE_THRESHOLDS -->
```typescript
// Source: src/lib/extraction/priceHeuristics.ts
// Last sync: 2026-01-21T10:00:00Z

export const CONFIDENCE_THRESHOLDS = {
  HIGH: {
    minAnchorCount: 3,
    minScore: 60,
    disqualifyingQualifiersAllowed: false,
  },
  MEDIUM: {
    minAnchorCount: 2,
    minScore: 40,
    disqualifyingQualifiersAllowed: false,
  },
  LOW: {
    minAnchorCount: 1,
    minScore: 20,
    disqualifyingQualifiersAllowed: true,
  },
  NONE: {
    minAnchorCount: 0,
    minScore: 0,
    disqualifyingQualifiersAllowed: true,
  },
};
```
<!-- AUTO-GENERATED END: CONFIDENCE_THRESHOLDS -->

<!-- AUTO-GENERATED START: SCORING_WEIGHTS -->
```typescript
// Source: src/lib/extraction/priceHeuristics.ts
// Last sync: 2026-01-21T10:00:00Z

export const SCORING_WEIGHTS = {
  // Positive signals
  DATA_TESTID_TOTAL: 35,
  TOTAL_KEYWORD_ADJACENT: 30,
  ARIA_TOTAL: 25,
  CHECKOUT_BUTTON_NEARBY: 25,
  SUMMARY_CONTAINER: 20,
  LARGE_FONT: 15,
  SEMANTIC_PRICE_CLASS: 15,
  BOLD_WEIGHT: 10,
  
  // Negative signals
  STRIKETHROUGH: -50,
  PER_NIGHT_QUALIFIER: -40,
  FROM_PREFIX: -35,
  STARTING_AT: -35,
  SEARCH_RESULT_CONTEXT: -30,
  FADED_OPACITY: -25,
  SMALL_FONT: -20,
};
```
<!-- AUTO-GENERATED END: SCORING_WEIGHTS -->

#### C.3.3 Sync Script

```bash
# scripts/sync-docs-from-code.ts
# Run: npx ts-node scripts/sync-docs-from-code.ts

/**
 * Extracts constants from source files and updates documentation.
 * Run this script in CI to detect drift.
 */

import * as fs from 'fs';
import * as path from 'path';

const DOCS_FILE = 'docs/EXTRACTION_PIPELINE_TECHNICAL_DOCS.md';
const SOURCE_MAPPINGS = [
  {
    marker: 'CONFIDENCE_THRESHOLDS',
    source: 'src/lib/extraction/priceHeuristics.ts',
    export: 'CONFIDENCE_THRESHOLDS',
  },
  {
    marker: 'SCORING_WEIGHTS',
    source: 'src/lib/extraction/priceHeuristics.ts',
    export: 'SCORING_WEIGHTS',
  },
  // Add more mappings as needed
];

function syncDocs() {
  for (const mapping of SOURCE_MAPPINGS) {
    const sourceContent = fs.readFileSync(mapping.source, 'utf-8');
    const constantValue = extractExport(sourceContent, mapping.export);
    updateDocsMarker(mapping.marker, constantValue, mapping.source);
  }
}

// CI check: fail if docs are out of sync
function checkSync(): boolean {
  // Compare generated content with existing docs
  // Return false if drift detected
}
```

#### C.3.4 Drift Detection in CI

```yaml
# .github/workflows/docs-sync.yml
name: Documentation Sync Check

on: [push, pull_request]

jobs:
  check-docs-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx ts-node scripts/sync-docs-from-code.ts --check
      - name: Fail if docs out of sync
        if: failure()
        run: |
          echo "Documentation is out of sync with code!"
          echo "Run: npx ts-node scripts/sync-docs-from-code.ts"
          exit 1
```

---

### C.4 Tier 3 Throttling Strategy

**⚠️ CRITICAL: This section documents performance guardrails for heuristic extraction.**

#### C.4.1 The Problem

Tier 3 heuristic extraction:
- Scans potentially thousands of DOM elements
- Calls `getComputedStyle()` repeatedly
- Can cause performance complaints ("extension slows down checkout")
- May trigger site behavioral detection (unusual DOM walking patterns)

#### C.4.2 Tier 3 Activation Conditions

Tier 3 should ONLY run when:

```typescript
type Tier3ActivationReason =
  | 'USER_EXPLICIT_REQUEST'      // User clicked "Find Price"
  | 'CHECKOUT_INTENT_DETECTED'   // Page looks like checkout
  | 'TIER_1_2_FAILED'            // Previous tiers exhausted
  | 'SITE_CONFIG_REQUIRES';      // Site flagged as needing heuristics

interface Tier3ActivationGuard {
  shouldActivate(context: ExtractionContext): boolean;
  getActivationReason(): Tier3ActivationReason | null;
}

function shouldRunTier3(context: ExtractionContext): boolean {
  const { triggerSource, pageIntent, tier1Result, tier2Result, siteConfig } = context;
  
  // Condition 1: User explicitly triggered
  if (triggerSource === 'user_click') {
    return true;
  }
  
  // Condition 2: Previous tiers failed
  if (
    tier1Result?.success === false &&
    tier2Result?.success === false
  ) {
    return true;
  }
  
  // Condition 3: Site requires heuristics (obfuscated classes)
  if (siteConfig?.featureFlags?.obfuscatedClassesLikely) {
    return true;
  }
  
  // Condition 4: Checkout intent detected
  if (pageIntent === 'checkout' || pageIntent === 'booking_summary') {
    return true;
  }
  
  // Otherwise: DO NOT run Tier 3 automatically
  // (e.g., search results page, browsing mode)
  return false;
}
```

#### C.4.3 MutationObserver Filtering

```typescript
class FilteredMutationObserver {
  private observer: MutationObserver;
  private priceContainerSelectors: string[];
  
  constructor(callback: MutationCallback) {
    this.priceContainerSelectors = [
      '[class*="summary"]',
      '[class*="checkout"]',
      '[class*="total"]',
      '[class*="price"]',
      '[class*="booking"]',
      '[data-testid*="price"]',
      '[data-testid*="total"]',
    ];
    
    this.observer = new MutationObserver((mutations) => {
      // Filter to only price-relevant mutations
      const relevantMutations = mutations.filter(m =>
        this.isRelevantMutation(m)
      );
      
      if (relevantMutations.length > 0) {
        callback(relevantMutations, this.observer);
      }
    });
  }
  
  private isRelevantMutation(mutation: MutationRecord): boolean {
    const target = mutation.target as Element;
    
    // Check if mutation is within a price container
    for (const selector of this.priceContainerSelectors) {
      if (target.closest?.(selector)) {
        return true;
      }
    }
    
    // Check if mutation added a price container
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          if (this.priceContainerSelectors.some(s => el.matches?.(s))) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  start(): void {
    // Observe targeted containers, not document.body
    const containers = document.querySelectorAll(
      this.priceContainerSelectors.join(',')
    );
    
    if (containers.length === 0) {
      // Fallback: observe body but with aggressive filtering
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: false,  // Skip text changes
        attributes: false,     // Skip attribute changes
      });
    } else {
      for (const container of containers) {
        this.observer.observe(container, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }
    }
  }
}
```

#### C.4.4 DOM Scanning Budget

```typescript
const TIER3_BUDGET = {
  maxElementsToScan: 500,          // Stop after N candidates
  maxTimeMs: 300,                  // Hard timeout
  maxGetComputedStyleCalls: 100,  // Limit expensive calls
  scanBatchSize: 50,              // Yield to main thread every N elements
  yieldIntervalMs: 10,            // Allow UI updates
};

async function* scanWithBudget(
  elements: HTMLElement[]
): AsyncGenerator<ScoredCandidate> {
  let scanned = 0;
  let styleCalls = 0;
  const startTime = performance.now();
  
  for (let i = 0; i < elements.length; i++) {
    // Budget checks
    if (scanned >= TIER3_BUDGET.maxElementsToScan) {
      console.warn('[Tier3] Hit element scan limit');
      return;
    }
    
    if (performance.now() - startTime > TIER3_BUDGET.maxTimeMs) {
      console.warn('[Tier3] Hit time budget');
      return;
    }
    
    // Yield to main thread periodically
    if (i > 0 && i % TIER3_BUDGET.scanBatchSize === 0) {
      await sleep(TIER3_BUDGET.yieldIntervalMs);
    }
    
    // Score the candidate
    const candidate = scoreCandidate(elements[i], {
      onGetComputedStyle: () => {
        styleCalls++;
        if (styleCalls > TIER3_BUDGET.maxGetComputedStyleCalls) {
          throw new BudgetExceededError('getComputedStyle limit reached');
        }
      },
    });
    
    scanned++;
    
    if (candidate.parsedMoney.success) {
      yield candidate;
    }
  }
}
```

---

### C.5 Override Lifecycle & Context Signatures

**⚠️ CRITICAL: This section documents how user overrides are managed to prevent "sticky wrong" failures.**

#### C.5.1 The Problem

User overrides can become invalid when:
- Site redesign changes where the selector points
- The selector now matches a different number
- The context (nearby labels, URL pattern) has changed

Without lifecycle management, old overrides cause silent failures.

#### C.5.2 Context Signature

Each override stores a "context signature" for validation:

```typescript
interface OverrideContextSignature {
  // URL patterns
  urlPathPattern: string;           // e.g., "/checkout/*" or "/booking/summary"
  urlQueryFingerprint?: string;     // Hash of relevant query params
  
  // DOM context
  nearbyLabelHash: string;          // Hash of nearby text labels
  ancestorPathHash: string;         // Hash of parent element path
  siblingCountHash: string;         // Hash of sibling structure
  
  // Value context
  expectedValuePattern?: RegExp;    // e.g., /^\$[\d,]+\.\d{2}$/
  typicalValueRange?: [number, number]; // [minSeen, maxSeen]
  
  // Timestamps
  createdAt: number;
  lastValidatedAt: number;
  lastSuccessAt: number;
}

interface EnhancedUserOverride extends UserOverride {
  contextSignature: OverrideContextSignature;
  validationHistory: ValidationAttempt[];
  status: 'active' | 'suspect' | 'retired';
}
```

#### C.5.3 Signature Generation

```typescript
function generateContextSignature(
  element: HTMLElement,
  parsedValue: Money
): OverrideContextSignature {
  // URL pattern
  const urlPathPattern = generateUrlPattern(window.location.pathname);
  
  // Nearby labels (within 200px)
  const nearbyLabels = getNearbyTextLabels(element, 200);
  const nearbyLabelHash = hashStrings(nearbyLabels);
  
  // Ancestor path (up to 5 levels)
  const ancestors = getAncestorPath(element, 5);
  const ancestorPathHash = hashElements(ancestors);
  
  // Siblings
  const siblingCount = element.parentElement?.children.length || 0;
  const siblingCountHash = hashNumber(siblingCount);
  
  // Value pattern
  const expectedValuePattern = generateValuePattern(parsedValue.raw);
  
  return {
    urlPathPattern,
    nearbyLabelHash,
    ancestorPathHash,
    siblingCountHash,
    expectedValuePattern,
    typicalValueRange: [parsedValue.amount, parsedValue.amount],
    createdAt: Date.now(),
    lastValidatedAt: Date.now(),
    lastSuccessAt: Date.now(),
  };
}

function generateUrlPattern(pathname: string): string {
  // Convert specific IDs to wildcards
  // "/checkout/12345/review" → "/checkout/*/review"
  return pathname.replace(/\/\d+\//g, '/*/').replace(/\/\d+$/, '/*');
}
```

#### C.5.4 Signature Validation

```typescript
function validateOverrideSignature(
  override: EnhancedUserOverride,
  element: HTMLElement,
  extractedValue: Money
): SignatureValidationResult {
  const current = generateContextSignature(element, extractedValue);
  const stored = override.contextSignature;
  
  const issues: SignatureIssue[] = [];
  
  // Check URL pattern
  if (!matchUrlPattern(stored.urlPathPattern, window.location.pathname)) {
    issues.push({
      field: 'urlPathPattern',
      severity: 'warning',
      message: 'URL pattern has changed',
    });
  }
  
  // Check nearby labels (most important)
  if (stored.nearbyLabelHash !== current.nearbyLabelHash) {
    issues.push({
      field: 'nearbyLabelHash',
      severity: 'critical',
      message: 'Nearby labels have changed - selector may point to wrong element',
    });
  }
  
  // Check ancestor path
  if (stored.ancestorPathHash !== current.ancestorPathHash) {
    issues.push({
      field: 'ancestorPathHash',
      severity: 'warning',
      message: 'DOM structure has changed',
    });
  }
  
  // Check value range
  if (stored.typicalValueRange) {
    const [min, max] = stored.typicalValueRange;
    const margin = Math.max(max - min, 100) * 0.5; // 50% margin or $100
    if (extractedValue.amount < min - margin || extractedValue.amount > max + margin) {
      issues.push({
        field: 'typicalValueRange',
        severity: 'warning',
        message: `Value ${extractedValue.amount} outside typical range [${min}, ${max}]`,
      });
    }
  }
  
  // Determine overall validity
  const hasCritical = issues.some(i => i.severity === 'critical');
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  
  return {
    valid: !hasCritical && warningCount <= 1,
    issues,
    shouldRetire: hasCritical,
    shouldRequireReconfirmation: warningCount > 1,
  };
}
```

#### C.5.5 Lifecycle State Machine

```typescript
type OverrideStatus = 'active' | 'suspect' | 'retired';

const OVERRIDE_LIFECYCLE_RULES = {
  // Retire after N consecutive failures
  maxConsecutiveFailures: 3,
  
  // Mark as suspect after N signature issues
  suspectThreshold: 2,
  
  // Require re-confirmation after days since last success
  staleAfterDays: 30,
  
  // Auto-retire if never successful after N attempts
  maxAttemptsWithoutSuccess: 5,
};

function updateOverrideStatus(
  override: EnhancedUserOverride,
  validationResult: SignatureValidationResult,
  extractionSuccess: boolean
): OverrideStatus {
  // Update validation history
  override.validationHistory.push({
    timestamp: Date.now(),
    success: extractionSuccess,
    signatureValid: validationResult.valid,
    issues: validationResult.issues,
  });
  
  // Keep last 10 attempts
  override.validationHistory = override.validationHistory.slice(-10);
  
  // Count recent failures
  const recentAttempts = override.validationHistory.slice(-5);
  const consecutiveFailures = countConsecutiveFailuresFromEnd(recentAttempts);
  const signatureIssueCount = recentAttempts.filter(a => !a.signatureValid).length;
  
  // State transitions
  if (consecutiveFailures >= OVERRIDE_LIFECYCLE_RULES.maxConsecutiveFailures) {
    return 'retired';
  }
  
  if (validationResult.shouldRetire) {
    return 'retired';
  }
  
  if (signatureIssueCount >= OVERRIDE_LIFECYCLE_RULES.suspectThreshold) {
    return 'suspect';
  }
  
  const daysSinceSuccess = (Date.now() - override.contextSignature.lastSuccessAt)
    / (1000 * 60 * 60 * 24);
  if (daysSinceSuccess > OVERRIDE_LIFECYCLE_RULES.staleAfterDays) {
    return 'suspect';
  }
  
  return 'active';
}
```

#### C.5.6 Re-confirmation Flow

When an override is marked `suspect`:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ⚠️ SAVED SELECTOR NEEDS RE-CONFIRMATION                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Your saved price selector for delta.com may no longer be accurate.   │
│                                                                         │
│  We detected:                                                           │
│  • The page structure has changed                                       │
│  • Last successful use: 45 days ago                                     │
│                                                                         │
│  Currently extracting: $1,234.56                                        │
│                                                                         │
│  Is this the correct total price?                                       │
│                                                                         │
│  [ Yes, Keep Using ]    [ No, Let Me Re-Select ]    [ Remove Saved ]   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### C.6 Privacy Redaction Layer

**⚠️ CRITICAL: This section documents mandatory privacy protections for all stored/transmitted data.**

#### C.6.1 The Problem

Travel checkout pages contain sensitive PII:
- Names, emails
- Loyalty/frequent flyer numbers
- Partial card numbers (even if masked)
- Addresses (for hotels)
- Phone numbers
- Passport/ID numbers (international)

Debug payloads, DOM snapshots, and logs must be sanitized.

#### C.6.2 Redaction Pipeline

```typescript
interface RedactionConfig {
  // What to redact
  stripFormInputValues: boolean;
  stripUserContentNodes: boolean;
  redactEmailPatterns: boolean;
  redactPhonePatterns: boolean;
  redactCardPatterns: boolean;
  redactNamePatterns: boolean;
  redactAddressPatterns: boolean;
  
  // URL handling
  stripQueryParams: string[];       // Specific params to remove
  stripAllQueryParams: boolean;     // Remove all params
  hashRemainingParams: boolean;     // Hash values instead of removing
  
  // Text limits
  maxTextLength: number;
  maxAttributeLength: number;
}

const DEFAULT_REDACTION_CONFIG: RedactionConfig = {
  stripFormInputValues: true,
  stripUserContentNodes: true,
  redactEmailPatterns: true,
  redactPhonePatterns: true,
  redactCardPatterns: true,
  redactNamePatterns: true,
  redactAddressPatterns: true,
  
  stripQueryParams: [
    'token', 'auth', 'session', 'key', 'secret', 'password',
    'email', 'phone', 'name', 'address', 'loyalty', 'member',
    'card', 'cvv', 'exp', 'zip', 'postal',
  ],
  stripAllQueryParams: false,
  hashRemainingParams: true,
  
  maxTextLength: 200,
  maxAttributeLength: 100,
};
```

#### C.6.3 Redaction Functions

```typescript
// Master redaction function - MUST be called on all stored data
function redactSensitiveData(
  data: unknown,
  config: RedactionConfig = DEFAULT_REDACTION_CONFIG
): unknown {
  if (typeof data === 'string') {
    return redactString(data, config);
  }
  
  if (data instanceof HTMLElement) {
    return redactDomSnapshot(data, config);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item, config));
  }
  
  if (typeof data === 'object' && data !== null) {
    return redactObject(data as Record<string, unknown>, config);
  }
  
  return data;
}

function redactString(text: string, config: RedactionConfig): string {
  let result = text;
  
  // Email patterns
  if (config.redactEmailPatterns) {
    result = result.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      '[EMAIL_REDACTED]'
    );
  }
  
  // Phone patterns (various formats)
  if (config.redactPhonePatterns) {
    result = result.replace(
      /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
      '[PHONE_REDACTED]'
    );
  }
  
  // Card patterns (16 digits with optional separators)
  if (config.redactCardPatterns) {
    result = result.replace(
      /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      '[CARD_REDACTED]'
    );
    // Also catch partial/masked cards
    result = result.replace(
      /\b(?:\d{4}[-\s]?)?(?:\*{4}[-\s]?){2}\d{4}\b/g,
      '[CARD_REDACTED]'
    );
  }
  
  // Address patterns (simplified - street numbers + words)
  if (config.redactAddressPatterns) {
    result = result.replace(
      /\d+\s+(?:[A-Za-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)\b/gi,
      '[ADDRESS_REDACTED]'
    );
  }
  
  // Truncate long text
  if (result.length > config.maxTextLength) {
    result = result.substring(0, config.maxTextLength) + '...[TRUNCATED]';
  }
  
  return result;
}
```

#### C.6.4 DOM Snapshot Redaction

```typescript
function redactDomSnapshot(
  element: HTMLElement,
  config: RedactionConfig
): string {
  // Clone to avoid modifying original
  const clone = element.cloneNode(true) as HTMLElement;
  
  // Remove sensitive node types entirely
  const sensitiveSelectors = [
    'input[type="password"]',
    'input[type="email"]',
    'input[type="tel"]',
    'input[name*="card"]',
    'input[name*="cvv"]',
    'input[name*="expir"]',
    'input[name*="name"]',
    'input[name*="address"]',
    'input[name*="phone"]',
    'input[name*="email"]',
    'input[autocomplete*="cc-"]',
    '[class*="personal"]',
    '[class*="account"]',
    '[class*="profile"]',
    '[class*="payment-form"]',
    '[data-testid*="personal"]',
    '[data-testid*="payment"]',
  ];
  
  for (const selector of sensitiveSelectors) {
    clone.querySelectorAll(selector).forEach(el => {
      el.textContent = '[REDACTED_NODE]';
      // Clear all attributes except structural ones
      const keepAttrs = ['class', 'id', 'data-testid'];
      Array.from(el.attributes).forEach(attr => {
        if (!keepAttrs.includes(attr.name)) {
          el.removeAttribute(attr.name);
        }
      });
    });
  }
  
  // Clear all input values
  if (config.stripFormInputValues) {
    clone.querySelectorAll('input, textarea, select').forEach(el => {
      (el as HTMLInputElement).value = '[VALUE_REDACTED]';
      el.removeAttribute('value');
    });
  }
  
  // Redact text content
  const walker = document.createTreeWalker(
    clone,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  let textNode: Text | null;
  while ((textNode = walker.nextNode() as Text | null)) {
    textNode.textContent = redactString(textNode.textContent || '', config);
  }
  
  // Redact attributes
  clone.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes).forEach(attr => {
      if (attr.value.length > config.maxAttributeLength) {
        attr.value = attr.value.substring(0, config.maxAttributeLength) + '...';
      }
      attr.value = redactString(attr.value, config);
    });
  });
  
  return clone.outerHTML;
}
```

#### C.6.5 URL Redaction

```typescript
function redactUrl(url: string, config: RedactionConfig): string {
  try {
    const parsed = new URL(url);
    
    // Strip sensitive params
    for (const param of config.stripQueryParams) {
      parsed.searchParams.delete(param);
    }
    
    // Option: strip all params
    if (config.stripAllQueryParams) {
      parsed.search = '';
    }
    
    // Option: hash remaining param values
    if (config.hashRemainingParams && !config.stripAllQueryParams) {
      const newParams = new URLSearchParams();
      parsed.searchParams.forEach((value, key) => {
        newParams.set(key, hashString(value).substring(0, 8));
      });
      parsed.search = newParams.toString();
    }
    
    return parsed.toString();
  } catch {
    return '[INVALID_URL]';
  }
}
```

#### C.6.6 Enforced Redaction Points

Redaction is **automatically applied** at these points:

```typescript
// 1. Before storing in Dead Letter Queue
async function recordFailedExtraction(error, context): Promise<void> {
  const redactedContext = redactSensitiveData(context);  // ENFORCED
  // ... store redactedContext
}

// 2. Before generating debug payload
function generateDebugPayload(result, options): DebugPayload {
  const payload = { /* ... */ };
  return redactSensitiveData(payload) as DebugPayload;  // ENFORCED
}

// 3. Before logging to console (in debug mode)
function logExtraction(log: ExtractionLog): void {
  const redactedLog = redactSensitiveData(log);  // ENFORCED
  console.log(redactedLog);
}

// 4. Before sending to any external service
async function sendTelemetry(data: TelemetryData): Promise<void> {
  const redactedData = redactSensitiveData(data);  // ENFORCED
  // ... send redactedData
}
```

#### C.6.7 Verification Tests

```typescript
describe('Privacy Redaction', () => {
  it('removes email addresses from DOM snapshots', () => {
    const html = '<div>Contact: john.doe@example.com</div>';
    const redacted = redactDomSnapshot(createElementFromHtml(html), DEFAULT_REDACTION_CONFIG);
    expect(redacted).not.toContain('john.doe@example.com');
    expect(redacted).toContain('[EMAIL_REDACTED]');
  });
  
  it('removes all input values', () => {
    const html = '<input type="text" value="John Doe">';
    const redacted = redactDomSnapshot(createElementFromHtml(html), DEFAULT_REDACTION_CONFIG);
    expect(redacted).not.toContain('John Doe');
  });
  
  it('strips sensitive query parameters from URLs', () => {
    const url = 'https://example.com/checkout?email=john@test.com&orderId=123';
    const redacted = redactUrl(url, DEFAULT_REDACTION_CONFIG);
    expect(redacted).not.toContain('john@test.com');
    expect(redacted).toContain('orderId'); // Non-sensitive param kept
  });
  
  it('truncates long text content', () => {
    const longText = 'A'.repeat(500);
    const redacted = redactString(longText, DEFAULT_REDACTION_CONFIG);
    expect(redacted.length).toBeLessThan(250);
    expect(redacted).toContain('[TRUNCATED]');
  });
});
```

---

### C.7 Triple-Gate Comparison Requirements

**⚠️ CRITICAL: No comparison verdict may be issued unless ALL THREE gates pass.**

#### C.7.1 The Problem

Extraction confidence alone is insufficient for a safe recommendation. A comparison can fail if:

1. Prices are extracted but semantics differ (per-night vs total)
2. Prices match but currencies differ (no auto-conversion)
3. Prices and currencies match but itineraries differ (wrong trip)

Each failure mode requires independent gating.

#### C.7.2 The Triple Gate

```typescript
interface ComparisonGateResult {
  canProceed: boolean;
  gatesPassed: GateStatus[];
  blockedBy: GateName | null;
  confidenceLevel: 'FULL' | 'WARNING' | 'BLOCKED';
  userMessage: string;
}

type GateName = 'SEMANTIC' | 'CURRENCY' | 'FINGERPRINT';

interface GateStatus {
  gate: GateName;
  passed: boolean;
  confidence: number;  // 0-100
  issues: string[];
}

function evaluateTripleGate(
  portalResult: ExtractionResult,
  directResult: ExtractionResult,
  fingerprintMatch: FingerprintMatchResult
): ComparisonGateResult {
  const gates: GateStatus[] = [];
  
  // === GATE 1: Semantic Match ===
  const semanticGate = evaluateSemanticGate(
    portalResult.priceBreakdown,
    directResult.priceBreakdown
  );
  gates.push(semanticGate);
  
  // === GATE 2: Currency Match ===
  const currencyGate = evaluateCurrencyGate(
    portalResult.price,
    directResult.price
  );
  gates.push(currencyGate);
  
  // === GATE 3: Fingerprint Match ===
  const fingerprintGate = evaluateFingerprintGate(fingerprintMatch);
  gates.push(fingerprintGate);
  
  // === Determine Overall Result ===
  const failedGate = gates.find(g => !g.passed);
  
  if (failedGate) {
    return {
      canProceed: false,
      gatesPassed: gates,
      blockedBy: failedGate.gate,
      confidenceLevel: 'BLOCKED',
      userMessage: getBlockedMessage(failedGate),
    };
  }
  
  const lowConfidenceGate = gates.find(g => g.confidence < 80);
  
  if (lowConfidenceGate) {
    return {
      canProceed: true,
      gatesPassed: gates,
      blockedBy: null,
      confidenceLevel: 'WARNING',
      userMessage: getWarningMessage(lowConfidenceGate),
    };
  }
  
  return {
    canProceed: true,
    gatesPassed: gates,
    blockedBy: null,
    confidenceLevel: 'FULL',
    userMessage: 'Comparison valid with high confidence',
  };
}
```

#### C.7.3 Gate Evaluation Functions

```typescript
function evaluateSemanticGate(
  portal: PriceBreakdown,
  direct: PriceBreakdown
): GateStatus {
  const issues: string[] = [];
  let confidence = 100;
  
  // Check 1: Both must be totals
  if (portal.extractedField !== direct.extractedField) {
    if (portal.isPerUnit || direct.isPerUnit) {
      issues.push('Comparing per-unit vs total price');
      confidence -= 50;  // Major issue
    }
  }
  
  // Check 2: Tax inclusion must match
  if (portal.includesTaxes !== direct.includesTaxes) {
    if (portal.includesTaxes !== 'unknown' && direct.includesTaxes !== 'unknown') {
      issues.push('Tax inclusion differs');
      confidence -= 30;
    } else {
      confidence -= 10;  // Unknown is less severe
    }
  }
  
  // Check 3: Payment timing
  if (portal.paymentTiming !== direct.paymentTiming) {
    if (portal.paymentTiming !== 'unknown' && direct.paymentTiming !== 'unknown') {
      issues.push('Payment timing differs');
      confidence -= 20;
    }
  }
  
  return {
    gate: 'SEMANTIC',
    passed: confidence >= 50,
    confidence: Math.max(0, confidence),
    issues,
  };
}

function evaluateCurrencyGate(
  portalPrice: Money,
  directPrice: Money
): GateStatus {
  const issues: string[] = [];
  
  // Hard requirement: currencies must match
  if (portalPrice.currency !== directPrice.currency) {
    return {
      gate: 'CURRENCY',
      passed: false,
      confidence: 0,
      issues: [`Currency mismatch: ${portalPrice.currency} vs ${directPrice.currency}`],
    };
  }
  
  // Both match - check detection confidence
  // (will be enhanced by C.9 probabilistic currency detection)
  return {
    gate: 'CURRENCY',
    passed: true,
    confidence: 100,
    issues: [],
  };
}

function evaluateFingerprintGate(
  match: FingerprintMatchResult
): GateStatus {
  const confidenceMap: Record<FingerprintMatchConfidence, number> = {
    'STRICT': 100,
    'MEDIUM': 70,
    'LOW': 30,
    'MISMATCH': 0,
  };
  
  return {
    gate: 'FINGERPRINT',
    passed: match.confidence !== 'MISMATCH' && match.confidence !== 'LOW',
    confidence: confidenceMap[match.confidence],
    issues: match.warnings,
  };
}
```

#### C.7.4 Integration Point

```typescript
// In compare/recommendation flow - BEFORE showing verdict
async function generateVerdict(session: CompareSession): Promise<VerdictResult> {
  const gateResult = evaluateTripleGate(
    session.portalSnapshot.extraction,
    session.directSnapshot.extraction,
    session.fingerprintMatch
  );
  
  if (!gateResult.canProceed) {
    return {
      type: 'BLOCKED',
      reason: gateResult.blockedBy,
      message: gateResult.userMessage,
      showComparison: false,
      showRecommendation: false,
    };
  }
  
  if (gateResult.confidenceLevel === 'WARNING') {
    return {
      type: 'WARNING',
      message: gateResult.userMessage,
      showComparison: true,
      showRecommendation: true,
      requiresUserConfirmation: true,
    };
  }
  
  // Full confidence - proceed with verdict
  return calculateVerdict(session);
}
```

---

### C.8 Candidate De-Duplication

**⚠️ CRITICAL: This section prevents false ambiguity from duplicate price displays.**

#### C.8.1 The Problem

In real DOMs, the same price often appears multiple times:

- Sticky header/footer with price summary
- Mobile vs desktop versions (only one visible)
- Accessibility text duplicates (aria-labels, screen reader text)
- Nested spans that make one price appear as multiple elements
- Shadow DOM copies

If we count these as separate candidates, we:
- Artificially shrink gaps between candidates
- Trigger false "ambiguous price" warnings
- Spam the picker unnecessarily

#### C.8.2 De-Duplication Strategy

```typescript
interface CandidateCluster {
  canonicalCandidate: ScoredCandidate;
  duplicates: ScoredCandidate[];
  clusterReason: ClusterReason;
}

type ClusterReason =
  | 'SAME_AMOUNT_SAME_CURRENCY'
  | 'BOUNDING_BOX_OVERLAP'
  | 'DOM_ANCESTRY'
  | 'ACCESSIBILITY_DUPLICATE';

function deduplicateCandidates(
  candidates: ScoredCandidate[]
): CandidateCluster[] {
  // Step 1: Group by normalized (amount, currency)
  const byValue = groupBy(candidates, c =>
    `${c.parsedMoney.money.amount.toFixed(2)}_${c.parsedMoney.money.currency}`
  );
  
  const clusters: CandidateCluster[] = [];
  
  for (const [key, group] of Object.entries(byValue)) {
    if (group.length === 1) {
      // Unique value - no dedup needed
      clusters.push({
        canonicalCandidate: group[0],
        duplicates: [],
        clusterReason: 'SAME_AMOUNT_SAME_CURRENCY',
      });
      continue;
    }
    
    // Multiple candidates with same value - cluster them
    const subclusters = clusterByProximity(group);
    clusters.push(...subclusters);
  }
  
  return clusters;
}

function clusterByProximity(
  candidates: ScoredCandidate[]
): CandidateCluster[] {
  const clusters: CandidateCluster[] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < candidates.length; i++) {
    if (used.has(i)) continue;
    
    const canonical = candidates[i];
    const duplicates: ScoredCandidate[] = [];
    
    for (let j = i + 1; j < candidates.length; j++) {
      if (used.has(j)) continue;
      
      const other = candidates[j];
      
      // Check if they're duplicates
      if (areDuplicates(canonical, other)) {
        duplicates.push(other);
        used.add(j);
      }
    }
    
    used.add(i);
    clusters.push({
      canonicalCandidate: selectCanonical([canonical, ...duplicates]),
      duplicates,
      clusterReason: detectClusterReason(canonical, duplicates),
    });
  }
  
  return clusters;
}
```

#### C.8.3 Duplicate Detection Rules

```typescript
function areDuplicates(a: ScoredCandidate, b: ScoredCandidate): boolean {
  // Rule 1: Same value (already filtered) + bounding box overlap
  if (boundingBoxOverlap(a.boundingRect, b.boundingRect) > 0.5) {
    return true;
  }
  
  // Rule 2: One is ancestor of the other
  if (
    a.element.contains(b.element) ||
    b.element.contains(a.element)
  ) {
    return true;
  }
  
  // Rule 3: Very close proximity (< 50px)
  const distance = measureDistance(a.element, b.element);
  if (distance < 50) {
    return true;
  }
  
  // Rule 4: One is hidden/offscreen (accessibility duplicate)
  const aVisible = isFullyVisible(a.element);
  const bVisible = isFullyVisible(b.element);
  if (aVisible !== bVisible) {
    return true;  // Hidden duplicate
  }
  
  // Rule 5: Same normalized text content
  const aText = normalizeText(a.text);
  const bText = normalizeText(b.text);
  if (aText === bText) {
    return true;
  }
  
  return false;
}

function selectCanonical(candidates: ScoredCandidate[]): ScoredCandidate {
  // Prefer: visible > higher score > larger bounding box > earlier in DOM
  return candidates.sort((a, b) => {
    // Visibility first
    const aVis = isFullyVisible(a.element) ? 1 : 0;
    const bVis = isFullyVisible(b.element) ? 1 : 0;
    if (aVis !== bVis) return bVis - aVis;
    
    // Then score
    if (a.score !== b.score) return b.score - a.score;
    
    // Then bounding box size
    const aArea = a.boundingRect.width * a.boundingRect.height;
    const bArea = b.boundingRect.width * b.boundingRect.height;
    if (aArea !== bArea) return bArea - aArea;
    
    // Finally DOM order
    const position = a.element.compareDocumentPosition(b.element);
    return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  })[0];
}
```

#### C.8.4 Impact on Ambiguity Detection

```typescript
// BEFORE: May trigger false ambiguity
function detectAmbiguityOld(candidates: ScoredCandidate[]): boolean {
  const sorted = candidates.sort((a, b) => b.score - a.score);
  const gap = sorted[0].score - sorted[1].score;
  return gap < 10;  // False positive if sorted[1] is a duplicate!
}

// AFTER: Dedup first
function detectAmbiguityNew(candidates: ScoredCandidate[]): AmbiguityResult {
  const clusters = deduplicateCandidates(candidates);
  
  // Now compare clusters, not raw candidates
  const sorted = clusters
    .map(c => c.canonicalCandidate)
    .sort((a, b) => b.score - a.score);
  
  if (sorted.length < 2) {
    return { isAmbiguous: false, gap: Infinity };
  }
  
  const gap = sorted[0].score - sorted[1].score;
  const isAmbiguous = gap < 10 && sorted[0].score > 0;
  
  return {
    isAmbiguous,
    gap,
    topCandidate: sorted[0],
    runnerUp: sorted[1],
    clustersFound: clusters.length,
    duplicatesRemoved: candidates.length - clusters.length,
  };
}
```

---

### C.9 Picker Semantic Confirmation Flow

**⚠️ CRITICAL: User-selected prices must be semantically classified before saving.**

#### C.9.1 The Problem

Current picker flow:
1. User clicks element
2. Parse money → success
3. Save selector as "totalPrice"
4. Return HIGH confidence

This is wrong because:
- User might click nightly rate thinking it's total
- User might click subtotal before taxes
- User might click "per person" price

Result: HIGH confidence, WRONG semantic field.

#### C.9.2 Enhanced Picker Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  PICKER SEMANTIC CONFIRMATION FLOW                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   1. User clicks element                                                │
│      │                                                                  │
│      ▼                                                                  │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ parseSelectedElement(element)                                    │  │
│   │  - Extract text                                                  │  │
│   │  - Parse money                                                   │  │
│   │  - Detect nearby labels                                          │  │
│   │  - Auto-classify semantic field                                  │  │
│   └────────────────────────┬────────────────────────────────────────┘  │
│                            │                                            │
│                            ▼                                            │
│   2. Show SEMANTIC CONFIRMATION DIALOG                                  │
│      │                                                                  │
│      ▼                                                                  │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │ ┌─────────────────────────────────────────────────────────────┐ │  │
│   │ │  We found: $243.00                                          │ │  │
│   │ │                                                              │ │  │
│   │ │  What does this price represent?                            │ │  │
│   │ │                                                              │ │  │
│   │ │  ○ Total trip price (all nights, all travelers)   ← BEST   │ │  │
│   │ │  ○ Price per night                                          │ │  │
│   │ │  ○ Price per person                                         │ │  │
│   │ │  ○ Subtotal (before taxes/fees)                            │ │  │
│   │ │  ○ I'm not sure                                             │ │  │
│   │ │                                                              │ │  │
│   │ │  [Cancel]                         [Confirm & Save]          │ │  │
│   │ └─────────────────────────────────────────────────────────────┘ │  │
│   └────────────────────────┬────────────────────────────────────────┘  │
│                            │                                            │
│                            ▼                                            │
│   3. Process user response                                              │
│      │                                                                  │
│      ├──── "Total trip price" ────▶ Save as totalPrice, HIGH conf      │
│      │                                                                  │
│      ├──── "Per night" ──────────▶ Save as perNight, MEDIUM conf       │
│      │                            + prompt for night count              │
│      │                                                                  │
│      ├──── "Per person" ─────────▶ Save as perPerson, MEDIUM conf      │
│      │                            + prompt for pax count                │
│      │                                                                  │
│      ├──── "Subtotal" ───────────▶ Save as subtotal, LOW conf          │
│      │                            + warn about tax addition             │
│      │                                                                  │
│      └──── "Not sure" ───────────▶ Save as ambiguous, LOW conf         │
│                                    + show "re-select" option            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### C.9.3 Implementation

```typescript
interface SemanticConfirmation {
  parsedPrice: Money;
  autoDetectedField: ExtractedPriceField;
  nearbyLabels: string[];
  userConfirmedField: ExtractedPriceField | null;
  additionalInfo?: {
    unitCount?: number;    // nights or pax
    unitType?: 'night' | 'person';
  };
}

async function runEnhancedPicker(): Promise<EnhancedPickerResult> {
  // Step 1: Activate picker
  const selectedElement = await waitForUserSelection();
  
  // Step 2: Parse and auto-detect
  const parsed = parseMoney(selectedElement.textContent || '');
  if (!parsed.success) {
    return { success: false, error: 'Could not parse price' };
  }
  
  const nearbyLabels = getNearbyTextLabels(selectedElement, 150);
  const autoDetected = classifyFromLabels(nearbyLabels);
  
  // Step 3: Show confirmation dialog
  const confirmation = await showSemanticConfirmationDialog({
    amount: parsed.money.formatted,
    autoDetected,
    nearbyLabels,
    suggestedOptions: generateSuggestedOptions(autoDetected, nearbyLabels),
  });
  
  if (confirmation.cancelled) {
    return { success: false, error: 'User cancelled' };
  }
  
  // Step 4: Process confirmation
  const semanticField = confirmation.selectedField;
  const confidence = getConfidenceForField(semanticField, autoDetected);
  
  // Step 5: Prompt for additional info if needed
  let additionalInfo: SemanticConfirmation['additionalInfo'];
  
  if (semanticField === 'PER_UNIT_RATE') {
    additionalInfo = await promptForUnitInfo(confirmation.unitType);
  }
  
  // Step 6: Save override with semantic info
  const override: EnhancedUserOverride = {
    siteKey: window.location.hostname,
    field: mapSemanticFieldToOverrideField(semanticField),
    selectors: generateSelectorStrategies(selectedElement),
    semanticClassification: semanticField,
    userConfirmedSemantic: true,
    additionalInfo,
    contextSignature: generateContextSignature(selectedElement, parsed.money),
    // ...
  };
  
  await saveUserOverride(override);
  
  return {
    success: true,
    price: parsed.money,
    semanticField,
    confidence,
    wasAutoDetected: semanticField === autoDetected,
  };
}

function getConfidenceForField(
  selected: ExtractedPriceField,
  autoDetected: ExtractedPriceField
): ConfidenceLevel {
  // User confirmed = HIGH only if selecting "total"
  if (selected === 'TOTAL_ALL_IN') {
    return 'HIGH';
  }
  
  // User explicitly selected per-unit or partial = MEDIUM
  if (selected === 'PER_UNIT_RATE' || selected === 'TOTAL_BEFORE_TAXES') {
    return 'MEDIUM';
  }
  
  // User said "not sure" = LOW
  if (selected === 'AMBIGUOUS') {
    return 'LOW';
  }
  
  return 'MEDIUM';
}
```

---

### C.10 Probabilistic Currency Detection

**⚠️ CRITICAL: Currency detection must be probabilistic, not binary.**

#### C.10.1 The Problem

Current detection treats currency as certain once detected:
- `$` → USD (but could be CAD, AUD, SGD, HKD...)
- `£` → GBP (but could be EGP, SYP...)
- `¥` → JPY (but could be CNY)

This causes:
- False positive currency matches
- Hidden currency mismatches on multi-currency sites
- Wrong comparison verdicts

#### C.10.2 Detection Confidence Tiers

```typescript
type CurrencyDetectionConfidence = 'CERTAIN' | 'PROBABLE' | 'AMBIGUOUS';

interface CurrencyDetectionResult {
  currency: string;                       // ISO code
  confidence: CurrencyDetectionConfidence;
  confidenceScore: number;                // 0-100
  detectionMethod: CurrencyDetectionMethod;
  alternativeCurrencies: AlternativeCurrency[];
  evidenceChain: CurrencyEvidence[];
}

interface AlternativeCurrency {
  currency: string;
  probability: number;  // 0-1
  reason: string;
}

type CurrencyDetectionMethod =
  | 'ISO_CODE'           // Explicit "USD", "EUR" text
  | 'UNAMBIGUOUS_SYMBOL' // €, ₹, ₽ (unique)
  | 'DISAMBIGUATED_SYMBOL' // $ with "US$" or context
  | 'CONTEXTUAL_HINT'    // Site locale, user settings
  | 'SYMBOL_ONLY'        // Bare $ with no context
  | 'FALLBACK';          // No detection, using default
```

#### C.10.3 Detection Algorithm

```typescript
function detectCurrency(
  text: string,
  context: CurrencyContext
): CurrencyDetectionResult {
  const evidenceChain: CurrencyEvidence[] = [];
  
  // === TIER 1: ISO Code (CERTAIN) ===
  const isoMatch = text.match(/\b([A-Z]{3})\s*[\d,]+/);
  if (isoMatch && isValidCurrencyCode(isoMatch[1])) {
    return {
      currency: isoMatch[1],
      confidence: 'CERTAIN',
      confidenceScore: 100,
      detectionMethod: 'ISO_CODE',
      alternativeCurrencies: [],
      evidenceChain: [{ type: 'ISO_CODE', value: isoMatch[1] }],
    };
  }
  
  // === TIER 2: Unambiguous Symbol (CERTAIN) ===
  const unambiguousSymbols: Record<string, string> = {
    '€': 'EUR',
    '₹': 'INR',
    '₽': 'RUB',
    '₩': 'KRW',
    '฿': 'THB',
    '₫': 'VND',
    '₪': 'ILS',
    'zł': 'PLN',
    'kr': 'NORDIC',  // Needs further disambiguation
  };
  
  for (const [symbol, code] of Object.entries(unambiguousSymbols)) {
    if (text.includes(symbol)) {
      if (code === 'NORDIC') {
        // Further disambiguation needed
        const nordic = disambiguateNordicKrone(text, context);
        return {
          currency: nordic.currency,
          confidence: 'PROBABLE',
          confidenceScore: 80,
          detectionMethod: 'CONTEXTUAL_HINT',
          alternativeCurrencies: nordic.alternatives,
          evidenceChain: [{ type: 'SYMBOL', value: symbol }, ...nordic.evidence],
        };
      }
      
      return {
        currency: code,
        confidence: 'CERTAIN',
        confidenceScore: 100,
        detectionMethod: 'UNAMBIGUOUS_SYMBOL',
        alternativeCurrencies: [],
        evidenceChain: [{ type: 'UNAMBIGUOUS_SYMBOL', value: symbol }],
      };
    }
  }
  
  // === TIER 3: Disambiguated $ (PROBABLE) ===
  const dollarMatch = text.match(/(US|CA|AU|NZ|HK|SG|)\$\s*[\d,]+/);
  if (dollarMatch) {
    const prefix = dollarMatch[1];
    
    if (prefix) {
      const prefixMap: Record<string, string> = {
        'US': 'USD', 'CA': 'CAD', 'AU': 'AUD',
        'NZ': 'NZD', 'HK': 'HKD', 'SG': 'SGD',
      };
      return {
        currency: prefixMap[prefix],
        confidence: 'CERTAIN',
        confidenceScore: 95,
        detectionMethod: 'DISAMBIGUATED_SYMBOL',
        alternativeCurrencies: [],
        evidenceChain: [{ type: 'PREFIX_SYMBOL', value: `${prefix}$` }],
      };
    }
    
    // Bare $ - use context
    const contextualCurrency = inferFromContext(context);
    return {
      currency: contextualCurrency.currency,
      confidence: 'AMBIGUOUS',
      confidenceScore: contextualCurrency.score,
      detectionMethod: 'SYMBOL_ONLY',
      alternativeCurrencies: getDollarAlternatives(context),
      evidenceChain: [
        { type: 'BARE_SYMBOL', value: '$' },
        ...contextualCurrency.evidence,
      ],
    };
  }
  
  // === TIER 4: £ (PROBABLE) ===
  if (text.includes('£')) {
    // Usually GBP, but check context
    if (context.siteRegion === 'EG' || context.hostname.includes('.eg')) {
      return {
        currency: 'EGP',
        confidence: 'PROBABLE',
        confidenceScore: 70,
        detectionMethod: 'CONTEXTUAL_HINT',
        alternativeCurrencies: [{ currency: 'GBP', probability: 0.3, reason: 'Common £ currency' }],
        evidenceChain: [{ type: 'SYMBOL', value: '£' }, { type: 'REGION_HINT', value: 'EG' }],
      };
    }
    
    return {
      currency: 'GBP',
      confidence: 'PROBABLE',
      confidenceScore: 90,
      detectionMethod: 'CONTEXTUAL_HINT',
      alternativeCurrencies: [{ currency: 'EGP', probability: 0.1, reason: 'Egyptian Pound' }],
      evidenceChain: [{ type: 'SYMBOL', value: '£' }],
    };
  }
  
  // === TIER 5: Fallback ===
  return {
    currency: context.defaultCurrency || 'USD',
    confidence: 'AMBIGUOUS',
    confidenceScore: 30,
    detectionMethod: 'FALLBACK',
    alternativeCurrencies: getMostCommonCurrencies(),
    evidenceChain: [{ type: 'FALLBACK', value: 'No currency detected' }],
  };
}

function getDollarAlternatives(context: CurrencyContext): AlternativeCurrency[] {
  // Probability based on site/region context
  const base: AlternativeCurrency[] = [
    { currency: 'USD', probability: 0.6, reason: 'Most common $ currency' },
    { currency: 'CAD', probability: 0.15, reason: 'Canadian Dollar' },
    { currency: 'AUD', probability: 0.1, reason: 'Australian Dollar' },
    { currency: 'SGD', probability: 0.05, reason: 'Singapore Dollar' },
    { currency: 'HKD', probability: 0.05, reason: 'Hong Kong Dollar' },
    { currency: 'NZD', probability: 0.05, reason: 'New Zealand Dollar' },
  ];
  
  // Adjust probabilities based on context
  if (context.siteRegion === 'CA' || context.hostname.includes('.ca')) {
    base.find(a => a.currency === 'CAD')!.probability = 0.7;
    base.find(a => a.currency === 'USD')!.probability = 0.2;
  }
  
  return base.sort((a, b) => b.probability - a.probability);
}
```

#### C.10.4 Currency Gate Integration

```typescript
function evaluateCurrencyGate(
  portalPrice: Money,
  directPrice: Money,
  portalDetection: CurrencyDetectionResult,
  directDetection: CurrencyDetectionResult
): GateStatus {
  // Hard fail: different currencies
  if (portalPrice.currency !== directPrice.currency) {
    return {
      gate: 'CURRENCY',
      passed: false,
      confidence: 0,
      issues: [`Currency mismatch: ${portalPrice.currency} vs ${directPrice.currency}`],
    };
  }
  
  // Soft concern: same currency but low detection confidence
  const minConfidence = Math.min(
    portalDetection.confidenceScore,
    directDetection.confidenceScore
  );
  
  const issues: string[] = [];
  
  if (portalDetection.confidence === 'AMBIGUOUS') {
    issues.push(`Portal currency (${portalPrice.currency}) detected with low confidence`);
  }
  
  if (directDetection.confidence === 'AMBIGUOUS') {
    issues.push(`Direct currency (${directPrice.currency}) detected with low confidence`);
  }
  
  // Check for conflicting alternatives
  const portalAlts = new Set(portalDetection.alternativeCurrencies.map(a => a.currency));
  const directAlts = new Set(directDetection.alternativeCurrencies.map(a => a.currency));
  
  if (portalAlts.has(directPrice.currency) || directAlts.has(portalPrice.currency)) {
    // High-probability alternative matches the other side's detected currency
    // This is suspicious
    issues.push('Currency ambiguity: alternatives overlap');
  }
  
  return {
    gate: 'CURRENCY',
    passed: true,
    confidence: minConfidence,
    issues,
  };
}
```

---

### C.11 Ground-Truth Proxy Health Metrics

**⚠️ CRITICAL: Success rate based on `ok` is not enough. Track signals that correlate with real-world correctness.**

#### C.11.1 The Problem

Current health tracking measures:
- `successRate` = extractions returning price / total attempts
- `confidenceBreakdown` = distribution of HIGH/MEDIUM/LOW/NONE

But a system can be "successful" yet consistently wrong if:
- It extracts per-night prices with MEDIUM confidence
- It gets currency wrong but consistently
- It matches fingerprints poorly

Need **ground-truth proxy metrics** that correlate with actual correctness.

#### C.11.2 Proxy Metrics

```typescript
interface GroundTruthProxyMetrics {
  // === User Correction Signals ===
  userFixedAfterMediumHigh: number;     // User clicked "Fix" after MEDIUM/HIGH
  userReselectedPrice: number;          // User used picker despite auto-success
  userOverrideCreatedRecently: number;  // New overrides suggest extraction broken
  
  // === Comparison Mismatch Signals ===
  fingerprintMismatchRate: number;      // Fingerprints didn't match
  semanticIncompatibilityRate: number;  // Semantic fields didn't align
  currencyMismatchRate: number;         // Currency detection conflicts
  
  // === Sanity Check Failures ===
  priceOutOfRangeRate: number;         // Price < $1 or > $100k
  priceVolatilityRate: number;         // Price changed between reads
  multipleHighConfidenceRate: number;  // Multiple prices scored HIGH (ambiguous)
  
  // === Session Abandonment ===
  comparisonAbortRate: number;         // User started compare but didn't finish
  pickerCancelRate: number;            // User opened picker but cancelled
  
  // === Derived Health Score ===
  groundTruthScore: number;            // 0-100, composite
}
```

#### C.11.3 Metric Collection

```typescript
// Track user correction events
function recordUserCorrection(
  type: 'FIX_CLICKED' | 'RESELECTED' | 'OVERRIDE_CREATED',
  context: CorrectionContext
): void {
  const hostname = window.location.hostname;
  const metrics = getOrCreateMetrics(hostname);
  
  switch (type) {
    case 'FIX_CLICKED':
      if (context.previousConfidence === 'HIGH' || context.previousConfidence === 'MEDIUM') {
        metrics.userFixedAfterMediumHigh++;
      }
      break;
      
    case 'RESELECTED':
      metrics.userReselectedPrice++;
      break;
      
    case 'OVERRIDE_CREATED':
      metrics.userOverrideCreatedRecently++;
      break;
  }
  
  saveMetrics(hostname, metrics);
}

// Track comparison mismatches
function recordComparisonResult(
  session: CompareSession,
  gateResults: ComparisonGateResult
): void {
  const hostname = session.portalHostname;
  const metrics = getOrCreateMetrics(hostname);
  
  const totalComparisons = metrics.totalComparisons || 0;
  
  if (gateResults.blockedBy === 'FINGERPRINT') {
    metrics.fingerprintMismatchRate = updateRollingRate(
      metrics.fingerprintMismatchRate,
      totalComparisons,
      1
    );
  }
  
  if (gateResults.blockedBy === 'SEMANTIC') {
    metrics.semanticIncompatibilityRate = updateRollingRate(
      metrics.semanticIncompatibilityRate,
      totalComparisons,
      1
    );
  }
  
  if (gateResults.blockedBy === 'CURRENCY') {
    metrics.currencyMismatchRate = updateRollingRate(
      metrics.currencyMismatchRate,
      totalComparisons,
      1
    );
  }
  
  metrics.totalComparisons = totalComparisons + 1;
  saveMetrics(hostname, metrics);
}

// Track sanity check failures during extraction
function recordSanityCheck(
  check: 'OUT_OF_RANGE' | 'VOLATILE' | 'MULTIPLE_HIGH',
  hostname: string
): void {
  const metrics = getOrCreateMetrics(hostname);
  const totalExtractions = metrics.totalExtractions || 0;
  
  switch (check) {
    case 'OUT_OF_RANGE':
      metrics.priceOutOfRangeRate = updateRollingRate(
        metrics.priceOutOfRangeRate, totalExtractions, 1
      );
      break;
      
    case 'VOLATILE':
      metrics.priceVolatilityRate = updateRollingRate(
        metrics.priceVolatilityRate, totalExtractions, 1
      );
      break;
      
    case 'MULTIPLE_HIGH':
      metrics.multipleHighConfidenceRate = updateRollingRate(
        metrics.multipleHighConfidenceRate, totalExtractions, 1
      );
      break;
  }
  
  saveMetrics(hostname, metrics);
}
```

#### C.11.4 Ground Truth Score Calculation

```typescript
function calculateGroundTruthScore(
  metrics: GroundTruthProxyMetrics,
  basicHealth: ExtractionHealth
): number {
  // Start with basic success rate
  let score = basicHealth.successRate;
  
  // === Deductions for user corrections ===
  // Each correction is a strong signal we got it wrong
  const correctionPenalty = (
    metrics.userFixedAfterMediumHigh * 5 +  // Severe: user fixed "confident" extraction
    metrics.userReselectedPrice * 3 +        // Moderate: user preferred manual
    metrics.userOverrideCreatedRecently * 2  // Mild: override creation
  );
  score -= Math.min(correctionPenalty, 30);  // Cap at -30
  
  // === Deductions for comparison failures ===
  const comparisonPenalty = (
    metrics.fingerprintMismatchRate * 20 +      // 20% penalty if fingerprints fail often
    metrics.semanticIncompatibilityRate * 15 +  // 15% for semantic mismatches
    metrics.currencyMismatchRate * 25           // 25% for currency issues
  );
  score -= comparisonPenalty;
  
  // === Deductions for sanity failures ===
  const sanityPenalty = (
    metrics.priceOutOfRangeRate * 10 +
    metrics.priceVolatilityRate * 15 +
    metrics.multipleHighConfidenceRate * 10
  );
  score -= sanityPenalty;
  
  // === Deductions for abandonment ===
  const abandonmentPenalty = (
    metrics.comparisonAbortRate * 5 +
    metrics.pickerCancelRate * 3
  );
  score -= abandonmentPenalty;
  
  return Math.max(0, Math.min(100, score));
}
```

#### C.11.5 Using Ground Truth Score

```typescript
function isSiteTrulyDegraded(hostname: string): DegradationAssessment {
  const basicHealth = getSiteHealth(hostname);
  const proxyMetrics = getGroundTruthMetrics(hostname);
  
  const groundTruthScore = calculateGroundTruthScore(proxyMetrics, basicHealth);
  
  // Compare basic vs ground truth
  const scoreGap = basicHealth.successRate - groundTruthScore;
  
  if (scoreGap > 20) {
    // Danger: basic metrics look good but ground truth is bad
    // System is "confidently wrong"
    return {
      status: 'CONFIDENTLY_WRONG',
      basicScore: basicHealth.successRate,
      groundTruthScore,
      recommendation: 'Disable auto-extraction, require manual picker',
    };
  }
  
  if (groundTruthScore < 50) {
    return {
      status: 'DEGRADED',
      basicScore: basicHealth.successRate,
      groundTruthScore,
      recommendation: 'Update selectors or add to known-broken list',
    };
  }
  
  if (groundTruthScore < 70) {
    return {
      status: 'MARGINAL',
      basicScore: basicHealth.successRate,
      groundTruthScore,
      recommendation: 'Monitor closely, may need intervention',
    };
  }
  
  return {
    status: 'HEALTHY',
    basicScore: basicHealth.successRate,
    groundTruthScore,
    recommendation: null,
  };
}
```

---

### C.12 Hard-Ceiling Disqualifiers

**⚠️ CRITICAL: Disqualifying qualifiers MUST cap confidence across ALL tiers, including stability promotion.**

#### C.12.1 The Problem

Current behavior allows confidence promotion:
- Tier 1 selector finds per-night price → LOW confidence
- Price is stable for 700ms → Promoted to MEDIUM
- Multiple anchors found → Promoted to HIGH

**This is WRONG.** A per-night price is NEVER the total, regardless of stability or anchor count.

Sites exploit this with:
- Sticky per-night prices in headers (stable, prominent)
- "From $X/night" with strong visual styling (high score)
- Per-person pricing displayed prominently

#### C.12.2 Disqualifier Categories

```typescript
type DisqualifyingQualifier =
  | 'PER_NIGHT'           // "/night", "per night", "nightly"
  | 'PER_PERSON'          // "per person", "each", "per traveler"
  | 'PER_ROOM'            // "per room", "room rate"
  | 'FROM_PREFIX'         // "from $X", "starting at"
  | 'TAXES_EXTRA'         // "before taxes", "plus taxes", "+ fees"
  | 'POINTS_ONLY'         // "miles", "points" (not cash)
  | 'SAVINGS_NOT_PRICE'   // "save $X", "savings"
  | 'DEPOSIT_ONLY';       // "due today", "deposit"

interface DisqualifierRule {
  qualifier: DisqualifyingQualifier;
  patterns: RegExp[];
  maxAllowedConfidence: ConfidenceLevel;
  canBeOverriddenByIntent: boolean;  // e.g., checkout intent might allow
  warningMessage: string;
}

const DISQUALIFIER_RULES: DisqualifierRule[] = [
  {
    qualifier: 'PER_NIGHT',
    patterns: [
      /\bper\s*night\b/i,
      /\/\s*night\b/i,
      /\bnightly\b/i,
      /\beach\s*night\b/i,
    ],
    maxAllowedConfidence: 'LOW',
    canBeOverriddenByIntent: false,  // NEVER override
    warningMessage: 'Price appears to be per-night, not total',
  },
  {
    qualifier: 'PER_PERSON',
    patterns: [
      /\bper\s*person\b/i,
      /\bper\s*traveler\b/i,
      /\beach\b/i,
      /\bper\s*pax\b/i,
    ],
    maxAllowedConfidence: 'LOW',
    canBeOverriddenByIntent: false,
    warningMessage: 'Price appears to be per-person, not total',
  },
  {
    qualifier: 'FROM_PREFIX',
    patterns: [
      /\bfrom\s*\$/i,
      /\bstarting\s*(at|from)\b/i,
      /\bas\s*low\s*as\b/i,
    ],
    maxAllowedConfidence: 'LOW',
    canBeOverriddenByIntent: false,
    warningMessage: 'Price shows minimum, not actual booking total',
  },
  {
    qualifier: 'TAXES_EXTRA',
    patterns: [
      /\bbefore\s*tax/i,
      /\bplus\s*tax/i,
      /\+\s*tax/i,
      /\bexcluding\s*(tax|fee)/i,
    ],
    maxAllowedConfidence: 'MEDIUM',  // Can be MEDIUM if we have taxes separately
    canBeOverriddenByIntent: true,   // Checkout might show both
    warningMessage: 'Price excludes taxes/fees',
  },
  {
    qualifier: 'SAVINGS_NOT_PRICE',
    patterns: [
      /\bsav(e|ing)\b/i,
      /\bdiscount\b/i,
      /\byou\s*save\b/i,
    ],
    maxAllowedConfidence: 'NONE',  // NEVER extract savings as price
    canBeOverriddenByIntent: false,
    warningMessage: 'This appears to be a savings amount, not a price',
  },
];
```

#### C.12.3 Enforcement Points

```typescript
// Enforcement Point 1: During Initial Scoring
function scoreCandidate(element: HTMLElement): ScoredCandidate {
  const text = element.textContent || '';
  const nearbyText = getNearbyText(element, 100);
  const combinedText = `${text} ${nearbyText}`;
  
  // Check disqualifiers FIRST
  const disqualifier = detectDisqualifier(combinedText);
  
  let score = calculateBaseScore(element);
  
  if (disqualifier) {
    // Apply heavy penalty
    score += SCORING.DISQUALIFYING_QUALIFIER;  // e.g., -50
  }
  
  return {
    element,
    text,
    score,
    hasDisqualifyingQualifier: !!disqualifier,
    disqualifierType: disqualifier?.qualifier,
    maxAllowedConfidence: disqualifier?.maxAllowedConfidence || 'HIGH',
    // ...
  };
}

// Enforcement Point 2: During Confidence Determination
function determineConfidence(candidate: ScoredCandidate): ConfidenceLevel {
  // Calculate raw confidence from anchors/score
  const rawConfidence = calculateRawConfidence(candidate);
  
  // HARD CEILING ENFORCEMENT
  if (candidate.hasDisqualifyingQualifier) {
    const ceiling = candidate.maxAllowedConfidence;
    
    // Raw confidence can NEVER exceed ceiling
    if (confidenceOrder(rawConfidence) > confidenceOrder(ceiling)) {
      return ceiling;
    }
  }
  
  return rawConfidence;
}

function confidenceOrder(level: ConfidenceLevel): number {
  return { 'NONE': 0, 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 }[level];
}

// Enforcement Point 3: During Stability Promotion
function promoteConfidenceForStability(
  result: ExtractionResult,
  stabilityInfo: StabilityInfo
): ConfidenceLevel {
  // Get candidate info
  const candidate = result.debugInfo?.candidate as ScoredCandidate;
  
  // HARD CEILING: Cannot promote past disqualifier ceiling
  if (candidate?.hasDisqualifyingQualifier) {
    // NO PROMOTION regardless of stability
    return result.confidence;
  }
  
  // Normal promotion logic for non-disqualified prices
  if (stabilityInfo.stableReadCount >= 2 && stabilityInfo.durationMs >= 700) {
    return promoteOneLevel(result.confidence);
  }
  
  return result.confidence;
}

// Enforcement Point 4: During Tier Fallback
function mergeTierResults(results: ExtractionResult[]): ExtractionResult {
  // Even when merging, disqualifier ceiling applies
  const best = results.reduce((a, b) =>
    compareResults(a, b) > 0 ? a : b
  );
  
  const candidate = best.debugInfo?.candidate as ScoredCandidate;
  
  if (candidate?.hasDisqualifyingQualifier) {
    // Re-enforce ceiling in case of merge confusion
    best.confidence = enforceConfidenceCeiling(
      best.confidence,
      candidate.maxAllowedConfidence
    );
  }
  
  return best;
}
```

#### C.12.4 Exception: Total-Computed Prices

The only exception is when we explicitly compute a total:

```typescript
function handlePerUnitExtraction(
  candidate: ScoredCandidate,
  pageContext: PageContext
): ExtractionResult {
  // Per-unit detected
  if (!candidate.hasDisqualifyingQualifier) {
    return standardExtraction(candidate);
  }
  
  // Try to compute total
  const unitCount = extractUnitCount(pageContext);
  
  if (unitCount && candidate.disqualifierType === 'PER_NIGHT') {
    const nights = unitCount;
    const perNightPrice = candidate.parsedMoney.money;
    const total = perNightPrice.amount * nights;
    
    // Computed total CAN have higher confidence, but with explicit labeling
    return {
      success: true,
      price: {
        amount: total,
        currency: perNightPrice.currency,
        formatted: formatMoney(total, perNightPrice.currency),
        raw: `${perNightPrice.raw} × ${nights} nights`,
      },
      confidence: 'MEDIUM',  // Still not HIGH - computation could be wrong
      method: 'HEURISTIC_COMPUTED',
      priceBreakdown: {
        extractedField: 'PER_UNIT_RATE',
        isPerUnit: true,
        unitType: 'night',
        unitCount: nights,
        total: { /* computed */ },
        // ...
      },
      warnings: ['Total computed from per-night rate × nights'],
    };
  }
  
  // Cannot compute - return LOW confidence
  return {
    ...standardExtraction(candidate),
    confidence: candidate.maxAllowedConfidence,  // LOW
  };
}
```

---

### C.13 Ambiguity-Aware Confidence

**⚠️ CRITICAL: Close score gaps between top candidates MUST reduce confidence.**

#### C.13.1 The Problem

Current logic:
- Top candidate scores 75 → HIGH confidence
- Second candidate scores 72 → Not considered

This is wrong because:
- 3-point gap is within noise margin
- Either could be "the right" price
- We're arbitrarily picking one with HIGH confidence

#### C.13.2 Gap-Based Confidence Penalty

```typescript
interface AmbiguityAssessment {
  isAmbiguous: boolean;
  topScore: number;
  runnerUpScore: number;
  gap: number;
  gapPenalty: ConfidencePenalty;
  affectedConfidence: ConfidenceLevel;
}

type ConfidencePenalty = 'NONE' | 'ONE_LEVEL' | 'TWO_LEVELS' | 'BLOCK';

const AMBIGUITY_THRESHOLDS = {
  // Gap below which we consider results ambiguous
  ambiguityThreshold: 10,
  
  // Penalty tiers
  severeGap: 5,      // Gap < 5 → drop 2 levels
  moderateGap: 10,   // Gap < 10 → drop 1 level
  safeGap: 15,       // Gap >= 15 → no penalty
  
  // Score floor for considering ambiguity
  minimumScoreForAmbiguity: 20,  // Don't penalize if both scores are garbage
};

function assessAmbiguity(candidates: ScoredCandidate[]): AmbiguityAssessment {
  // Must have at least 2 candidates
  if (candidates.length < 2) {
    return {
      isAmbiguous: false,
      topScore: candidates[0]?.score || 0,
      runnerUpScore: 0,
      gap: Infinity,
      gapPenalty: 'NONE',
      affectedConfidence: 'HIGH',
    };
  }
  
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const runnerUp = sorted[1];
  
  const gap = top.score - runnerUp.score;
  
  // Not ambiguous if runner-up has garbage score
  if (runnerUp.score < AMBIGUITY_THRESHOLDS.minimumScoreForAmbiguity) {
    return {
      isAmbiguous: false,
      topScore: top.score,
      runnerUpScore: runnerUp.score,
      gap,
      gapPenalty: 'NONE',
      affectedConfidence: 'HIGH',
    };
  }
  
  // Calculate penalty based on gap
  let gapPenalty: ConfidencePenalty;
  
  if (gap < AMBIGUITY_THRESHOLDS.severeGap) {
    gapPenalty = 'TWO_LEVELS';  // HIGH → LOW
  } else if (gap < AMBIGUITY_THRESHOLDS.moderateGap) {
    gapPenalty = 'ONE_LEVEL';   // HIGH → MEDIUM, MEDIUM → LOW
  } else if (gap < AMBIGUITY_THRESHOLDS.safeGap) {
    gapPenalty = 'NONE';        // But still flag as ambiguous
  } else {
    gapPenalty = 'NONE';
  }
  
  const isAmbiguous = gap < AMBIGUITY_THRESHOLDS.safeGap;
  
  return {
    isAmbiguous,
    topScore: top.score,
    runnerUpScore: runnerUp.score,
    gap,
    gapPenalty,
    affectedConfidence: applyPenalty('HIGH', gapPenalty),
  };
}

function applyPenalty(
  baseConfidence: ConfidenceLevel,
  penalty: ConfidencePenalty
): ConfidenceLevel {
  const levels: ConfidenceLevel[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH'];
  const currentIndex = levels.indexOf(baseConfidence);
  
  switch (penalty) {
    case 'NONE':
      return baseConfidence;
    case 'ONE_LEVEL':
      return levels[Math.max(0, currentIndex - 1)];
    case 'TWO_LEVELS':
      return levels[Math.max(0, currentIndex - 2)];
    case 'BLOCK':
      return 'NONE';
  }
}
```

#### C.13.3 Integration with Extraction

```typescript
function extractPriceHeuristically(): ExtractionResult {
  // Step 1: Find and score candidates
  const candidates = findPriceCandidates(document.body);
  const scoredCandidates = candidates
    .map(el => scoreCandidate(el))
    .filter(c => c.parsedMoney.success);
  
  // Step 2: De-duplicate (C.8)
  const clusters = deduplicateCandidates(scoredCandidates);
  const uniqueCandidates = clusters.map(c => c.canonicalCandidate);
  
  // Step 3: Assess ambiguity
  const ambiguity = assessAmbiguity(uniqueCandidates);
  
  // Step 4: Select top candidate
  const sorted = uniqueCandidates.sort((a, b) => b.score - a.score);
  const topCandidate = sorted[0];
  
  if (!topCandidate) {
    return createFailedResult('No candidates found');
  }
  
  // Step 5: Calculate base confidence
  let confidence = determineConfidence(topCandidate);
  
  // Step 6: Apply ambiguity penalty
  if (ambiguity.isAmbiguous && ambiguity.gapPenalty !== 'NONE') {
    const penalizedConfidence = applyPenalty(confidence, ambiguity.gapPenalty);
    
    console.log(
      `[Ambiguity] Gap=${ambiguity.gap}, ` +
      `Penalty=${ambiguity.gapPenalty}, ` +
      `${confidence} → ${penalizedConfidence}`
    );
    
    confidence = penalizedConfidence;
  }
  
  // Step 7: Build result with ambiguity info
  return {
    success: true,
    price: topCandidate.parsedMoney.money,
    confidence,
    method: 'HEURISTIC',
    evidence: topCandidate.anchorEvidence,
    debugInfo: {
      candidate: topCandidate,
      ambiguity,
      runnerUp: sorted[1] || null,
    },
    warnings: ambiguity.isAmbiguous
      ? [`Multiple similar prices found (gap: ${ambiguity.gap.toFixed(1)})`]
      : [],
  };
}
```

#### C.13.4 User Communication

When ambiguity is detected, show user a dialog:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ⚠️ MULTIPLE PRICES DETECTED                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  We found two similar prices on this page:                              │
│                                                                         │
│  →  $1,234.56  (selected)                                               │
│      Found near "Total" label                                           │
│                                                                         │
│  →  $1,189.00  (alternative)                                            │
│      Found near "Subtotal" label                                        │
│                                                                         │
│  Please verify you're comparing the correct total price.               │
│                                                                         │
│  [ Use $1,234.56 ]    [ Use $1,189.00 ]    [ Select Manually ]          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### C.14 Page Intent Classifier

**⚠️ CRITICAL: Page intent (checkout vs search vs details) MUST gate what prices are valid.**

#### C.14.1 The Problem

Current extraction treats all pages equally. But:

- **Search page**: Prices are listings, not bookable totals
- **Details page**: Price may be "starting at" or per-night
- **Checkout page**: Price should be final total

Extracting "THE price" from a search results page is inherently wrong, even if technically accurate.

#### C.14.2 Page Intent Types

```typescript
type PageIntent =
  | 'CHECKOUT'        // Final booking page with total
  | 'PAYMENT'         // Payment entry (subset of checkout)
  | 'BOOKING_SUMMARY' // Review before payment
  | 'DETAILS'         // Single property/flight details
  | 'SEARCH'          // Search results listing
  | 'LANDING'         // Homepage, marketing page
  | 'UNKNOWN';

interface PageIntentClassification {
  intent: PageIntent;
  confidence: number;  // 0-100
  signals: IntentSignal[];
  extractionPolicy: ExtractionPolicy;
}

interface ExtractionPolicy {
  allowAutoExtraction: boolean;
  maxAllowedConfidence: ConfidenceLevel;
  requiresUserConfirmation: boolean;
  validPriceFields: ExtractedPriceField[];
  warningMessage?: string;
}

const INTENT_POLICIES: Record<PageIntent, ExtractionPolicy> = {
  'CHECKOUT': {
    allowAutoExtraction: true,
    maxAllowedConfidence: 'HIGH',
    requiresUserConfirmation: false,
    validPriceFields: ['TOTAL_ALL_IN', 'TOTAL_BEFORE_TAXES'],
  },
  'PAYMENT': {
    allowAutoExtraction: true,
    maxAllowedConfidence: 'HIGH',
    requiresUserConfirmation: false,
    validPriceFields: ['TOTAL_ALL_IN', 'DUE_NOW_PARTIAL'],
  },
  'BOOKING_SUMMARY': {
    allowAutoExtraction: true,
    maxAllowedConfidence: 'HIGH',
    requiresUserConfirmation: false,
    validPriceFields: ['TOTAL_ALL_IN', 'TOTAL_BEFORE_TAXES'],
  },
  'DETAILS': {
    allowAutoExtraction: true,
    maxAllowedConfidence: 'MEDIUM',  // Cap at MEDIUM
    requiresUserConfirmation: false,
    validPriceFields: ['TOTAL_ALL_IN', 'PER_UNIT_RATE'],
    warningMessage: 'Price may not include all fees until checkout',
  },
  'SEARCH': {
    allowAutoExtraction: false,  // Do NOT auto-extract
    maxAllowedConfidence: 'LOW',
    requiresUserConfirmation: true,
    validPriceFields: [],
    warningMessage: 'This appears to be a search results page. Navigate to checkout for accurate total.',
  },
  'LANDING': {
    allowAutoExtraction: false,
    maxAllowedConfidence: 'NONE',
    requiresUserConfirmation: true,
    validPriceFields: [],
    warningMessage: 'Cannot extract prices from landing pages',
  },
  'UNKNOWN': {
    allowAutoExtraction: true,
    maxAllowedConfidence: 'MEDIUM',  // Conservative
    requiresUserConfirmation: false,
    validPriceFields: ['TOTAL_ALL_IN', 'TOTAL_BEFORE_TAXES', 'PER_UNIT_RATE'],
    warningMessage: 'Page type unknown - verify price is the booking total',
  },
};
```

#### C.14.3 Intent Classification Algorithm

```typescript
interface IntentSignal {
  type: string;
  weight: number;
  description: string;
}

function classifyPageIntent(): PageIntentClassification {
  const signals: IntentSignal[] = [];
  const scores: Record<PageIntent, number> = {
    'CHECKOUT': 0, 'PAYMENT': 0, 'BOOKING_SUMMARY': 0,
    'DETAILS': 0, 'SEARCH': 0, 'LANDING': 0, 'UNKNOWN': 0,
  };
  
  // Signal 1: URL patterns
  const url = window.location.href.toLowerCase();
  
  if (/checkout|payment|pay|purchase|book-now/i.test(url)) {
    scores['CHECKOUT'] += 40;
    signals.push({ type: 'URL_CHECKOUT', weight: 40, description: 'URL contains checkout keywords' });
  }
  
  if (/review|summary|confirm/i.test(url)) {
    scores['BOOKING_SUMMARY'] += 35;
    signals.push({ type: 'URL_SUMMARY', weight: 35, description: 'URL contains summary keywords' });
  }
  
  if (/search|results|flights|hotels\?/i.test(url)) {
    scores['SEARCH'] += 45;
    signals.push({ type: 'URL_SEARCH', weight: 45, description: 'URL indicates search results' });
  }
  
  // Signal 2: DOM structure
  const hasPaymentForm = !!document.querySelector(
    'form[action*="pay"], input[name*="card"], input[type="cc-number"]'
  );
  if (hasPaymentForm) {
    scores['PAYMENT'] += 50;
    signals.push({ type: 'PAYMENT_FORM', weight: 50, description: 'Payment form detected' });
  }
  
  // Search indicators
  const resultCards = document.querySelectorAll(
    '[class*="result"], [class*="listing"], [class*="offer-card"]'
  );
  if (resultCards.length > 3) {
    scores['SEARCH'] += 40;
    signals.push({ type: 'RESULT_CARDS', weight: 40, description: `${resultCards.length} result cards found` });
  }
  
  const hasFilters = !!document.querySelector('[class*="filter"], [class*="sort"]');
  if (hasFilters) {
    scores['SEARCH'] += 20;
    signals.push({ type: 'FILTERS', weight: 20, description: 'Search filters detected' });
  }
  
  // Determine winner
  const entries = Object.entries(scores) as [PageIntent, number][];
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const [topIntent, topScore] = sorted[0];
  const [runnerUp, runnerUpScore] = sorted[1] || ['UNKNOWN', 0];
  
  const gap = topScore - runnerUpScore;
  const confidence = Math.min(100, topScore + gap);
  const intent = topScore < 20 ? 'UNKNOWN' : topIntent;
  
  return {
    intent,
    confidence,
    signals,
    extractionPolicy: INTENT_POLICIES[intent],
  };
}
```

#### C.14.4 Integration with Pipeline

```typescript
async function runExtractionPipeline(options: PipelineOptions): Promise<PipelineResult> {
  // STEP 0: Classify page intent (FIRST, before any extraction)
  const intentClassification = classifyPageIntent();
  const policy = intentClassification.extractionPolicy;
  
  // Gate 1: Should we even try auto-extraction?
  if (!policy.allowAutoExtraction && !options.forceExtraction) {
    return {
      success: false,
      price: null,
      confidence: 'NONE',
      method: 'BLOCKED',
      tier: 'NONE',
      warnings: [policy.warningMessage || 'Extraction not allowed on this page type'],
      debugInfo: { pageIntent: intentClassification, blockedReason: 'PAGE_INTENT_POLICY' },
    };
  }
  
  // Normal extraction proceeds...
  const result = await runTieredExtraction(options);
  
  // Gate 2: Apply confidence ceiling from intent
  if (confidenceOrder(result.confidence) > confidenceOrder(policy.maxAllowedConfidence)) {
    result.confidence = policy.maxAllowedConfidence;
    result.warnings.push(
      `Confidence capped at ${policy.maxAllowedConfidence} due to page type (${intentClassification.intent})`
    );
  }
  
  // Attach intent to result
  result.debugInfo = { ...result.debugInfo, pageIntent: intentClassification };
  
  return result;
}
```

---

### C.15 Fixture-Based DOM Regression Suite

**⚠️ CRITICAL: Save HTML snapshots for known problematic layouts and lock in behavior.**

#### C.15.1 The Problem

Testing is concentrated in parseMoney unit tests. Real failure modes are:
- Heuristic candidate scoring on complex DOMs
- Class name changes breaking selectors
- Shadow DOM / iframe edge cases
- SPA navigation timing

We need **fixture-based DOM tests** that catch regressions before production.

#### C.15.2 Fixture Strategy

```typescript
// Fixture file structure:
// fixtures/
//   google-flights/
//     checkout-2026-01-15.html
//     checkout-2026-01-15.meta.json
//   delta/
//     checkout-basic-economy-2026-01-10.html
//     checkout-basic-economy-2026-01-10.meta.json

interface FixtureMetadata {
  name: string;
  source: string;           // e.g., "google-flights-checkout"
  capturedAt: string;       // ISO date
  knownIssues?: string[];   // What this fixture tests
  expectedPrice: { amount: number; currency: string };
  expectedConfidence: ConfidenceLevel;
  expectedMethod: ExtractionMethod;
}
```

#### C.15.3 Fixture Capture Script

```typescript
// scripts/capture-fixture.ts
async function captureFixture(metadata: Partial<FixtureMetadata>): Promise<void> {
  const html = document.documentElement.outerHTML;
  
  // Redact PII before saving (C.6)
  const redactedHtml = redactDomSnapshot(document.documentElement, {
    ...DEFAULT_REDACTION_CONFIG,
    stripFormInputValues: true,
    redactEmailPatterns: true,
  });
  
  // Run extraction to capture expected values
  const result = await runExtractionPipeline();
  
  const fullMetadata: FixtureMetadata = {
    name: metadata.name || `${window.location.hostname}-${Date.now()}`,
    source: window.location.hostname,
    capturedAt: new Date().toISOString(),
    knownIssues: metadata.knownIssues || [],
    expectedPrice: result.price ? {
      amount: result.price.amount,
      currency: result.price.currency,
    } : { amount: 0, currency: 'USD' },
    expectedConfidence: result.confidence,
    expectedMethod: result.method,
  };
  
  downloadFile(`${fullMetadata.name}.html`, redactedHtml);
  downloadFile(`${fullMetadata.name}.meta.json`, JSON.stringify(fullMetadata, null, 2));
}
```

#### C.15.4 Fixture Test Runner

```typescript
// test/extraction/fixtures.test.ts
import { JSDOM } from 'jsdom';

describe('Extraction Fixture Tests', () => {
  const fixtures = loadFixtures('./test/fixtures');
  
  fixtures.forEach(({ name, html, metadata }) => {
    describe(name, () => {
      let dom: JSDOM;
      
      beforeEach(() => {
        dom = new JSDOM(html, { url: `https://${metadata.source}/checkout` });
        (global as any).document = dom.window.document;
        (global as any).window = dom.window;
      });
      
      afterEach(() => { dom.window.close(); });
      
      it('extracts expected price', async () => {
        const result = await runExtractionPipeline();
        expect(result.price?.amount).toBe(metadata.expectedPrice.amount);
        expect(result.price?.currency).toBe(metadata.expectedPrice.currency);
      });
      
      it('achieves expected confidence', async () => {
        const result = await runExtractionPipeline();
        expect(result.confidence).toBe(metadata.expectedConfidence);
      });
    });
  });
});
```

#### C.15.5 Fixture Update Workflow

When extraction logic intentionally changes:

```bash
# 1. Run extraction on live sites to verify new behavior
npm run capture-fixtures

# 2. Review changes to expected values
git diff test/fixtures/

# 3. Update metadata if behavior is intentionally different
# Edit .meta.json files as needed

# 4. Run fixture tests
npm run test:fixtures

# 5. Commit fixture updates with explanation
git add test/fixtures/
git commit -m "Update fixtures for new per-night detection logic"
```

---

### C.16 Locale Lexicon Support

**⚠️ CRITICAL: English-centric anchor labels fail on non-EN locales.**

#### C.16.1 The Problem

Current heuristics search for:
- "total", "grand total", "amount due"
- "per night", "nightly"
- "checkout", "book now"

But international users see:
- French: "total", "montant total", "par nuit"
- German: "Gesamtbetrag", "pro Nacht", "Buchung"
- Spanish: "total", "precio total", "por noche"
- Arabic: "المجموع", "لكل ليلة"

Missing these means falling back to picker constantly.

#### C.16.2 Locale Lexicon Structure

```typescript
interface LocaleLexicon {
  locale: string;           // ISO 639-1 (e.g., "de", "fr")
  totalKeywords: string[];
  perNightKeywords: string[];
  perPersonKeywords: string[];
  fromKeywords: string[];
  checkoutKeywords: string[];
  taxesFeesKeywords: string[];
}

const LOCALE_LEXICONS: LocaleLexicon[] = [
  // English (default)
  {
    locale: 'en',
    totalKeywords: ['total', 'grand total', 'amount due', 'trip total', 'total price'],
    perNightKeywords: ['per night', '/night', 'nightly', 'each night', 'avg/night'],
    perPersonKeywords: ['per person', 'per traveler', 'each', 'per guest', 'pp'],
    fromKeywords: ['from', 'starting at', 'as low as', 'prices from'],
    checkoutKeywords: ['checkout', 'book now', 'continue', 'reserve', 'confirm'],
    taxesFeesKeywords: ['taxes', 'fees', 'tax', 'service fee', 'resort fee'],
  },
  // French
  {
    locale: 'fr',
    totalKeywords: ['total', 'montant total', 'total à payer', 'prix total', 'coût total'],
    perNightKeywords: ['par nuit', '/nuit', 'la nuit', 'nuitée'],
    perPersonKeywords: ['par personne', 'par voyageur', 'par adulte'],
    fromKeywords: ['à partir de', 'dès', 'depuis'],
    checkoutKeywords: ['réserver', 'confirmer', 'paiement', 'finaliser'],
    taxesFeesKeywords: ['taxes', 'frais', 'taxe de séjour', 'frais de service'],
  },
  // German
  {
    locale: 'de',
    totalKeywords: ['Gesamtbetrag', 'Gesamtpreis', 'Summe', 'Total', 'Endbetrag'],
    perNightKeywords: ['pro Nacht', '/Nacht', 'je Nacht', 'Nacht'],
    perPersonKeywords: ['pro Person', 'je Person', 'pro Erwachsener'],
    fromKeywords: ['ab', 'von', 'Preise ab'],
    checkoutKeywords: ['Buchung', 'Buchen', 'Jetzt buchen', 'Weiter', 'Reservieren'],
    taxesFeesKeywords: ['Steuern', 'Gebühren', 'inklusive Steuern'],
  },
  // Spanish
  {
    locale: 'es',
    totalKeywords: ['total', 'precio total', 'importe total', 'monto total'],
    perNightKeywords: ['por noche', '/noche', 'la noche'],
    perPersonKeywords: ['por persona', 'por viajero', 'por adulto'],
    fromKeywords: ['desde', 'a partir de'],
    checkoutKeywords: ['reservar', 'confirmar', 'finalizar', 'pagar'],
    taxesFeesKeywords: ['impuestos', 'tasas', 'cargos'],
  },
  // Arabic
  {
    locale: 'ar',
    totalKeywords: ['المجموع', 'الإجمالي', 'المبلغ الإجمالي'],
    perNightKeywords: ['لكل ليلة', '/ليلة', 'في الليلة'],
    perPersonKeywords: ['للشخص', 'لكل شخص'],
    fromKeywords: ['من', 'ابتداءً من'],
    checkoutKeywords: ['احجز', 'تأكيد', 'إتمام الحجز'],
    taxesFeesKeywords: ['الضرائب', 'الرسوم'],
  },
  // Japanese
  {
    locale: 'ja',
    totalKeywords: ['合計', '総額', 'お支払い金額', '料金合計'],
    perNightKeywords: ['1泊', '/泊', '泊あたり'],
    perPersonKeywords: ['1名', '1人あたり', '大人1名'],
    fromKeywords: ['から', '〜'],
    checkoutKeywords: ['予約', '確認', '購入', '次へ'],
    taxesFeesKeywords: ['税', '税込', 'サービス料'],
  },
];
```

#### C.16.3 Locale Detection

```typescript
function detectPageLocale(): string {
  // Priority 1: HTML lang attribute
  const htmlLang = document.documentElement.lang;
  if (htmlLang) {
    const baseLang = htmlLang.split('-')[0].toLowerCase();
    if (LOCALE_LEXICONS.some(l => l.locale === baseLang)) return baseLang;
  }
  
  // Priority 2: URL TLD hints
  const hostname = window.location.hostname;
  const tldMap: Record<string, string> = {
    '.de': 'de', '.fr': 'fr', '.es': 'es', '.jp': 'ja', '.ae': 'ar',
  };
  for (const [tld, locale] of Object.entries(tldMap)) {
    if (hostname.endsWith(tld)) return locale;
  }
  
  // Priority 3: Browser language
  const browserLang = navigator.language?.split('-')[0].toLowerCase();
  if (browserLang && LOCALE_LEXICONS.some(l => l.locale === browserLang)) return browserLang;
  
  return 'en';  // Default to English
}

function getLexicon(locale?: string): LocaleLexicon {
  const detectedLocale = locale || detectPageLocale();
  return LOCALE_LEXICONS.find(l => l.locale === detectedLocale)
    || LOCALE_LEXICONS.find(l => l.locale === 'en')!;
}
```

#### C.16.4 Integration with Heuristics

```typescript
function scoreCandidate(element: HTMLElement): ScoredCandidate {
  const lexicon = getLexicon();
  const combinedText = `${element.textContent} ${getNearbyText(element, 100)}`.toLowerCase();
  
  let score = 0;
  const signals: SignalMatch[] = [];
  
  // Total keyword detection (multilingual)
  for (const keyword of lexicon.totalKeywords) {
    if (combinedText.includes(keyword.toLowerCase())) {
      score += SCORING.TOTAL_KEYWORD_ADJACENT;
      signals.push({ type: 'TOTAL_KEYWORD', value: SCORING.TOTAL_KEYWORD_ADJACENT, description: `"${keyword}" nearby` });
      break;
    }
  }
  
  // Per-night detection (multilingual)
  for (const keyword of lexicon.perNightKeywords) {
    if (combinedText.includes(keyword.toLowerCase())) {
      score += SCORING.PER_NIGHT_QUALIFIER;  // Negative
      signals.push({ type: 'PER_NIGHT_QUALIFIER', value: SCORING.PER_NIGHT_QUALIFIER, description: `"${keyword}" nearby` });
      break;
    }
  }
  
  // ... rest of scoring
  return { element, score, signals, locale: lexicon.locale, /* ... */ };
}
```

---

### C.17 Unreachable Environment UX

**⚠️ CRITICAL: When we CAN'T reach the price, tell the user clearly.**

#### C.17.1 The Problem

Some environments are fundamentally inaccessible:
- **Closed Shadow DOM**: Cannot pierce closed shadow roots
- **Cross-origin iframes**: Security prevents access
- **Bot walls**: CAPTCHAs, behavioral detection
- **Heavy obfuscation**: React Native WebView, encrypted content

Current behavior: silently fail, user wonders why picker never works.

#### C.17.2 Detection Functions

```typescript
interface UnreachableEnvironment {
  type: UnreachableType;
  detected: boolean;
  confidence: number;
  userMessage: string;
  suggestedAction: UserAction;
}

type UnreachableType = 'CLOSED_SHADOW_DOM' | 'CROSS_ORIGIN_IFRAME' | 'BOT_WALL' | 'DYNAMIC_RENDERING' | 'EMPTY_BODY';
type UserAction = 'USE_PICKER_ON_VISIBLE' | 'MANUAL_ENTRY' | 'REFRESH_PAGE' | 'TRY_DIFFERENT_BROWSER';

function detectUnreachableEnvironments(): UnreachableEnvironment[] {
  const environments: UnreachableEnvironment[] = [];
  
  // Detection 1: Cross-Origin Iframes
  const iframes = document.querySelectorAll('iframe');
  const crossOriginIframes = Array.from(iframes).filter(iframe => {
    try { iframe.contentDocument; return false; } catch { return true; }
  });
  
  const priceIframes = crossOriginIframes.filter(iframe => {
    const src = iframe.src || '';
    return /checkout|payment|booking|pay\./i.test(src);
  });
  
  if (priceIframes.length > 0) {
    environments.push({
      type: 'CROSS_ORIGIN_IFRAME',
      detected: true,
      confidence: 90,
      userMessage: 'The price is displayed in an embedded frame we cannot access.',
      suggestedAction: 'MANUAL_ENTRY',
    });
  }
  
  // Detection 2: Bot Wall / CAPTCHA
  const captchaIndicators = [
    document.querySelector('[class*="captcha"]'),
    document.querySelector('iframe[src*="recaptcha"]'),
    document.querySelector('iframe[src*="hcaptcha"]'),
  ].filter(Boolean);
  
  if (captchaIndicators.length > 0) {
    environments.push({
      type: 'BOT_WALL',
      detected: true,
      confidence: 95,
      userMessage: 'This page has a security check that blocks automated access.',
      suggestedAction: 'REFRESH_PAGE',
    });
  }
  
  // Detection 3: Empty/Loading Body
  const bodyText = document.body?.textContent?.trim() || '';
  if (bodyText.length < 100) {
    environments.push({
      type: 'EMPTY_BODY',
      detected: true,
      confidence: 70,
      userMessage: 'The page content has not loaded yet.',
      suggestedAction: 'REFRESH_PAGE',
    });
  }
  
  return environments;
}
```

#### C.17.3 User-Facing Messages

```typescript
function showUnreachableEnvironmentMessage(env: UnreachableEnvironment): void {
  const messages: Record<UnreachableType, { title: string; body: string; action: string }> = {
    'CLOSED_SHADOW_DOM': {
      title: '🔒 Protected Page Component',
      body: 'This site uses protected components that we cannot access directly.',
      action: 'Use the picker to click on the visible price, or enter the total manually.',
    },
    'CROSS_ORIGIN_IFRAME': {
      title: '📋 Embedded Booking Frame',
      body: 'The total price is displayed inside an embedded frame from another domain. Browser security prevents us from reading it.',
      action: 'Please enter the total price manually in the field below.',
    },
    'BOT_WALL': {
      title: '🤖 Security Check Detected',
      body: 'This page has an active security check (CAPTCHA) that is blocking our access.',
      action: 'Complete the security check, then refresh and try again.',
    },
    'EMPTY_BODY': {
      title: '⏳ Page Not Loaded',
      body: 'The page content hasn\'t fully loaded yet.',
      action: 'Wait a moment, then refresh the page.',
    },
    'DYNAMIC_RENDERING': {
      title: '⚠️ Page Rendering Issue',
      body: 'The page may not have rendered correctly, or is still loading.',
      action: 'Try refreshing the page. If the issue persists, use manual entry.',
    },
  };
  
  const msg = messages[env.type];
  
  showNotification({
    type: 'warning',
    title: msg.title,
    body: msg.body,
    action: msg.action,
    persistent: true,
    actions: [
      { label: 'Enter Manually', onClick: () => openManualEntry() },
      { label: 'Try Picker', onClick: () => activatePicker() },
      { label: 'Dismiss', onClick: () => dismissNotification() },
    ],
  });
}
```

#### C.17.4 Integration with Pipeline

```typescript
async function runExtractionPipeline(options: PipelineOptions): Promise<PipelineResult> {
  // STEP -1: Check for unreachable environments
  const unreachableEnvs = detectUnreachableEnvironments();
  const blockers = unreachableEnvs.filter(e => e.confidence >= 80);
  
  if (blockers.length > 0 && !options.ignoreEnvironmentWarnings) {
    const topBlocker = blockers.sort((a, b) => b.confidence - a.confidence)[0];
    showUnreachableEnvironmentMessage(topBlocker);
    
    return {
      success: false,
      price: null,
      confidence: 'NONE',
      method: 'BLOCKED',
      tier: 'NONE',
      warnings: [topBlocker.userMessage],
      debugInfo: { unreachableEnvironments: unreachableEnvs, blockedBy: topBlocker.type },
    };
  }
  
  // Proceed with normal extraction...
  const result = await runTieredExtraction(options);
  
  // If extraction failed and we detected potential issues, show helpful message
  if (!result.success && unreachableEnvs.length > 0) {
    const topIssue = unreachableEnvs.sort((a, b) => b.confidence - a.confidence)[0];
    showUnreachableEnvironmentMessage(topIssue);
  }
  
  return result;
}
```

---

## Appendix D: Changelog

### Version 1.3.0 (January 21, 2026)

**Added:**
- C.12: Hard-Ceiling Disqualifiers - per-night/from/per-person MUST cap confidence at LOW across ALL tiers
- C.13: Ambiguity-Aware Confidence - score gap < 5 drops 2 levels, gap < 10 drops 1 level
- C.14: Page Intent Classifier - checkout vs search vs details as first-class extraction gate
- C.15: Fixture-Based DOM Regression Suite - HTML snapshots for problematic layouts
- C.16: Locale Lexicon Support - multilingual anchor detection (EN, FR, DE, ES, AR, JA)
- C.17: Unreachable Environment UX - shadow DOM/iframe detection with user messaging

**Changed:**
- Enforced hard ceiling on confidence for disqualifying qualifiers at ALL pipeline stages
- Ambiguity penalty now applies after de-duplication to prevent false triggers
- Page intent classification runs BEFORE extraction, not after

### Version 1.2.0 (January 21, 2026)

**Added:**
- C.7: Triple-Gate Comparison Requirements - all comparisons gated on semantic + currency + fingerprint
- C.8: Candidate De-Duplication - prevents false ambiguity from duplicate price displays
- C.9: Picker Semantic Confirmation Flow - users must confirm price meaning, not just value
- C.10: Probabilistic Currency Detection - currency confidence as CERTAIN/PROBABLE/AMBIGUOUS
- C.11: Ground-Truth Proxy Health Metrics - tracks signals that correlate with actual correctness

**Fixed:**
- Version header drift (was 1.0.0, should be 1.1.0)

### Version 1.1.0 (January 21, 2026)

**Added:**
- C.1: Fingerprint Match Confidence Gating - prevents "correct price, wrong trip" failures
- C.2: Unified Price Semantics (PriceBreakdown model) - prevents "correct number, wrong meaning"
- C.3: Documentation-to-Code Synchronization - prevents drift between docs and implementation
- C.4: Tier 3 Throttling Strategy - performance guardrails for heuristic extraction
- C.5: Override Lifecycle & Context Signatures - prevents "sticky wrong" user overrides
- C.6: Privacy Redaction Layer - mandatory PII protection for all stored data

**Changed:**
- Updated Table of Contents with new appendices

---

*Document maintained by VentureX Engineering Team*
*Last updated: January 21, 2026 (v1.3.0)*
*For questions: engineering@venturex.io*