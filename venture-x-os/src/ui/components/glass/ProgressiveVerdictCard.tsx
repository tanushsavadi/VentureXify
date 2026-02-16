/**
 * Progressive Verdict Card v2.0
 *
 * Implements streamlined progressive disclosure:
 * - Level 0 (default): Decision in 5 seconds - verdict + 2 reasons + CTA
 * - Level 1 (tap "Why?"): Tight 3-bullet format with contextual info
 * - Level 2 (tap "Show math"): Full audit trail modal
 *
 * Key UX Improvements:
 * - "Out-of-pocket today" as primary cost label
 * - Friction badge with tooltip explanation
 * - Award reality check with break-even line
 * - Semantic pill colors (green=savings, yellow=caution, purple=action)
 * - Reduced visual density, more spacing
 *
 * Tab-specific content:
 * - Cheapest: lowest out-of-pocket today (after credits)
 * - Max Value: lowest "effective cost" after valuing points earned/spent
 * - Easiest: lowest friction + lowest risk
 */

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { GlassButton } from './index';
import { SavingsWaterfall } from './SavingsWaterfall';
import {
  ChevronDown,
  TrendingDown,
  Sparkles,
  AlertTriangle,
  DollarSign,
  Plane,
  Zap,
  Calculator,
  X,
  CheckCircle2,
  HelpCircle,
  Info,
  Crown,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export type RankingMode = 'cheapest' | 'max_value' | 'easiest';

// Double-dip strategy info (Portal + Travel Eraser)
export interface DoubleDipStrategyInfo {
  payToday: number;
  milesEarned: number;
  milesValue: number;       // at user's cpp value
  eraseLater: number;       // max amount that can be erased with earned miles
  savingsVsDirect: number;  // cash savings vs direct price
  mileValueCpp: number;     // user's mile valuation in cents
}

export interface VerdictDataProgressive {
  recommendation: 'portal' | 'direct' | 'tie';
  
  // Itinerary summary (e.g., "DXB → LAX • May 12–20")
  itinerarySummary?: string;
  
  // Double-dip strategy info (optional - for flights when portal is recommended)
  doubleDipStrategy?: DoubleDipStrategyInfo;
  
  // Hero numbers (Level 0)
  winner: {
    label: string;
    payToday: number;
    payTodayLabel: string; // "Pay $521 today" or "Out of pocket"
  };
  
  // Primary delta chip
  primaryDelta: {
    type: 'savings' | 'cost' | 'tie'; // NEW: 'tie' for close calls
    amount: number;
    label: string; // "Save $246" or "$246 more" or "Essentially a tie"
  };
  
  // Close-call state - when prices are within threshold
  isCloseCall?: boolean;
  closeCallReason?: string; // e.g., "Within $25 or 2% - choose based on cancellation/support"
  
  // Secondary perk chip (optional)
  secondaryPerk?: {
    icon: 'miles' | 'flexibility' | 'status';
    label: string; // "+1,071 more miles" or "Keep airline status"
  };
  
  // Warning chip (max 1, only if relevant)
  // Updated: Now supports actionable confirmation pattern
  warning?: {
    severity: 'info' | 'warning' | 'critical' | 'confirm'; // 'confirm' = actionable check
    label: string; // "Confirm: airline checkout vs OTA"
    reason?: string; // "Direct seller not verified"
    actionLabel?: string;
    onAction?: () => void;
    confirmable?: boolean; // If true, shows checkmark when user confirms
  };
  
  // Level 1: Why bullets (max 3)
  whyBullets: {
    icon: '💰' | '✈️' | '⚠️' | '💡' | '📊';
    text: string;
  }[];
  
  // Level 2: Audit trail
  auditTrail: {
    assumptions: {
      label: string;
      value: string;
      editable?: boolean;
    }[];
    couldFlipIf: string[];
    fullBreakdown: {
      portalSticker: number;
      portalOutOfPocket: number;
      portalMilesEarned: string; // Can be range "2,605–4,105"
      directSticker: number;
      directOutOfPocket: number;
      directMilesEarned: number;
      creditApplied: number;
      breakEvenCpp?: number;
      portalPremiumPercent?: number;
      // Pay at property fee (e.g., resort fees, service fees due at check-in)
      payAtProperty?: number;
      // Booking type for proper context
      bookingType?: 'flight' | 'hotel' | 'vacation_rental';
      // Award data (optional, when transfer points option is added)
      awardProgram?: string;
      awardMiles?: number;
      awardTaxes?: number;
      awardTaxesEstimated?: boolean;
      awardCpp?: number;
      // Per-leg award breakdown (optional, when multi-leg award data exists)
      awardLegs?: {
        direction: 'outbound' | 'return' | 'roundtrip';
        program: string;
        partnerMiles: number;
        c1Miles: number;
        taxes: number;
        taxesEstimated: boolean;
        ratio: string; // e.g., "1:1" or "2:1.5"
        cpp: number;
      }[];
    };
    notes: string[];
  };
  
  // Confidence (maps to friction level)
  confidence: 'high' | 'medium' | 'low';
  
  // Friction level with explicit explanation
  friction?: {
    level: 'low' | 'medium' | 'high';
    tooltip: string; // e.g., "Portal booking + credit. Easy, but changes/support can be slower than booking direct."
  };
  
  // Award reality check (only when award is present)
  awardRealityCheck?: {
    cashSaved: number;
    milesSpent: number;
    cppValue: number;
    isGoodValue: boolean; // true if > 1.3cpp
    breakEvenMessage: string; // "Award only wins if you value miles at < 0.64¢ each."
  };
  
  // Tab-specific visibility
  tabMode?: RankingMode;
}

interface ProgressiveVerdictCardProps {
  verdict: VerdictDataProgressive;
  tabMode?: RankingMode;
  onAssumptionEdit?: (label: string) => void;
  onContinue?: () => void;
  onCompareOthers?: () => void;
  /** User's existing miles balance (undefined = not entered) */
  milesBalance?: number;
  /** Whether "Factor in miles value" toggle is ON */
  showEffectiveCost?: boolean;
  /** User's mile valuation in cpp (e.g., 0.01 = 1¢/mi) */
  mileValuationCpp?: number;
  className?: string;
}

// ============================================
// DETAIL CHIP COMPONENT
// ============================================

const DetailChip: React.FC<{
  type: 'success' | 'neutral' | 'warning' | 'confirm' | 'tie';
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  checked?: boolean;
}> = ({ type, icon, children, onClick, checked }) => {
  const colors = {
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    neutral: 'bg-[#4a90d9]/10 border-[#4a90d9]/20 text-[#7eb8e0]',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    // 'tie' type: close-call situation - uses amber/yellow for "uncertain"
    tie: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    // 'confirm' type: actionable, not error-like - uses blue/cyan tones
    confirm: checked
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
      : 'bg-sky-500/10 border-sky-500/20 text-sky-300 hover:bg-sky-500/15 cursor-pointer',
  };

  const Wrapper = onClick ? 'button' : 'span';

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
        colors[type]
      )}
    >
      {checked ? <CheckCircle2 className="w-3 h-3" /> : icon}
      {children}
    </Wrapper>
  );
};

