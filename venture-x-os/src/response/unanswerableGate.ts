// ============================================
// UNANSWERABLE GATE
// Determines when to refuse answering due to missing info
// Better to say "I don't know" than hallucinate
// ============================================

import { ComputeIntent, ComputeRequest, ComputeResult } from '../compute/deterministicEngine';

// ============================================
// GATE RESULT
// ============================================

export interface GateResult {
  refuse: boolean;
  reason?: string;
  response?: string;
  missingData?: string[];
  suggestedActions?: string[];
}

// ============================================
// RETRIEVAL QUALITY METRICS
// ============================================

export interface RetrievalQuality {
  topScore: number;           // Best retrieval score (0-1)
  averageScore: number;       // Average of top-k scores
  numResults: number;         // How many results returned
  hasOfficialSource: boolean; // Tier 1 source present?
  freshness: 'fresh' | 'stale' | 'unknown';  // Are sources current?
}

// ============================================
// GROUNDING RESULT (from citation system)
// ============================================

export interface GroundingResult {
  isGrounded: boolean;        // Can we cite sources for the answer?
  groundedPercentage: number; // What % of claims are sourced?
  ungoundedClaims: string[];  // Claims we can't verify
}

// ============================================
// UNANSWERABLE GATE CLASS
// ============================================

export class UnanswerableGate {
  // Thresholds for refusing
  private readonly MIN_RETRIEVAL_SCORE = 0.5;
  private readonly MIN_GROUNDING_PERCENTAGE = 0.6;
  private readonly MIN_RESULTS_FOR_CONFIDENCE = 2;
  
  /**
   * Determine if we should refuse to answer the query
   */
  shouldRefuse(
    computeRequest: ComputeRequest,
    retrievalQuality?: RetrievalQuality,
    groundingResult?: GroundingResult
  ): GateResult {
    // Case 1: Computation needed but missing required params
    if (computeRequest.intent === ComputeIntent.NEED_MORE_INFO) {
      return this.refuseForMissingData(computeRequest.missingParams || []);
    }
    
    // Case 2: Computation intent but params are invalid
    if (this.requiresComputation(computeRequest.intent)) {
      const validation = this.validateComputeParams(computeRequest);
      if (!validation.valid) {
        return this.refuseForMissingData(validation.missing);
      }
    }
    
    // Case 3: Knowledge query but retrieval quality is too low
    if (computeRequest.intent === ComputeIntent.EXPLAIN_ONLY && retrievalQuality) {
      if (retrievalQuality.topScore < this.MIN_RETRIEVAL_SCORE) {
        return this.refuseForLowConfidence(retrievalQuality);
      }
      
      if (retrievalQuality.numResults < this.MIN_RESULTS_FOR_CONFIDENCE) {
        return this.refuseForInsufficientSources(retrievalQuality);
      }
    }
    
    // Case 4: Answer can't be grounded in sources
    if (groundingResult && !groundingResult.isGrounded) {
      if (groundingResult.groundedPercentage < this.MIN_GROUNDING_PERCENTAGE) {
        return this.refuseForUngroundedClaims(groundingResult);
      }
    }
    
    // Case 5: Sources are stale for time-sensitive queries
    if (retrievalQuality?.freshness === 'stale' && this.isTimeSensitive(computeRequest)) {
      return this.refuseForStaleData(retrievalQuality);
    }
    
    // All checks passed - proceed with answering
    return { refuse: false };
  }
  
  /**
   * Generate a graceful refusal response with helpful guidance
   */
  generateRefusalResponse(gateResult: GateResult): string {
    if (!gateResult.refuse) {
      return '';
    }
    
    const parts: string[] = [];
    
    // Main reason
    parts.push(`🤔 ${gateResult.reason || "I don't have enough information to help with this."}`);
    
    // Missing data
    if (gateResult.missingData && gateResult.missingData.length > 0) {
      parts.push(`\nTo help you, I'd need:`);
      for (const item of gateResult.missingData) {
        parts.push(`• ${this.formatMissingDataItem(item)}`);
      }
    }
    
    // Suggested actions
    if (gateResult.suggestedActions && gateResult.suggestedActions.length > 0) {
      parts.push(`\n💡 You could:`);
      for (const action of gateResult.suggestedActions) {
        parts.push(`• ${action}`);
      }
    }
    
    return parts.join('\n');
  }
  
  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================
  
  private requiresComputation(intent: ComputeIntent): boolean {
    return [
      ComputeIntent.PORTAL_VS_DIRECT,
      ComputeIntent.TRAVEL_ERASER,
      ComputeIntent.TRANSFER_CPP,
      ComputeIntent.MILES_EARNED,
      ComputeIntent.BREAK_EVEN,
    ].includes(intent);
  }
  
