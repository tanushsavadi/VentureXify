/**
 * StepChangeDialog — Glassmorphic confirmation dialog for step regression guards.
 *
 * Shown when the user's browser navigation (or a background data event) would
 * regress the comparison flow to an earlier step. Matches the existing OLED-dark
 * frosted-glass design language used throughout the side-panel.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/utils';

// ============================================
// TYPES
// ============================================

export interface StepChangeDialogProps {
  /** Whether the dialog is visible */
  isOpen: boolean;
  /** Dialog heading — e.g. "Return to Google Flights?" */
  title: string;
  /** Explanatory body text */
  description: string;
  /** Label for the confirm / "go back" button */
  confirmLabel: string;
  /** Label for the cancel / "stay" button */
  cancelLabel: string;
  /** Called when user confirms the regression */
  onConfirm: () => void;
  /** Called when user cancels (stays on current step) */
  onCancel: () => void;
  /** Optional emoji / icon rendered above the title */
  icon?: string;
}

// ============================================
// COMPONENT
// ============================================

export const StepChangeDialog: React.FC<StepChangeDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  icon,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="step-change-dialog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onCancel}
        >
          {/* Semi-transparent backdrop with blur */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Dialog card — glassmorphic */}
          <motion.div
            key="step-change-dialog-card"
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'relative w-full max-w-[340px] rounded-2xl p-5',
              'bg-[#1a1a2e]/95 backdrop-blur-xl',
              'border border-white/10',
              'shadow-2xl',
            )}
            style={{
              boxShadow:
                '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            }}
          >
            {/* Noise texture overlay */}
            <div
              className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-[0.012] mix-blend-overlay"
              style={{ backgroundImage: 'var(--noise-texture)' }}
            />

            {/* Inner highlight */}
            <div
              className="absolute inset-0 rounded-[inherit] pointer-events-none"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)' }}
            />

            {/* Visible content */}
            <div className="relative z-10">
              {/* Icon */}
              {icon && (
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/20 flex items-center justify-center">
                  <span className="text-2xl">{icon}</span>
                </div>
              )}

              {/* Title */}
              <h3 className="text-base font-semibold text-white text-center mb-2">
                {title}
              </h3>

              {/* Description */}
              <p className="text-sm text-white/50 text-center mb-5 leading-relaxed">
                {description}
              </p>

              {/* Buttons — confirm (accent), cancel (ghost) */}
              <div className="flex flex-col gap-2.5">
                {/* Confirm / go-back — teal/cyan accent button */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={onConfirm}
                  className={cn(
                    'w-full px-4 py-2.5 rounded-lg text-sm font-semibold',
                    'border border-[rgba(74,144,217,0.3)]',
                    'text-white',
                    'transition-all duration-150 ease-out',
                    'hover:border-[rgba(74,144,217,0.5)]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(74,144,217,0.5)]',
                  )}
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(74,144,217,0.2), rgba(45,106,163,0.15))',
                    boxShadow:
                      '0 0 20px rgba(74,144,217,0.1), inset 0 1px 0 rgba(255,255,255,0.06)',
                  }}
                >
                  {confirmLabel}
                </motion.button>

                {/* Cancel / stay — ghost button */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={onCancel}
                  className={cn(
                    'w-full px-4 py-2.5 rounded-lg text-sm font-medium',
                    'bg-transparent border border-transparent',
                    'text-white/40 hover:text-white/60',
                    'transition-all duration-150 ease-out',
                    'hover:bg-white/[0.04]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
                  )}
                >
                  {cancelLabel}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StepChangeDialog;
