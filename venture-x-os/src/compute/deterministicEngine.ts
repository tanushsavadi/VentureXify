// ============================================
// DETERMINISTIC COMPUTE ENGINE
// All numerical computations happen here - NEVER in the LLM
// ============================================

import { VENTURE_X_CONSTANTS, BookingType, getPortalMultiplier, getBaseMultiplier } from '../lib/types';

// ============================================
// COMPUTE INTENTS (what calculations we support)
// ============================================

export enum ComputeIntent {
  PORTAL_VS_DIRECT = 'portal_vs_direct',
  TRAVEL_ERASER = 'travel_eraser',
  TRANSFER_CPP = 'transfer_cpp',
  MILES_EARNED = 'miles_earned',
  BREAK_EVEN = 'break_even',
  EXPLAIN_ONLY = 'explain_only',
  NEED_MORE_INFO = 'need_more_info',
}

// ============================================
// COMPUTE REQUEST & RESULT TYPES
// ============================================

export interface ComputeRequest {
  intent: ComputeIntent;
  params: Record<string, number | string | boolean | undefined>;
  missingParams?: string[];
}

export interface ComputeResult {
  intent: ComputeIntent;
  success: boolean;
  computed: Record<string, number | string | boolean>;
  formula: string;
  humanReadable: string;
  warnings: string[];
  missingRequired?: string[];
}

// ============================================
// DETERMINISTIC ENGINE CLASS
// ============================================

export class DeterministicEngine {
  /**
   * Main compute dispatcher - routes to appropriate calculator
   */
  compute(request: ComputeRequest): ComputeResult {
    switch (request.intent) {
      case ComputeIntent.PORTAL_VS_DIRECT:
        return this.computePortalVsDirect(request.params);
      
      case ComputeIntent.TRAVEL_ERASER:
        return this.computeTravelEraser(request.params);
      
      case ComputeIntent.TRANSFER_CPP:
        return this.computeTransferCPP(request.params);
      
      case ComputeIntent.MILES_EARNED:
        return this.computeMilesEarned(request.params);
      
      case ComputeIntent.BREAK_EVEN:
        return this.computeBreakEven(request.params);
      
      case ComputeIntent.EXPLAIN_ONLY:
        return this.noComputeNeeded();
      
      case ComputeIntent.NEED_MORE_INFO:
        return this.needMoreInfo(request.missingParams || []);
      
      default:
        return this.unknownIntent(request.intent);
    }
  }

