/**
 * Premium Segmented Control / Stepper
 * Glass morphism style with glow and animated underline
 * v4 - Ultra compact for narrow extension panels
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { Check } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface SegmentedControlItem {
  id: string | number;
  label: string;
  icon?: React.ReactNode;
}

interface GlassSegmentedControlProps {
  items: SegmentedControlItem[];
  activeId: string | number;
  onChange?: (id: string | number) => void;
  variant?: 'tabs' | 'stepper';
  completedIds?: (string | number)[];
  className?: string;
}

// ============================================
// GLASS SEGMENTED CONTROL
// ============================================

export const GlassSegmentedControl: React.FC<GlassSegmentedControlProps> = ({
  items,
  activeId,
  onChange,
  variant = 'tabs',
  completedIds = [],
  className,
}) => {
  const activeIndex = items.findIndex(item => item.id === activeId);

  if (variant === 'stepper') {
    return (
      <div
        className={cn(
          'flex items-center gap-1 p-1.5',
          'bg-white/[0.04] border border-white/[0.08]',
          'rounded-2xl backdrop-blur-md',
          className
        )}
      >
        {items.map((item, index) => {
          const isActive = item.id === activeId;
          const isCompleted = completedIds.includes(item.id);
          const isPast = index < activeIndex;

          return (
            <React.Fragment key={item.id}>
              {/* Step */}
              <motion.button
                onClick={() => onChange?.(item.id)}
                className={cn(
                  'relative flex items-center gap-2 px-3 py-2',
                  'rounded-xl transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50',
                  isActive && 'z-10'
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {/* Background glow for active */}
                {isActive && (
                  <motion.div
                    layoutId="stepper-glow"
                    className="absolute inset-0 rounded-xl bg-white/[0.08] border border-white/[0.15]"
                    style={{
                      boxShadow: '0 0 20px rgba(99, 102, 241, 0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}

                {/* Step number / check */}
                <div
                  className={cn(
                    'relative z-10 flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold',
                    'transition-all duration-200',
                    isActive && 'bg-indigo-500/30 text-white border border-indigo-500/50 shadow-[0_0_12px_rgba(99,102,241,0.4)]',
                    isCompleted && 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
                    !isActive && !isCompleted && 'bg-white/[0.06] text-white/40 border border-white/[0.10]'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-3 h-3" strokeWidth={3} />
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    'relative z-10 text-sm font-medium transition-colors duration-200',
                    isActive && 'text-white',
                    isCompleted && 'text-white/80',
                    !isActive && !isCompleted && 'text-white/50'
                  )}
                >
                  {item.label}
                </span>
              </motion.button>

              {/* Connector */}
              {index < items.length - 1 && (
                <div className="flex-1 min-w-[20px] mx-1 h-[2px] relative">
                  {/* Background line */}
                  <div className="absolute inset-0 bg-white/[0.08] rounded-full" />
                  {/* Progress line */}
                  <motion.div
                    className="absolute inset-y-0 left-0 bg-indigo-500/60 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{
                      width: isPast || isCompleted ? '100%' : isActive ? '50%' : '0%',
                    }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  // Tabs variant
  return (
    <div
      className={cn(
        'relative flex items-center gap-0.5 p-1',
        'bg-white/[0.04] border border-white/[0.08]',
        'rounded-xl backdrop-blur-md',
        className
      )}
    >
      {items.map((item) => {
        const isActive = item.id === activeId;

        return (
          <motion.button
            key={item.id}
            onClick={() => onChange?.(item.id)}
            className={cn(
              'relative flex-1 flex items-center justify-center gap-2 px-4 py-2',
              'rounded-lg transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50',
              'text-sm font-medium',
              isActive ? 'text-white' : 'text-white/50 hover:text-white/70'
            )}
            whileHover={{ scale: isActive ? 1 : 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Active background */}
            {isActive && (
              <motion.div
                layoutId="tab-bg"
                className="absolute inset-0 rounded-lg bg-white/[0.10] border border-white/[0.15]"
                style={{
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}

            {/* Active underline glow */}
            {isActive && (
              <motion.div
                layoutId="tab-glow"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px]"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.8), transparent)',
                  boxShadow: '0 2px 12px rgba(99, 102, 241, 0.5)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}

            {/* Content */}
            <span className="relative z-10 flex items-center gap-2">
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              {item.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};

// ============================================
// PROGRESS RAIL - Ultra Compact
// Designed for narrow extension panels (~300px)
// ============================================

interface ProgressRailProps {
  currentStep: number;
  steps: { label: string; icon?: React.ReactNode }[];
  onStepClick?: (step: number) => void;
  /** Which steps can be navigated to (defaults to completed + current) */
  enabledSteps?: number[];
  className?: string;
}

export const GlassProgressRail: React.FC<ProgressRailProps> = ({
  currentStep,
  steps,
  onStepClick,
  enabledSteps,
  className,
}) => {
  // By default, allow clicking on completed steps and current step
  const canClickStep = (stepNum: number) => {
    if (enabledSteps) {
      return enabledSteps.includes(stepNum);
    }
    // Default: can click any step up to current
    return stepNum <= currentStep;
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-center gap-y-1 w-full',
        'py-2 px-2',
        'bg-white/[0.03] border border-white/[0.06]',
        'rounded-xl backdrop-blur-md',
        className
      )}
    >
      {steps.map((step, index) => {
        const stepNum = index + 1;
        const isActive = currentStep === stepNum;
        const isCompleted = currentStep > stepNum;
        const isClickable = canClickStep(stepNum) && onStepClick;

        return (
          <React.Fragment key={index}>
            {/* Step indicator */}
            <motion.button
              onClick={() => isClickable && onStepClick?.(stepNum)}
              disabled={!isClickable}
              className={cn(
                'relative flex items-center gap-1.5 flex-shrink-0',
                'py-1 px-2',
                'rounded-lg transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500/50',
                // Clickable styling
                isClickable && !isActive && 'hover:bg-white/[0.04] cursor-pointer',
                !isClickable && !isActive && 'cursor-default'
              )}
              whileTap={isClickable ? { scale: 0.97 } : undefined}
            >
              {/* Background for active state */}
              {isActive && (
                <motion.div
                  layoutId="progress-active-bg"
                  className="absolute inset-0 bg-white/[0.08] rounded-lg border border-white/[0.10]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              {/* Number circle */}
              <div
                className={cn(
                  'relative z-10 flex items-center justify-center',
                  'w-5 h-5 rounded-full',
                  'text-[10px] font-semibold',
                  'transition-all duration-200 flex-shrink-0',
                  isActive && 'bg-indigo-500/35 text-white border border-indigo-400/50',
                  isCompleted && 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/40',
                  !isActive && !isCompleted && 'bg-white/[0.04] text-white/30 border border-white/[0.08]'
                )}
              >
                {isCompleted ? (
                  <Check className="w-2.5 h-2.5" strokeWidth={3} />
                ) : (
                  stepNum
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  'relative z-10 text-sm font-semibold tracking-tight whitespace-nowrap',
                  'transition-colors duration-200',
                  isActive && 'text-white',
                  isCompleted && 'text-white/70',
                  !isActive && !isCompleted && 'text-white/45'
                )}
              >
                {step.label}
              </span>
            </motion.button>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="w-4 h-[1.5px] mx-1 relative flex-shrink-0">
                <div className="absolute inset-0 bg-white/[0.08] rounded-full" />
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full bg-indigo-500/50"
                  initial={false}
                  animate={{
                    width: isCompleted ? '100%' : isActive ? '50%' : '0%',
                  }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default GlassSegmentedControl;
