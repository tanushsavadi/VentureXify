/**
 * OnboardingFlow Component
 * 
 * Conversational, fast (≤90 seconds) onboarding wizard for VentureXify.
 * Uses glass component system for visual consistency with main application.
 * 
 * Steps:
 * 0. Welcome (5 seconds)
 * 1. Credit status (most important)
 * 2. Your style (Cheapest / Max Value / Easiest)
 * 3. Miles preferences
 * 4. PointsYeah opt-in
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding } from './useOnboarding';
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  GlassInput,
  GlassDivider,
  AuroraBackground,
} from '../components/glass';
import { cn } from '../../lib/utils';

// ============================================
// ANIMATED LOGO (Matching main app)
// ============================================

const AnimatedLogo: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
  };
  
  return (
    <motion.div
      className={cn(
        sizeClasses[size],
        'rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-white/10 flex items-center justify-center overflow-hidden relative'
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <span className="text-white font-bold text-xl relative z-10">VX</span>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20"
        animate={{ x: ['0%', '100%', '0%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
    </motion.div>
  );
};

// ============================================
// PROGRESS BAR COMPONENT (Glass style)
// ============================================

const ProgressBar: React.FC<{ currentStep: number; totalSteps: number }> = ({ currentStep, totalSteps }) => (
  <div className="px-5 pt-5 pb-2">
    <div className="flex gap-1.5 mb-2">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex-1 h-1 rounded-full transition-all duration-300',
            i + 1 < currentStep
              ? 'bg-indigo-500/60'
              : i + 1 === currentStep
                ? 'bg-white/90'
                : 'bg-white/10'
          )}
        />
      ))}
    </div>
    <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
      Step {currentStep} of {totalSteps}
    </p>
  </div>
);

// ============================================
// CHOICE CARD COMPONENT (Glass style)
// ============================================

interface ChoiceCardProps {
  emoji: string;
  label: string;
  description: string;
  isActive: boolean;
  onClick: () => void;
}

const ChoiceCard: React.FC<ChoiceCardProps> = ({
  emoji,
  label,
  description,
  isActive,
  onClick,
}) => (
  <motion.button
    onClick={onClick}
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.99 }}
    className={cn(
      'w-full p-4 rounded-xl text-left transition-all duration-200',
      'backdrop-blur-md border',
      'flex items-center gap-3',
      isActive
        ? 'bg-indigo-500/15 border-indigo-500/40'
        : 'bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.12]'
    )}
  >
    <span className="text-2xl w-10 text-center flex-shrink-0">{emoji}</span>
    <div className="flex-1 min-w-0">
      <div className={cn(
        'font-semibold text-sm mb-0.5',
        isActive ? 'text-white' : 'text-white/90'
      )}>
        {label}
      </div>
      <div className="text-xs text-white/50 leading-relaxed">{description}</div>
    </div>
    {isActive && (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0"
      >
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </motion.div>
    )}
  </motion.button>
);

// ============================================
// CHIP SELECTOR COMPONENT
// ============================================

interface ChipSelectorProps {
  options: { value: number | string; label: string }[];
  selectedValue: number | string | undefined;
  onSelect: (value: number | string) => void;
}

const ChipSelector: React.FC<ChipSelectorProps> = ({ options, selectedValue, onSelect }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onSelect(opt.value)}
        className={cn(
          'px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
          'border backdrop-blur-sm',
          selectedValue === opt.value
            ? 'bg-indigo-500/20 border-indigo-500/40 text-white'
            : 'bg-white/[0.04] border-white/[0.08] text-white/60 hover:bg-white/[0.08] hover:text-white/80'
        )}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

// ============================================
// TOGGLE SWITCH COMPONENT
// ============================================

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={cn(
      'relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0',
      checked ? 'bg-indigo-500' : 'bg-white/20'
    )}
  >
    <motion.div
      className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md"
      animate={{ left: checked ? 'calc(100% - 20px)' : '4px' }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
    />
  </button>
);

// ============================================
// STEP COMPONENTS
// ============================================

interface StepProps {
  onNext: () => void;
  onSkip: () => void;
}

/**
 * Step 0: Welcome
 */
