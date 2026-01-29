/**
 * useOnboarding Hook
 *
 * React hook for managing onboarding flow state for VentureXify.
 * Provides:
 * - Load/save to userPrefs storage
 * - Step navigation
 * - Partial completion tracking
 * - Reset functionality
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getUserPrefs,
  setUserPrefs,
  completeOnboarding,
  needsOnboarding,
  resetUserPrefs,
  type UserPrefs,
  type DefaultMode,
  DEFAULT_USER_PREFS,
  DEFAULT_MILE_VALUATION_CPP,
} from '../../storage/userPrefs';

// ============================================
// TYPES
// ============================================

export type OnboardingStep = 0 | 1 | 2 | 3 | 4;

export interface OnboardingState {
  // Navigation
  currentStep: OnboardingStep;
  totalSteps: 5;
  canGoBack: boolean;
  canGoNext: boolean;
  
  // Collected values
  creditRemaining: number;
  creditChoice: 'full' | 'some' | 'none' | null;
  defaultMode: DefaultMode;
  milesBalance: number | undefined;
  wantsMilesFactored: boolean;
  mileValuationCpp: number;
  useConservativeValuation: boolean;
  enableAwardSearch: boolean;
  
  // Status
  isLoading: boolean;
  isCompleted: boolean;
  isSkipped: boolean;
  error: string | null;
}

export interface OnboardingActions {
  // Navigation
  goToStep: (step: OnboardingStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  
  // Step 1: Credit
  setCreditChoice: (choice: 'full' | 'some' | 'none') => void;
  setCreditAmount: (amount: number) => void;
  
  // Step 2: Style
  setDefaultMode: (mode: DefaultMode) => void;
  
  // Step 3: Miles
  setWantsMilesFactored: (wants: boolean) => void;
  setMilesBalance: (balance: number | undefined) => void;
  setUseConservativeValuation: (conservative: boolean) => void;
  setMileValuationCpp: (cpp: number) => void;
  
  // Step 4: PointsYeah
  setEnableAwardSearch: (enable: boolean) => void;
  
  // Completion
  complete: () => Promise<void>;
  skip: () => Promise<void>;
  reset: () => Promise<void>;
  rerunOnboarding: () => void;
}

export type UseOnboardingReturn = [OnboardingState, OnboardingActions];

// ============================================
// INITIAL STATE
// ============================================

const initialState: OnboardingState = {
  currentStep: 0,
  totalSteps: 5,
  canGoBack: false,
  canGoNext: true,
  
  creditRemaining: DEFAULT_USER_PREFS.creditRemaining,
  creditChoice: null,
  defaultMode: DEFAULT_USER_PREFS.defaultMode,
  milesBalance: undefined,
  wantsMilesFactored: false,
  mileValuationCpp: DEFAULT_MILE_VALUATION_CPP, // Use single source of truth
  useConservativeValuation: true,
  enableAwardSearch: DEFAULT_USER_PREFS.enableAwardSearch,
  
  isLoading: true,
  isCompleted: false,
  isSkipped: false,
  error: null,
};

// ============================================
// HOOK
// ============================================

export function useOnboarding(): UseOnboardingReturn {
  const [state, setState] = useState<OnboardingState>(initialState);
  
  // Use ref to always have access to latest state in callbacks
  const stateRef = useRef<OnboardingState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  
  // Load existing prefs on mount
  useEffect(() => {
    loadPrefs();
  }, []);
  
  const loadPrefs = async () => {
    try {
      const prefs = await getUserPrefs();
      const needs = await needsOnboarding();
      
      setState(prev => ({
        ...prev,
        creditRemaining: prefs.creditRemaining,
        creditChoice: prefs.creditRemaining === 300 ? 'full' : prefs.creditRemaining === 0 ? 'none' : 'some',
        defaultMode: prefs.defaultMode,
        milesBalance: prefs.milesBalance,
        wantsMilesFactored: prefs.milesBalance !== undefined,
        mileValuationCpp: prefs.mileValuationCpp,
        useConservativeValuation: !prefs.customMileValuation,
        enableAwardSearch: prefs.enableAwardSearch,
        isCompleted: !needs,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load preferences',
      }));
    }
  };
  
  // Update navigation state when step changes
  useEffect(() => {
    setState(prev => ({
      ...prev,
      canGoBack: prev.currentStep > 0,
      canGoNext: prev.currentStep < 4,
    }));
  }, [state.currentStep]);
  
  // ============================================
  // NAVIGATION ACTIONS
  // ============================================
  
  const goToStep = useCallback((step: OnboardingStep) => {
    setState(prev => ({ ...prev, currentStep: step }));
  }, []);
  
  const nextStep = useCallback(() => {
    setState(prev => {
      if (prev.currentStep < 4) {
        return { ...prev, currentStep: (prev.currentStep + 1) as OnboardingStep };
      }
      return prev;
    });
  }, []);
  
  const prevStep = useCallback(() => {
    setState(prev => {
      if (prev.currentStep > 0) {
        return { ...prev, currentStep: (prev.currentStep - 1) as OnboardingStep };
      }
      return prev;
    });
  }, []);
  
  // ============================================
  // STEP 1: CREDIT ACTIONS
  // ============================================
  
  const setCreditChoice = useCallback((choice: 'full' | 'some' | 'none') => {
    setState(prev => {
      let creditRemaining = prev.creditRemaining;
      if (choice === 'full') creditRemaining = 300;
      if (choice === 'none') creditRemaining = 0;
      // 'some' keeps current value or defaults to 150
      if (choice === 'some' && (prev.creditRemaining === 300 || prev.creditRemaining === 0)) {
        creditRemaining = 150;
      }
      
      return { ...prev, creditChoice: choice, creditRemaining };
    });
  }, []);
  
  const setCreditAmount = useCallback((amount: number) => {
    const clamped = Math.max(0, Math.min(300, Math.round(amount)));
    setState(prev => ({ ...prev, creditRemaining: clamped }));
  }, []);
  
  // ============================================
  // STEP 2: STYLE ACTIONS
  // ============================================
  
  const setDefaultMode = useCallback((mode: DefaultMode) => {
    setState(prev => ({ ...prev, defaultMode: mode }));
  }, []);
  
  // ============================================
  // STEP 3: MILES ACTIONS
  // ============================================
  
  const setWantsMilesFactored = useCallback((wants: boolean) => {
    setState(prev => ({
      ...prev,
      wantsMilesFactored: wants,
      milesBalance: wants ? (prev.milesBalance ?? 0) : undefined,
    }));
  }, []);
  
  const setMilesBalance = useCallback((balance: number | undefined) => {
    setState(prev => ({ ...prev, milesBalance: balance }));
  }, []);
  
  const setUseConservativeValuation = useCallback((conservative: boolean) => {
    setState(prev => ({
      ...prev,
      useConservativeValuation: conservative,
      mileValuationCpp: conservative ? 0.015 : prev.mileValuationCpp,
    }));
  }, []);
  
  const setMileValuationCpp = useCallback((cpp: number) => {
    const clamped = Math.max(0.005, Math.min(0.05, cpp));
    setState(prev => ({
      ...prev,
      mileValuationCpp: clamped,
      useConservativeValuation: false,
    }));
  }, []);
  
  // ============================================
  // STEP 4: POINTSYEAH ACTIONS
  // ============================================
  
  const setEnableAwardSearch = useCallback((enable: boolean) => {
    setState(prev => ({ ...prev, enableAwardSearch: enable }));
  }, []);
  
  // ============================================
  // COMPLETION ACTIONS
  // ============================================
  
  const complete = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Use stateRef.current to get the latest state values
      const currentState = stateRef.current;
      
      const prefsToSave: Partial<UserPrefs> = {
        creditRemaining: currentState.creditRemaining,
        creditAlreadyUsed: currentState.creditRemaining < 300,
        defaultMode: currentState.defaultMode,
        wantsLowHassle: currentState.defaultMode === 'easiest',
        milesBalance: currentState.wantsMilesFactored ? currentState.milesBalance : undefined,
        mileValuationCpp: currentState.mileValuationCpp,
        customMileValuation: !currentState.useConservativeValuation,
        enableAwardSearch: currentState.enableAwardSearch,
        autoPrefillPointsYeah: true,
      };
      
      console.log('[Onboarding] Saving prefs:', prefsToSave);
      await completeOnboarding(prefsToSave);
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        isCompleted: true,
        isSkipped: false,
      }));
      
      // Emit telemetry event (no PII)
      console.log('[Onboarding] Completed', {
        creditUsed: currentState.creditRemaining < 300,
        defaultMode: currentState.defaultMode,
        milesFactored: currentState.wantsMilesFactored,
        awardSearchEnabled: currentState.enableAwardSearch,
      });
    } catch (error) {
      console.error('[Onboarding] Error saving:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to save preferences',
      }));
    }
  }, []); // No dependencies - uses stateRef for fresh state
  
  const skip = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Save defaults but mark as skipped (can prompt again later)
      await setUserPrefs({
        ...DEFAULT_USER_PREFS,
        onboardingCompleted: true,
      });
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        isCompleted: true,
        isSkipped: true,
      }));
      
      // Emit telemetry event
      try {
        console.log('[Onboarding] Skipped');
      } catch {}
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to skip onboarding',
      }));
    }
  }, []);
  
  const reset = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await resetUserPrefs();
      setState({ ...initialState, isLoading: false });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to reset',
      }));
    }
  }, []);
  
  const rerunOnboarding = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: 0,
      isCompleted: false,
      isSkipped: false,
    }));
  }, []);
  
  // ============================================
  // RETURN
  // ============================================
  
  const actions: OnboardingActions = {
    goToStep,
    nextStep,
    prevStep,
    setCreditChoice,
    setCreditAmount,
    setDefaultMode,
    setWantsMilesFactored,
    setMilesBalance,
    setUseConservativeValuation,
    setMileValuationCpp,
    setEnableAwardSearch,
    complete,
    skip,
    reset,
    rerunOnboarding,
  };
  
  return [state, actions];
}

export default useOnboarding;
