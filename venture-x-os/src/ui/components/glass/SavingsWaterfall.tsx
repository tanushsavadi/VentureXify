/**
 * SavingsWaterfall — Progressive Savings Breakdown
 *
 * Replaces scattered effective-cost displays with a unified waterfall:
 *   Listed Price → Credit → Pay Today → Eraser → After Eraser
 *
 * Design principles:
 * - Objective first: Eraser at 1¢/mi is guaranteed, always shown
 * - Subjective second: Transfer partner valuations gated by toggle
 * - One narrative, one path, one set of numbers
 *
 * @see docs/SAVINGS_WATERFALL_SPEC.md
 */

import React from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/utils';

// ============================================
// INFO TIP — Portal-based tooltip to escape overflow clipping
// Uses position:fixed + createPortal to render on document.body
// ============================================

const InfoTip = ({ text }: { text: string }) => {
  const [show, setShow] = React.useState(false);
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
// TYPES
// ============================================

export interface SavingsWaterfallProps {
  /** Portal listed price before any credits (e.g., $1,504) */
  listedPrice: number;

  /** Travel credit applied — 0 if already used or not applicable */
  creditApplied: number;

  /** What the user pays today after credit (e.g., $1,204) */
  payToday: number;

  /** Direct booking price for "vs direct" comparison (e.g., $1,286) */
  directPrice: number;

  /** Miles earned from THIS booking via portal (e.g., 6,020) */
  milesEarned: number;

  /** User's existing miles balance. <=0 or undefined = not entered. */
  existingMilesBalance: number | undefined;

  /** Fixed eraser rate: 0.01 = 1¢/mi (from VENTURE_X_CONSTANTS.ERASER_CPM) */
  eraserCpp: number;

  /** Which side won the comparison */
  recommendation: 'portal' | 'direct' | 'tie';

  /** User's subjective mile valuation for transfer-partner footnote */
  mileValuationCpp?: number;

  /** Whether the "Factor in miles value" toggle is ON */
  showEffectiveCost?: boolean;

  /** Award transfer data (optional — only when award comparison is available) */
  awardData?: {
    totalC1Miles: number;
    totalTaxes: number;
    totalCpp: number;
    programName: string;
    isWinner: boolean;
  };
}

// ============================================
// DERIVED STATE
// ============================================

interface WaterfallDerivedState {
  // Step 1: Credit
  showCreditStep: boolean;
  savingsVsDirect: number;
  isPayTodayCheaperThanDirect: boolean;

  // Step 2: Eraser
  showEraserStep: boolean;
  totalMilesAvailable: number;
  maxEraserDollars: number;
  eraserAmount: number;
  milesUsedForErase: number;
  afterEraserCost: number;
  totalSavingsVsDirect: number;
  isAfterEraserCheaperThanDirect: boolean;

  // Miles breakdown
  hasExistingBalance: boolean;
  balanceEnteredExplicitly: boolean;

  // Footnote
  showTransferFootnote: boolean;
  keptMilesValue: number;

  // Award comparison
  showAwardRow: boolean;
  awardSavingsVsPortal: number;
  awardIsWinner: boolean;
}

function computeDerivedState(props: SavingsWaterfallProps): WaterfallDerivedState {
  const {
    creditApplied,
    payToday,
    directPrice,
    milesEarned,
    existingMilesBalance,
    eraserCpp,
    mileValuationCpp = 0.01,
    showEffectiveCost = false,
  } = props;

  // Step 1: Credit
  const showCreditStep = creditApplied > 0;
  const savingsVsDirect = directPrice - payToday;
  const isPayTodayCheaperThanDirect = savingsVsDirect > 0;

  // Step 2: Eraser
  const hasExistingBalance = existingMilesBalance !== undefined && existingMilesBalance > 0;
  // User explicitly entered 0 (vs. never entering at all)
  const balanceEnteredExplicitly = existingMilesBalance !== undefined && existingMilesBalance >= 0;
  const totalMilesAvailable = (hasExistingBalance ? existingMilesBalance : 0) + milesEarned;
  const maxEraserDollars = Math.floor(totalMilesAvailable * eraserCpp);
  const eraserAmount = Math.min(maxEraserDollars, payToday); // Can't erase more than you pay
  const milesUsedForErase = Math.round(eraserAmount / eraserCpp);
  const afterEraserCost = payToday - eraserAmount;
  const totalSavingsVsDirect = directPrice - afterEraserCost;
  const isAfterEraserCheaperThanDirect = totalSavingsVsDirect > 0;
  const showEraserStep = milesEarned > 0 || (hasExistingBalance && totalMilesAvailable > 0);

  // Transfer footnote
  const showTransferFootnote = showEffectiveCost && milesEarned > 0;
  const keptMilesValue = totalMilesAvailable * mileValuationCpp;

  // Award comparison
  const awardData = (props as SavingsWaterfallProps).awardData;
  const showAwardRow = !!awardData && awardData.totalC1Miles > 0;
  const awardSavingsVsPortal = showAwardRow
    ? payToday - awardData!.totalTaxes
    : 0;
  const awardIsWinner = showAwardRow ? !!awardData!.isWinner : false;

  return {
    showCreditStep,
    savingsVsDirect,
    isPayTodayCheaperThanDirect,
    showEraserStep,
    totalMilesAvailable,
    maxEraserDollars,
    eraserAmount,
    milesUsedForErase,
    afterEraserCost,
    totalSavingsVsDirect,
    isAfterEraserCheaperThanDirect,
    hasExistingBalance,
    balanceEnteredExplicitly,
    showTransferFootnote,
    keptMilesValue,
    showAwardRow,
    awardSavingsVsPortal,
    awardIsWinner,
  };
}

// ============================================
// SUB-COMPONENTS
// ============================================

/** A single row in the waterfall: label + amount */
const WaterfallRow: React.FC<{
  label: React.ReactNode;
  amount: string;
  amountClass?: string;
  subtitle?: React.ReactNode;
  stepNumber?: string;
  index: number;
}> = ({ label, amount, amountClass, subtitle, stepNumber, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.08, duration: 0.25 }}
    className="flex items-start justify-between gap-2 py-1.5"
  >
    <div className="flex items-start gap-2 min-w-0 flex-1">
      {stepNumber && (
        <span className="text-xs text-emerald-400 font-semibold mt-0.5 flex-shrink-0">
          {stepNumber}
        </span>
      )}
      <div className="min-w-0">
        <div className="text-xs text-white/60">{label}</div>
        {subtitle && (
          <div className="text-xs text-white/50 mt-0.5">{subtitle}</div>
        )}
      </div>
    </div>
    <span className={cn('text-sm font-semibold flex-shrink-0', amountClass || 'text-white')}>
      {amount}
    </span>
  </motion.div>
);

