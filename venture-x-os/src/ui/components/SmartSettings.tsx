/**
 * Smart Settings Modal — Premium Frosted Glass Design
 *
 * Glassmorphic settings panel matching the BottomNav floating pill aesthetic.
 * Uses translucent surfaces, backdrop blur, and multi-layer shadows for
 * an Apple-inspired frosted glass look on OLED black.
 *
 * Includes:
 * - Quick Defaults (most users)
 * - Miles & Valuation
 * - Award Search (PointsYeah)
 * - Advanced (collapsed by default)
 *
 * Changes take effect immediately and update verdict.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getUserPrefs,
  setUserPrefs,
  resetUserPrefs,
  type UserPrefs,
  type DefaultMode,
  type PortalMilesBasis,
  type DefaultOpenTab,
  DEFAULT_USER_PREFS,
  DEFAULT_MILE_VALUATION_CPP,
  getAssumptionLabels,
} from '../../storage/userPrefs';
import { POINTSYEAH_TIPS } from '../../engine/pointsyeah';
import { cn } from '../../lib/utils';

// ============================================
// SLIDER CSS (Firefox compatibility) — inject once
// ============================================

const sliderStyles = `
  .vx-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.12);
    cursor: pointer;
    margin-top: 12px;
    margin-bottom: 8px;
  }
  .vx-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: linear-gradient(135deg, #5b9bd5, #4a90d9);
    cursor: pointer;
    border: 2px solid rgba(255,255,255,0.15);
    box-shadow: 0 2px 8px rgba(74,144,217,0.4);
  }
  .vx-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: linear-gradient(135deg, #5b9bd5, #4a90d9);
    cursor: pointer;
    border: 2px solid rgba(255,255,255,0.15);
    box-shadow: 0 2px 8px rgba(74,144,217,0.4);
  }
  .vx-slider::-moz-range-track {
    background: rgba(255,255,255,0.12);
    border-radius: 3px;
    height: 6px;
  }
  .vx-slider:focus {
    outline: none;
  }
  .vx-slider:focus::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px rgba(74, 144, 217, 0.3), 0 2px 8px rgba(74,144,217,0.4);
  }
  .vx-slider:focus::-moz-range-thumb {
    box-shadow: 0 0 0 3px rgba(74, 144, 217, 0.3), 0 2px 8px rgba(74,144,217,0.4);
  }
`;

if (typeof document !== 'undefined') {
  const existingStyle = document.getElementById('vx-slider-styles');
  if (!existingStyle) {
    const styleEl = document.createElement('style');
    styleEl.id = 'vx-slider-styles';
    styleEl.textContent = sliderStyles;
    document.head.appendChild(styleEl);
  }
}

// ============================================
// SUB-COMPONENTS
// ============================================

/** Accessible toggle with glassmorphic styling */
const Toggle: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}> = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    className={cn(
      'relative w-11 h-6 rounded-full flex-shrink-0 cursor-pointer',
      'transition-all duration-200 border',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a90d9]/50',
      checked
        ? 'bg-emerald-500/30 border-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
        : 'bg-white/[0.06] border-white/[0.08]'
    )}
    onClick={() => onChange(!checked)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onChange(!checked);
      }
    }}
  >
    <div
      className={cn(
        'w-5 h-5 rounded-full bg-white absolute top-[2px] transition-transform duration-200',
        'shadow-[0_2px_6px_rgba(0,0,0,0.3)]',
        checked ? 'translate-x-5' : 'translate-x-[2px]'
      )}
    />
  </button>
);

/** Badge showing Default / Custom status */
const Badge: React.FC<{ isDefault: boolean }> = ({ isDefault }) => (
  <span
    className={cn(
      'px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide',
      isDefault
        ? 'bg-white/[0.06] text-white/40'
        : 'bg-[#4a90d9]/20 text-[#7eb8e0]'
    )}
  >
    {isDefault ? 'Default' : 'Custom'}
  </span>
);