  /**
   * Portal vs Direct comparison
   * Required params: portalPrice, directPrice
   * Optional params: bookingType, milesValuation, creditRemaining
   */
  computePortalVsDirect(params: Record<string, number | string | boolean | undefined>): ComputeResult {
    const portalPrice = this.toNumber(params.portalPrice);
    const directPrice = this.toNumber(params.directPrice);
    
    // Check required params
    if (portalPrice === null) {
      return this.missingRequired(['portalPrice']);
    }
    if (directPrice === null) {
      return this.missingRequired(['directPrice']);
    }
    
    const bookingType = (params.bookingType as BookingType) || 'flight';
    const milesValuation = this.toNumber(params.milesValuation) ?? VENTURE_X_CONSTANTS.DEFAULT_MILES_VALUATION;
    const creditRemaining = this.toNumber(params.creditRemaining) ?? 0;
    
    // Get multipliers based on booking type
    const portalMultiplier = getPortalMultiplier(bookingType);
    const directMultiplier = getBaseMultiplier();
    
    // Calculate miles earned
    const portalMiles = Math.floor(portalPrice) * portalMultiplier;
    const directMiles = Math.floor(directPrice) * directMultiplier;
    const extraMiles = portalMiles - directMiles;
    
    // Calculate mile value
    const portalMilesValue = (portalMiles * milesValuation) / 100;
    const directMilesValue = (directMiles * milesValuation) / 100;
    
    // Apply credit if any
    const portalEffectiveCost = Math.max(0, portalPrice - creditRemaining);
    const directEffectiveCost = directPrice;
    
    // Calculate net costs (price minus miles value)
    const portalNetCost = portalEffectiveCost - portalMilesValue;
    const directNetCost = directEffectiveCost - directMilesValue;
    
    // Determine winner
    const netAdvantage = Math.abs(portalNetCost - directNetCost);
    let winner: string;
    if (Math.abs(portalNetCost - directNetCost) < 5) {
      winner = 'tie';
    } else if (portalNetCost < directNetCost) {
      winner = 'portal';
    } else {
      winner = 'direct';
    }
    
    // Calculate break-even premium
    // At what point does portal become worse than direct?
    // portalPrice - portalMilesValue = directPrice - directMilesValue
    const breakEvenPremium = this.calculateBreakEvenPremium(
      directPrice,
      portalMultiplier,
      directMultiplier,
      milesValuation
    );
    
    const warnings: string[] = [];
    if (portalPrice > directPrice * 1.3) {
      warnings.push('Portal premium exceeds 30% - verify pricing is current');
    }
    if (Math.abs(portalPrice - directPrice) < 5) {
      warnings.push('Prices are very close - double-check both before booking');
    }
    
    return {
      intent: ComputeIntent.PORTAL_VS_DIRECT,
      success: true,
      computed: {
        portalPrice,
        directPrice,
        bookingType,
        portalMultiplier,
        directMultiplier,
        portalMiles,
        directMiles,
        extraMiles,
        portalMilesValue: Math.round(portalMilesValue * 100) / 100,
        directMilesValue: Math.round(directMilesValue * 100) / 100,
        portalEffectiveCost,
        directEffectiveCost,
        portalNetCost: Math.round(portalNetCost * 100) / 100,
        directNetCost: Math.round(directNetCost * 100) / 100,
        netAdvantage: Math.round(netAdvantage * 100) / 100,
        winner,
        breakEvenPremium: Math.round(breakEvenPremium * 100) / 100,
        creditApplied: Math.min(creditRemaining, portalPrice),
        milesValuation,
      },
      formula: `Net Cost = Price - (Miles × ${milesValuation}¢/mile); Winner = lower net cost`,
      humanReadable: this.formatPortalVsDirectResult(winner, netAdvantage, portalMiles, directMiles),
      warnings,
    };
  }

  /**
   * Travel Eraser calculation
   * Required params: purchaseAmount
   * Optional params: milesBalance
   */
  computeTravelEraser(params: Record<string, number | string | boolean | undefined>): ComputeResult {
    const purchaseAmount = this.toNumber(params.purchaseAmount);
    
    if (purchaseAmount === null) {
      return this.missingRequired(['purchaseAmount']);
    }
    
    const milesBalance = this.toNumber(params.milesBalance);
    
    // Eraser rate: 1 cent per mile = 100 miles per $1
    const milesNeeded = Math.ceil(purchaseAmount * 100);
    const eraserCPM = VENTURE_X_CONSTANTS.ERASER_CPM;
    const minRedemption = VENTURE_X_CONSTANTS.ERASER_MIN_REDEMPTION;
    
    const meetsMinimum = milesNeeded >= minRedemption;
    const canFullyErase = milesBalance !== null ? milesBalance >= milesNeeded : null;
    const milesRemaining = milesBalance !== null ? milesBalance - milesNeeded : null;
    
    const warnings: string[] = [];
    if (!meetsMinimum) {
      warnings.push(`Minimum redemption is ${minRedemption.toLocaleString()} miles ($${minRedemption / 100})`);
    }
    if (canFullyErase === false) {
      warnings.push(`Insufficient miles - need ${milesNeeded.toLocaleString()}, have ${milesBalance?.toLocaleString()}`);
    }
    
    return {
      intent: ComputeIntent.TRAVEL_ERASER,
      success: true,
      computed: {
        purchaseAmount,
        milesNeeded,
        eraserCPM,
        statementCredit: purchaseAmount,
        meetsMinimum,
        ...(milesBalance !== null && { milesBalance }),
        ...(canFullyErase !== null && { canFullyErase }),
        ...(milesRemaining !== null && { milesRemaining }),
      },
      formula: `Miles Needed = Purchase Amount × 100 (at ${eraserCPM}cpp)`,
      humanReadable: `To erase $${purchaseAmount.toFixed(2)}, you need ${milesNeeded.toLocaleString()} miles`,
      warnings,
    };
  }