/** Divider line */
const WaterfallDivider: React.FC<{ index: number }> = ({ index }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: index * 0.08, duration: 0.2 }}
    className="border-t border-white/[0.06] my-1"
  />
);

/** Highlighted row (Pay Today, After Eraser) */
const WaterfallHighlight: React.FC<{
  icon: string;
  label: string;
  amount: string;
  savingsLabel?: string;
  isPositiveSavings?: boolean;
  isPrimary?: boolean;
  index: number;
}> = ({ icon, label, amount, savingsLabel, isPositiveSavings, isPrimary, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.08, duration: 0.25 }}
    className={cn(
      'rounded-lg px-3 py-2.5 my-1',
      isPrimary ? 'bg-white/[0.06]' : 'bg-white/[0.04]'
    )}
  >
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm">{icon}</span>
        <span className={cn(
          'font-semibold',
          isPrimary ? 'text-base text-white' : 'text-sm text-white/90'
        )}>
          {label}
        </span>
      </div>
      <span className={cn(
        'font-bold',
        isPrimary ? 'text-lg text-white' : 'text-base text-white'
      )}>
        {amount}
      </span>
    </div>
    {savingsLabel && (
      <div className={cn(
        'text-[11px] mt-1 pl-7',
        isPositiveSavings ? 'text-emerald-400' : 'text-amber-400/80'
      )}>
        {savingsLabel}
      </div>
    )}
  </motion.div>
);

/** The "Want to save more?" / "Save with miles" prompt */
export const SaveMorePrompt: React.FC<{ text: string; index: number }> = ({ text, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.08, duration: 0.25 }}
    className="flex items-center gap-2 py-2 px-1"
  >
    <span className="text-sm">✨</span>
    <span className="text-xs text-emerald-400/80 font-medium">{text}</span>
  </motion.div>
);

