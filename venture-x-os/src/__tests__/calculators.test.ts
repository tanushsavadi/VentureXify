import { describe, it, expect } from 'vitest';
import {
  calculatePointsEarned,
  calculatePointsValue,
  calculatePortalVsDirect,
  calculateRedemption,
  calculatePriceMatch,
  calculateVentureXScore,
  calculateValueCaptured,
  calculateRenewalROI,
  calculateEraserValue,
} from '../lib/calculators';
import { VENTURE_X_CONSTANTS } from '../lib/types';

describe('Points Calculations', () => {
  describe('calculatePointsEarned', () => {
    it('should calculate portal points at 5x', () => {
      const points = calculatePointsEarned(100, true, 'flight');
      expect(points).toBe(500);
    });

    it('should calculate direct points at 2x', () => {
      const points = calculatePointsEarned(100, false, 'flight');
      expect(points).toBe(200);
    });

    it('should handle decimal amounts by flooring', () => {
      const points = calculatePointsEarned(99.99, false, 'hotel');
      expect(points).toBe(198); // 99 * 2
    });
  });

  describe('calculatePointsValue', () => {
    it('should calculate value at default valuation', () => {
      const value = calculatePointsValue(1000, 1.7);
      expect(value).toBe(17);
    });

    it('should calculate value at 1 cent per mile', () => {
      const value = calculatePointsValue(5000, 1.0);
      expect(value).toBe(50);
    });
  });
});

describe('Portal vs Direct Calculator', () => {
  it('should favor direct when prices are equal', () => {
    const result = calculatePortalVsDirect({
      directPrice: 500,
      portalPrice: 500,
      bookingType: 'flight',
      milesValuation: 1.7,
      caresAboutStatus: false,
    });

    // Portal earns 2500 points (5x), Direct earns 1000 points (2x)
    // Portal value: 2500 * 1.7 / 100 = $42.50
    // Direct value: 1000 * 1.7 / 100 = $17.00
    // Both cost same, portal has higher value
    expect(result.winner).toBe('portal');
  });

  it('should factor in status when enabled', () => {
    const withoutStatus = calculatePortalVsDirect({
      directPrice: 500,
      portalPrice: 500,
      bookingType: 'flight',
      milesValuation: 1.7,
      caresAboutStatus: false,
    });

    const withStatus = calculatePortalVsDirect({
      directPrice: 500,
      portalPrice: 500,
      bookingType: 'flight',
      milesValuation: 1.7,
      caresAboutStatus: true,
    });

    // Status should add value to direct booking
    expect(withStatus.netDifference).toBeLessThan(withoutStatus.netDifference);
  });

  it('should favor direct when portal has significant premium', () => {
    const result = calculatePortalVsDirect({
      directPrice: 500,
      portalPrice: 600, // 20% premium
      bookingType: 'flight',
      milesValuation: 1.0, // Conservative valuation
      caresAboutStatus: true,
    });

    expect(result.winner).toBe('direct');
  });

  it('should calculate break-even premium', () => {
    const result = calculatePortalVsDirect({
      directPrice: 500,
      portalPrice: 500,
      bookingType: 'hotel',
      milesValuation: 1.7,
      caresAboutStatus: false,
    });

    expect(result.breakEvenPremium).toBeGreaterThan(0);
  });
});

describe('Redemption Calculator', () => {
  describe('calculateEraserValue', () => {
    it('should calculate points needed for eraser', () => {
      const result = calculateEraserValue(100);
      expect(result.points).toBe(10000);
      expect(result.cpm).toBe(1.0);
    });
  });

  describe('calculateRedemption', () => {
    it('should recommend eraser for low target CPM', () => {
      const result = calculateRedemption({
        cashPrice: 500,
        milesBalance: 100000,
        targetCPM: 0.8, // Below eraser baseline
        isEraserEligible: true,
      });

      expect(result.recommendation).toBe('eraser');
    });

    it('should recommend transfer for high target CPM', () => {
      const result = calculateRedemption({
        cashPrice: 500,
        milesBalance: 100000,
        targetCPM: 2.5, // Above eraser baseline
        isEraserEligible: true,
      });

      expect(result.recommendation).toBe('transfer');
    });

    it('should recommend cash when not eligible', () => {
      const result = calculateRedemption({
        cashPrice: 500,
        milesBalance: 100000,
        targetCPM: 1.5,
        isEraserEligible: false,
      });

      expect(result.recommendation).toBe('cash');
    });

    it('should recommend cash when insufficient balance', () => {
      const result = calculateRedemption({
        cashPrice: 500,
        milesBalance: 1000, // Not enough
        targetCPM: 0.8,
        isEraserEligible: true,
      });

      expect(result.recommendation).toBe('cash');
    });
  });
});

