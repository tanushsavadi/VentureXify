/**
 * Smart Settings Modal
 * 
 * Progressive disclosure settings that mirror onboarding fields.
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

// ============================================
// STYLES
// ============================================

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    backdropFilter: 'blur(10px)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  panel: {
    width: '100%',
    maxWidth: '420px',
    maxHeight: '90vh',
    backgroundColor: 'rgba(18,18,18,0.98)',
    borderRadius: '20px 20px 0 0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
    boxShadow: '0 -10px 60px rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderBottom: 'none',
  },
  header: {
    padding: '20px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'white',
    margin: 0,
  },
  headerSubtitle: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '4px',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
  },
  headerButton: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  closeButton: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '16px 20px',
    position: 'relative' as const,
  },
  // P1 fix: scroll indicator gradient at bottom
  scrollIndicator: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: '40px',
    background: 'linear-gradient(to top, rgba(18,18,18,0.98), transparent)',
    pointerEvents: 'none' as const,
    zIndex: 5,
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '12px',
  },
  settingRow: {
    padding: '12px 14px',
    borderRadius: '12px',
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '8px',
  },
  settingLabel: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'white',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  settingDesc: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 1.4,
  },
  badge: {
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '9px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
  },
  badgeDefault: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.4)',
  },
  badgeCustom: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    color: '#a5b4fc',
  },
  radioGroup: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
  },
  radioButton: {
    padding: '10px 14px',
    borderRadius: '10px',
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
    flex: 1,
    textAlign: 'center' as const,
    minWidth: '80px',
  },
  radioButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.25)',
    color: 'white',
  },
  slider: {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    backgroundColor: 'rgba(255,255,255,0.15)',
    appearance: 'none' as const,
    cursor: 'pointer',
    marginTop: '12px',
    marginBottom: '8px',
  },
  sliderLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '10px',
    color: 'rgba(255,255,255,0.35)',
  },
  sliderValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'white',
    textAlign: 'center' as const,
    marginBottom: '4px',
  },
  chipGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '6px',
    marginTop: '10px',
  },
  chip: {
    padding: '6px 12px',
    borderRadius: '16px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  chipActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.2)',
    color: 'white',
  },
  toggle: {
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    backgroundColor: 'rgba(239, 68, 68, 0.4)', // Red when OFF
    position: 'relative' as const,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    flexShrink: 0,
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  toggleActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.5)', // Green when ON
    border: '1px solid rgba(34, 197, 94, 0.4)',
  },
  toggleKnob: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: 'white',
    position: 'absolute' as const,
    top: '2px',
    left: '2px',
    transition: 'transform 0.2s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'white',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    marginTop: '8px',
  },
  advancedToggle: {
    padding: '12px 14px',
    borderRadius: '12px',
    backgroundColor: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    marginBottom: '12px',
  },
  advancedLabel: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
    fontWeight: 500,
  },
  tipsModal: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    zIndex: 110,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  tipsContent: {
    maxWidth: '340px',
    backgroundColor: 'rgba(25,25,25,0.98)',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  tipsList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  tipItem: {
    display: 'flex',
    gap: '10px',
    marginBottom: '12px',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 1.5,
  },
  tipNumber: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '11px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  footer: {
    padding: '16px 20px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    gap: '10px',
    flexShrink: 0,
  },
  footerButton: {
    flex: 1,
    padding: '12px',
    borderRadius: '10px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    border: 'none',
  },
  primaryButton: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    color: 'white',
  },
  dangerButton: {
    backgroundColor: 'rgba(255,100,100,0.1)',
    color: 'rgba(255,150,150,0.9)',
  },
  // Custom confirm modal styles
  confirmOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    zIndex: 120,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  confirmModal: {
    maxWidth: '300px',
    backgroundColor: 'rgba(25,25,25,0.98)',
    borderRadius: '16px',
    padding: '20px',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  confirmTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'white',
    marginBottom: '8px',
  },
  confirmDesc: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.5,
    marginBottom: '20px',
  },
  confirmButtons: {
    display: 'flex',
    gap: '10px',
  },
  confirmCancel: {
    flex: 1,
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    backgroundColor: 'transparent',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  confirmDanger: {
    flex: 1,
    padding: '10px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#fca5a5',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  // Firefox-compatible slider styles (applied via className)
  sliderFirefox: `
    appearance: none;
    background: rgba(255,255,255,0.15);
    border-radius: 3px;
    width: 100%;
    height: 6px;
    cursor: pointer;
  `,
};

// Slider CSS for Firefox compatibility - inject into head
const sliderStyles = `
  .vx-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.15);
    cursor: pointer;
    margin-top: 12px;
    margin-bottom: 8px;
  }
  .vx-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #6366f1;
    cursor: pointer;
    border: none;
  }
  .vx-slider::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #6366f1;
    cursor: pointer;
    border: none;
  }
  .vx-slider::-moz-range-track {
    background: rgba(255,255,255,0.15);
    border-radius: 3px;
    height: 6px;
  }
  .vx-slider:focus {
    outline: none;
  }
  .vx-slider:focus::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3);
  }
  .vx-slider:focus::-moz-range-thumb {
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3);
  }
`;

// Inject slider styles once
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

// P1 fix: Accessible toggle with role="switch" and aria-checked
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
    style={{
      ...styles.toggle,
      ...(checked ? styles.toggleActive : {}),
      border: 'none',
      outline: 'none',
    }}
    onClick={() => onChange(!checked)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onChange(!checked);
      }
    }}
  >
    <div style={{ ...styles.toggleKnob, transform: checked ? 'translateX(20px)' : 'translateX(0)' }} />
  </button>
);

// P1 fix: Changed "Assumed" to "Default" for clarity
const Badge: React.FC<{ isDefault: boolean }> = ({ isDefault }) => (
  <span style={{ ...styles.badge, ...(isDefault ? styles.badgeDefault : styles.badgeCustom) }}>
    {isDefault ? 'Default' : 'Custom'}
  </span>
);

// Custom confirmation modal (P0 fix: replace browser confirm())
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
      style={styles.confirmOverlay}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={styles.confirmModal}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={styles.confirmTitle}>Reset all settings?</h3>
        <p style={styles.confirmDesc}>
          This will restore all settings to their default values. Your credit remaining will be set to $300, and all customizations will be cleared.
        </p>
        <div style={styles.confirmButtons}>
          <button onClick={onCancel} style={styles.confirmCancel}>
            Cancel
          </button>
          <button onClick={onConfirm} style={styles.confirmDanger}>
            Reset
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const PointsYeahTipsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    style={styles.tipsModal}
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={styles.tipsContent}
      onClick={(e) => e.stopPropagation()}
    >
      <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'white', marginBottom: '16px' }}>
        How to Use PointsYeah
      </h3>
      <ul style={styles.tipsList}>
        {POINTSYEAH_TIPS.map((tip) => (
          <li key={tip.number} style={styles.tipItem}>
            <span style={styles.tipNumber}>{tip.number}</span>
            <span style={{ fontWeight: tip.important ? 500 : 400 }}>{tip.text}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onClose}
        style={{ ...styles.footerButton, ...styles.primaryButton, width: '100%', marginTop: '16px' }}
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
  const updatePref = useCallback(async <K extends keyof UserPrefs>(key: K, value: UserPrefs[K]) => {
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
  }, [prefs]);
  
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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={styles.overlay}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={styles.panel}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header style={styles.header}>
            <div>
              <h2 style={styles.headerTitle}>⚙️ Settings</h2>
              <p style={styles.headerSubtitle}>These affect your verdicts. Stored locally.</p>
            </div>
            <div style={styles.headerActions}>
              <button
                onClick={handleResetClick}
                style={styles.headerButton}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
              >
                Reset
              </button>
              {onRerunOnboarding && (
                <button
                  onClick={onRerunOnboarding}
                  style={styles.headerButton}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
                >
                  Re-run Setup
                </button>
              )}
              <button
                onClick={onClose}
                style={styles.closeButton}
              >
                ×
              </button>
            </div>
          </header>
          
          {/* Content - P1 fix: wrapped in container for scroll indicator */}
          <div style={{ position: 'relative' as const, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' as const }}>
            <div style={styles.content}>
            {isLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                Loading...
              </div>
            ) : (
              <>
                {/* Section 1: Quick Defaults */}
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>Quick Defaults</h3>
                  
                  {/* Default Mode */}
                  <div style={styles.settingRow}>
                    <div style={styles.settingLabel}>
                      Default Decision Mode
                      <Badge isDefault={prefs.defaultMode === 'cheapest'} />
                    </div>
                    <div style={styles.settingDesc}>
                      Sets which verdict tab opens first. <strong>Cheapest</strong> prioritizes lowest cash out-of-pocket today. <strong>Max Value</strong> factors in miles earned and potential award redemptions. <strong>Easiest</strong> recommends the simplest booking path with fewest steps.
                    </div>
                    <div style={{ ...styles.radioGroup, marginTop: '10px' }}>
                      {[
                        { value: 'cheapest' as DefaultMode, label: '💸 Cheapest', desc: 'Lowest cash today' },
                        { value: 'max_value' as DefaultMode, label: '✨ Max Value', desc: 'Best overall value' },
                        { value: 'easiest' as DefaultMode, label: '😌 Easiest', desc: 'Simplest booking' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => updatePref('defaultMode', opt.value)}
                          style={{
                            ...styles.radioButton,
                            ...(prefs.defaultMode === opt.value ? styles.radioButtonActive : {}),
                          }}
                          title={opt.desc}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Default Open Tab */}
                  <div style={styles.settingRow}>
                    <div style={styles.settingLabel}>
                      Default Open Tab
                      <Badge isDefault={prefs.defaultOpenTab === 'auto'} />
                    </div>
                    <div style={styles.settingDesc}>
                      Which tab opens first when you launch VentureXify. <strong>Auto</strong> selects Chat when no booking is detected, Compare when on a supported page. <strong>Chat</strong> always opens the AI assistant. <strong>Compare</strong> always opens the price comparison flow.
                    </div>
                    <div style={{ ...styles.radioGroup, marginTop: '10px' }}>
                      {[
                        { value: 'auto' as DefaultOpenTab, label: '🔄 Auto' },
                        { value: 'chat' as DefaultOpenTab, label: '💬 Chat' },
                        { value: 'compare' as DefaultOpenTab, label: '📊 Compare' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => updatePref('defaultOpenTab', opt.value)}
                          style={{
                            ...styles.radioButton,
                            ...(prefs.defaultOpenTab === opt.value ? styles.radioButtonActive : {}),
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Credit Remaining */}
                  <div style={styles.settingRow}>
                    <div style={styles.settingLabel}>
                      Travel Credit Remaining
                      <Badge isDefault={prefs.creditRemaining === 300} />
                    </div>
                    <div style={styles.settingDesc}>
                      Your Venture X card includes a <strong>$300 annual travel credit</strong> that only applies to Capital One Travel portal bookings. This credit resets each card anniversary year. We use this to calculate your actual out-of-pocket cost when booking through the portal.
                    </div>
                    <div style={styles.sliderValue}>${prefs.creditRemaining}</div>
                    <input
                      type="range"
                      min="0"
                      max="300"
                      step="10"
                      value={prefs.creditRemaining}
                      onChange={(e) => updatePref('creditRemaining', parseInt(e.target.value))}
                      className="vx-slider"
                    />
                    <div style={styles.sliderLabels}>
                      <span>$0 (fully used)</span>
                      <span>$300 (fresh)</span>
                    </div>
                    <div style={styles.chipGrid}>
                      {[300, 200, 100, 0].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => updatePref('creditRemaining', amt)}
                          style={{
                            ...styles.chip,
                            ...(prefs.creditRemaining === amt ? styles.chipActive : {}),
                          }}
                        >
                          ${amt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Section 2: Miles & Valuation */}
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>Miles & Valuation</h3>
                  
                  {/* Miles Balance */}
                  <div style={styles.settingRow}>
                    <div style={styles.toggleRow}>
                      <div>
                        <div style={styles.settingLabel}>Factor in my miles balance</div>
                        <div style={styles.settingDesc}>
                                                  Track your Capital One miles balance to see how much you can cover with Travel Eraser (no minimum required - redeem any amount at 1¢/mile). We'll also show when miles can help reduce your trip cost.
                                                </div>
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
                          value={prefs.milesBalance ?? ''}
                          onChange={(e) => updatePref('milesBalance', parseInt(e.target.value) || 0)}
                          placeholder="Enter your current miles balance"
                          style={styles.input}
                        />
                        <div style={{ ...styles.settingDesc, marginTop: '6px', fontSize: '11px' }}>
                          💡 Travel Eraser has no minimum — redeem any amount from $0.01 up at 1¢/mile
                        </div>
                      </motion.div>
                    )}
                  </div>
                  
                  {/* Mile Valuation - CPP Expanded */}
                  <div style={styles.settingRow}>
                    <div style={styles.toggleRow}>
                      <div>
                        <div style={styles.settingLabel}>
                          Use custom mile valuation
                          <Badge isDefault={!prefs.customMileValuation} />
                        </div>
                        <div style={styles.settingDesc}>
                          <strong>Cents per mile</strong> is how we value your miles when comparing options. For example, 1.5¢ per mile means 10,000 miles = $150 in value.
                        </div>
                      </div>
                      <Toggle
                        checked={prefs.customMileValuation ?? false}
                        label="Use custom mile valuation"
                        onChange={async (on) => {
                          // When turning off, reset to conservative value in same update
                          // P0 fix: use DEFAULT_MILE_VALUATION_CPP instead of hardcoded value
                          if (!on) {
                            const updated = { ...prefs, customMileValuation: false, mileValuationCpp: DEFAULT_MILE_VALUATION_CPP };
                            setLocalPrefs(updated);
                            setHasChanges(true);
                            await setUserPrefs(updated);
                          } else {
                            updatePref('customMileValuation', true);
                          }
                        }}
                      />
                    </div>
                    
                    {/* Valuation context box */}
                    <div style={{
                      marginTop: '10px',
                      padding: '10px 12px',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                      fontSize: '11px',
                      lineHeight: 1.6,
                      color: 'rgba(255,255,255,0.55)',
                    }}>
                      <div style={{ marginBottom: '6px' }}>
                        <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Reference values:</strong>
                      </div>
                      <div>• <strong>1.0¢</strong> — Travel Eraser floor (guaranteed minimum)</div>
                      <div>• <strong>1.5¢</strong> — Conservative estimate for comparisons</div>
                      <div>• <strong>1.8–2.5¢</strong> — Transfer partner sweet spots (business class, etc.)</div>
                      <div>• <strong>3.0¢+</strong> — Rare award chart wins</div>
                    </div>
                    
                    {!prefs.customMileValuation && (
                      <div style={{ ...styles.settingDesc, marginTop: '8px', fontStyle: 'italic' }}>
                        Currently using: <strong>1.0¢ per mile</strong> (conservative default)
                      </div>
                    )}
                    
                    {prefs.customMileValuation && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                      >
                        <div style={{ ...styles.sliderValue, fontSize: '18px', marginTop: '12px' }}>
                          {(prefs.mileValuationCpp * 100).toFixed(1)}¢ per mile
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="3.0"
                          step="0.1"
                          value={prefs.mileValuationCpp * 100}
                          onChange={(e) => updatePref('mileValuationCpp', parseFloat(e.target.value) / 100)}
                          className="vx-slider"
                        />
                        <div style={styles.sliderLabels}>
                          <span>0.5¢ (pessimistic)</span>
                          <span>3.0¢ (optimistic)</span>
                        </div>
                        <div style={{ ...styles.settingDesc, marginTop: '8px' }}>
                          At {(prefs.mileValuationCpp * 100).toFixed(1)}¢, your 10,000 miles = <strong>${(prefs.mileValuationCpp * 10000).toFixed(0)}</strong> in value
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
                
                {/* Section 3: Award Search */}
                <div style={styles.section}>
                  <h3 style={styles.sectionTitle}>Award Search (PointsYeah)</h3>
                  
                  {/* What is PointsYeah - info box */}
                  <div style={{
                    padding: '10px 12px',
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    lineHeight: 1.5,
                    color: 'rgba(255,255,255,0.6)',
                    marginBottom: '12px',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                  }}>
                    <strong style={{ color: 'rgba(255,255,255,0.8)' }}>What is PointsYeah?</strong>
                    <div style={{ marginTop: '4px' }}>
                      PointsYeah is a free tool that searches award availability across airline programs. Capital One miles can be transferred to partners like Air France, Turkish, and Avianca to book flights with miles instead of cash—often at much better value than cash or Travel Eraser.
                    </div>
                  </div>
                  
                  {/* Enable Award Search */}
                  <div style={styles.settingRow}>
                    <div style={styles.toggleRow}>
                      <div>
                        <div style={styles.settingLabel}>Show award options in Max Value</div>
                        <div style={styles.settingDesc}>
                          When enabled, the "Max Value" tab will include a button to check award flight availability on PointsYeah. This helps you see if transferring miles to an airline partner could get you a better deal than paying cash or using Travel Eraser.
                        </div>
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
                      <div style={styles.settingRow}>
                        <div style={styles.toggleRow}>
                          <div>
                            <div style={styles.settingLabel}>Auto-open with flight details</div>
                            <div style={styles.settingDesc}>
                              When you click "Check Awards", we'll automatically fill in your origin airport, destination, travel dates, and cabin class on PointsYeah—so you don't have to type it all again. You'll still book directly with the airline.
                            </div>
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
                        style={{
                          ...styles.settingRow,
                          cursor: 'pointer',
                          width: '100%',
                          textAlign: 'left',
                          border: 'none',
                        }}
                      >
                        <div style={styles.settingLabel}>
                          📖 How to use PointsYeah →
                        </div>
                        <div style={styles.settingDesc}>
                          Learn what to look for: low miles + low fees, seat availability, transfer partners, and when awards beat cash.
                        </div>
                      </button>
                    </>
                  )}
                </div>
                
                {/* Advanced Section */}
                <div style={styles.section}>
                  {/* P2 fix #11: Added Show/Hide text for better affordance */}
                  <button
                    style={{ ...styles.advancedToggle, border: 'none', width: '100%', cursor: 'pointer' }}
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    aria-expanded={showAdvanced}
                  >
                    <div>
                      <span style={styles.advancedLabel}>Advanced (optional)</span>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
                        Fine-tune how verdicts are calculated
                      </div>
                    </div>
                    <span style={{
                      color: 'rgba(255,255,255,0.5)',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      {showAdvanced ? 'Hide' : 'Show'}
                      <span style={{
                        transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                        display: 'inline-block',
                      }}>▼</span>
                    </span>
                  </button>
                  
                  {showAdvanced && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                    >
                      {/* Confidence Labels */}
                      <div style={styles.settingRow}>
                        <div style={styles.toggleRow}>
                          <div>
                            <div style={styles.settingLabel}>Show confidence labels</div>
                            <div style={styles.settingDesc}>
                              Display how certain we are about each verdict. "High" means we have accurate data; "Medium" or "Low" means some values are estimated or prices may have changed.
                            </div>
                          </div>
                          <Toggle
                            checked={prefs.showConfidenceLabels}
                            onChange={(on) => updatePref('showConfidenceLabels', on)}
                            label="Show confidence labels"
                          />
                        </div>
                      </div>
                      
                      {/* What Could Change */}
                      <div style={styles.settingRow}>
                        <div style={styles.toggleRow}>
                          <div>
                            <div style={styles.settingLabel}>Show "What could change the answer?"</div>
                            <div style={styles.settingDesc}>
                              Lists factors that could flip the recommendation—like if your credit resets, if prices change, or if you value miles differently. Helps you understand the "gray area" in close calls.
                            </div>
                          </div>
                          <Toggle
                            checked={prefs.showWhatCouldChange}
                            onChange={(on) => updatePref('showWhatCouldChange', on)}
                            label="Show what could change the answer"
                          />
                        </div>
                      </div>
                      
                      {/* Assume Direct is Airline */}
                      <div style={styles.settingRow}>
                        <div style={styles.toggleRow}>
                          <div>
                            <div style={styles.settingLabel}>Assume direct = airline checkout</div>
                            <div style={styles.settingDesc}>
                              When ON, we assume "direct" prices come from the airline's own website (earning full miles/status). When OFF, we show a warning that the price might be from an OTA (online travel agency like Expedia) which may not earn airline miles.
                            </div>
                          </div>
                          <Toggle
                            checked={prefs.assumeDirectIsAirline}
                            onChange={(on) => updatePref('assumeDirectIsAirline', on)}
                            label="Assume direct is airline checkout"
                          />
                        </div>
                      </div>
                      
                      {/* Portal Miles Basis */}
                      <div style={styles.settingRow}>
                        <div style={styles.settingLabel}>Portal miles calculation basis</div>
                        <div style={styles.settingDesc}>
                          Capital One awards 5x miles on portal flights. The question is: does 5x apply to the full ticket price, or only what you pay after the travel credit? Data points vary, so we let you choose how to calculate it.
                        </div>
                        <div style={{
                          marginTop: '10px',
                          padding: '8px 10px',
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          borderRadius: '6px',
                          fontSize: '10px',
                          color: 'rgba(255,255,255,0.45)',
                          lineHeight: 1.5,
                        }}>
                          • <strong>Full price</strong> — 5x on the ticket's sticker price (optimistic)<br/>
                          • <strong>After credit</strong> — 5x only on what you actually pay (conservative)<br/>
                          • <strong>Show range</strong> — Display both possibilities (recommended)
                        </div>
                        <div style={{ ...styles.radioGroup, marginTop: '10px' }}>
                          {[
                            { value: 'sticker' as PortalMilesBasis, label: 'Full price' },
                            { value: 'post_credit' as PortalMilesBasis, label: 'After credit' },
                            { value: 'range' as PortalMilesBasis, label: 'Show range' },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => updatePref('portalMilesBasis', opt.value)}
                              style={{
                                ...styles.radioButton,
                                fontSize: '12px',
                                ...(prefs.portalMilesBasis === opt.value ? styles.radioButtonActive : {}),
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Price Premium Threshold */}
                      {/* P2 fix #12: Changed min from 0% to 2% - 0-1% could be rounding errors */}
                      <div style={styles.settingRow}>
                        <div style={styles.settingLabel}>
                          Price premium threshold
                          <Badge isDefault={prefs.pricePremiumThreshold === 0.07} />
                        </div>
                        <div style={styles.settingDesc}>
                          If the portal price is significantly higher than the direct price, we'll flag it as a warning. This sets how much higher the portal needs to be before we consider it a "premium." For example, 7% means if direct is $500 and portal is $535+, we flag it.
                        </div>
                        <div style={{ ...styles.sliderValue, fontSize: '16px', marginTop: '10px' }}>
                          {(prefs.pricePremiumThreshold * 100).toFixed(0)}%
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="25"
                          step="1"
                          value={Math.max(2, prefs.pricePremiumThreshold * 100)}
                          onChange={(e) => updatePref('pricePremiumThreshold', parseFloat(e.target.value) / 100)}
                          className="vx-slider"
                        />
                        <div style={styles.sliderLabels}>
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
            {/* P1 fix: Scroll indicator gradient */}
            <div style={styles.scrollIndicator} />
          </div>
          
          {/* Footer */}
          <footer style={styles.footer}>
            <button
              onClick={onClose}
              style={{ ...styles.footerButton, ...styles.primaryButton }}
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