  private validateComputeParams(
    request: ComputeRequest
  ): { valid: boolean; missing: string[] } {
    const requiredParams: Record<ComputeIntent, string[]> = {
      [ComputeIntent.PORTAL_VS_DIRECT]: ['portalPrice', 'directPrice'],
      [ComputeIntent.TRAVEL_ERASER]: ['purchaseAmount'],
      [ComputeIntent.TRANSFER_CPP]: ['cashFare', 'milesRequired'],
      [ComputeIntent.MILES_EARNED]: ['amount'],
      [ComputeIntent.BREAK_EVEN]: ['directPrice'],
      [ComputeIntent.EXPLAIN_ONLY]: [],
      [ComputeIntent.NEED_MORE_INFO]: [],
    };
    
    const required = requiredParams[request.intent] || [];
    const missing = required.filter(p => {
      const value = request.params[p];
      return value === undefined || value === null || value === '';
    });
    
    return {
      valid: missing.length === 0,
      missing,
    };
  }
  
  private isTimeSensitive(request: ComputeRequest): boolean {
    // Transfer partner CPP queries are time-sensitive (award pricing changes)
    if (request.intent === ComputeIntent.TRANSFER_CPP) {
      return true;
    }
    
    // Check if params mention time-sensitive terms
    const paramsStr = JSON.stringify(request.params).toLowerCase();
    return /promo|deal|limited|expir|today|current/i.test(paramsStr);
  }
  
  private refuseForMissingData(missingParams: string[]): GateResult {
    return {
      refuse: true,
      reason: "I need some specific information to calculate this.",
      missingData: missingParams,
      suggestedActions: this.getSuggestedActionsForMissingData(missingParams),
      response: this.generateRefusalResponse({
        refuse: true,
        reason: "I need some specific information to calculate this.",
        missingData: missingParams,
        suggestedActions: this.getSuggestedActionsForMissingData(missingParams),
      }),
    };
  }
  
  private refuseForLowConfidence(quality: RetrievalQuality): GateResult {
    return {
      refuse: true,
      reason: "I couldn't find reliable information about this in my knowledge base.",
      suggestedActions: [
        'Try rephrasing your question',
        'Check the Capital One website directly',
        'Ask about a specific Venture X feature',
      ],
    };
  }
  
  private refuseForInsufficientSources(quality: RetrievalQuality): GateResult {
    return {
      refuse: true,
      reason: "I don't have enough sources to give a confident answer.",
      suggestedActions: [
        'Try a more specific question',
        'Check official Capital One documentation',
      ],
    };
  }
  
  private refuseForUngroundedClaims(grounding: GroundingResult): GateResult {
    return {
      refuse: true,
      reason: "I can't verify the information needed to answer this question accurately.",
      missingData: grounding.ungoundedClaims.slice(0, 3), // Show top 3
      suggestedActions: [
        'Ask about verified Venture X card features',
        'Check official sources for the latest information',
      ],
    };
  }
  
  private refuseForStaleData(quality: RetrievalQuality): GateResult {
    return {
      refuse: true,
      reason: "My information on this topic may be outdated. For current rates or promotions, please check the official source.",
      suggestedActions: [
        'Visit capitalone.com for current information',
        'Check the transfer partner website directly',
      ],
    };
  }
  
  private getSuggestedActionsForMissingData(missingParams: string[]): string[] {
    const suggestions: string[] = [];
    
    if (missingParams.includes('portalPrice') || missingParams.includes('directPrice')) {
      suggestions.push('Look up both prices first, then ask me to compare');
      suggestions.push('Tell me the portal and direct prices for your booking');
    }
    
    if (missingParams.includes('purchaseAmount')) {
      suggestions.push('Tell me the purchase amount you want to erase');
    }
    
    if (missingParams.includes('cashFare') || missingParams.includes('milesRequired')) {
      suggestions.push('Find the cash fare and miles required for the award booking');
      suggestions.push('Check the transfer partner website for award pricing');
    }
    
    if (suggestions.length === 0) {
      suggestions.push('Provide the missing details and ask again');
    }
    
    return suggestions;
  }
  
  private formatMissingDataItem(param: string): string {
    const labels: Record<string, string> = {
      portalPrice: 'The price on Capital One Travel portal',
      directPrice: 'The price booking directly with the airline/hotel',
      purchaseAmount: 'The purchase amount you want to erase',
      cashFare: 'The cash price for the same flight/room',
      milesRequired: 'The number of miles required for the award booking',
      taxesFees: 'The taxes and fees on the award ticket',
      amount: 'The booking amount',
      milesBalance: 'Your current miles balance',
    };
    
    return labels[param] || param;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const unanswerableGate = new UnanswerableGate();