  /**
   * Transfer partner CPP calculation
   * Required params: cashFare, milesRequired
   * Optional params: taxesFees
   */
  computeTransferCPP(params: Record<string, number | string | boolean | undefined>): ComputeResult {
    const cashFare = this.toNumber(params.cashFare);
    const milesRequired = this.toNumber(params.milesRequired);
    
    if (cashFare === null) {
      return this.missingRequired(['cashFare']);
    }
    if (milesRequired === null) {
      return this.missingRequired(['milesRequired']);
    }
    
    const taxesFees = this.toNumber(params.taxesFees) ?? 0;
    
    // CPP = (Cash Fare - Taxes/Fees) / Miles
    const effectiveValue = cashFare - taxesFees;
    const cpp = (effectiveValue / milesRequired) * 100;
    const roundedCPP = Math.round(cpp * 100) / 100;
    
    // Determine if this is a good redemption
    let rating: string;
    if (cpp >= 2.5) {
      rating = 'excellent';
    } else if (cpp >= 1.5) {
      rating = 'good';
    } else if (cpp >= 1.0) {
      rating = 'fair';
    } else {
      rating = 'poor';
    }
    
    const eraserEquivalent = milesRequired / 100; // What you'd get from eraser
    const valueOverEraser = effectiveValue - eraserEquivalent;
    
    const warnings: string[] = [];
    if (cpp < 1.0) {
      warnings.push('CPP below 1.0 - Travel Eraser would give better value');
    }
    if (taxesFees > cashFare * 0.3) {
      warnings.push('Taxes/fees are high (>30% of fare) - verify this is expected');
    }
    
    return {
      intent: ComputeIntent.TRANSFER_CPP,
      success: true,
      computed: {
        cashFare,
        milesRequired,
        taxesFees,
        effectiveValue: Math.round(effectiveValue * 100) / 100,
        cpp: roundedCPP,
        rating,
        eraserEquivalent: Math.round(eraserEquivalent * 100) / 100,
        valueOverEraser: Math.round(valueOverEraser * 100) / 100,
        worthTransferring: cpp >= 1.0,
      },
      formula: `CPP = (Cash Fare $${cashFare} - Taxes $${taxesFees}) ÷ ${milesRequired.toLocaleString()} miles × 100`,
      humanReadable: `This redemption gives ${roundedCPP.toFixed(2)} cents per mile (${rating})`,
      warnings,
    };
  }

  /**
   * Calculate miles earned on a purchase
   * Required params: amount, isPortal
   * Optional params: bookingType
   */
  computeMilesEarned(params: Record<string, number | string | boolean | undefined>): ComputeResult {
    const amount = this.toNumber(params.amount);
    
    if (amount === null) {
      return this.missingRequired(['amount']);
    }
    
    const isPortal = params.isPortal === true || params.isPortal === 'true';
    const bookingType = (params.bookingType as BookingType) || 'other';
    
    const multiplier = isPortal ? getPortalMultiplier(bookingType) : getBaseMultiplier();
    const milesEarned = Math.floor(amount) * multiplier;
    
    return {
      intent: ComputeIntent.MILES_EARNED,
      success: true,
      computed: {
        amount,
        isPortal,
        bookingType,
        multiplier,
        milesEarned,
      },
      formula: `Miles = $${amount} × ${multiplier}x = ${milesEarned.toLocaleString()} miles`,
      humanReadable: `You'll earn ${milesEarned.toLocaleString()} miles (${multiplier}x)`,
      warnings: [],
    };
  }