/** Miles breakdown sub-rows */
const EraserBreakdown: React.FC<{
  existingBalance: number;
  milesEarned: number;
  hasExistingBalance: boolean;
  index: number;
}> = ({ existingBalance, milesEarned, hasExistingBalance, index }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.08, duration: 0.25 }}
    className="pl-6 text-xs text-white/50 space-y-0.5"
  >
    {hasExistingBalance ? (
      <>
        <div className="flex items-center gap-1">
          <span className="text-white/30">├</span>
          <span>{existingBalance.toLocaleString()} existing balance<InfoTip text="Your current Capital One miles balance as entered in Settings." /></span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-white/30">└</span>
          <span>{milesEarned.toLocaleString()} earned from this booking<InfoTip text="Miles earned from this portal booking at 5x on flights." /></span>
        </div>
      </>
    ) : (
      <div>Use {milesEarned.toLocaleString()} earned miles only</div>
    )}
  </motion.div>
);

/** Transfer partner footnote */
const TransferPartnerFootnote: React.FC<{
  mileValuationCpp: number;
}> = ({ mileValuationCpp }) => {
  const centsPerMile = (mileValuationCpp * 100).toFixed(1);
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-visible"
    >
      <div className="flex items-start gap-2 pt-2 px-1">
        <span className="text-sm mt-0.5">💡</span>
        <div className="text-xs text-white/50 leading-relaxed">
          <span>Or keep miles for premium transfers<InfoTip text="Transfer miles to airline/hotel partners for potentially higher value. Common sweet spots are 1.5-2¢/mi." /></span>
          <br />
          <span className="text-white/40">(potentially worth {centsPerMile}–2¢/mi on premium awards)</span>
        </div>
      </div>
    </motion.div>
  );
};

/** CTA for entering miles balance */
const MilesBalanceCTA: React.FC<{ index: number }> = ({ index }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.08, duration: 0.25 }}
    className="flex items-start gap-2 pt-2 px-1"
  >
    <span className="text-sm mt-0.5">📝</span>
    <div className="text-xs text-white/50 leading-relaxed">
      Enter your miles balance in Settings
      <br />
      <span className="text-white/40">to see full eraser savings</span>
    </div>
  </motion.div>
);

// ============================================
// AWARD COMPARISON ROW
// Shows "vs Award Transfer" at the bottom of the waterfall
// ============================================