// ============================================
// ACTIONABLE WARNING CHIP (for "Confirm" pattern)
// ============================================

const ActionableWarningChip: React.FC<{
  label: string;
  reason?: string;
  confirmed: boolean;
  onConfirm: () => void;
}> = ({ label, reason, confirmed, onConfirm }) => {
  return (
    <div className="flex flex-col gap-1">
      <DetailChip
        type="confirm"
        icon={<HelpCircle className="w-3 h-3" />}
        onClick={onConfirm}
        checked={confirmed}
      >
        {confirmed ? '✓ Confirmed' : label}
      </DetailChip>
      {!confirmed && reason && (
        <span className="text-[10px] text-white/40 ml-1">{reason}</span>
      )}
    </div>
  );
};

// ============================================
// WHY BULLET COMPONENT
// ============================================

const WhyBullet: React.FC<{
  icon: string;
  text: string;
  index: number;
}> = ({ icon, text, index }) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.1 }}
    className="flex items-start gap-2"
  >
    <span className="text-sm mt-0.5">{icon}</span>
    <span className="text-sm text-white/80">{text}</span>
  </motion.div>
);

// ============================================
// ANIMATED NUMBER COMPONENT
// ============================================

const AnimatedNumber: React.FC<{
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}> = ({ value, prefix = '', suffix = '', className }) => {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {prefix}{value.toLocaleString()}{suffix}
    </motion.span>
  );
};

// ============================================
// TOOLTIP WITH INFO ICON
// ============================================

const InfoTooltip: React.FC<{
  term: string;
  definition: string;
}> = ({ term, definition }) => {
  const [show, setShow] = useState(false);
  
  return (
    <span className="relative inline-flex items-center gap-1">
      <span>{term}</span>
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="text-white/30 hover:text-white/50 cursor-help"
      >
        <HelpCircle className="w-3 h-3" />
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1 z-50 w-48 p-2 rounded-lg bg-black/95 border border-white/20 text-[10px] text-white/80 shadow-xl"
          >
            {definition}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
};

// ============================================
// INFO TIP — Simple hover tooltip for key terms
// ============================================

const InfoTip = ({ text }: { text: string }) => {
  const [show, setShow] = useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [pos, setPos] = React.useState({ top: 0, right: 0 });

  const handleShow = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPos({
        top: rect.top - 4,
        right: window.innerWidth - rect.right,
      });
    }
    setShow(true);
  };

  return (
    <span className="inline-flex items-center ml-1">
      <button
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); show ? setShow(false) : handleShow(); }}
        onMouseEnter={handleShow}
        onMouseLeave={() => setShow(false)}
        className="text-white/40 hover:text-white/70 text-xs cursor-help transition-colors"
      >
        ⓘ
      </button>
      {show && ReactDOM.createPortal(
        <div
          className="fixed px-2.5 py-1.5 text-[11px] leading-tight text-white/90 bg-gray-900/95 border border-white/10 rounded-lg shadow-xl pointer-events-none"
          style={{
            zIndex: 99999,
            top: pos.top,
            right: pos.right,
            maxWidth: Math.min(200, window.innerWidth - 16),
            transform: 'translateY(-100%)',
          }}
        >
          {text}
        </div>,
        document.body
      )}
    </span>
  );
};

// ============================================
// R8: EXPANDABLE INFO — Progressive disclosure helper
// Hides detailed explanations behind a tap-to-reveal ⓘ button
// ============================================

const ExpandableInfo: React.FC<{
  summary: string;
  detail: React.ReactNode;
  variant?: 'default' | 'amber';
  className?: string;
}> = ({ summary, detail, variant = 'default', className }) => {
  const [expanded, setExpanded] = useState(false);
  const colors = variant === 'amber'
    ? 'text-amber-400/70 hover:text-amber-300'
    : 'text-white/40 hover:text-white/60';
  const detailColors = variant === 'amber'
    ? 'text-amber-200/70'
    : 'text-white/40';
  return (
    <div className={className}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn('flex items-center gap-1 text-xs transition-colors', colors)}
      >
        <Info className="w-3 h-3 flex-shrink-0" />
        <span>{summary}</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn('mt-1.5 text-xs leading-relaxed', detailColors)}>
              {detail}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// ACCORDION COMPONENT
// ============================================

const Accordion: React.FC<{
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
  children: React.ReactNode;
}> = ({ title, icon, defaultOpen = false, onToggle, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="rounded-xl border border-white/[0.08] overflow-hidden">
      <button
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          onToggle?.(next);
        }}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-4 py-3',
          'bg-white/[0.03] hover:bg-white/[0.05] transition-colors'
        )}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium text-white/80">{title}</span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          <ChevronDown className="w-4 h-4 text-white/40" />
        </motion.div>
      </button>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t border-white/[0.06] bg-white/[0.01]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// CPP VALUE COLOR HELPER
// ============================================

const getCppColor = (cpp: number): string => {
  if (cpp >= 2.0) return 'text-emerald-300'; // excellent
  if (cpp >= 1.5) return 'text-emerald-400'; // good
  if (cpp >= 1.0) return 'text-amber-300';   // decent
  return 'text-red-400';                     // poor
};

const getCppBgColor = (cpp: number): string => {
  if (cpp >= 2.0) return 'bg-emerald-500/10 border-emerald-500/20';
  if (cpp >= 1.5) return 'bg-emerald-500/10 border-emerald-500/15';
  if (cpp >= 1.0) return 'bg-amber-500/10 border-amber-500/15';
  return 'bg-red-500/10 border-red-500/15';
};

const getCppLabel = (cpp: number): string => {
  if (cpp >= 2.0) return 'Excellent';
  if (cpp >= 1.5) return 'Good';
  if (cpp >= 1.0) return 'Decent';
  return 'Low';
};

// ============================================
// PER-LEG AWARD BREAKDOWN COMPONENT
// ============================================

type AwardLegData = NonNullable<VerdictDataProgressive['auditTrail']['fullBreakdown']['awardLegs']>[number];

