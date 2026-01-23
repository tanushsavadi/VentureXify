// ============================================
// AI TYPES - Configuration and Interfaces
// ============================================

export interface AIConfig {
  enabled: boolean;
  provider: 'groq' | 'openai';
  apiKey: string;
  model?: string;
}

export interface PersonalizationContext {
  // User profile
  milesBalance: number;
  travelCreditRemaining: number;
  creditRenewalDate: string | null;
  
  // Eraser queue
  eraserQueueTotal: number;
  expiringItems: { amount: number; daysLeft: number }[];
  
  // Current booking
  bookingType: 'flight' | 'hotel' | 'car' | 'unknown';
  destination: string | null;
  totalPrice: number;
  
  // Strategy analysis results
  bestStrategyName: string;
  portalPrice: number;
  directPrice: number | null;
  milesEarned: number;
  creditApplied: number;
  outOfPocket: number;
  
  // Comparison data (if available)
  priceDelta?: number;
  winner?: 'portal' | 'direct' | 'tie';
}

export interface ExplanationResult {
  text: string;
  generatedAt: number;
  provider: string;
  cached: boolean;
}

// Default AI config
export const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: false,
  provider: 'groq',
  apiKey: '',
};