/** Glassmorphic confirmation modal (P0 fix: replaces browser confirm()) */
const ConfirmResetModal: React.FC<{
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center p-5"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)' }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          'max-w-[300px] w-full p-5 rounded-2xl relative',
          'backdrop-blur-2xl backdrop-saturate-[1.8]',
          'border border-white/[0.12]',
          'shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.10)]'
        )}
        style={{ background: 'linear-gradient(to bottom, rgba(30, 30, 45, 0.60), rgba(15, 15, 25, 0.55))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Frosted shine overlay */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.08] via-white/[0.02] to-transparent pointer-events-none" />

        <h3 className="relative text-base font-semibold text-white mb-2">
          Reset all settings?
        </h3>
        <p className="relative text-[13px] text-white/60 leading-relaxed mb-5">
          This will restore all settings to their default values. Your credit remaining will
          be set to $300, and all customizations will be cleared.
        </p>
        <div className="relative flex gap-2.5">
          <button
            onClick={onCancel}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-[13px] font-medium cursor-pointer',
              'bg-white/[0.04] border border-white/[0.08] text-white/70',
              'hover:bg-white/[0.08] hover:text-white/90',
              'transition-all duration-150'
            )}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'flex-1 py-2.5 rounded-xl text-[13px] font-medium cursor-pointer border-none',
              'bg-red-500/15 text-red-300',
              'hover:bg-red-500/25 hover:text-red-200',
              'transition-all duration-150'
            )}
          >
            Reset
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/** Glassmorphic PointsYeah tips modal */
const PointsYeahTipsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[110] flex items-center justify-center p-5"
    style={{ backgroundColor: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)' }}
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        'max-w-[340px] w-full p-5 rounded-2xl relative',
        'backdrop-blur-2xl backdrop-saturate-[1.8]',
        'border border-white/[0.12]',
        'shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.10)]'
      )}
      style={{ background: 'linear-gradient(to bottom, rgba(30, 30, 45, 0.60), rgba(15, 15, 25, 0.55))' }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Frosted shine overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.08] via-white/[0.02] to-transparent pointer-events-none" />

      <h3 className="relative text-base font-semibold text-white mb-4">
        How to Use PointsYeah
      </h3>
      <ul className="relative list-none m-0 p-0">
        {POINTSYEAH_TIPS.map((tip) => (
          <li key={tip.number} className="flex gap-2.5 mb-3 text-[13px] text-white/80 leading-relaxed">
            <span
              className={cn(
                'w-5 h-5 rounded-full flex-shrink-0',
                'bg-white/[0.08] text-white/60',
                'text-[11px] font-semibold',
                'flex items-center justify-center'
              )}
            >
              {tip.number}
            </span>
            <span className={tip.important ? 'font-medium' : 'font-normal'}>{tip.text}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onClose}
        className={cn(
          'relative w-full mt-4 py-3 rounded-xl text-sm font-semibold cursor-pointer',
          'bg-gradient-to-b from-white/[0.10] to-white/[0.04]',
          'backdrop-blur-lg border border-white/[0.08]',
          'text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
          'hover:from-white/[0.14] hover:to-white/[0.06]',
          'transition-all duration-150'
        )}
      >
        Got it
      </button>
    </motion.div>
  </motion.div>
);

// ============================================
// MAIN COMPONENT
// ============================================

interface SmartSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onRerunOnboarding?: () => void;
}