const WelcomeStep: React.FC<StepProps & { onStart: () => void }> = ({ onStart, onSkip }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="flex-1 flex flex-col px-5 pb-5"
  >
    <div className="flex-1 flex flex-col items-center justify-center text-center pt-8">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring' }}
        className="mb-6"
      >
        <AnimatedLogo size="lg" />
      </motion.div>
      
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-3xl font-bold text-white mb-3"
      >
        Welcome to VentureXify
      </motion.h1>
      
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-base text-white/60 max-w-[280px] mb-8 leading-relaxed"
      >
        I'll help you book flights the smartest way with your Venture X card.
      </motion.p>
      
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <GlassCard variant="default" className="p-4 max-w-[260px]">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <span>⏱️</span>
            <span>60-second setup. You can change this anytime.</span>
          </div>
        </GlassCard>
      </motion.div>
    </div>
    
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 }}
      className="space-y-3 mt-auto pt-6"
    >
      <GlassButton variant="primary" className="w-full py-3.5" onClick={onStart}>
        Let's set it up →
      </GlassButton>
      <GlassButton variant="ghost" className="w-full" onClick={onSkip}>
        Skip for now
      </GlassButton>
    </motion.div>
  </motion.div>
);

/**
 * Step 1: Credit Status
 */
const CreditStep: React.FC<StepProps & {
  creditChoice: 'full' | 'some' | 'none' | null;
  creditRemaining: number;
  onChoiceSelect: (choice: 'full' | 'some' | 'none') => void;
  onAmountChange: (amount: number) => void;
}> = ({ creditChoice, creditRemaining, onChoiceSelect, onAmountChange, onNext }) => {
  const quickChips = [
    { value: 250, label: '$250' },
    { value: 200, label: '$200' },
    { value: 150, label: '$150' },
    { value: 100, label: '$100' },
    { value: 50, label: '$50' },
  ];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 flex flex-col px-5 pb-5 overflow-y-auto"
    >
      <h1 className="text-2xl font-bold text-white mb-2">
        How much credit do you have left?
      </h1>
      <p className="text-sm text-white/50 mb-6 leading-relaxed">
        Your $300 annual travel credit makes a big difference in the math.
      </p>
      
      <div className="space-y-3 mb-4">
        <ChoiceCard
          emoji="💰"
          label="$300 (I haven't used it)"
          description="Full credit available this card year"
          isActive={creditChoice === 'full'}
          onClick={() => onChoiceSelect('full')}
        />
        <ChoiceCard
          emoji="💵"
          label="Some left"
          description="I've used part of my credit"
          isActive={creditChoice === 'some'}
          onClick={() => onChoiceSelect('some')}
        />
        <ChoiceCard
          emoji="✅"
          label="$0 (used it)"
          description="Already maximized this year"
          isActive={creditChoice === 'none'}
          onClick={() => onChoiceSelect('none')}
        />
      </div>
      
      {/* Show amount input only for "some" */}
      <AnimatePresence>
        {creditChoice === 'some' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <label className="block text-xs font-medium text-white/50 mb-3">
              How much remaining?
            </label>
            <ChipSelector
              options={quickChips}
              selectedValue={creditRemaining}
              onSelect={(v) => onAmountChange(v as number)}
            />
            <div className="mt-3">
              <input
                type="number"
                min="0"
                max="300"
                value={creditRemaining}
                onChange={(e) => onAmountChange(parseInt(e.target.value) || 0)}
                placeholder="Enter amount"
                className={cn(
                  'w-full px-4 py-3 text-sm rounded-xl',
                  'bg-white/[0.04] border border-white/[0.08]',
                  'text-white placeholder:text-white/30',
                  'focus:outline-none focus:bg-white/[0.06] focus:border-indigo-500/40'
                )}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {creditChoice && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-emerald-400/80 mb-4"
        >
          Nice — this makes your verdict way more accurate. ✨
        </motion.p>
      )}
      
      <div className="mt-auto pt-4">
        <GlassButton
          variant="primary"
          className="w-full py-3.5"
          onClick={onNext}
          disabled={!creditChoice}
        >
          Continue →
        </GlassButton>
      </div>
    </motion.div>
  );
};

/**
 * Step 2: Your Style
 */