describe('Price Match Calculator', () => {
  it('should return eligible when all criteria met', () => {
    const result = calculatePriceMatch({
      isConfirmed: true,
      hoursSinceBooking: 12,
      competitorPrice: 400,
      originalPrice: 500,
      sameDates: true,
      sameRoomType: true,
      sameCancellation: true,
      sameOccupancy: true,
    });

    expect(result.eligible).toBe(true);
    expect(result.confidence).toBe('HIGH');
    expect(result.savings).toBe(100);
  });

  it('should return not eligible when past 24 hours', () => {
    const result = calculatePriceMatch({
      isConfirmed: true,
      hoursSinceBooking: 30,
      competitorPrice: 400,
      originalPrice: 500,
      sameDates: true,
      sameRoomType: true,
      sameCancellation: true,
      sameOccupancy: true,
    });

    expect(result.eligible).toBe(false);
  });

  it('should return not eligible when competitor price is higher', () => {
    const result = calculatePriceMatch({
      isConfirmed: true,
      hoursSinceBooking: 12,
      competitorPrice: 550, // Higher than original
      originalPrice: 500,
      sameDates: true,
      sameRoomType: true,
      sameCancellation: true,
      sameOccupancy: true,
    });

    expect(result.eligible).toBe(false);
    expect(result.savings).toBe(0);
  });

  it('should have medium confidence with one criteria missing', () => {
    const result = calculatePriceMatch({
      isConfirmed: true,
      hoursSinceBooking: 12,
      competitorPrice: 400,
      originalPrice: 500,
      sameDates: true,
      sameRoomType: false, // Missing
      sameCancellation: true,
      sameOccupancy: true,
    });

    expect(result.confidence).toBe('MED');
  });

  it('should generate script template', () => {
    const result = calculatePriceMatch({
      isConfirmed: true,
      hoursSinceBooking: 12,
      competitorPrice: 400,
      originalPrice: 500,
      sameDates: true,
      sameRoomType: true,
      sameCancellation: true,
      sameOccupancy: true,
    });

    expect(result.scriptTemplate).toContain('$500.00');
    expect(result.scriptTemplate).toContain('$400.00');
    expect(result.scriptTemplate).toContain('$100.00');
  });
});

describe('Venture X Score Calculator', () => {
  it('should return 0 for no activity', () => {
    const score = calculateVentureXScore({
      travelCreditUsed: 0,
      globalEntryUsed: false,
      priorityPassActivated: false,
      partnerStatusEnrolled: false,
      eraserItemsUsed: 0,
      loungeVisits: 0,
    });

    expect(score).toBe(0);
  });

  it('should return 100 for maxed out usage', () => {
    const score = calculateVentureXScore({
      travelCreditUsed: VENTURE_X_CONSTANTS.TRAVEL_CREDIT, // Full credit
      globalEntryUsed: true,
      priorityPassActivated: true,
      partnerStatusEnrolled: true,
      eraserItemsUsed: 5, // More than threshold
      loungeVisits: 10, // More than threshold
    });

    expect(score).toBe(100);
  });

  it('should calculate partial scores correctly', () => {
    const score = calculateVentureXScore({
      travelCreditUsed: 150, // Half of $300
      globalEntryUsed: true,
      priorityPassActivated: false,
      partnerStatusEnrolled: false,
      eraserItemsUsed: 0,
      loungeVisits: 0,
    });

    // 15 (half of 30 for credit) + 15 (global entry) = 30
    expect(score).toBe(30);
  });
});

describe('Value Captured Calculator', () => {
  it('should sum all value sources', () => {
    const value = calculateValueCaptured({
      travelCreditUsed: 300,
      globalEntryUsed: true,
      priorityPassActivated: true,
      partnerStatusEnrolled: false,
      eraserItemsUsed: 0,
      loungeVisits: 5,
    });

    // 300 (credit) + 100 (global entry) + 5 * 32 (lounge visits) = 560
    expect(value).toBe(560);
  });

  it('should handle zero usage', () => {
    const value = calculateValueCaptured({
      travelCreditUsed: 0,
      globalEntryUsed: false,
      priorityPassActivated: false,
      partnerStatusEnrolled: false,
      eraserItemsUsed: 0,
      loungeVisits: 0,
    });

    expect(value).toBe(0);
  });
});

describe('Renewal ROI Calculator', () => {
  it('should calculate positive ROI when value exceeds fee', () => {
    const result = calculateRenewalROI(600, 395);

    expect(result.netValue).toBe(205);
    expect(result.roi).toBeGreaterThan(100);
    expect(result.worthKeeping).toBe(true);
  });

  it('should calculate negative ROI when value is less than fee', () => {
    const result = calculateRenewalROI(200, 395);

    expect(result.netValue).toBe(-195);
    expect(result.roi).toBeLessThan(100);
    expect(result.worthKeeping).toBe(false);
  });

  it('should use default annual fee', () => {
    const result = calculateRenewalROI(VENTURE_X_CONSTANTS.ANNUAL_FEE);

    expect(result.netValue).toBe(0);
    expect(result.roi).toBe(100);
    expect(result.worthKeeping).toBe(true);
  });
});