export const SmartSettings: React.FC<SmartSettingsProps> = ({
  isOpen,
  onClose,
  onRerunOnboarding,
}) => {
  const [prefs, setLocalPrefs] = useState<UserPrefs>(DEFAULT_USER_PREFS);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Load prefs on open
  useEffect(() => {
    if (isOpen) {
      loadPrefs();
    }
  }, [isOpen]);

  const loadPrefs = async () => {
    setIsLoading(true);
    try {
      const loaded = await getUserPrefs();
      setLocalPrefs(loaded);
      setHasChanges(false);
    } catch (error) {
      console.error('[Settings] Failed to load prefs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update a pref (instant effect)
  const updatePref = useCallback(
    async <K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) => {
      const updated = { ...prefs, [key]: value };

      // Auto-derive creditAlreadyUsed
      if (key === 'creditRemaining') {
        updated.creditAlreadyUsed = (value as number) < 300;
      }

      // Auto-derive wantsLowHassle
      if (key === 'defaultMode') {
        updated.wantsLowHassle = value === 'easiest';
      }

      setLocalPrefs(updated);
      setHasChanges(true);

      // Save immediately for instant effect
      try {
        await setUserPrefs(updated);
      } catch (error) {
        console.error('[Settings] Failed to save pref:', error);
      }
    },
    [prefs]
  );

  // Reset to defaults (P0 fix: use custom modal instead of browser confirm())
  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  const handleResetConfirm = async () => {
    setShowResetConfirm(false);
    try {
      await resetUserPrefs();
      await loadPrefs();
    } catch (error) {
      console.error('[Settings] Failed to reset:', error);
    }
  };

  const handleResetCancel = () => {
    setShowResetConfirm(false);
  };

  // Get assumption labels for UI
  const assumptions = getAssumptionLabels(prefs);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {/* ── Overlay ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      >
        {/* ── Main Glass Panel ── */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={cn(
            'w-full max-w-[420px] max-h-[90vh] overflow-hidden',
            'flex flex-col relative',
            // Frosted glass panel — translucent with visible frost
            'rounded-t-[20px]',
            'backdrop-blur-2xl backdrop-saturate-[1.8]',
            // Glass border with stronger visibility
            'border border-white/[0.12] border-b-0',
            // Multi-layer shadow for depth (BottomNav style)
            'shadow-[0_-8px_40px_rgba(0,0,0,0.4),0_-2px_10px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.10)]'
          )}
          onClick={(e) => e.stopPropagation()}
          style={{
            // Translucent tinted glass — NOT opaque; uses a subtle dark tint so
            // backdrop-blur has visible material to frost through
            background: 'linear-gradient(to bottom, rgba(30, 30, 45, 0.55), rgba(15, 15, 25, 0.50))',
          }}
        >
          {/* Frosted shine overlay — brighter for visible glass refraction */}
          <div className="absolute inset-0 rounded-t-[20px] bg-gradient-to-br from-white/[0.08] via-white/[0.02] to-transparent pointer-events-none z-0" />

          {/* Noise texture overlay for premium feel */}
          <div
            className="absolute inset-0 rounded-t-[20px] pointer-events-none z-0 opacity-[0.012] mix-blend-overlay"
            style={{ backgroundImage: 'var(--noise-texture)' }}
          />

          {/* ── Header ── */}
          <header className="relative z-10 px-5 py-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-lg font-semibold text-white m-0">⚙️ Settings</h2>
              <p className="text-[12px] text-white/45 mt-1">
                These affect your verdicts. Stored locally.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetClick}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer',
                  'bg-white/[0.06] text-white/55 border-none',
                  'hover:bg-white/[0.10] hover:text-white/80',
                  'transition-all duration-150'
                )}
              >
                Reset
              </button>
              {onRerunOnboarding && (
                <button
                  onClick={onRerunOnboarding}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-[12px] font-medium cursor-pointer',
                    'bg-white/[0.06] text-white/55 border-none',
                    'hover:bg-white/[0.10] hover:text-white/80',
                    'transition-all duration-150'
                  )}
                >
                  Re-run Setup
                </button>
              )}
              <button
                onClick={onClose}
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  'bg-white/[0.06] text-white/55 border-none text-lg cursor-pointer',
                  'hover:bg-white/[0.10] hover:text-white/80',
                  'transition-all duration-150'
                )}
              >
                ×
              </button>
            </div>
          </header>

          {/* ── Scrollable Content ── */}
          <div className="relative z-10 flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
              {isLoading ? (
                <div className="py-10 text-center text-white/50 text-sm">Loading...</div>
              ) : (
                <>
                  {/* ━━━ Section 1: Quick Defaults ━━━ */}
                  <div className="mb-6">
                    <h3 className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-3">
                      Quick Defaults
                    </h3>

                    {/* Default Mode */}
                    <div className={cn(
                      'p-3.5 rounded-xl mb-2',
                      'bg-white/[0.03] border border-white/[0.06]',
                      'backdrop-blur-sm'
                    )}>
                      <div className="flex items-center gap-2 text-sm font-medium text-white mb-1">
                        Default Decision Mode
                        <Badge isDefault={prefs.defaultMode === 'cheapest'} />
                      </div>
                      <p className="text-[12px] text-white/45 leading-relaxed">
                        Sets which verdict tab opens first.{' '}
                        <strong className="text-white/60">Cheapest</strong> prioritizes lowest cash
                        out-of-pocket today.{' '}
                        <strong className="text-white/60">Max Value</strong> factors in miles earned
                        and potential award redemptions.{' '}
                        <strong className="text-white/60">Easiest</strong> recommends the simplest
                        booking path with fewest steps.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        {(
                          [
                            { value: 'cheapest' as DefaultMode, label: '💸 Cheapest', desc: 'Lowest cash today' },
                            { value: 'max_value' as DefaultMode, label: '✨ Max Value', desc: 'Best overall value' },
                            { value: 'easiest' as DefaultMode, label: '😌 Easiest', desc: 'Simplest booking' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => updatePref('defaultMode', opt.value)}
                            title={opt.desc}
                            className={cn(
                              'flex-1 min-w-[80px] py-2.5 px-3.5 rounded-xl',
                              'text-[13px] font-medium text-center cursor-pointer',
                              'border transition-all duration-150',
                              prefs.defaultMode === opt.value
                                ? cn(
                                    'bg-gradient-to-b from-white/[0.12] to-white/[0.05]',
                                    'border-white/[0.15] text-white',
                                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                                  )
                                : cn(
                                    'bg-white/[0.03] border-white/[0.06] text-white/60',
                                    'hover:bg-white/[0.06] hover:text-white/80'
                                  )
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Default Open Tab */}
                    <div className={cn(
                      'p-3.5 rounded-xl mb-2',
                      'bg-white/[0.03] border border-white/[0.06]',
                      'backdrop-blur-sm'
                    )}>
                      <div className="flex items-center gap-2 text-sm font-medium text-white mb-1">
                        Default Open Tab
                        <Badge isDefault={prefs.defaultOpenTab === 'auto'} />
                      </div>
                      <p className="text-[12px] text-white/45 leading-relaxed">
                        Which tab opens first when you launch VentureXify.{' '}
                        <strong className="text-white/60">Auto</strong> selects Chat when no booking
                        is detected, Compare when on a supported page.{' '}
                        <strong className="text-white/60">Chat</strong> always opens the AI
                        assistant.{' '}
                        <strong className="text-white/60">Compare</strong> always opens the price
                        comparison flow.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        {(
                          [
                            { value: 'auto' as DefaultOpenTab, label: '🔄 Auto' },
                            { value: 'chat' as DefaultOpenTab, label: '💬 Chat' },
                            { value: 'compare' as DefaultOpenTab, label: '📊 Compare' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => updatePref('defaultOpenTab', opt.value)}
                            className={cn(
                              'flex-1 min-w-[80px] py-2.5 px-3.5 rounded-xl',
                              'text-[13px] font-medium text-center cursor-pointer',
                              'border transition-all duration-150',
                              prefs.defaultOpenTab === opt.value
                                ? cn(
                                    'bg-gradient-to-b from-white/[0.12] to-white/[0.05]',
                                    'border-white/[0.15] text-white',
                                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                                  )
                                : cn(
                                    'bg-white/[0.03] border-white/[0.06] text-white/60',
                                    'hover:bg-white/[0.06] hover:text-white/80'
                                  )
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Credit Remaining */}
                    <div className={cn(
                      'p-3.5 rounded-xl mb-2',
                      'bg-white/[0.03] border border-white/[0.06]',
                      'backdrop-blur-sm'
                    )}>
                      <div className="flex items-center gap-2 text-sm font-medium text-white mb-1">
                        Travel Credit Remaining
                        <Badge isDefault={prefs.creditRemaining === 300} />
                      </div>
                      <p className="text-[12px] text-white/45 leading-relaxed">
                        Your Venture X card includes a{' '}
                        <strong className="text-white/60">$300 annual travel credit</strong> that
                        only applies to Capital One Travel portal bookings. This credit resets each
                        card anniversary year. We use this to calculate your actual out-of-pocket
                        cost when booking through the portal.
                      </p>
                      <div className="text-2xl font-bold text-white text-center mb-1 mt-2">
                        ${prefs.creditRemaining}
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="300"
                        step="10"
                        value={prefs.creditRemaining}
                        onChange={(e) => updatePref('creditRemaining', parseInt(e.target.value))}
                        className="vx-slider"
                      />
                      <div className="flex justify-between text-[10px] text-white/35">
                        <span>$0 (fully used)</span>
                        <span>$300 (fresh)</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {[300, 200, 100, 0].map((amt) => (
                          <button
                            key={amt}
                            onClick={() => updatePref('creditRemaining', amt)}
                            className={cn(
                              'px-3 py-1.5 rounded-full text-[12px] cursor-pointer',
                              'border transition-all duration-150',
                              prefs.creditRemaining === amt
                                ? 'bg-white/[0.12] border-white/[0.15] text-white'
                                : 'bg-white/[0.03] border-white/[0.06] text-white/55 hover:bg-white/[0.06]'
                            )}
                          >
                            ${amt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* ━━━ Section 2: Miles & Valuation ━━━ */}
                  <div className="mb-6">
                    <h3 className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-3">
                      Miles &amp; Valuation
                    </h3>

                    {/* Miles Balance */}
                    <div className={cn(
                      'p-3.5 rounded-xl mb-2',
                      'bg-white/[0.03] border border-white/[0.06]',
                      'backdrop-blur-sm'
                    )}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-white mb-1">
                            Factor in my miles balance
                          </div>
                          <p className="text-[12px] text-white/45 leading-relaxed">
                            Track your Capital One miles balance to see how much you can cover with
                            Travel Eraser (no minimum required — redeem any amount at 1¢/mile).
                            We'll also show when miles can help reduce your trip cost.
                          </p>
                        </div>
                        <Toggle
                          checked={prefs.milesBalance !== undefined}
                          onChange={(on) => updatePref('milesBalance', on ? 0 : undefined)}
                          label="Factor in my miles balance"
                        />
                      </div>
                      {prefs.milesBalance !== undefined && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                        >
                          <input
                            type="number"
                            min="0"
                            value={prefs.milesBalance === undefined ? '' : prefs.milesBalance}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                updatePref('milesBalance', 0);
                              } else {
                                const parsed = parseInt(val, 10);
                                if (!isNaN(parsed) && parsed >= 0) {
                                  updatePref('milesBalance', parsed);
                                }
                              }
                            }}
                            placeholder="Enter your current miles balance"
                            className={cn(
                              'w-full mt-2 px-3 py-2.5 rounded-lg text-sm text-white',
                              'bg-white/[0.04] border border-white/[0.08]',
                              'placeholder:text-white/30',
                              'focus:outline-none focus:border-[#4a90d9]/40 focus:bg-white/[0.06]',
                              'transition-all duration-150'
                            )}
                          />
                          <p className="text-[11px] text-white/40 mt-1.5">
                            💡 Travel Eraser has no minimum — redeem any amount from $0.01 up at
                            1¢/mile
                          </p>
                        </motion.div>
                      )}
                    </div>

                    {/* Mile Valuation — CPP */}
                    <div className={cn(
                      'p-3.5 rounded-xl mb-2',
                      'bg-white/[0.03] border border-white/[0.06]',
                      'backdrop-blur-sm'
                    )}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-medium text-white mb-1">
                            Use custom mile valuation
                            <Badge isDefault={!prefs.customMileValuation} />
                          </div>
                          <p className="text-[12px] text-white/45 leading-relaxed">
                            <strong className="text-white/60">Cents per mile</strong> is how we
                            value your miles when comparing options. For example, 1.5¢ per mile
                            means 10,000 miles = $150 in value.
                          </p>
                        </div>
                        <Toggle
                          checked={prefs.customMileValuation ?? false}
                          label="Use custom mile valuation"
                          onChange={async (on) => {
                            if (!on) {
                              const updated = {
                                ...prefs,
                                customMileValuation: false,
                                mileValuationCpp: DEFAULT_MILE_VALUATION_CPP,
                              };
                              setLocalPrefs(updated);
                              setHasChanges(true);
                              await setUserPrefs(updated);
                            } else {
                              updatePref('customMileValuation', true);
                            }
                          }}
                        />
                      </div>

                      {/* Reference values box */}
                      <div
                        className={cn(
                          'mt-2.5 p-2.5 rounded-lg',
                          'bg-white/[0.02] text-[11px] leading-relaxed text-white/50'
                        )}
                      >
                        <div className="mb-1.5">
                          <strong className="text-white/65">Reference values:</strong>
                        </div>
                        <div>
                          • <strong>1.0¢</strong> — Travel Eraser floor (guaranteed minimum)
                        </div>
                        <div>
                          • <strong>1.5¢</strong> — Conservative estimate for comparisons
                        </div>
                        <div>
                          • <strong>1.8–2.5¢</strong> — Transfer partner sweet spots (business class, etc.)
                        </div>
                        <div>
                          • <strong>3.0¢+</strong> — Rare award chart wins
                        </div>
                      </div>

                      {!prefs.customMileValuation && (
                        <p className="text-[12px] text-white/45 mt-2 italic">
                          Currently using: <strong>1.0¢ per mile</strong> (conservative default)
                        </p>
                      )}

                      {prefs.customMileValuation && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                        >
                          <div className="text-lg font-bold text-white text-center mt-3">
                            {(prefs.mileValuationCpp * 100).toFixed(1)}¢ per mile
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="3.0"
                            step="0.1"
                            value={prefs.mileValuationCpp * 100}
                            onChange={(e) =>
                              updatePref('mileValuationCpp', parseFloat(e.target.value) / 100)
                            }
                            className="vx-slider"
                          />
                          <div className="flex justify-between text-[10px] text-white/35">
                            <span>0.5¢ (pessimistic)</span>
                            <span>3.0¢ (optimistic)</span>
                          </div>
                          <p className="text-[12px] text-white/45 mt-2">
                            At {(prefs.mileValuationCpp * 100).toFixed(1)}¢, your 10,000 miles ={' '}
                            <strong>${(prefs.mileValuationCpp * 10000).toFixed(0)}</strong> in value
                          </p>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* ━━━ Section 3: Award Search ━━━ */}
                  <div className="mb-6">
                    <h3 className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-3">
                      Award Search (PointsYeah)
                    </h3>

                    {/* Info box */}
                    <div
                      className={cn(
                        'p-3 rounded-lg mb-3',
                        'bg-[#4a90d9]/[0.06] border border-[#4a90d9]/[0.12]',
                        'text-[12px] leading-relaxed text-white/55'
                      )}
                    >
                      <strong className="text-white/75">What is PointsYeah?</strong>
                      <div className="mt-1">
                        PointsYeah is a free tool that searches award availability across airline
                        programs. Capital One miles can be transferred to partners like Air France,
                        Turkish, and Avianca to book flights with miles instead of cash—often at much
                        better value than cash or Travel Eraser.
                      </div>
                    </div>

                    {/* Enable Award Search */}
                    <div className={cn(
                      'p-3.5 rounded-xl mb-2',
                      'bg-white/[0.03] border border-white/[0.06]',
                      'backdrop-blur-sm'
                    )}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-white mb-1">
                            Show award options in Max Value
                          </div>
                          <p className="text-[12px] text-white/45 leading-relaxed">
                            When enabled, the "Max Value" tab will include a button to check award
                            flight availability on PointsYeah. This helps you see if transferring
                            miles to an airline partner could get you a better deal than paying cash
                            or using Travel Eraser.
                          </p>
                        </div>
                        <Toggle
                          checked={prefs.enableAwardSearch}
                          onChange={(on) => updatePref('enableAwardSearch', on)}
                          label="Show award options in Max Value"
                        />
                      </div>
                    </div>

                    {prefs.enableAwardSearch && (
                      <>
                        {/* Auto-prefill */}
                        <div className={cn(
                          'p-3.5 rounded-xl mb-2',
                          'bg-white/[0.03] border border-white/[0.06]',
                          'backdrop-blur-sm'
                        )}>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-white mb-1">
                                Auto-open with flight details
                              </div>
                              <p className="text-[12px] text-white/45 leading-relaxed">
                                When you click "Check Awards", we'll automatically fill in your
                                origin airport, destination, travel dates, and cabin class on
                                PointsYeah—so you don't have to type it all again. You'll still
                                book directly with the airline.
                              </p>
                            </div>
                            <Toggle
                              checked={prefs.autoPrefillPointsYeah}
                              onChange={(on) => updatePref('autoPrefillPointsYeah', on)}
                              label="Auto-open with flight details"
                            />
                          </div>
                        </div>

                        {/* Tips Guide */}
                        <button
                          onClick={() => setShowTips(true)}
                          className={cn(
                            'w-full p-3.5 rounded-xl mb-2 text-left',
                            'bg-white/[0.03] border border-white/[0.06]',
                            'cursor-pointer backdrop-blur-sm',
                            'hover:bg-white/[0.05] hover:border-white/[0.10]',
                            'transition-all duration-150'
                          )}
                        >
                          <div className="text-sm font-medium text-white mb-1">
                            📖 How to use PointsYeah →
                          </div>
                          <p className="text-[12px] text-white/45 leading-relaxed">
                            Learn what to look for: low miles + low fees, seat availability,
                            transfer partners, and when awards beat cash.
                          </p>
                        </button>
                      </>
                    )}
                  </div>

                  {/* ━━━ Section 4: Advanced ━━━ */}
                  <div className="mb-6">
                    <button
                      className={cn(
                        'w-full p-3.5 rounded-xl mb-3 flex items-center justify-between',
                        'bg-white/[0.02] border border-white/[0.06] cursor-pointer',
                        'hover:bg-white/[0.04] hover:border-white/[0.08]',
                        'transition-all duration-150'
                      )}
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      aria-expanded={showAdvanced}
                    >
                      <div>
                        <span className="text-[13px] font-medium text-white/50">
                          Advanced (optional)
                        </span>
                        <div className="text-[10px] text-white/30 mt-0.5">
                          Fine-tune how verdicts are calculated
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-[12px] text-white/45">
                        {showAdvanced ? 'Hide' : 'Show'}
                        <span
                          className="inline-block transition-transform duration-200"
                          style={{
                            transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}
                        >
                          ▼
                        </span>
                      </span>
                    </button>

                    {showAdvanced && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                      >
                        {/* Confidence Labels */}
                        <div className={cn(
                          'p-3.5 rounded-xl mb-2',
                          'bg-white/[0.03] border border-white/[0.06]',
                          'backdrop-blur-sm'
                        )}>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-white mb-1">
                                Show confidence labels
                              </div>
                              <p className="text-[12px] text-white/45 leading-relaxed">
                                Display how certain we are about each verdict. "High" means we have
                                accurate data; "Medium" or "Low" means some values are estimated or
                                prices may have changed.
                              </p>
                            </div>
                            <Toggle
                              checked={prefs.showConfidenceLabels}
                              onChange={(on) => updatePref('showConfidenceLabels', on)}
                              label="Show confidence labels"
                            />
                          </div>
                        </div>

                        {/* What Could Change */}
                        <div className={cn(
                          'p-3.5 rounded-xl mb-2',
                          'bg-white/[0.03] border border-white/[0.06]',
                          'backdrop-blur-sm'
                        )}>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-white mb-1">
                                Show "What could change the answer?"
                              </div>
                              <p className="text-[12px] text-white/45 leading-relaxed">
                                Lists factors that could flip the recommendation—like if your credit
                                resets, if prices change, or if you value miles differently. Helps
                                you understand the "gray area" in close calls.
                              </p>
                            </div>
                            <Toggle
                              checked={prefs.showWhatCouldChange}
                              onChange={(on) => updatePref('showWhatCouldChange', on)}
                              label="Show what could change the answer"
                            />
                          </div>
                        </div>

                        {/* Assume Direct is Airline */}
                        <div className={cn(
                          'p-3.5 rounded-xl mb-2',
                          'bg-white/[0.03] border border-white/[0.06]',
                          'backdrop-blur-sm'
                        )}>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-white mb-1">
                                Assume direct = airline checkout
                              </div>
                              <p className="text-[12px] text-white/45 leading-relaxed">
                                When ON, we assume "direct" prices come from the airline's own
                                website (earning full miles/status). When OFF, we show a warning
                                that the price might be from an OTA (online travel agency like
                                Expedia) which may not earn airline miles.
                              </p>
                            </div>
                            <Toggle
                              checked={prefs.assumeDirectIsAirline}
                              onChange={(on) => updatePref('assumeDirectIsAirline', on)}
                              label="Assume direct is airline checkout"
                            />
                          </div>
                        </div>

                        {/* Portal Miles Basis */}
                        <div className={cn(
                          'p-3.5 rounded-xl mb-2',
                          'bg-white/[0.03] border border-white/[0.06]',
                          'backdrop-blur-sm'
                        )}>
                          <div className="text-sm font-medium text-white mb-1">
                            Portal miles calculation basis
                          </div>
                          <p className="text-[12px] text-white/45 leading-relaxed">
                            Capital One awards 5x miles on portal flights. The question is: does 5x
                            apply to the full ticket price, or only what you pay after the travel
                            credit? Data points vary, so we let you choose how to calculate it.
                          </p>
                          <div className={cn(
                            'mt-2.5 p-2.5 rounded-lg',
                            'bg-white/[0.02] text-[10px] text-white/40 leading-relaxed'
                          )}>
                            •{' '}
                            <strong>Full price</strong> — 5x on the ticket's sticker price
                            (optimistic)
                            <br />•{' '}
                            <strong>After credit</strong> — 5x only on what you actually pay
                            (conservative)
                            <br />•{' '}
                            <strong>Show range</strong> — Display both possibilities (recommended)
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2.5">
                            {(
                              [
                                { value: 'sticker' as PortalMilesBasis, label: 'Full price' },
                                { value: 'post_credit' as PortalMilesBasis, label: 'After credit' },
                                { value: 'range' as PortalMilesBasis, label: 'Show range' },
                              ] as const
                            ).map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => updatePref('portalMilesBasis', opt.value)}
                                className={cn(
                                  'flex-1 py-2.5 px-3 rounded-xl',
                                  'text-[12px] font-medium text-center cursor-pointer',
                                  'border transition-all duration-150',
                                  prefs.portalMilesBasis === opt.value
                                    ? cn(
                                        'bg-gradient-to-b from-white/[0.12] to-white/[0.05]',
                                        'border-white/[0.15] text-white',
                                        'shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                                      )
                                    : cn(
                                        'bg-white/[0.03] border-white/[0.06] text-white/60',
                                        'hover:bg-white/[0.06] hover:text-white/80'
                                      )
                                )}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Price Premium Threshold */}
                        <div className={cn(
                          'p-3.5 rounded-xl mb-2',
                          'bg-white/[0.03] border border-white/[0.06]',
                          'backdrop-blur-sm'
                        )}>
                          <div className="flex items-center gap-2 text-sm font-medium text-white mb-1">
                            Price premium threshold
                            <Badge isDefault={prefs.pricePremiumThreshold === 0.07} />
                          </div>
                          <p className="text-[12px] text-white/45 leading-relaxed">
                            If the portal price is significantly higher than the direct price, we'll
                            flag it as a warning. This sets how much higher the portal needs to be
                            before we consider it a "premium." For example, 7% means if direct is
                            $500 and portal is $535+, we flag it.
                          </p>
                          <div className="text-base font-bold text-white text-center mt-2.5">
                            {(prefs.pricePremiumThreshold * 100).toFixed(0)}%
                          </div>
                          <input
                            type="range"
                            min="2"
                            max="25"
                            step="1"
                            value={Math.max(2, prefs.pricePremiumThreshold * 100)}
                            onChange={(e) =>
                              updatePref(
                                'pricePremiumThreshold',
                                parseFloat(e.target.value) / 100
                              )
                            }
                            className="vx-slider"
                          />
                          <div className="flex justify-between text-[10px] text-white/35">
                            <span>2% (strict)</span>
                            <span>25% (lenient)</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Scroll fade indicator at bottom */}
            <div
              className="absolute bottom-0 left-0 right-0 h-10 pointer-events-none z-[5]"
              style={{ background: 'linear-gradient(to top, rgba(15, 15, 25, 0.65), transparent)' }}
            />
          </div>

          {/* ── Footer ── */}
          <footer className="relative z-10 px-5 py-4 border-t border-white/[0.06] flex gap-2.5 flex-shrink-0">
            <button
              onClick={onClose}
              className={cn(
                'flex-1 py-3 rounded-xl text-sm font-semibold cursor-pointer',
                'bg-gradient-to-b from-white/[0.10] to-white/[0.04]',
                'backdrop-blur-lg border border-white/[0.08]',
                'text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
                'hover:from-white/[0.14] hover:to-white/[0.06]',
                'active:scale-[0.98]',
                'transition-all duration-150'
              )}
            >
              Done
            </button>
          </footer>
        </motion.div>
      </motion.div>

      {/* Tips Modal */}
      <AnimatePresence>
        {showTips && <PointsYeahTipsModal onClose={() => setShowTips(false)} />}
      </AnimatePresence>

      {/* Reset Confirmation Modal (P0 fix) */}
      <AnimatePresence>
        <ConfirmResetModal
          isOpen={showResetConfirm}
          onConfirm={handleResetConfirm}
          onCancel={handleResetCancel}
        />
      </AnimatePresence>
    </AnimatePresence>
  );
};

export default SmartSettings;