const StyleStep: React.FC<StepProps & {
  defaultMode: 'cheapest' | 'max_value' | 'easiest';
  onModeSelect: (mode: 'cheapest' | 'max_value' | 'easiest') => void;
}> = ({ defaultMode, onModeSelect, onNext }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="flex-1 flex flex-col px-5 pb-5 overflow-y-auto"
  >
    <h1 className="text-2xl font-bold text-white mb-2">
      What's your default vibe?
    </h1>
    <p className="text-sm text-white/50 mb-6 leading-relaxed">
      This sets which recommendation you see first. You can always switch tabs.
    </p>
    
    <div className="space-y-3 mb-4">
      <ChoiceCard
        emoji="💸"
        label="Lowest cash today"
        description="Minimize out-of-pocket spending"
        isActive={defaultMode === 'cheapest'}
        onClick={() => onModeSelect('cheapest')}
      />
      <ChoiceCard
        emoji="✨"
        label="Max value"
        description="I'll use points if the math is good"
        isActive={defaultMode === 'max_value'}
        onClick={() => onModeSelect('max_value')}
      />
      <ChoiceCard
        emoji="😌"
        label="Low hassle"
        description="Avoid complicated bookings"
        isActive={defaultMode === 'easiest'}
        onClick={() => onModeSelect('easiest')}
      />
    </div>
    
    <p className="text-xs text-white/40 mb-4">
      You can change this anytime in Settings.
    </p>
    
    <div className="mt-auto pt-4">
      <GlassButton variant="primary" className="w-full py-3.5" onClick={onNext}>
        Continue →
      </GlassButton>
    </div>
  </motion.div>
);

/**
 * Step 3: Miles Preferences
 */
