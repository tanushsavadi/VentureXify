/**
 * OutOfOrderStepWarning — Phase 3 Step Navigation Safeguard
 *
 * Glassmorphic warning banner shown when the user lands on a step
 * they shouldn't be on yet (e.g. Google Flights before capturing
 * the portal price). Replaces the confusing "Waiting for flight
 * selection…" spinner with a clear, actionable message.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import { GlassButton } from './index';
import { cn } from '../../../lib/utils';

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

export interface OutOfOrderStepWarningProps {
  /** The step the current page corresponds to (e.g. 2 for Google Flights) */
  currentStep: number;
  /** Which steps have captured data (e.g. [] if nothing captured) */
  completedSteps: number[];
  /** Optional callback to navigate user to the correct step */
  onGoToStep?: (step: number) => void;
}

// ────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────

interface StepMeta {
  label: string;
  shortLabel: string;
}

const STEP_META: Record<number, StepMeta> = {
  1: { label: 'Capture portal price', shortLabel: 'Portal' },
  2: { label: 'Find direct price', shortLabel: 'Direct' },
  3: { label: 'See verdict', shortLabel: 'Verdict' },
};

function getMissingSteps(currentStep: number, completedSteps: number[]): number[] {
  const needed: number[] = [];
  for (let s = 1; s < currentStep; s++) {
    if (!completedSteps.includes(s)) needed.push(s);
  }
  return needed;
}

function getTitle(currentStep: number, missing: number[]): string {
  if (missing.length === 0) return 'Almost There';
  if (missing.includes(1) && currentStep === 2) return 'Step 1 Required First';
  if (currentStep === 3 && missing.length >= 2) return 'Both Steps Needed First';
  if (currentStep === 3 && missing.includes(1)) return 'Step 1 Required First';
  if (currentStep === 3 && missing.includes(2)) return 'Step 2 Required First';
  return `Step ${missing[0]} Required First`;
}

function getDescription(currentStep: number, missing: number[]): string {
  if (currentStep === 2 && missing.includes(1)) {
    return 'Start with Step 1 — go to the Capital One Travel Portal and search for your flight to capture the portal price.';
  }
  if (currentStep === 3 && missing.length >= 2) {
    return 'Both prices needed — capture the portal price and the direct price before viewing the verdict.';
  }
  if (currentStep === 3 && missing.includes(1)) {
    return 'The portal price is missing. Go to the Capital One Travel Portal and search for your flight first.';
  }
  if (currentStep === 3 && missing.includes(2)) {
    return 'The direct price is missing. Search on Google Flights to capture the direct price.';
  }
  return 'Complete the earlier steps before continuing.';
}

function getActionLabel(missing: number[]): string {
  if (missing.includes(1)) return 'Go to Portal';
  if (missing.includes(2)) return 'Go to Google Flights';
  return 'Go Back';
}

function getActionStep(missing: number[]): number {
  return missing.length > 0 ? missing[0] : 1;
}

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

export const OutOfOrderStepWarning: React.FC<OutOfOrderStepWarningProps> = ({
  currentStep,
  completedSteps,
  onGoToStep,
}) => {
  const missing = getMissingSteps(currentStep, completedSteps);
  const title = getTitle(currentStep, missing);
  const description = getDescription(currentStep, missing);
  const actionLabel = getActionLabel(missing);
  const actionStep = getActionStep(missing);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}
      className="text-center py-8"
    >
      {/* Warning icon */}
      <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 flex items-center justify-center">
        <AlertTriangle className="w-10 h-10 text-amber-400/70" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-[var(--text-tertiary)] mb-6 max-w-[280px] mx-auto leading-relaxed">
        {description}
      </p>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 mb-6 flex-wrap px-4">
        {[1, 2, 3].map((step, idx) => {
          const isCompleted = completedSteps.includes(step);
          const isMissing = missing.includes(step);
          const isCurrent = step === currentStep;
          const meta = STEP_META[step];

          return (
            <React.Fragment key={step}>
              {idx > 0 && (
                <span className="text-[var(--text-muted)]">→</span>
              )}
              <div
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors',
                  isCompleted
                    ? 'bg-emerald-500/10 border-emerald-500/20'
                    : isMissing
                      ? 'bg-amber-500/10 border-amber-500/20'
                      : isCurrent
                        ? 'bg-white/[0.06] border-white/[0.12]'
                        : 'bg-white/[0.04] border-white/[0.08]'
                )}
              >
                {isCompleted ? (
                  <span className="text-xs text-emerald-400 font-medium">
                    ✓ {meta.shortLabel}
                  </span>
                ) : (
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isMissing ? 'text-amber-300' : 'text-[var(--text-muted)]'
                    )}
                  >
                    {`${step === 1 ? '①' : step === 2 ? '②' : '③'} ${meta.label}`}
                  </span>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Action button */}
      {onGoToStep && (
        <GlassButton
          variant="primary"
          className="w-auto mx-auto"
          onClick={() => onGoToStep(actionStep)}
        >
          <ExternalLink className="w-4 h-4" />
          {actionLabel}
        </GlassButton>
      )}
    </motion.div>
  );
};

OutOfOrderStepWarning.displayName = 'OutOfOrderStepWarning';

export default OutOfOrderStepWarning;