const AwardComparisonRow: React.FC<{
  awardData: NonNullable<SavingsWaterfallProps['awardData']>;
  comparisonPrice: number; // portal or direct pay-today to compare against
  index: number;
}> = ({ awardData, comparisonPrice, index }) => {
  const savingsVsAward = comparisonPrice - awardData.totalTaxes;
  const awardCheaper = savingsVsAward > 0;

  // CPP color helper
  const cppColor = awardData.totalCpp >= 2.0
    ? 'text-emerald-300'
    : awardData.totalCpp >= 1.5
      ? 'text-emerald-400'
      : awardData.totalCpp >= 1.0
        ? 'text-amber-300'
        : 'text-red-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.25 }}
      className="mt-3"
    >
      <WaterfallDivider index={index} />

      {/* Award winner banner */}
      {awardData.isWinner && awardCheaper && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: (index + 1) * 0.08, duration: 0.3 }}
          className="rounded-lg px-3 py-2.5 my-1.5 bg-emerald-500/10 border border-emerald-500/25"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">🏆</span>
            <span className="text-xs font-semibold text-emerald-400">
              Award wins: Save ${savingsVsAward.toLocaleString()} vs portal
            </span>
          </div>
          <div className="text-[11px] text-emerald-300/70 pl-7">
            Only ${awardData.totalTaxes.toLocaleString()} out of pocket + {awardData.totalC1Miles.toLocaleString()} C1 miles
          </div>
        </motion.div>
      )}

      {/* Non-winner award comparison row */}
      {!awardData.isWinner && (
        <div className="flex items-start justify-between gap-2 py-2 px-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs">✈️</span>
            <div className="min-w-0">
              <div className="text-xs text-white/50">
                vs Award Transfer
                <span className="text-[10px] text-white/30 ml-1">
                  ({awardData.programName})
                </span>
              </div>
              <div className="text-[10px] text-white/40 mt-0.5">
                ${awardData.totalTaxes.toLocaleString()} taxes + {awardData.totalC1Miles.toLocaleString()} C1 miles
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end flex-shrink-0">
            <span className={cn(
              'text-xs font-medium',
              cppColor
            )}>
              {awardData.totalCpp.toFixed(1)}¢/mi
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ============================================
// PORTAL WINNER LAYOUT
// ============================================

const PortalWinnerWaterfall: React.FC<{
  props: SavingsWaterfallProps;
  derived: WaterfallDerivedState;
}> = ({ props, derived }) => {
  let stepIndex = 0;
  const nextIndex = () => stepIndex++;

  return (
    <div className="space-y-0.5">
      {/* Listed Price */}
      <WaterfallRow
        label="Listed Price"
        amount={`$${props.listedPrice.toLocaleString()}`}
        index={nextIndex()}
      />

      {/* Step 1: Credit (if applicable) */}
      {derived.showCreditStep && (
        <>
          <WaterfallRow
            label={<span>${props.creditApplied.toLocaleString()} Travel Credit<InfoTip text="Annual $300 travel credit for Capital One Venture X cardholders. Applied automatically to portal bookings." /></span>}
            amount={`−$${props.creditApplied.toLocaleString()}`}
            amountClass="text-emerald-400"
            stepNumber="①"
            index={nextIndex()}
          />
          <WaterfallDivider index={nextIndex()} />
        </>
      )}

      {/* Pay Today highlight */}
      <WaterfallHighlight
        icon="💳"
        label="Pay Today"
        amount={`$${props.payToday.toLocaleString()}`}
        savingsLabel={
          derived.isPayTodayCheaperThanDirect
            ? `Save $${derived.savingsVsDirect.toLocaleString()} vs Direct ($${props.directPrice.toLocaleString()})`
            : derived.savingsVsDirect < 0
              ? `$${Math.abs(derived.savingsVsDirect).toLocaleString()} more vs Direct ($${props.directPrice.toLocaleString()})`
              : undefined
        }
        isPositiveSavings={derived.isPayTodayCheaperThanDirect}
        isPrimary={!derived.showEraserStep || !props.showEffectiveCost}
        index={nextIndex()}
      />

      {/* Step 2: Eraser — ⚡ Power Strategy glowing card */}
      {/* Hidden when showEffectiveCost is OFF (out-of-pocket only mode) */}
      {props.showEffectiveCost && derived.showEraserStep && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="relative mt-4 rounded-xl overflow-visible"
        >
          {/* Animated gradient border / glow */}
          <motion.div
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              padding: '1px',
              background: 'linear-gradient(135deg, rgba(16,185,129,0.35), rgba(20,184,166,0.15), rgba(16,185,129,0.35))',
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
            }}
            animate={{
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Subtle outer glow */}
          <motion.div
            className="absolute inset-0 rounded-xl pointer-events-none"
            animate={{
              boxShadow: [
                '0 0 12px rgba(16, 185, 129, 0.08), inset 0 1px 0 rgba(16, 185, 129, 0.1)',
                '0 0 20px rgba(16, 185, 129, 0.15), inset 0 1px 0 rgba(16, 185, 129, 0.15)',
                '0 0 12px rgba(16, 185, 129, 0.08), inset 0 1px 0 rgba(16, 185, 129, 0.1)',
              ],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          <div className="relative bg-white/[0.06] rounded-xl p-3">
            {/* ⚡ POWER STRATEGY label */}
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
              <span>⚡</span>
              <span>POWER STRATEGY</span>
            </div>

            <WaterfallRow
              label={<span>Travel Eraser (1¢/mi)<InfoTip text="Formerly 'Travel Eraser,' now called 'Cover Your Travel Purchase' on Capital One's benefits page. Redeem miles to erase travel purchases from your statement at 1¢ per mile. Works on any travel purchase within 90 days." /></span>}
              amount={`−$${derived.eraserAmount.toLocaleString()}`}
              amountClass="text-emerald-400"
              subtitle={`Use ${derived.milesUsedForErase.toLocaleString()} miles`}
              stepNumber={derived.showCreditStep ? '②' : '①'}
              index={nextIndex()}
            />

            {/* Miles breakdown */}
            <EraserBreakdown
              existingBalance={props.existingMilesBalance ?? 0}
              milesEarned={props.milesEarned}
              hasExistingBalance={derived.hasExistingBalance}
              index={nextIndex()}
            />

            <WaterfallDivider index={nextIndex()} />

            {/* After Eraser highlight */}
            <WaterfallHighlight
              icon="🎯"
              label="After Eraser"
              amount={`$${derived.afterEraserCost.toLocaleString()}`}
              savingsLabel={
                derived.isAfterEraserCheaperThanDirect
                  ? `Save $${derived.totalSavingsVsDirect.toLocaleString()} vs Direct`
                  : undefined
              }
              isPositiveSavings={derived.isAfterEraserCheaperThanDirect}
              isPrimary={true}
              index={nextIndex()}
            />
          </div>
        </motion.div>
      )}

      {/* Miles balance CTA (if not entered) — hidden when toggle is OFF */}
      {props.showEffectiveCost && derived.showEraserStep && !derived.balanceEnteredExplicitly && (
        <MilesBalanceCTA index={nextIndex()} />
      )}

      {/* Transfer partner footnote (toggle-gated) */}
      <AnimatePresence>
        {derived.showTransferFootnote && (
          <TransferPartnerFootnote
            mileValuationCpp={props.mileValuationCpp ?? 0.01}
          />
        )}
      </AnimatePresence>

      {/* Award Transfer comparison (when award data available) */}
      {derived.showAwardRow && props.awardData && (
        <AwardComparisonRow
          awardData={props.awardData}
          comparisonPrice={props.payToday}
          index={nextIndex()}
        />
      )}
    </div>
  );
};

// ============================================
// DIRECT WINNER LAYOUT
// ============================================

const DirectWinnerWaterfall: React.FC<{
  props: SavingsWaterfallProps;
}> = ({ props }) => {
  let stepIndex = 0;
  const nextIndex = () => stepIndex++;

  const savingsVsPortal = props.payToday - props.directPrice;
  const directIsCheaper = savingsVsPortal > 0;

  return (
    <div className="space-y-0.5">
      {/* Direct Price */}
      <WaterfallRow
        label="Direct Price"
        amount={`$${props.directPrice.toLocaleString()}`}
        index={nextIndex()}
      />

      <WaterfallDivider index={nextIndex()} />

      {/* Pay Today highlight */}
      <WaterfallHighlight
        icon="💳"
        label="Pay Today"
        amount={`$${props.directPrice.toLocaleString()}`}
        savingsLabel={
          directIsCheaper
            ? `Save $${savingsVsPortal.toLocaleString()} vs Portal after credit`
            : undefined
        }
        isPositiveSavings={directIsCheaper}
        isPrimary={true}
        index={nextIndex()}
      />

      {/* Miles earned note */}
      {props.milesEarned > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: nextIndex() * 0.08, duration: 0.25 }}
          className="flex items-center gap-2 py-2 px-1"
        >
          <span className="text-sm">✈️</span>
          <span className="text-xs text-white/50">
            You'll earn {props.milesEarned.toLocaleString()} miles at 2x
          </span>
        </motion.div>
      )}

      {/* Transfer partner footnote (toggle-gated) */}
      <AnimatePresence>
        {props.showEffectiveCost && props.milesEarned > 0 && (
          <TransferPartnerFootnote
            mileValuationCpp={props.mileValuationCpp ?? 0.01}
          />
        )}
      </AnimatePresence>

      {/* Award Transfer comparison (when award data available) */}
      {props.awardData && props.awardData.totalC1Miles > 0 && (
        <AwardComparisonRow
          awardData={props.awardData}
          comparisonPrice={props.directPrice}
          index={nextIndex()}
        />
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const SavingsWaterfall: React.FC<SavingsWaterfallProps> = (props) => {
  const derived = computeDerivedState(props);
  const isDirectWinner = props.recommendation === 'direct';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl bg-white/[0.04] border border-white/[0.08] p-4"
    >
      {/* Header */}
      <div className="text-[11px] text-white/50 uppercase tracking-wider font-medium mb-3 flex items-center gap-2">
        <span>📋</span>
        <span>Your Savings Breakdown</span>
      </div>

      {/* Waterfall content */}
      {isDirectWinner ? (
        <DirectWinnerWaterfall props={props} />
      ) : (
        <PortalWinnerWaterfall props={props} derived={derived} />
      )}
    </motion.div>
  );
};

export default SavingsWaterfall;
