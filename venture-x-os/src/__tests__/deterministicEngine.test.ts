// ============================================
// DETERMINISTIC ENGINE TESTS
// Ensures all computations are accurate and never produce NaN
// ============================================

import { describe, it, expect } from 'vitest';
import { 
  DeterministicEngine, 
  ComputeIntent,
} from '../compute/deterministicEngine';

describe('DeterministicEngine', () => {
  const engine = new DeterministicEngine();
  
  // ============================================
  // PORTAL VS DIRECT TESTS
  // ============================================
  
  describe('computePortalVsDirect', () => {
    it('should compute portal vs direct correctly for flights', () => {
      const result = engine.compute({
        intent: ComputeIntent.PORTAL_VS_DIRECT,
        params: { 
          portalPrice: 450, 
          directPrice: 420,
          bookingType: 'flight',
        },
      });
      
      expect(result.success).toBe(true);
      expect(result.computed.portalMiles).toBe(2250); // 450 * 5
      expect(result.computed.directMiles).toBe(840);  // 420 * 2
      expect(result.computed.winner).toBeDefined();
    });
    
    it('should compute 10x multiplier for hotels', () => {
      const result = engine.compute({
        intent: ComputeIntent.PORTAL_VS_DIRECT,
        params: { 
          portalPrice: 300, 
          directPrice: 280,
          bookingType: 'hotel',
        },
      });
      
      expect(result.success).toBe(true);
      expect(result.computed.portalMiles).toBe(3000); // 300 * 10
      expect(result.computed.directMiles).toBe(560);  // 280 * 2
      expect(result.computed.portalMultiplier).toBe(10);
    });
    
    it('should compute 10x multiplier for rental cars', () => {
      const result = engine.compute({
        intent: ComputeIntent.PORTAL_VS_DIRECT,
        params: { 
          portalPrice: 200, 
          directPrice: 180,
          bookingType: 'rental',
        },
      });
      
      expect(result.success).toBe(true);
      expect(result.computed.portalMultiplier).toBe(10);
      expect(result.computed.portalMiles).toBe(2000); // 200 * 10
    });
    
    it('should never return NaN or undefined numbers', () => {
      const result = engine.compute({
        intent: ComputeIntent.PORTAL_VS_DIRECT,
        params: { portalPrice: 0, directPrice: 0 },
      });
      
      expect(result.success).toBe(true);
      
      for (const [key, value] of Object.entries(result.computed)) {
        if (typeof value === 'number') {
          expect(isNaN(value)).toBe(false);
          expect(value).not.toBeUndefined();
        }
      }
    });
    
    it('should return NEED_MORE_INFO when missing required params', () => {
      const result = engine.compute({
        intent: ComputeIntent.PORTAL_VS_DIRECT,
        params: { portalPrice: 450 }, // Missing directPrice
      });
      
      expect(result.success).toBe(false);
      expect(result.intent).toBe(ComputeIntent.NEED_MORE_INFO);
      expect(result.missingRequired).toContain('directPrice');
    });
    
    it('should apply travel credit correctly', () => {
      const result = engine.compute({
        intent: ComputeIntent.PORTAL_VS_DIRECT,
        params: { 
          portalPrice: 450, 
          directPrice: 420,
          creditRemaining: 300,
        },
      });
      
      expect(result.success).toBe(true);
      expect(result.computed.portalEffectiveCost).toBe(150); // 450 - 300
      expect(result.computed.creditApplied).toBe(300);
    });
    
    it('should calculate break-even premium', () => {
      const result = engine.compute({
        intent: ComputeIntent.PORTAL_VS_DIRECT,
        params: { 
          portalPrice: 420, 
          directPrice: 400,
          bookingType: 'flight',
        },
      });
      
      expect(result.success).toBe(true);
      expect(typeof result.computed.breakEvenPremium).toBe('number');
      expect(result.computed.breakEvenPremium).toBeGreaterThan(0);
    });
    
    it('should detect tie when prices are very close', () => {
      const result = engine.compute({
        intent: ComputeIntent.PORTAL_VS_DIRECT,
        params: {
          portalPrice: 401,
          directPrice: 400,
          milesValuation: 1.7, // Default valuation
        },
      });
      
      expect(result.success).toBe(true);
      // Net difference should be small (within $25 for very close prices)
      // The advantage comes from portal earning more miles even at similar prices
      expect(Math.abs(result.computed.netAdvantage as number)).toBeLessThan(25);
    });
    
    it('should add warning for high portal premium', () => {
      const result = engine.compute({
        intent: ComputeIntent.PORTAL_VS_DIRECT,
        params: { 
          portalPrice: 600, // 50% more than direct
          directPrice: 400,
        },
      });
      
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('premium'))).toBe(true);
    });
  });
  
  // ============================================
  // TRAVEL ERASER TESTS
  // ============================================
  
  describe('computeTravelEraser', () => {
    it('should calculate miles needed correctly', () => {
      const result = engine.compute({
        intent: ComputeIntent.TRAVEL_ERASER,
        params: { purchaseAmount: 100, milesBalance: 50000 },
      });
      
      expect(result.success).toBe(true);
      expect(result.computed.milesNeeded).toBe(10000); // 100 * 100
      expect(result.computed.canFullyErase).toBe(true);
    });
    
    it('should detect insufficient miles', () => {
      const result = engine.compute({
        intent: ComputeIntent.TRAVEL_ERASER,
        params: { purchaseAmount: 100, milesBalance: 5000 },
      });
      
      expect(result.success).toBe(true);
      expect(result.computed.canFullyErase).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
    
    it('should warn about minimum redemption', () => {
      const result = engine.compute({
        intent: ComputeIntent.TRAVEL_ERASER,
        params: { purchaseAmount: 40 }, // Less than $50 minimum
      });
      
      expect(result.success).toBe(true);
      expect(result.computed.meetsMinimum).toBe(false);
      expect(result.warnings.some(w => w.includes('Minimum'))).toBe(true);
    });
    
    it('should handle fractional amounts', () => {
      const result = engine.compute({
        intent: ComputeIntent.TRAVEL_ERASER,
        params: { purchaseAmount: 75.50 },
      });
      
      expect(result.success).toBe(true);
      expect(result.computed.milesNeeded).toBe(7550); // Ceiling
    });
  });
  
  // ============================================
  // TRANSFER CPP TESTS
  // ============================================
  
  describe('computeTransferCPP', () => {
    it('should calculate CPP correctly', () => {
      const result = engine.compute({
        intent: ComputeIntent.TRANSFER_CPP,
        params: { 
          cashFare: 1200, 
          milesRequired: 60000,
          taxesFees: 100,
        },
      });
      
      expect(result.success).toBe(true);
      // CPP = (1200 - 100) / 60000 * 100 = 1.83
      expect(result.computed.cpp).toBeCloseTo(1.83, 1);
      expect(result.computed.rating).toBe('good');
    });
    
    it('should rate excellent CPP correctly', () => {
      const result = engine.compute({
        intent: ComputeIntent.TRANSFER_CPP,
        params: { 
          cashFare: 3000, 
          milesRequired: 60000,
          taxesFees: 0,
        },
      });
      
      expect(result.success).toBe(true);
      // CPP = 3000 / 60000 * 100 = 5.0
      expect(result.computed.cpp).toBe(5);
      expect(result.computed.rating).toBe('excellent');
    });
    
    it('should warn about poor CPP', () => {
      const result = engine.compute({
        intent: ComputeIntent.TRANSFER_CPP,
        params: { 
          cashFare: 400, 
          milesRequired: 60000,
        },
      });
      
      expect(result.success).toBe(true);
      // CPP = 400 / 60000 * 100 = 0.67
      expect(result.computed.rating).toBe('poor');
      expect(result.computed.worthTransferring).toBe(false);
    });
    
    it('should handle high taxes/fees', () => {
      const result = engine.compute({
        intent: ComputeIntent.TRANSFER_CPP,
        params: { 
          cashFare: 1000, 
          milesRequired: 60000,
          taxesFees: 500, // 50% taxes
        },
      });
      
      expect(result.warnings.some(w => w.includes('Taxes'))).toBe(true);
    });
  });
  
  // ============================================
  // MILES EARNED TESTS
  // ============================================
  
  describe('computeMilesEarned', () => {
    it('should calculate portal miles correctly', () => {
      const result = engine.compute({
        intent: ComputeIntent.MILES_EARNED,
        params: { amount: 500, isPortal: true, bookingType: 'flight' },
      });
      
      expect(result.success).toBe(true);
      expect(result.computed.milesEarned).toBe(2500); // 500 * 5
    });
    
    it('should calculate direct miles correctly', () => {
      const result = engine.compute({
        intent: ComputeIntent.MILES_EARNED,
        params: { amount: 500, isPortal: false },
      });
      
      expect(result.success).toBe(true);
      expect(result.computed.milesEarned).toBe(1000); // 500 * 2
    });
    
    it('should handle 10x hotel multiplier', () => {
      const result = engine.compute({
        intent: ComputeIntent.MILES_EARNED,
        params: { amount: 500, isPortal: true, bookingType: 'hotel' },
      });
      
      expect(result.success).toBe(true);
      expect(result.computed.milesEarned).toBe(5000); // 500 * 10
    });
  });
  
  // ============================================
  // BREAK-EVEN TESTS
  // ============================================
  
  describe('computeBreakEven', () => {
    it('should calculate break-even correctly for flights', () => {
      const result = engine.compute({
        intent: ComputeIntent.BREAK_EVEN,
        params: { directPrice: 400, bookingType: 'flight' },
      });
      
      expect(result.success).toBe(true);
      expect(typeof result.computed.breakEvenPremium).toBe('number');
      expect(result.computed.maxPortalPrice).toBeGreaterThan(400);
    });
    
    it('should handle different valuations', () => {
      const lowVal = engine.compute({
        intent: ComputeIntent.BREAK_EVEN,
        params: { directPrice: 400, milesValuation: 1.0 },
      });
      
      const highVal = engine.compute({
        intent: ComputeIntent.BREAK_EVEN,
        params: { directPrice: 400, milesValuation: 2.0 },
      });
      
      // Higher valuation = higher acceptable premium
      expect(highVal.computed.breakEvenPremium).toBeGreaterThan(
        lowVal.computed.breakEvenPremium as number
      );
    });
  });
  
  // ============================================
  // EDGE CASE TESTS
  // ============================================
  
  describe('Edge Cases', () => {
    it('should handle zero prices', () => {
      const result = engine.compute({
        intent: ComputeIntent.PORTAL_VS_DIRECT,
        params: { portalPrice: 0, directPrice: 0 },
      });
      
      expect(result.success).toBe(true);
      expect(isNaN(result.computed.netAdvantage as number)).toBe(false);
    });
    
    it('should handle very large numbers', () => {
      const result = engine.compute({
        intent: ComputeIntent.PORTAL_VS_DIRECT,
        params: { portalPrice: 10000, directPrice: 9500 },
      });
      
      expect(result.success).toBe(true);
      expect(isFinite(result.computed.netAdvantage as number)).toBe(true);
    });
    
    it('should handle string numbers', () => {
      const result = engine.compute({
        intent: ComputeIntent.PORTAL_VS_DIRECT,
        params: { portalPrice: '450', directPrice: '420' },
      });
      
      expect(result.success).toBe(true);
      expect(result.computed.portalPrice).toBe(450);
    });
    
    it('should handle comma-formatted numbers', () => {
      const result = engine.compute({
        intent: ComputeIntent.TRAVEL_ERASER,
        params: { purchaseAmount: '1,500' },
      });
      
      expect(result.success).toBe(true);
      expect(result.computed.purchaseAmount).toBe(1500);
    });
    
    it('should return explain_only for unknown intents', () => {
      const result = engine.compute({
        intent: 'unknown_intent' as ComputeIntent,
        params: {},
      });
      
      expect(result.success).toBe(false);
    });
  });
});