const MilesStep: React.FC<StepProps & {
  wantsMilesFactored: boolean;
  milesBalance: number | undefined;
  useConservativeValuation: boolean;
  mileValuationCpp: number;
  onWantsChange: (wants: boolean) => void;
  onBalanceChange: (balance: number) => void;
  onValuationTypeChange: (conservative: boolean) => void;
  onValuationChange: (cpp: number) => void;
}> = ({
  wantsMilesFactored,
  milesBalance,
  useConservativeValuation,
  mileValuationCpp,
  onWantsChange,
  onBalanceChange,
  onValuationTypeChange,
  onValuationChange,
  onNext,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="flex-1 flex flex-col px-5 pb-5 overflow-y-auto"
  >
    <h1 className="text-2xl font-bold text-white mb-2">
      Miles preferences
    </h1>
    <p className="text-sm text-white/50 mb-6 leading-relaxed">
      Optional: Help me personalize your comparisons.
    </p>
    
    {/* Miles Balance Question */}
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1 mr-4">
          <p className="text-sm font-medium text-white mb-1">
            Factor in your miles balance?
          </p>
          <p className="text-xs text-white/40">
            Track if you have enough for redemptions
          </p>
        </div>
        <ToggleSwitch
          checked={wantsMilesFactored}
          onChange={onWantsChange}
        />
      </div>
      
      <AnimatePresence>
        {wantsMilesFactored && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <input
              type="number"
              min="0"
              value={milesBalance ?? ''}
              onChange={(e) => onBalanceChange(parseInt(e.target.value) || 0)}
              placeholder="Enter miles balance"
              className={cn(
                'w-full px-4 py-3 text-sm rounded-xl',
                'bg-white/[0.04] border border-white/[0.08]',
                'text-white placeholder:text-white/30',
                'focus:outline-none focus:bg-white/[0.06] focus:border-indigo-500/40'
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    
    <GlassDivider className="mb-6" />
    
    {/* Mile Valuation Question */}
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1 mr-4">
          <p className="text-sm font-medium text-white mb-1">
            Custom mile valuation?
          </p>
          <p className="text-xs text-white/40">
            Default: 1.5¢ per mile (conservative)
          </p>
        </div>
        <ToggleSwitch
          checked={!useConservativeValuation}
          onChange={(checked) => onValuationTypeChange(!checked)}
        />
      </div>
      
      <AnimatePresence>
        {!useConservativeValuation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="text-center mb-2">
              <span className="text-xl font-bold text-white">
                {(mileValuationCpp * 100).toFixed(1)}¢
              </span>
              <span className="text-sm text-white/40 ml-1">per mile</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="3.0"
              step="0.1"
              value={mileValuationCpp * 100}
              onChange={(e) => onValuationChange(parseFloat(e.target.value) / 100)}
              className={cn(
                'w-full h-1.5 rounded-full appearance-none cursor-pointer mb-2',
                'bg-white/15',
                '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4',
                '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500'
              )}
            />
            <div className="flex justify-between text-[10px] text-white/30">
              <span>0.5¢</span>
              <span>3.0¢</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <GlassCard variant="default" className="mt-4 p-3">
        <div className="flex items-start gap-2 text-xs text-white/50">
          <span>💡</span>
          <span>This only affects "net" math. Cash price is always shown.</span>
        </div>
      </GlassCard>
    </div>
    
    <div className="mt-auto pt-6">
      <GlassButton variant="primary" className="w-full py-3.5" onClick={onNext}>
        Continue →
      </GlassButton>
    </div>
  </motion.div>
);

/**
 * Step 4: PointsYeah Opt-in
 */
const PointsYeahStep: React.FC<StepProps & {
  enableAwardSearch: boolean;
  onToggle: (enable: boolean) => void;
  onComplete: () => void;
}> = ({ enableAwardSearch, onToggle, onComplete }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="flex-1 flex flex-col px-5 pb-5 overflow-y-auto"
  >
    <h1 className="text-2xl font-bold text-white mb-2">
      Want award options?
    </h1>
    <p className="text-sm text-white/50 mb-6 leading-relaxed">
      Check award availability via PointsYeah when it might be worth it.
    </p>
    
    <div className="space-y-3 mb-4">
      <ChoiceCard
        emoji="✈️"
        label="Yes — show me awards"
        description='via PointsYeah in "Max Value" tab'
        isActive={enableAwardSearch}
        onClick={() => onToggle(true)}
      />
      <ChoiceCard
        emoji="🚫"
        label="Not now"
        description="Keep it simple"
        isActive={!enableAwardSearch}
        onClick={() => onToggle(false)}
      />
    </div>
    
    <AnimatePresence>
      {enableAwardSearch && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <GlassCard variant="default" className="p-4">
            <div className="space-y-2 text-xs text-white/50 leading-relaxed">
              <p className="flex items-start gap-2">
                <span>📍</span>
                <span>When it's worth it, I'll open PointsYeah prefilled with your flight.</span>
              </p>
              <p className="flex items-start gap-2">
                <span>🎫</span>
                <span>You'll still book with the airline — I'm just speeding up the search.</span>
              </p>
            </div>
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
    
    <div className="mt-auto pt-6">
      <GlassButton variant="primary" className="w-full py-3.5" onClick={onComplete}>
        Finish setup ✓
      </GlassButton>
    </div>
  </motion.div>
);

/**
 * Completion Screen
 */
const CompleteStep: React.FC<{
  creditRemaining: number;
  defaultMode: string;
  enableAwardSearch: boolean;
  mileValuationCpp: number;
  onTryIt: () => void;
  onOpenSettings: () => void;
}> = ({ creditRemaining, defaultMode, enableAwardSearch, mileValuationCpp, onTryIt, onOpenSettings }) => {
  const modeLabels: Record<string, string> = {
    cheapest: 'Lowest cash',
    max_value: 'Max value',
    easiest: 'Low hassle',
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col px-5 pb-5 text-center"
    >
      <div className="flex-1 flex flex-col items-center justify-center pt-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.2 }}
          className="text-6xl mb-6"
        >
          ✅
        </motion.div>
        
        <h1 className="text-2xl font-bold text-white mb-2">You're set!</h1>
        <p className="text-sm text-white/50 mb-6">
          Your verdicts are now personalized.
        </p>
        
        <GlassCard variant="elevated" className="w-full max-w-[300px] text-left">
          <div className="space-y-0">
            <div className="flex justify-between py-3 border-b border-white/[0.06]">
              <span className="text-xs text-white/50">Credit remaining</span>
              <span className="text-xs text-white font-medium">${creditRemaining}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-white/[0.06]">
              <span className="text-xs text-white/50">Default mode</span>
              <span className="text-xs text-white font-medium">{modeLabels[defaultMode]}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-white/[0.06]">
              <span className="text-xs text-white/50">Mile valuation</span>
              <span className="text-xs text-white font-medium">{(mileValuationCpp * 100).toFixed(1)}¢</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-xs text-white/50">Award search</span>
              <GlassBadge
                variant={enableAwardSearch ? 'success' : 'muted'}
                size="sm"
              >
                {enableAwardSearch ? 'On' : 'Off'}
              </GlassBadge>
            </div>
          </div>
        </GlassCard>
        
        <div className="mt-6 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] max-w-[280px]">
          <p className="text-[10px] text-white/40 leading-relaxed">
            🔒 <strong className="text-white/50">Stored locally:</strong> credit remaining, preferences, optional miles balance.
            We don't store card numbers or log into Capital One.
          </p>
        </div>
      </div>
      
      <div className="space-y-3 mt-auto pt-6">
        <GlassButton variant="primary" className="w-full py-3.5" onClick={onTryIt}>
          Try it on this page →
        </GlassButton>
        <GlassButton variant="ghost" className="w-full" onClick={onOpenSettings}>
          Open Settings
        </GlassButton>
      </div>
    </motion.div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

interface OnboardingFlowProps {
  onComplete: () => void;
  onOpenSettings?: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, onOpenSettings }) => {
  const [state, actions] = useOnboarding();
  
  // Handle completion
  const handleComplete = async () => {
    await actions.complete();
  };
  
  // Handle skip
  const handleSkip = async () => {
    await actions.skip();
    onComplete();
  };
  
  // Handle try it
  const handleTryIt = () => {
    onComplete();
  };
  
  // Handle open settings
  const handleOpenSettings = () => {
    if (onOpenSettings) {
      onOpenSettings();
    }
  };
  
  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center relative overflow-hidden">
        <AuroraBackground />
        <div className="text-center relative z-10">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full mx-auto mb-3"
          />
          <p className="text-white/40 text-sm">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Show completion screen if finished
  if (state.isCompleted && state.currentStep === 4) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
        <AuroraBackground />
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/15 via-transparent to-purple-950/10 pointer-events-none" />
        <CompleteStep
          creditRemaining={state.creditRemaining}
          defaultMode={state.defaultMode}
          enableAwardSearch={state.enableAwardSearch}
          mileValuationCpp={state.mileValuationCpp}
          onTryIt={handleTryIt}
          onOpenSettings={handleOpenSettings}
        />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
      {/* Background */}
      <AuroraBackground />
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/15 via-transparent to-purple-950/10 pointer-events-none" />
      
      {/* Progress bar (hidden on welcome) */}
      {state.currentStep > 0 && (
        <ProgressBar currentStep={state.currentStep} totalSteps={4} />
      )}
      
      {/* Step content */}
      <AnimatePresence mode="wait">
        {state.currentStep === 0 && (
          <WelcomeStep
            key="welcome"
            onStart={actions.nextStep}
            onSkip={handleSkip}
            onNext={actions.nextStep}
          />
        )}
        
        {state.currentStep === 1 && (
          <CreditStep
            key="credit"
            creditChoice={state.creditChoice}
            creditRemaining={state.creditRemaining}
            onChoiceSelect={actions.setCreditChoice}
            onAmountChange={actions.setCreditAmount}
            onNext={actions.nextStep}
            onSkip={handleSkip}
          />
        )}
        
        {state.currentStep === 2 && (
          <StyleStep
            key="style"
            defaultMode={state.defaultMode}
            onModeSelect={actions.setDefaultMode}
            onNext={actions.nextStep}
            onSkip={handleSkip}
          />
        )}
        
        {state.currentStep === 3 && (
          <MilesStep
            key="miles"
            wantsMilesFactored={state.wantsMilesFactored}
            milesBalance={state.milesBalance}
            useConservativeValuation={state.useConservativeValuation}
            mileValuationCpp={state.mileValuationCpp}
            onWantsChange={actions.setWantsMilesFactored}
            onBalanceChange={actions.setMilesBalance}
            onValuationTypeChange={actions.setUseConservativeValuation}
            onValuationChange={actions.setMileValuationCpp}
            onNext={actions.nextStep}
            onSkip={handleSkip}
          />
        )}
        
        {state.currentStep === 4 && !state.isCompleted && (
          <PointsYeahStep
            key="pointsyeah"
            enableAwardSearch={state.enableAwardSearch}
            onToggle={actions.setEnableAwardSearch}
            onComplete={handleComplete}
            onNext={handleComplete}
            onSkip={handleSkip}
          />
        )}
      </AnimatePresence>
      
      {/* Back button footer (steps 2-4) */}
      {state.currentStep > 1 && state.currentStep <= 4 && !state.isCompleted && (
        <footer className="px-5 py-4 border-t border-white/[0.04] flex-shrink-0">
          <GlassButton variant="ghost" onClick={actions.prevStep}>
            ← Back
          </GlassButton>
        </footer>
      )}
    </div>
  );
};

export default OnboardingFlow;