  /**
   * Calculate break-even portal premium
   * Required params: directPrice
   * Optional params: bookingType, milesValuation
   */
  computeBreakEven(params: Record<string, number | string | boolean | undefined>): ComputeResult {
    const directPrice = this.toNumber(params.directPrice);
    
    if (directPrice === null) {
      return this.missingRequired(['directPrice']);
    }
    
    const bookingType = (params.bookingType as BookingType) || 'flight';
    const milesValuation = this.toNumber(params.milesValuation) ?? VENTURE_X_CONSTANTS.DEFAULT_MILES_VALUATION;
    
    const portalMultiplier = getPortalMultiplier(bookingType);
    const directMultiplier = getBaseMultiplier();
    
    const breakEvenPremium = this.calculateBreakEvenPremium(
      directPrice,
      portalMultiplier,
      directMultiplier,
      milesValuation
    );
    
    const maxPortalPrice = directPrice + breakEvenPremium;
    
    return {
      intent: ComputeIntent.BREAK_EVEN,
      success: true,
      computed: {
        directPrice,
        breakEvenPremium: Math.round(breakEvenPremium * 100) / 100,
        maxPortalPrice: Math.round(maxPortalPrice * 100) / 100,
        portalMultiplier,
        directMultiplier,
        milesValuation,
      },
      formula: `Break-even = Direct Price × (Portal Mult - Direct Mult) × (Valuation/100) ÷ (1 - (Portal Mult × Valuation/100))`,
      humanReadable: `Portal is worth it up to $${maxPortalPrice.toFixed(0)} (premium of $${breakEvenPremium.toFixed(0)})`,
      warnings: [],
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private calculateBreakEvenPremium(
    directPrice: number,
    portalMultiplier: number,
    directMultiplier: number,
    milesValuation: number
  ): number {
    // Break-even: when portal net cost = direct net cost
    // P_portal - P_portal * M_portal * V = P_direct - P_direct * M_direct * V
    // P_portal(1 - M_portal * V) = P_direct(1 - M_direct * V)
    // P_portal = P_direct * (1 - M_direct * V) / (1 - M_portal * V)
    // Premium = P_portal - P_direct
    
    const v = milesValuation / 100; // Convert to decimal
    const numerator = 1 - directMultiplier * v;
    const denominator = 1 - portalMultiplier * v;
    
    if (denominator <= 0) {
      // If portal multiplier × valuation >= 100%, portal always wins
      return Infinity;
    }
    
    const breakEvenPortalPrice = directPrice * numerator / denominator;
    return Math.max(0, breakEvenPortalPrice - directPrice);
  }

  private formatPortalVsDirectResult(
    winner: string,
    netAdvantage: number,
    portalMiles: number,
    directMiles: number
  ): string {
    if (winner === 'tie') {
      return `It's a tie - both options are within $5 of each other`;
    } else if (winner === 'portal') {
      return `Portal wins by ~$${netAdvantage.toFixed(0)} (earns ${portalMiles.toLocaleString()} miles vs ${directMiles.toLocaleString()})`;
    } else {
      return `Direct wins by ~$${netAdvantage.toFixed(0)} (despite fewer miles)`;
    }
  }

  private toNumber(value: number | string | boolean | undefined): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    if (typeof value === 'boolean') {
      return null;
    }
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, ''));
    return isNaN(num) ? null : num;
  }

  private missingRequired(params: string[]): ComputeResult {
    return {
      intent: ComputeIntent.NEED_MORE_INFO,
      success: false,
      computed: {},
      formula: '',
      humanReadable: `I need the following to calculate: ${params.join(', ')}`,
      warnings: [],
      missingRequired: params,
    };
  }

  private noComputeNeeded(): ComputeResult {
    return {
      intent: ComputeIntent.EXPLAIN_ONLY,
      success: true,
      computed: {},
      formula: 'No computation needed',
      humanReadable: 'This question can be answered from knowledge base',
      warnings: [],
    };
  }

  private needMoreInfo(params: string[]): ComputeResult {
    return {
      intent: ComputeIntent.NEED_MORE_INFO,
      success: false,
      computed: {},
      formula: '',
      humanReadable: params.length > 0
        ? `To answer this, I need: ${params.join(', ')}`
        : 'I need more specific information to help with this',
      warnings: [],
      missingRequired: params,
    };
  }

  private unknownIntent(intent: string): ComputeResult {
    return {
      intent: ComputeIntent.EXPLAIN_ONLY,
      success: false,
      computed: {},
      formula: '',
      humanReadable: `Unknown compute intent: ${intent}`,
      warnings: [`Unrecognized intent: ${intent}`],
    };
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const deterministicEngine = new DeterministicEngine();