const AwardLegRow: React.FC<{
  leg: AwardLegData;
  isLast: boolean;
}> = ({ leg, isLast }) => {
  const directionLabel = leg.direction === 'outbound' ? 'Outbound' : leg.direction === 'return' ? 'Return' : 'Roundtrip';
  const isNonOneToOne = leg.ratio !== '1:1';

  return (
    <div className={cn(
      'px-3 py-2.5',
      !isLast && 'border-b border-white/[0.06]'
    )}>
      {/* Direction + Program */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-xs">✈️</span>
        <span className="text-xs font-medium text-white/80">
          {directionLabel}: {leg.program}
        </span>
      </div>

      {/* Miles conversion */}
      <div className="pl-5 space-y-1 text-[11px]">
        <div className="text-white/50">
          {leg.partnerMiles.toLocaleString()} partner pts × {leg.ratio} ratio
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-white/70">
            = {leg.c1Miles.toLocaleString()} Capital One miles
          </span>
          {isNonOneToOne && (
            <span className="text-amber-400 text-[10px]">⚠️</span>
          )}
        </div>
        {isNonOneToOne && (
          <div className="text-amber-400/70 text-[10px]">
            (non-1:1 conversion)
          </div>
        )}
        <div className="text-white/50">
          + ${leg.taxes.toLocaleString()} taxes/fees
          {leg.taxesEstimated && (
            <span className="text-white/30"> (estimated)</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-white/40">Value:</span>
          <span className={cn('font-medium', getCppColor(leg.cpp))}>
            {leg.cpp.toFixed(1)}¢/mile
          </span>
          <span className={cn(
            'text-[9px] px-1.5 py-0.5 rounded-full border',
            getCppBgColor(leg.cpp)
          )}>
            {getCppLabel(leg.cpp)}
          </span>
        </div>
      </div>
    </div>
  );
};

const AwardTransferBreakdown: React.FC<{
  awardLegs: AwardLegData[];
  totalC1Miles?: number;
  totalTaxes?: number;
  totalTaxesEstimated?: boolean;
  totalCpp?: number;
  baselineLabel?: string;
  baselineAmount?: number;
}> = ({ awardLegs, totalC1Miles, totalTaxes, totalTaxesEstimated: totalTaxesEstimatedProp, totalCpp, baselineLabel, baselineAmount }) => {
  if (!awardLegs || awardLegs.length === 0) return null;

  const isSingleLeg = awardLegs.length === 1;

  // Compute totals from legs if not provided
  const computedTotalMiles = totalC1Miles ?? awardLegs.reduce((s, l) => s + l.c1Miles, 0);
  const computedTotalTaxes = totalTaxes ?? awardLegs.reduce((s, l) => s + l.taxes, 0);
  const computedTotalCpp = totalCpp ?? (awardLegs.length > 0
    ? awardLegs.reduce((s, l) => s + l.cpp, 0) / awardLegs.length
    : 0);

  return (
    <div className="mt-4 pt-4 border-t border-white/[0.08]">
      <div className="text-[10px] font-semibold text-[#5b9bd5] uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <span>📊</span>
        <span>Award Transfer Breakdown</span>
      </div>

      <div className="rounded-lg border border-white/[0.08] overflow-hidden bg-white/[0.02]">
        {/* Per-leg rows (only show individual legs if multi-leg) */}
        {!isSingleLeg && awardLegs.map((leg, i) => (
          <AwardLegRow
            key={`${leg.direction}-${i}`}
            leg={leg}
            isLast={false}
          />
        ))}

        {/* Single leg: show just the one program inline */}
        {isSingleLeg && (
          <div className="px-3 py-2.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-xs">✈️</span>
              <span className="text-xs font-medium text-white/80">
                via {awardLegs[0].program}
              </span>
            </div>
            <div className="pl-5 space-y-1 text-[11px]">
              <div className="text-white/50">
                {awardLegs[0].partnerMiles.toLocaleString()} partner pts × {awardLegs[0].ratio} ratio
              </div>
              {awardLegs[0].ratio !== '1:1' && (
                <div className="flex items-center gap-1.5">
                  <span className="text-white/70">
                    = {awardLegs[0].c1Miles.toLocaleString()} Capital One miles
                  </span>
                  <span className="text-amber-400 text-[10px]">⚠️</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TOTAL row */}
        <div className="px-3 py-2.5 bg-white/[0.03]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-xs">📌</span>
            <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">
              {isSingleLeg ? 'Summary' : 'Total'}
            </span>
          </div>
          <div className="pl-5 space-y-1 text-[11px]">
            <div className="text-white/70 font-medium">
              {computedTotalMiles.toLocaleString()} Capital One miles
            </div>
            <div className="text-white/50">
              + ${computedTotalTaxes.toLocaleString()} taxes/fees
              {(totalTaxesEstimatedProp || awardLegs.some(l => l.taxesEstimated)) && (
                <span className="text-white/30"> (some estimated)</span>
              )}
            </div>
            {computedTotalCpp > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-white/40">Overall value:</span>
                <span className={cn('font-semibold', getCppColor(computedTotalCpp))}>
                  {computedTotalCpp.toFixed(1)}¢/mile
                </span>
              </div>
            )}
            {baselineLabel && baselineAmount !== undefined && (
              <div className="text-white/40 mt-1">
                vs baseline: ${baselineAmount.toLocaleString()} ({baselineLabel})
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper to derive a baseline label from the comparison baseline type
const getBaselineLabel = (baseline?: string): string => {
  switch (baseline) {
    case 'portal_credit': return 'Portal after credit';
    case 'portal_no_credit': return 'Portal price';
    case 'direct': return 'Direct price';
    default: return 'Baseline';
  }
};

// Variable to track whether totalTaxes might be estimated
const computedTotalTaxesEstimated = (legs: AwardLegData[]): boolean =>
  legs.some(l => l.taxesEstimated);

// ============================================
// DETAILS MODAL COMPONENT (Summary-First with Accordions)
// ============================================

const DetailsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  auditTrail: VerdictDataProgressive['auditTrail'];
  tabMode?: RankingMode;
  onAssumptionEdit?: (label: string) => void;
  // P0 #3 FIX: Add onContinue callback to provide booking CTA instead of dead-end
  onContinue?: () => void;
  recommendation?: 'portal' | 'direct' | 'tie';
  /** Props for rendering SavingsWaterfall inside the modal */
  milesBalance?: number;
  showEffectiveCost?: boolean;
  mileValuationCpp?: number;
  doubleDipStrategy?: DoubleDipStrategyInfo;
}> = ({ isOpen, onClose, auditTrail, tabMode, onAssumptionEdit, onContinue, recommendation, milesBalance, showEffectiveCost, mileValuationCpp, doubleDipStrategy }) => {
  if (!isOpen) return null;

  const { assumptions, couldFlipIf, fullBreakdown, notes } = auditTrail;

  // ============================================
  // SANITY GUARDS: Parse miles with bounds checking
  // Prevents absurd values from rendering (e.g., -$1,516,792)
  // ============================================
  
  const parsePortalMiles = (milesStr: string): number => {
    // Handle range format "2,605–4,105" by taking the first/conservative number
    const cleanStr = milesStr.replace(/[^0-9–-]/g, '');
    const firstNum = cleanStr.split(/[–-]/)[0];
    const parsed = parseInt(firstNum, 10) || 0;
    return parsed;
  };
  
  const rawPortalMiles = parsePortalMiles(fullBreakdown.portalMilesEarned);
  const rawDirectMiles = fullBreakdown.directMilesEarned;
  
  // SANITY CHECK: For a typical booking (~$500-$5000), miles should be reasonable
  // Portal 5x max on $10k = 50,000 miles; 10x on $10k = 100,000 miles
  // Anything over 200,000 miles on a single booking is almost certainly a bug
  const MAX_REASONABLE_MILES = 200000;
  
  const portalMilesSafe = rawPortalMiles > MAX_REASONABLE_MILES ? 0 : rawPortalMiles;
  const directMilesSafe = rawDirectMiles > MAX_REASONABLE_MILES ? 0 : rawDirectMiles;
  
  // Detect if values seem wrong (for UI warning)
  // (Effective cost computation removed — handled by SavingsWaterfall)
  const hasMathError =
    rawPortalMiles > MAX_REASONABLE_MILES ||
    rawDirectMiles > MAX_REASONABLE_MILES;
  
  // Determine winner and savings
  const portalWins = fullBreakdown.portalOutOfPocket <= fullBreakdown.directOutOfPocket;
  const winner = portalWins ? 'Portal' : 'Direct';
  const savings = Math.abs(fullBreakdown.portalOutOfPocket - fullBreakdown.directOutOfPocket);
  const milesDiff = Math.abs(portalMilesSafe - directMilesSafe);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[85vh] overflow-y-auto"
      >
        <div className="relative bg-[#0A0A0F] rounded-2xl border border-white/[0.10] overflow-hidden">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#4a90d9]/[0.03] to-transparent pointer-events-none" />
          
          {/* Header */}
          <div className="relative flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-[#5b9bd5]" />
              Math & Assumptions
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] transition-colors"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          <div className="relative p-5 space-y-5">
            {/* ===== HERO SUMMARY (Always Visible) ===== */}
            {/* UX FIX P0-1: Show actual out-of-pocket as PRIMARY, effective cost as SECONDARY */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 via-[#4a90d9]/5 to-[#1e3048]/10 border border-emerald-500/20">
              {/* Winner Badge */}
              <div className="flex items-center gap-2 mb-3">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Winner: {winner} Booking
                </span>
              </div>
              
              {/* PRIMARY: Actual Out-of-Pocket (what you pay today) */}
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[10px] text-white/50 uppercase tracking-wider">
                  Pay Today
                </span>
              </div>
              <div className="text-3xl font-bold text-white mb-2">
                ${(portalWins ? fullBreakdown.portalOutOfPocket : fullBreakdown.directOutOfPocket).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              
              {/* Savings vs alternative */}
              <div className="flex items-center gap-3 text-sm">
                {savings > 0 ? (
                  <span className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full',
                    portalWins
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-[#4a90d9]/15 text-[#7eb8e0]'
                  )}>
                    <TrendingDown className="w-3.5 h-3.5" />
                    Save <span className="font-semibold">${savings}</span> vs {portalWins ? 'Direct' : 'Portal'}
                  </span>
                ) : (
                  <span className="text-white/50">Similar out-of-pocket costs</span>
                )}
              </div>
              
              {/* Miles delta (smaller text, no dollar conversion — handled by SavingsWaterfall) */}
              {milesDiff > 100 && !hasMathError && (
                <div className="mt-3 pt-3 border-t border-white/[0.08]">
                  <div className="text-xs text-white/50">
                    {portalMilesSafe > directMilesSafe ? 'Portal' : 'Direct'} earns{' '}
                    <span className="text-[#7eb8e0] font-medium">
                      +{milesDiff.toLocaleString()} more miles
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ===== MATH ERROR WARNING ===== */}
            {hasMathError && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-red-400 mb-1">
                      Math Error Detected
                    </div>
                    <div className="text-xs text-white/60 mb-2">
                      Some calculated values appear incorrect. The verdict above is based on raw price comparison only.
                    </div>
                    <div className="text-[10px] text-white/40 font-mono">
                      Debug: portalMiles={rawPortalMiles.toLocaleString()}, directMiles={rawDirectMiles.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===== SAVINGS WATERFALL (in modal) ===== */}
            {(() => {
              const fb = fullBreakdown;
              const parseMilesStrModal = (s: string): number => {
                const clean = s.replace(/[^0-9–-]/g, '');
                const first = clean.split(/[–-]/)[0];
                return parseInt(first, 10) || 0;
              };
              const portalMilesModal = doubleDipStrategy?.milesEarned
                ?? parseMilesStrModal(fb.portalMilesEarned);

              return (
                <SavingsWaterfall
                  listedPrice={fb.portalSticker}
                  creditApplied={fb.creditApplied}
                  payToday={fb.portalOutOfPocket}
                  directPrice={fb.directOutOfPocket}
                  milesEarned={portalMilesModal}
                  existingMilesBalance={milesBalance}
                  eraserCpp={0.01}
                  recommendation={recommendation ?? 'portal'}
                  mileValuationCpp={mileValuationCpp}
                  showEffectiveCost={showEffectiveCost}
                />
              );
            })()}

            {/* ===== ACCORDION 1: Key Assumptions ===== */}
            <Accordion
              title="Key assumptions"
              icon={<Sparkles className="w-4 h-4 text-[#5b9bd5]" />}
            >
              <div className="space-y-2">
                {/* Assumption rows - improved visual affordance for editable items */}
                {assumptions.map((assumption, i) => (
                  <button
                    key={i}
                    onClick={() => assumption.editable && onAssumptionEdit?.(assumption.label)}
                    disabled={!assumption.editable}
                    className={cn(
                      'w-full flex items-center justify-between py-2.5 px-3 rounded-xl transition-all',
                      assumption.editable
                        ? 'bg-[#4a90d9]/10 hover:bg-[#4a90d9]/15 border border-[#4a90d9]/20 hover:border-[#4a90d9]/30 cursor-pointer group'
                        : 'bg-white/[0.02] border border-transparent cursor-default'
                    )}
                  >
                    <div className="flex flex-col items-start gap-0.5">
                      <span className="text-xs text-white/50">
                        {assumption.label === 'Mile value' ? (
                          <InfoTooltip
                            term={assumption.label}
                            definition="How much each Capital One mile is worth in cents. Default 1.5¢ is a conservative estimate. Transfer partners can often achieve 1.8-2.5¢."
                          />
                        ) : assumption.label === 'Travel credit' ? (
                          <InfoTooltip
                            term={assumption.label}
                            definition="Annual $300 Venture X travel credit. Click to edit if you've already used part of it."
                          />
                        ) : (
                          assumption.label
                        )}
                      </span>
                      {assumption.editable && (
                        <span className="text-[9px] text-[#5b9bd5]/60 group-hover:text-[#5b9bd5]/80 transition-colors">
                          Click to edit
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-sm font-semibold text-right',
                        assumption.editable ? 'text-[#7eb8e0] group-hover:text-[#a3c9e8]' : 'text-white/70'
                      )}>
                        {assumption.value}
                      </span>
                      {assumption.editable && (
                        <span className="w-6 h-6 rounded-md bg-[#4a90d9]/20 group-hover:bg-[#4a90d9]/30 flex items-center justify-center transition-colors">
                          <span className="text-[#7eb8e0] text-xs">✎</span>
                        </span>
                      )}
                    </div>
                  </button>
                ))}
                
                {/* What could flip */}
                {couldFlipIf.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/[0.06]">
                    <div className="text-[10px] text-amber-400/80 uppercase tracking-wider font-medium mb-2">
                      What could change the answer
                    </div>
                    <div className="space-y-1.5">
                      {couldFlipIf.map((condition, i) => (
                        <div key={i} className="text-xs text-white/60 flex items-start gap-2">
                          <span className="text-amber-400 mt-0.5">→</span>
                          <span>{condition}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Accordion>

            {/* ===== ACCORDION 2: Full Calculation Details ===== */}
            {/* Hidden when math error detected to avoid showing incorrect values */}
            {!hasMathError && (
            <Accordion
              title="Full calculation details"
              icon={<Calculator className="w-4 h-4 text-[#5b9bd5]" />}
            >
              <div className="space-y-4">
                {/* Portal vs Direct vs Award Grid */}
                <div className={cn(
                  'grid gap-3',
                  fullBreakdown.awardMiles ? 'grid-cols-3' : 'grid-cols-2'
                )}>
                  {/* Portal Column */}
                  <div className="space-y-3">
                    <div className="text-[10px] font-semibold text-[#5b9bd5] uppercase tracking-wider pb-2 border-b border-white/[0.06]">
                      Portal
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-white/40">Listed Price<InfoTip text="The price shown on the booking site before any credits or rewards." /></span>
                        <span className="text-xs font-semibold text-white text-right">
                          ${fullBreakdown.portalSticker.toLocaleString()}
                        </span>
                      </div>
                      {fullBreakdown.creditApplied > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-white/40">Credit</span>
                          <span className="text-xs font-semibold text-emerald-400 text-right">
                            -${fullBreakdown.creditApplied}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-1 border-t border-white/[0.06]">
                        <span className="text-[10px] text-white/50">Pay today</span>
                        <span className="text-sm font-bold text-white text-right">
                          ${fullBreakdown.portalOutOfPocket.toLocaleString()}
                        </span>
                      </div>
                      {/* Pay at property fee (resort fees, service fees) */}
                      {fullBreakdown.payAtProperty && fullBreakdown.payAtProperty > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-amber-400/80">
                            <InfoTooltip
                              term="+ at property"
                              definition="Additional fee due at check-in (e.g., resort fee, service fee). Not included in portal price."
                            />
                          </span>
                          <span className="text-xs font-semibold text-amber-400 text-right">
                            +${fullBreakdown.payAtProperty.toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-white/40">Miles earned<InfoTip text="Portal earns 5x miles on flights, 10x on hotels. Direct earns 2x on all travel." /></span>
                        <span className="text-xs font-semibold text-[#7eb8e0] text-right">
                          {(() => {
                            const milesStr = fullBreakdown.portalMilesEarned.toString();
                            // Don't add prefix if already has one (–, +) or contains range notation
                            if (milesStr.includes('–') || milesStr.startsWith('+') || milesStr.startsWith('-')) {
                              return milesStr;
                            }
                            return `+${milesStr}`;
                          })()}
                        </span>
                      </div>
                      {/* Show miles calculation breakdown when range exists */}
                      {fullBreakdown.portalMilesEarned.toString().includes('–') && (
                        <div className="text-[9px] text-white/30 mt-1 space-y-0.5">
                          <div>
                            5x on ${fullBreakdown.portalSticker.toLocaleString()} listed price
                            {fullBreakdown.creditApplied > 0 && (
                              <> or ${(fullBreakdown.portalSticker - fullBreakdown.creditApplied).toLocaleString()} after credit</>
                            )}
                          </div>
                          <div className="text-amber-400/60">
                            ℹ️ Conservative estimate used for recommendation
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Direct Column */}
                  <div className="space-y-3">
                    <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider pb-2 border-b border-white/[0.06]">
                      Direct
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-white/40">Listed Price</span>
                        <span className="text-xs font-semibold text-white text-right">
                          ${fullBreakdown.directSticker.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-white/40">Credit</span>
                        <span className="text-xs text-white/30 text-right">—</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-white/[0.06]">
                        <span className="text-[10px] text-white/50">Pay today</span>
                        <span className="text-sm font-bold text-white text-right">
                          ${fullBreakdown.directOutOfPocket.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-white/40">Miles earned</span>
                        <span className="text-xs font-semibold text-[#7eb8e0] text-right">
                          +{fullBreakdown.directMilesEarned.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Award Column (only when award data exists) */}
                  {fullBreakdown.awardMiles && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 pb-2 border-b border-white/[0.06]">
                        <span className={cn(
                          "text-[10px] font-semibold uppercase tracking-wider",
                          fullBreakdown.awardCpp !== undefined && fullBreakdown.awardCpp < 1.0
                            ? "text-amber-400"
                            : "text-[#5b9bd5]"
                        )}>Award</span>
                        {fullBreakdown.awardCpp !== undefined && fullBreakdown.awardCpp < 1.0 && (
                          <span className="text-[8px] text-amber-400">⚠️</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-white/40">Taxes</span>
                          <span className="text-xs font-semibold text-white text-right">
                            ${fullBreakdown.awardTaxes?.toLocaleString() || 0}
                            {fullBreakdown.awardTaxesEstimated && (
                              <span className="text-[8px] text-white/30">*</span>
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-white/40">Miles cost</span>
                          <span className="text-xs font-semibold text-[#7eb8e0] text-right">
                            {fullBreakdown.awardMiles.toLocaleString()}
                          </span>
                        </div>
                        {fullBreakdown.awardCpp !== undefined && (
                          <div className="flex justify-between items-center pt-1 border-t border-white/[0.06]">
                            <span className="text-[10px] text-white/40">
                              <InfoTooltip
                                term="CPP"
                                definition="Cents per point. Shows how much value you're getting per mile. Good = 1.3¢+, Excellent = 1.8¢+. Travel Eraser baseline = 1¢."
                              />
                            </span>
                            <span className={cn(
                              "text-sm font-bold text-right",
                              getCppColor(fullBreakdown.awardCpp)
                            )}>
                              {fullBreakdown.awardCpp.toFixed(2)}¢
                            </span>
                          </div>
                        )}
                        {fullBreakdown.awardProgram && (
                          <div className="text-[10px] text-white/40 truncate">
                            via {fullBreakdown.awardProgram}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* ===== PER-LEG AWARD TRANSFER BREAKDOWN ===== */}
                {fullBreakdown.awardLegs && fullBreakdown.awardLegs.length > 0 && (
                  <AwardTransferBreakdown
                    awardLegs={fullBreakdown.awardLegs}
                    totalC1Miles={fullBreakdown.awardMiles}
                    totalTaxes={fullBreakdown.awardTaxes}
                    totalTaxesEstimated={fullBreakdown.awardTaxesEstimated || computedTotalTaxesEstimated(fullBreakdown.awardLegs)}
                    totalCpp={fullBreakdown.awardCpp}
                    baselineLabel={getBaselineLabel(undefined)}
                    baselineAmount={fullBreakdown.directOutOfPocket}
                  />
                )}

                {/* Travel Eraser Breakdown — hidden when "Factor in miles value" toggle is OFF */}
                {showEffectiveCost && (() => {
                  const parseMilesStr2 = (s: string): number => {
                    const clean = s.replace(/[^0-9–-]/g, '');
                    const first = clean.split(/[–-]/)[0];
                    return parseInt(first, 10) || 0;
                  };
                  const earnedMiles = doubleDipStrategy?.milesEarned ?? parseMilesStr2(fullBreakdown.portalMilesEarned);
                  const existingBal = milesBalance ?? 0;
                  const totalMiles = existingBal + earnedMiles;
                  const maxErase = Math.floor(totalMiles * 0.01);
                  const eraserAmt = Math.min(maxErase, fullBreakdown.portalOutOfPocket);
                  const afterEraser = fullBreakdown.portalOutOfPocket - eraserAmt;
                  const totalSavings = fullBreakdown.directOutOfPocket - afterEraser;

                  if (earnedMiles <= 0) return null;

                  return (
                    <div className="mt-4 pt-4 border-t border-white/[0.08]">
                      <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-3">
                        ── TRAVEL ERASER BREAKDOWN ──
                      </div>
                      <div className="space-y-1.5 font-mono text-xs">
                        <div className="flex justify-between">
                          <span className="text-white/50">Existing miles balance<InfoTip text="Your current Capital One miles balance as entered in Settings." /></span>
                          <span className="text-white/70">{existingBal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">+ Miles earned (portal)<InfoTip text="Miles earned from this portal booking at 5x on flights." /></span>
                          <span className="text-emerald-400">+{earnedMiles.toLocaleString()}</span>
                        </div>
                        <div className="border-t border-white/[0.08] my-1" />
                        <div className="flex justify-between">
                          <span className="text-white/60 font-medium">Total miles available</span>
                          <span className="text-white font-medium">{totalMiles.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">Eraser rate</span>
                          <span className="text-white/70">1¢/mi</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">Max eraser amount</span>
                          <span className="text-white/70">${maxErase.toLocaleString()}</span>
                        </div>
                        <div className="border-t border-white/[0.08] my-1" />
                        <div className="flex justify-between font-semibold">
                          <span className="text-white/80">After Eraser</span>
                          <span className="text-white">${afterEraser.toLocaleString()}</span>
                        </div>
                        {totalSavings > 0 && (
                          <div className="flex justify-between font-semibold">
                            <span className="text-emerald-400/80">Total savings vs Direct</span>
                            <span className="text-emerald-400">${totalSavings.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Portal Premium % */}
                {fullBreakdown.portalPremiumPercent !== undefined && fullBreakdown.portalPremiumPercent > 0 && (
                  <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <div className="text-xs text-amber-300/80">
                      Portal listed price is <span className="font-semibold">{fullBreakdown.portalPremiumPercent.toFixed(0)}%</span> higher than direct (before credit)
                    </div>
                  </div>
                )}

                {/* Break-even CPP (for Max Value) */}
                {tabMode === 'max_value' && fullBreakdown.breakEvenCpp && (
                  <div className="p-2.5 rounded-lg bg-[#4a90d9]/10 border border-[#4a90d9]/20">
                    <div className="text-xs text-[#7eb8e0]">
                      Portal beats direct if you value miles at{' '}
                      <span className="font-semibold">≥{fullBreakdown.breakEvenCpp.toFixed(2)}¢/mi</span>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {notes.length > 0 && (
                  <div className="pt-3 border-t border-white/[0.06]">
                    <div className="text-xs text-white/40 space-y-1.5">
                      {notes.map((note, i) => (
                        <p key={i}>• {note}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Accordion>
            )}

            {/* P0 #3 FIX: Replace dead-end "Got it" with actionable CTA buttons */}
            {/* P0 CTA-WINNER MISMATCH FIX: Use locally-calculated portalWins instead of recommendation prop */}
            {/* This ensures the CTA always matches the "WINNER:" header displayed above */}
            <div className="space-y-2">
              {/* Primary CTA - Continue to booking */}
              {onContinue && (
                <GlassButton
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    onClose();
                    onContinue();
                  }}
                >
                  Continue to {portalWins ? 'Portal' : 'Direct Site'}
                </GlassButton>
              )}
              {/* Secondary - Close modal */}
              {/* P2-22 FIX: Changed from "Review More Details" (redundant - user is already IN details) to "Close" */}
              <GlassButton
                variant="secondary"
                className="w-full"
                onClick={onClose}
              >
                Close
              </GlassButton>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============================================
// BOOKING STEPS BADGE WITH TOOLTIP
// (Renamed from "friction" for clarity)
// ============================================

const FrictionBadge: React.FC<{
  level: 'low' | 'medium' | 'high';
  tooltip: string;
}> = ({ level, tooltip }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  // User-friendly labels instead of "friction"
  const config = {
    low: {
      color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
      label: 'Easy',
      shortLabel: 'Easy',
      icon: '✓'
    },
    medium: {
      color: 'bg-white/10 text-white/60 border-white/20',
      label: 'Standard',
      shortLabel: 'Standard',
      icon: '•'
    },
    high: {
      color: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
      label: 'Complex',
      shortLabel: '⚡',
      icon: '!'
    },
  };
  
  const { color, label, shortLabel, icon } = config[level];
  
  return (
    <div className="relative shrink-0">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-medium rounded-full border cursor-help transition-colors hover:bg-white/5 whitespace-nowrap',
          color
        )}
      >
        <span className="text-[8px] leading-none">{icon}</span>
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{shortLabel}</span>
        <Info className="w-2 h-2 opacity-50 shrink-0" />
      </button>
      
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute top-full right-0 mt-2 w-56 p-3 rounded-lg bg-black/95 border border-white/20 text-[11px] text-white/80 z-20 shadow-xl"
          >
            <div className="font-medium text-white/90 mb-1">What this means</div>
            {tooltip}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// AWARD REALITY CHECK COMPONENT
// ============================================

const AwardRealityCheck: React.FC<{
  cashSaved: number;
  milesSpent: number;
  cppValue: number;
  isGoodValue: boolean;
  breakEvenMessage: string;
}> = ({ cashSaved, milesSpent, cppValue, isGoodValue, breakEvenMessage }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn(
      'p-3 rounded-xl border mb-4',
      isGoodValue
        ? 'bg-emerald-500/10 border-emerald-500/20'
        : 'bg-amber-500/10 border-amber-500/20'
    )}
  >
    <div className="flex items-start gap-2 mb-2">
      {isGoodValue ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
      )}
      <div>
        <div className={cn(
          'text-xs font-medium',
          isGoodValue ? 'text-emerald-300' : 'text-amber-300'
        )}>
          Award Reality Check
        </div>
        <div className="text-[11px] text-white/70 mt-1">
          Award saves <span className="text-white font-medium">${cashSaved}</span> cash, but costs{' '}
          <span className="text-white font-medium">{milesSpent.toLocaleString()} miles</span> → that's{' '}
          <span className={cn('font-semibold', isGoodValue ? 'text-emerald-400' : 'text-amber-400')}>
            {cppValue.toFixed(2)}¢/mi
          </span>
          {!isGoodValue && ' (low)'}
        </div>
      </div>
    </div>
    <div className={cn(
      'text-[10px] px-2 py-1.5 rounded-md',
      isGoodValue ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'
    )}>
      💡 {breakEvenMessage}
    </div>
  </motion.div>
);

// ============================================
// CLOSE-CALL BANNER COMPONENT
// Shows when prices are within threshold and verdict is uncertain
// ============================================

const CloseCallBanner: React.FC<{
  reason?: string;
}> = ({ reason }) => (
  <motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30"
  >
    <div className="flex items-start gap-2">
      <span className="text-base mt-0.5">⚖️</span>
      <div className="flex-1">
        <div className="text-sm font-semibold text-amber-300 mb-0.5">
          Essentially a tie
        </div>
        {/* R8: Dense tie-breaker guidance collapsed behind tap-to-expand */}
        <ExpandableInfo
          summary="How to decide"
          detail={reason || 'Prices are within $25 or 2% — choose based on cancellation policies, support quality, or personal preference.'}
          variant="amber"
        />
      </div>
    </div>
  </motion.div>
);

// ============================================
// CONFIDENCE BADGE COMPONENT
// Shows confidence level when not high
// ============================================

const ConfidenceBadge: React.FC<{
  level: 'high' | 'medium' | 'low';
}> = ({ level }) => {
  if (level === 'high') return null;
  
  const config = {
    medium: {
      color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      label: 'Medium confidence',
      icon: '⚠️',
    },
    low: {
      color: 'bg-red-500/15 text-red-400 border-red-500/30',
      label: 'Low confidence',
      icon: '❓',
    },
  };
  
  const { color, label, icon } = config[level];
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full border',
      color
    )}>
      <span>{icon}</span>
      {label}
    </span>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const ProgressiveVerdictCard: React.FC<ProgressiveVerdictCardProps> = ({
  verdict,
  tabMode = 'cheapest',
  onAssumptionEdit,
  onContinue,
  onCompareOthers,
  milesBalance,
  showEffectiveCost = false,
  mileValuationCpp = 0.01,
  className,
}) => {
  // R4: Collapse "Why This Wins" by default for a 5-second decision viewport.
  // Level 0 (recommendation + price + savings + CTA) is all that's needed at first glance.
  // Users tap "Why?" to expand Level 1 details on demand.
  const [showWhy, setShowWhy] = useState(false);
  // Auto-open math for low confidence verdicts
  const [showDetails, setShowDetails] = useState(verdict.confidence === 'low');
  const [warningConfirmed, setWarningConfirmed] = useState(false);

  const getRecommendationEmoji = () => {
    // Show tie emoji for close calls
    if (verdict.isCloseCall) return '⚖️';
    switch (verdict.recommendation) {
      case 'portal': return '🏦';
      case 'direct': return '✈️';
      case 'tie': return '⚖️';
      default: return '✨';
    }
  };

  // Friction level defaults based on recommendation
  // Note: If a booking-type-aware friction is provided via verdict.friction, use it.
  // Otherwise, provide generic defaults (booking type context passed via verdict.friction from parent)
  const getFriction = () => {
    if (verdict.friction) return verdict.friction;
    // Default friction levels - generic fallback (booking-type-specific handled by parent)
    if (verdict.recommendation === 'direct') {
      return { level: 'low' as const, tooltip: 'Direct booking. Easier changes and support.' };
    }
    return { level: 'medium' as const, tooltip: 'Portal booking + credit. Easy, but changes/support can be slower.' };
  };
  
  const friction = getFriction();

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          'relative rounded-2xl overflow-hidden',
          className
        )}
      >
        {/* Subtle gradient border (reduced intensity) */}
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            padding: '1.5px',
            background: 'conic-gradient(from 0deg, rgba(74, 144, 217, 0.4), rgba(45, 106, 163, 0.25), rgba(51, 78, 104, 0.2), rgba(45, 106, 163, 0.25), rgba(74, 144, 217, 0.4))',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />

        {/* Card content - increased padding for better spacing */}
        <div className="relative bg-white/[0.06] backdrop-blur-xl rounded-2xl p-6">
          {/* Inner highlight */}
          <div className="absolute inset-0 rounded-[inherit] pointer-events-none shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" />

          {/* ===== LEVEL 0: HERO DECISION ===== */}
          <div className="relative z-10">
            {/* Close-call banner (show when prices are within threshold) */}
            {verdict.isCloseCall && (
              <CloseCallBanner reason={verdict.closeCallReason} />
            )}
            
            {/* Itinerary summary (e.g., "DXB → LAX • May 12–20") */}
            {verdict.itinerarySummary && (
              <div className="mb-3 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-center">
                <span className="text-xs text-white/60 font-medium">
                  {verdict.itinerarySummary}
                </span>
              </div>
            )}
            
            {/* Recommended badge + Friction badge row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  {verdict.isCloseCall ? 'Slight Edge' : 'Recommended'}
                </span>
              </div>
              {/* UX FIX P2-10: Friction badge now has detailed explanation in tooltip */}
              <FrictionBadge level={friction.level} tooltip={friction.tooltip} />
            </div>
            
            {/* Winner announcement row - improved spacing */}
            <div className="flex items-center gap-4 mb-5">
              <motion.div
                className="text-4xl"
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                {getRecommendationEmoji()}
              </motion.div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-1">
                  {verdict.winner.label}
                </h2>
                <p className="text-sm text-white/70">
                  Out-of-pocket today: <span className="text-white font-semibold">${verdict.winner.payToday.toLocaleString()}</span>
                </p>
              </div>
            </div>

            {/* Chips row: Primary delta + Secondary perk - semantic colors */}
            <div className="flex flex-wrap gap-2 mb-5">
              {/* Primary delta chip - green for savings, amber for tie */}
              <DetailChip
                type={verdict.primaryDelta.type === 'savings' ? 'success'
                    : verdict.primaryDelta.type === 'tie' ? 'tie'
                    : 'neutral'}
                icon={verdict.primaryDelta.type === 'savings'
                  ? <TrendingDown className="w-3 h-3" />
                  : verdict.primaryDelta.type === 'tie'
                    ? <span className="text-xs">⚖️</span>
                    : <DollarSign className="w-3 h-3" />
                }
              >
                {verdict.primaryDelta.label}
              </DetailChip>

              {/* Secondary perk chip - purple for info */}
              {verdict.secondaryPerk && (
                <DetailChip
                  type="neutral"
                  icon={
                    verdict.secondaryPerk.icon === 'miles' ? <Plane className="w-3 h-3" /> :
                    verdict.secondaryPerk.icon === 'flexibility' ? <Zap className="w-3 h-3" /> :
                    <Sparkles className="w-3 h-3" />
                  }
                >
                  {verdict.secondaryPerk.label}
                </DetailChip>
              )}

              {/* Warning chip - yellow for caution */}
              {verdict.warning && (
                verdict.warning.severity === 'confirm' || verdict.warning.confirmable ? (
                  <ActionableWarningChip
                    label={verdict.warning.label}
                    reason={verdict.warning.reason}
                    confirmed={warningConfirmed}
                    onConfirm={() => setWarningConfirmed(true)}
                  />
                ) : (
                  <DetailChip
                    type="warning"
                    icon={<AlertTriangle className="w-3 h-3" />}
                  >
                    {verdict.warning.label}
                  </DetailChip>
                )
              )}
            </div>

            {/* Primary CTA */}
            <GlassButton
              variant="primary"
              className="w-full mb-3"
              onClick={onContinue}
            >
              Continue to {verdict.recommendation === 'portal' ? 'Portal' : 'Direct'}
            </GlassButton>

            {/* Secondary actions row: Why? + Compare others */}
            {/* P1 FIX: Changed "Hide details" to "Show less" for better UX consistency */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setShowWhy(!showWhy)}
                className="flex items-center gap-1.5 py-2 text-sm text-white/60 hover:text-white/80 transition-colors"
              >
                <span>{showWhy ? 'Show less' : 'See your savings breakdown ↓'}</span>
                <motion.div
                  animate={{ rotate: showWhy ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.div>
              </button>
              
              {onCompareOthers && (
                <>
                  <span className="text-white/20">•</span>
                  <button
                    onClick={onCompareOthers}
                    className="py-2 text-sm text-white/50 hover:text-white/70 transition-colors"
                  >
                    Compare other options
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ===== LEVEL 1: WHY SECTION (Tight 3-bullet format) ===== */}
          <AnimatePresence>
            {showWhy && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="relative z-10 overflow-hidden"
              >
                <div className="pt-5 mt-3 border-t border-white/[0.08]">
                  
                  {/* Award Reality Check (when award data exists) */}
                  {verdict.awardRealityCheck && (
                    <AwardRealityCheck {...verdict.awardRealityCheck} />
                  )}
                  
                  {/* Why this wins - Tight 3-bullet format */}
                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] mb-4">
                    <div className="text-[11px] text-white/50 uppercase tracking-wider font-medium mb-3">
                      💰 HOW YOU SAVE
                    </div>
                    <div className="space-y-3">
                      {verdict.whyBullets.slice(0, 3).map((bullet, i) => (
                        <WhyBullet
                          key={i}
                          icon={bullet.icon}
                          text={bullet.text}
                          index={i}
                        />
                      ))}
                    </div>
                  </div>

                  {/* ===== SAVINGS WATERFALL ===== */}
                  {/* Unified progressive savings breakdown: Listed → Credit → Pay Today → Eraser → After Eraser */}
                  {(() => {
                    const fb = verdict.auditTrail.fullBreakdown;
                    // Parse portal miles from string (could be range "2,605–4,105")
                    const parseMilesStr = (s: string): number => {
                      const clean = s.replace(/[^0-9–-]/g, '');
                      const first = clean.split(/[–-]/)[0];
                      return parseInt(first, 10) || 0;
                    };
                    const portalMiles = verdict.doubleDipStrategy?.milesEarned
                      ?? parseMilesStr(fb.portalMilesEarned);

                    return (
                      <SavingsWaterfall
                        listedPrice={fb.portalSticker}
                        creditApplied={fb.creditApplied}
                        payToday={fb.portalOutOfPocket}
                        directPrice={fb.directOutOfPocket}
                        milesEarned={portalMiles}
                        existingMilesBalance={milesBalance}
                        eraserCpp={0.01}
                        recommendation={verdict.recommendation}
                        mileValuationCpp={mileValuationCpp}
                        showEffectiveCost={showEffectiveCost}
                      />
                    );
                  })()}

                  {/* Show math button */}
                  <button
                    onClick={() => setShowDetails(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-3 mt-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-white/50 hover:bg-white/[0.05] hover:text-white/70 transition-colors"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    Show math & assumptions
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Subtle glow (reduced intensity) */}
          <motion.div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            animate={{
              boxShadow: [
                '0 0 20px rgba(74, 144, 217, 0.05)',
                '0 0 35px rgba(74, 144, 217, 0.1)',
                '0 0 20px rgba(74, 144, 217, 0.05)',
              ],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </div>
      </motion.div>

      {/* ===== LEVEL 2: DETAILS MODAL ===== */}
      {/* P0 #3 FIX: Pass onContinue and recommendation to DetailsModal for booking CTA */}
      <AnimatePresence>
        {showDetails && (
          <DetailsModal
            isOpen={showDetails}
            onClose={() => setShowDetails(false)}
            auditTrail={verdict.auditTrail}
            tabMode={tabMode}
            onAssumptionEdit={onAssumptionEdit}
            onContinue={onContinue}
            recommendation={verdict.recommendation}
            milesBalance={milesBalance}
            showEffectiveCost={showEffectiveCost}
            mileValuationCpp={mileValuationCpp}
            doubleDipStrategy={verdict.doubleDipStrategy}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default ProgressiveVerdictCard;
