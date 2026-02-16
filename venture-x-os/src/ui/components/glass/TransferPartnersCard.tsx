/**
 * Transfer Partners Card
 *
 * A compact, expandable card for award flight searches in the Max Value tab.
 * Integrates with PointsYeah for award availability searching.
 *
 * Features:
 * - Deep link to PointsYeah with itinerary pre-filled
 * - Tips modal for using PointsYeah effectively
 * - Manual award entry after searching PointsYeah
 * - 3-way comparison: Portal vs Direct vs Award
 * - Shows implied CPP for entered/imported awards
 * - Alliance partner suggestions based on detected airline
 * - CPM threshold warnings from research (1¢ floor, 1.3¢ good, 1.8¢+ excellent)
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { GlassButton } from './index';
import {
  ChevronDown,
  ExternalLink,
  Sparkles,
  Lightbulb,
  X,
  Plane,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Calculator,
  ArrowLeft,
  Trophy,
  Info,
} from 'lucide-react';
import {
  buildPointsYeahUrl,
  POINTSYEAH_TIPS,
  type AwardOption,
  type AwardSearchParams,
  type PointsYeahTip,
  findBestAward,
  enrichAwardOptions,
} from '../../../engine/pointsyeah';
import {
  VENTURE_X_CONSTANTS,
  assessAwardValue,
} from '../../../engine/types';

// ============================================
// CPM THRESHOLDS FROM RESEARCH
// ============================================

const CPM_THRESHOLDS = {
  FLOOR: VENTURE_X_CONSTANTS.CPM_FLOOR * 100,        // 1.0¢ - Travel Eraser baseline
  GOOD_DEAL: VENTURE_X_CONSTANTS.CPM_GOOD_DEAL * 100, // 1.3¢ - worth transferring
  VERY_GOOD: VENTURE_X_CONSTANTS.CPM_VERY_GOOD * 100, // 1.5¢ - clearly worth it
  EXCELLENT: VENTURE_X_CONSTANTS.TRANSFER_CPP_TARGET * 100, // 1.8¢+ - great value
  OUTSTANDING: VENTURE_X_CONSTANTS.TRANSFER_CPP_EXCELLENT * 100, // 2.5¢+ - exceptional
};

// ============================================
// ALLIANCE DATA & TRANSLATION LAYER
// ============================================

type Alliance = 'star_alliance' | 'oneworld' | 'skyteam' | 'independent';

interface AllianceInfo {
  name: string;
  shortName: string;
  color: string;
  textColor: string;
  icon: string;
}

const ALLIANCE_INFO: Record<Alliance, AllianceInfo> = {
  star_alliance: {
    name: 'Star Alliance',
    shortName: 'Star',
    color: 'bg-amber-500/15 border-amber-500/25',
    textColor: 'text-amber-400',
    icon: '⭐',
  },
  oneworld: {
    name: 'oneworld',
    shortName: 'OW',
    color: 'bg-red-500/15 border-red-500/25',
    textColor: 'text-red-400',
    icon: '🌍',
  },
  skyteam: {
    name: 'SkyTeam',
    shortName: 'ST',
    color: 'bg-blue-500/15 border-blue-500/25',
    textColor: 'text-blue-400',
    icon: '✈️',
  },
  independent: {
    name: 'Independent',
    shortName: 'Ind',
    color: 'bg-[#2d4a63]/15 border-[#2d4a63]/25',
    textColor: 'text-[#5b9bd5]',
    icon: '💎',
  },
};

interface TransferPartner {
  code: string;
  name: string;
  alliance: Alliance;
  /** Airlines this program can book (operating carriers) */
  operatingAirlines: string[];
  /** Sweet spots or common use cases */
  bestFor: string[];
  /** Transfer time in hours (typical) */
  transferTime: string;
  /** Fee characteristics */
  feeLevel: 'low' | 'moderate' | 'high';
}

const CAPITAL_ONE_PARTNERS: TransferPartner[] = [
  {
    code: 'TK',
    name: 'Turkish Miles&Smiles',
    alliance: 'star_alliance',
    operatingAirlines: ['United', 'Lufthansa', 'Swiss', 'ANA', 'Turkish Airlines', 'Air Canada', 'Singapore Airlines'],
    bestFor: ['North America to Europe', 'Business class sweet spots', 'Low fuel surcharges'],
    transferTime: 'Instant–24hrs',
    feeLevel: 'low',
  },
  {
    code: 'AV',
    name: 'Avianca LifeMiles',
    alliance: 'star_alliance',
    operatingAirlines: ['United', 'Lufthansa', 'Swiss', 'ANA', 'Avianca', 'Air Canada', 'Turkish Airlines'],
    bestFor: ['Star Alliance redemptions', 'Mixed-cabin awards', 'No fuel surcharges on United'],
    transferTime: 'Instant',
    feeLevel: 'low',
  },
  {
    code: 'SQ',
    name: 'Singapore KrisFlyer',
    alliance: 'star_alliance',
    operatingAirlines: ['Singapore Airlines', 'United', 'Lufthansa', 'ANA', 'Air Canada', 'Star Alliance partners'],
    bestFor: ['Singapore Suites', 'Asia routes', 'Premium cabin sweet spots'],
    transferTime: '12–24hrs',
    feeLevel: 'moderate',
  },
  {
    code: 'BA',
    name: 'British Airways',
    alliance: 'oneworld',
    operatingAirlines: ['American Airlines', 'British Airways', 'Cathay Pacific', 'Qantas', 'Japan Airlines', 'Alaska'],
    bestFor: ['Short-haul flights', 'Off-peak awards', 'AA domestic flights'],
    transferTime: 'Instant',
    feeLevel: 'high', // BA has high fuel surcharges on BA metal
  },
  {
    code: 'QF',
    name: 'Qantas',
    alliance: 'oneworld',
    operatingAirlines: ['Qantas', 'American Airlines', 'British Airways', 'Cathay Pacific', 'Japan Airlines', 'Alaska'],
    bestFor: ['Australia routes', 'oneworld awards', 'Partner awards'],
    transferTime: '24–48hrs',
    feeLevel: 'moderate',
  },
  {
    code: 'AF',
    name: 'Air France/KLM',
    alliance: 'skyteam',
    operatingAirlines: ['Air France', 'KLM', 'Delta', 'Korean Air', 'Virgin Atlantic'],
    bestFor: ['Europe connections', 'Promo awards', 'SkyTeam redemptions'],
    transferTime: '24–48hrs',
    feeLevel: 'moderate',
  },
  {
    code: 'EY',
    name: 'Etihad Guest',
    alliance: 'independent',
    operatingAirlines: ['Etihad', 'American Airlines', 'Air France', 'Virgin Australia', 'Korean Air'],
    bestFor: ['Etihad First/Business', 'AA awards without surcharges', 'Gulf routes'],
    transferTime: '24–48hrs',
    feeLevel: 'low',
  },
  {
    code: 'EK',
    name: 'Emirates Skywards',
    alliance: 'independent',
    operatingAirlines: ['Emirates', 'Qantas', 'JetBlue'],
    bestFor: ['Emirates First Class', 'A380 routes', 'Dubai connections'],
    transferTime: 'Instant–24hrs',
    feeLevel: 'high',
  },
];

// Tie-breaker guidance for multiple partner options
const TIE_BREAKER_GUIDANCE = "Prefer lowest miles if fees similar; prefer lowest fees if miles similar; consider change/cancel flexibility.";

// ============================================
// TYPES
// ============================================

export interface TransferPartnersCardProps {
  /** Itinerary for PointsYeah search */
  itinerary: {
    origin: string;        // IATA code
    destination: string;   // IATA code
    departDate: string;    // YYYY-MM-DD
    returnDate?: string;   // YYYY-MM-DD
    cabin?: 'economy' | 'premium' | 'business' | 'first';
    passengers?: number;
  };
  /** Direct cash price for CPP calculation */
  directCashPrice: number;
  /** Portal price for 3-way comparison */
  portalCashPrice?: number;
  /** Credit remaining (applies only to portal) */
  creditRemaining?: number;
  /** Callback when user opens PointsYeah */
  onSearchAwards?: () => void;
  /** Imported award results (from content script) - already enriched with impliedCpp */
  importedAwards?: AwardOption[];
  /** Callback when import is requested */
  onImportAwards?: () => void;
  /** Whether awards import is loading */
  isImporting?: boolean;
  className?: string;
}

type FlowStep = 'intro' | 'searching' | 'input' | 'result';

// ManualAward interface reserved for future manual entry feature
// interface ManualAward {
//   program: string;
//   miles: number;
//   taxes: number;
// }

interface ComparisonResult {
  winner: 'portal' | 'direct' | 'award';
  winnerLabel: string;
  savings: number;
  awardCpp: number;
  portalCost: number;
  directCost: number;
  awardCost: number;
  explanation: string[];
}

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
// TIPS MODAL COMPONENT
// ============================================

const TipsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm"
      >
        <div className="relative bg-white/[0.08] backdrop-blur-xl rounded-2xl p-5 border border-white/[0.12]">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              PointsYeah Tips
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] transition-colors"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>

          {/* Tips list */}
          <div className="space-y-3">
            {POINTSYEAH_TIPS.map((tip: PointsYeahTip) => (
              <div
                key={tip.number}
                className={cn(
                  'flex gap-3 p-2 rounded-lg',
                  tip.important && 'bg-amber-500/10 border border-amber-500/20'
                )}
              >
                <span className={cn(
                  'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                  tip.important
                    ? 'bg-amber-500/30 text-amber-300'
                    : 'bg-white/[0.08] text-white/50'
                )}>
                  {tip.number}
                </span>
                <p className={cn(
                  'text-xs leading-relaxed',
                  tip.important ? 'text-amber-200/90' : 'text-white/70'
                )}>
                  {tip.text}
                </p>
              </div>
            ))}
          </div>

          {/* Close button */}
          <GlassButton
            variant="secondary"
            className="w-full mt-4"
            onClick={onClose}
          >
            Got it
          </GlassButton>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============================================
// IMPORTED AWARD ROW COMPONENT
// ============================================

const ImportedAwardRow: React.FC<{
  award: AwardOption;
  isBest: boolean;
  directCashPrice?: number;
}> = ({ award, isBest, directCashPrice: _directCashPrice }) => {
  // impliedCpp should already be calculated on the award (enriched)
  const impliedCpp = award.impliedCpp || 0;
  
  // Use research-based assessment for value tier
  const assessment = assessAwardValue(impliedCpp / 100, VENTURE_X_CONSTANTS.FRICTION_SCORES.TRANSFER_AWARD);
  
  // Determine color based on tier
  const getCpmColor = () => {
    if (impliedCpp < CPM_THRESHOLDS.FLOOR) return 'text-red-400';
    if (impliedCpp < CPM_THRESHOLDS.GOOD_DEAL) return 'text-amber-400';
    if (impliedCpp < CPM_THRESHOLDS.EXCELLENT) return 'text-emerald-400';
    if (impliedCpp < CPM_THRESHOLDS.OUTSTANDING) return 'text-blue-400';
    return 'text-[#5b9bd5]';
  };
  
  const getBgColor = () => {
    if (isBest && impliedCpp >= CPM_THRESHOLDS.GOOD_DEAL) return 'bg-emerald-500/10 border border-emerald-500/20';
    if (impliedCpp < CPM_THRESHOLDS.FLOOR) return 'bg-red-500/5 border border-red-500/10';
    if (impliedCpp < CPM_THRESHOLDS.GOOD_DEAL) return 'bg-amber-500/5 border border-amber-500/10';
    return 'bg-white/[0.04]';
  };
  
  return (
    <div className={cn('flex items-center justify-between p-2 rounded-lg', getBgColor())}>
      <div className="flex items-center gap-2">
        {isBest && impliedCpp >= CPM_THRESHOLDS.GOOD_DEAL && (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        )}
        {impliedCpp < CPM_THRESHOLDS.FLOOR && (
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
        )}
        <div>
          <div className="text-xs font-medium text-white/90">
            {award.program}
          </div>
          <div className="text-[10px] text-white/50">
            {award.miles.toLocaleString()} mi + ${award.feesCash.toFixed(0)} fees
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className={cn('text-xs font-medium', getCpmColor())}>
          {impliedCpp.toFixed(1)}¢/pt
        </div>
        {isBest && impliedCpp >= CPM_THRESHOLDS.GOOD_DEAL && (
          <div className="text-[10px] text-emerald-400/70">Best value</div>
        )}
        {impliedCpp < CPM_THRESHOLDS.FLOOR && (
          <div className="text-[10px] text-red-400/70">Below baseline</div>
        )}
        {impliedCpp >= CPM_THRESHOLDS.FLOOR && impliedCpp < CPM_THRESHOLDS.GOOD_DEAL && (
          <div className="text-[10px] text-amber-400/70">Marginal</div>
        )}
        {impliedCpp >= CPM_THRESHOLDS.EXCELLENT && !isBest && (
          <div className="text-[10px] text-blue-400/70">{assessment.label}</div>
        )}
      </div>
    </div>
  );
};

// ============================================
// CPM VALUE BADGE - Shows threshold info
// ============================================

const CpmValueBadge: React.FC<{
  cpm: number;
  showLabel?: boolean;
}> = ({ cpm, showLabel = true }) => {
  const getConfig = () => {
    if (cpm < CPM_THRESHOLDS.FLOOR) {
      return {
        bg: 'bg-red-500/15 border-red-500/25',
        text: 'text-red-400',
        label: '⚠️ Below Travel Eraser',
        icon: AlertTriangle,
      };
    }
    if (cpm < CPM_THRESHOLDS.GOOD_DEAL) {
      return {
        bg: 'bg-amber-500/15 border-amber-500/25',
        text: 'text-amber-400',
        label: 'Marginal value',
        icon: Info,
      };
    }
    if (cpm < CPM_THRESHOLDS.EXCELLENT) {
      return {
        bg: 'bg-emerald-500/15 border-emerald-500/25',
        text: 'text-emerald-400',
        label: '✅ Good value',
        icon: CheckCircle2,
      };
    }
    if (cpm < CPM_THRESHOLDS.OUTSTANDING) {
      return {
        bg: 'bg-blue-500/15 border-blue-500/25',
        text: 'text-blue-400',
        label: '🎯 Great value',
        icon: CheckCircle2,
      };
    }
    return {
      bg: 'bg-[#1e3048]/15 border-[#1e3048]/25',
      text: 'text-[#5b9bd5]',
      label: '⭐ Outstanding!',
      icon: Trophy,
    };
  };
  
  const config = getConfig();
  const IconComponent = config.icon;
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border',
      config.bg,
      config.text
    )}>
      <IconComponent className="w-3.5 h-3.5" />
      {cpm.toFixed(1)}¢/mile
      {showLabel && <span className="text-[10px] opacity-80 ml-0.5">({config.label})</span>}
    </span>
  );
};

// ============================================
// CPM THRESHOLD LEGEND - Education about thresholds
// Exported for use in other components that may want to display threshold info
// ============================================

export const CpmThresholdLegend: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('p-2 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[10px]', className)}>
    <div className="text-white/50 font-medium mb-1.5">Award Value Thresholds:</div>
    <div className="grid grid-cols-2 gap-1">
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-red-500/50" />
        <span className="text-white/40">&lt;{CPM_THRESHOLDS.FLOOR}¢ = Below baseline</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-amber-500/50" />
        <span className="text-white/40">{CPM_THRESHOLDS.FLOOR}-{CPM_THRESHOLDS.GOOD_DEAL}¢ = Marginal</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-emerald-500/50" />
        <span className="text-white/40">{CPM_THRESHOLDS.GOOD_DEAL}-{CPM_THRESHOLDS.EXCELLENT}¢ = Good</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-blue-500/50" />
        <span className="text-white/40">&gt;{CPM_THRESHOLDS.EXCELLENT}¢ = Great+</span>
      </div>
    </div>
  </div>
);

// ============================================
// ALLIANCE BADGE COMPONENT
// ============================================

const AllianceBadge: React.FC<{
  alliance: Alliance;
  size?: 'sm' | 'md';
}> = ({ alliance, size = 'sm' }) => {
  const info = ALLIANCE_INFO[alliance];
  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-[9px]'
    : 'px-2 py-1 text-[10px]';
  
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border font-medium',
      info.color,
      info.textColor,
      sizeClasses
    )}>
      <span>{info.icon}</span>
      <span>{info.shortName}</span>
    </span>
  );
};

// ============================================
// ALLIANCE TRANSLATION CARD - Plain English Explanation
// ============================================

const AllianceTranslationCard: React.FC<{
  partner: TransferPartner;
  operatingAirline?: string;
}> = ({ partner, operatingAirline }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const allianceInfo = ALLIANCE_INFO[partner.alliance];
  
  // Determine the operating airline to show
  const flyingOn = operatingAirline || (partner.operatingAirlines.length > 0 ? partner.operatingAirlines[0] : partner.name);
  
  // Build the "why this works" explanation
  const getWhyExplanation = () => {
    if (partner.alliance === 'independent') {
      return `${partner.name} has direct partnerships with select airlines allowing award bookings.`;
    }
    return `${partner.name} can book seats on ${flyingOn} because they're both ${allianceInfo.name} partners.`;
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] space-y-3"
    >
      {/* Book With */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Book with</div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{partner.name}</span>
            <AllianceBadge alliance={partner.alliance} />
          </div>
        </div>
        <div className="text-[10px] text-white/40 text-right">
          <div>{partner.transferTime}</div>
          <div className={cn(
            partner.feeLevel === 'low' ? 'text-emerald-400' :
            partner.feeLevel === 'high' ? 'text-amber-400' : 'text-white/50'
          )}>
            {partner.feeLevel === 'low' ? '✓ Low fees' :
             partner.feeLevel === 'high' ? '⚠ Higher fees' : 'Moderate fees'}
          </div>
        </div>
      </div>
      
      {/* You'll fly on */}
      <div>
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">You'll fly on</div>
        <div className="flex items-center gap-2">
          <Plane className="w-4 h-4 text-[#5b9bd5]" />
          <span className="text-sm text-white/90">{flyingOn}</span>
        </div>
      </div>
      
      {/* Why this works - with tooltip */}
      <div className="relative">
        <button
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => setShowTooltip(!showTooltip)}
          className="flex items-center gap-1.5 text-[10px] text-[#5b9bd5] hover:text-[#7eb8e0] transition-colors cursor-help"
        >
          <Info className="w-3 h-3" />
          <span>Why this works</span>
        </button>
        
        <AnimatePresence>
          {showTooltip && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute left-0 top-full mt-1 z-20 w-full p-2.5 rounded-lg bg-black/95 border border-white/20 text-[11px] text-white/80 shadow-xl"
            >
              {getWhyExplanation()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Best for (if available) */}
      {partner.bestFor.length > 0 && (
        <div className="pt-2 border-t border-white/[0.06]">
          <div className="text-[10px] text-white/40 mb-1.5">Best for:</div>
          <div className="flex flex-wrap gap-1">
            {partner.bestFor.slice(0, 2).map((item, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-[10px] text-white/60 bg-white/[0.04] rounded-full"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ============================================
// MULTIPLE PARTNERS TIE-BREAKER GUIDANCE
// ============================================

const TieBreakerGuidance: React.FC = () => (
  <div className="p-2 rounded-lg bg-[#4a90d9]/5 border border-[#4a90d9]/10">
    <div className="text-[10px] text-[#7eb8e0]/80 flex items-start gap-1.5">
      <Lightbulb className="w-3 h-3 mt-0.5 flex-shrink-0" />
      <span>{TIE_BREAKER_GUIDANCE}</span>
    </div>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const TransferPartnersCard: React.FC<TransferPartnersCardProps> = ({
  itinerary,
  directCashPrice,
  portalCashPrice,
  creditRemaining = 300,
  onSearchAwards,
  importedAwards,
  onImportAwards: _onImportAwards,
  isImporting,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [flowStep, setFlowStep] = useState<FlowStep>('intro');
  
  // Manual award entry state
  const [selectedProgram, setSelectedProgram] = useState('');
  const [milesInput, setMilesInput] = useState('');
  const [taxesInput, setTaxesInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);

  // Convert itinerary prop to AwardSearchParams format
  const searchParams: AwardSearchParams = {
    departure: itinerary.origin,
    arrival: itinerary.destination,
    departDate: itinerary.departDate,
    returnDate: itinerary.returnDate,
    adults: itinerary.passengers || 1,
    cabin: itinerary.cabin || '',
  };

  const pointsYeahUrl = buildPointsYeahUrl(searchParams, { capitalOneOnly: true });
  
  // Enrich awards with CPP values if not already done, then find best
  const enrichedAwards = importedAwards
    ? enrichAwardOptions(directCashPrice, importedAwards)
    : [];
  const bestAward = findBestAward(enrichedAwards);
  const hasAwards = enrichedAwards.length > 0;

  const handleSearchClick = () => {
    // Open PointsYeah in new tab
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: pointsYeahUrl });
    } else {
      window.open(pointsYeahUrl, '_blank');
    }
    onSearchAwards?.();
    setFlowStep('searching');
  };

  // Calculate 3-way comparison
  const calculateComparison = (): ComparisonResult | null => {
    const miles = parseInt(milesInput.replace(/,/g, ''), 10);
    const taxes = parseFloat(taxesInput.replace(/[^0-9.]/g, '')) || 0;
    
    if (!selectedProgram) {
      setInputError('Please select a program');
      return null;
    }
    if (isNaN(miles) || miles < 1000) {
      setInputError('Please enter valid miles (at least 1,000)');
      return null;
    }
    
    setInputError(null);
    
    // Calculate costs
    const effectivePortal = portalCashPrice || directCashPrice;
    const portalOutOfPocket = Math.max(0, effectivePortal - creditRemaining);
    const directOutOfPocket = directCashPrice;
    const awardOutOfPocket = taxes;
    
    // Miles values at research-based valuation (default 1.5cpp conservative)
    const MILES_VALUE = VENTURE_X_CONSTANTS.DEFAULT_MILE_VALUE_CPP; // 0.015 conservative
    const portalMilesEarned = Math.round(effectivePortal * 5);
    const directMilesEarned = Math.round(directCashPrice * 2);
    
    // Net costs (accounting for miles value)
    const portalNetCost = portalOutOfPocket - (portalMilesEarned * MILES_VALUE);
    const directNetCost = directOutOfPocket - (directMilesEarned * MILES_VALUE);
    const awardNetCost = taxes + (miles * MILES_VALUE); // Spending miles = opportunity cost
    
    // Calculate implied CPP for award
    const cashAvoided = Math.min(portalOutOfPocket, directOutOfPocket);
    const awardCpp = cashAvoided > 0 && miles > 0
      ? ((cashAvoided - taxes) / miles) * 100
      : 0;
    
    // ============================================
    // RESEARCH-BASED THRESHOLD CHECK
    // Only recommend award if it meets minimum threshold
    // ============================================
    const assessment = assessAwardValue(awardCpp / 100, VENTURE_X_CONSTANTS.FRICTION_SCORES.TRANSFER_AWARD);
    const awardMeetsThreshold = assessment.worthTransferring;
    
    // If award is below Travel Eraser floor, penalize it heavily
    const penalizedAwardNetCost = awardMeetsThreshold
      ? awardNetCost
      : awardNetCost + 500; // Heavy penalty for below-threshold awards
    
    // Determine winner by net cost (with penalty applied)
    const costs = [
      { type: 'portal' as const, cost: portalNetCost, label: 'Portal Booking' },
      { type: 'direct' as const, cost: directNetCost, label: 'Direct Booking' },
      { type: 'award' as const, cost: penalizedAwardNetCost, rawCost: awardNetCost, label: 'Award Booking' },
    ];
    costs.sort((a, b) => a.cost - b.cost);
    
    const winner = costs[0];
    const runnerUp = costs[1];
    const savings = Math.round(runnerUp.cost - winner.cost);
    
    // Build explanation using research thresholds
    const explanation: string[] = [];
    
    // Add award value assessment message
    if (winner.type === 'award') {
      if (awardCpp >= CPM_THRESHOLDS.OUTSTANDING) {
        explanation.push(`⭐ Outstanding award value at ${awardCpp.toFixed(1)}¢/mile!`);
      } else if (awardCpp >= CPM_THRESHOLDS.EXCELLENT) {
        explanation.push(`🎯 Great award value at ${awardCpp.toFixed(1)}¢/mile!`);
      } else if (awardCpp >= CPM_THRESHOLDS.GOOD_DEAL) {
        explanation.push(`✅ Good award value at ${awardCpp.toFixed(1)}¢/mile`);
      } else {
        explanation.push(`Award wins at ${awardCpp.toFixed(1)}¢/mile`);
      }
      explanation.push(`Pay $${taxes.toFixed(0)} taxes + ${miles.toLocaleString()} miles`);
    } else if (winner.type === 'portal') {
      explanation.push(`🏦 Portal wins at $${portalOutOfPocket} out of pocket`);
      explanation.push(`Earn ${portalMilesEarned.toLocaleString()} miles (5x)`);
    } else {
      explanation.push(`✈️ Direct wins at $${directOutOfPocket}`);
      explanation.push(`Earn ${directMilesEarned.toLocaleString()} miles (2x)`);
    }
    
    // Add warning if award is below threshold
    if (!awardMeetsThreshold && awardCpp > 0) {
      if (awardCpp < CPM_THRESHOLDS.FLOOR) {
        explanation.push(`⚠️ Warning: Award at ${awardCpp.toFixed(1)}¢/mile is BELOW Travel Eraser baseline (${CPM_THRESHOLDS.FLOOR}¢/mile). Just pay cash and erase later.`);
      } else {
        explanation.push(`💡 Note: Award at ${awardCpp.toFixed(1)}¢/mile is below "good deal" threshold (${CPM_THRESHOLDS.GOOD_DEAL}¢/mile) given the friction involved.`);
      }
    }
    
    return {
      winner: winner.type,
      winnerLabel: winner.label,
      savings,
      awardCpp,
      portalCost: portalOutOfPocket,
      directCost: directOutOfPocket,
      awardCost: awardOutOfPocket,
      explanation,
    };
  };

  const handleCalculate = () => {
    const result = calculateComparison();
    if (result) {
      setComparisonResult(result);
      setFlowStep('result');
    }
  };

  const resetFlow = () => {
    setFlowStep('intro');
    setSelectedProgram('');
    setMilesInput('');
    setTaxesInput('');
    setInputError(null);
    setComparisonResult(null);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={cn(
          'relative rounded-xl overflow-hidden',
          className
        )}
      >
        <div className="relative bg-gradient-to-br from-[#2d4a63]/10 via-[#4a90d9]/10 to-[#1e3048]/10 backdrop-blur-xl rounded-xl border border-white/[0.10]">
          {/* Header - Always visible */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#2d4a63]/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#5b9bd5]" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-white">
                  Award Flights
                </h4>
                <p className="text-xs text-white/50">
                  Search transfer partner availability
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {comparisonResult && (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-medium rounded-full">
                  {comparisonResult.winnerLabel.split(' ')[0]} wins
                </span>
              )}
              {hasAwards && !comparisonResult && (
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-medium rounded-full">
                  {enrichedAwards.length} found
                </span>
              )}
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4 text-white/40" />
              </motion.div>
            </div>
          </button>

          {/* Expandable content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3">
                  {/* Itinerary summary */}
                  <div className="p-2 rounded-lg bg-white/[0.04] flex items-center gap-2 text-xs text-white/60">
                    <Plane className="w-3.5 h-3.5" />
                    <span>
                      {itinerary.origin} → {itinerary.destination}
                      {itinerary.returnDate && ` (roundtrip)`}
                    </span>
                    <span className="text-white/40">•</span>
                    <span>{itinerary.departDate}</span>
                  </div>

                  {/* STEP: INTRO */}
                  {flowStep === 'intro' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      {/* Imported awards list */}
                      {hasAwards && (
                        <div className="space-y-2">
                          <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                            Award Options
                          </div>
                          {enrichedAwards.slice(0, 3).map((award, i) => (
                            <ImportedAwardRow
                              key={i}
                              award={award}
                              isBest={bestAward?.program === award.program}
                            />
                          ))}
                          {enrichedAwards.length > 3 && (
                            <div className="text-[10px] text-white/40 text-center">
                              +{enrichedAwards.length - 3} more options
                            </div>
                          )}
                        </div>
                      )}

                      {/* R8: Info message collapsed — full explanation on tap */}
                      {!hasAwards && !isImporting && (
                        <ExpandableInfo
                          summary="How transfer partners work"
                          detail="Transfer partners can beat cash prices. Search PointsYeah, then enter what you find to compare."
                          className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                        />
                      )}

                      {/* Loading state */}
                      {isImporting && (
                        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center">
                          <RefreshCw className="w-5 h-5 text-[#5b9bd5] mx-auto mb-2 animate-spin" />
                          <p className="text-xs text-white/50">
                            Importing results...
                          </p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <GlassButton
                          variant="primary"
                          className="flex-1"
                          onClick={handleSearchClick}
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                          Search PointsYeah
                        </GlassButton>
                        
                        <button
                          onClick={() => setShowTips(true)}
                          className="p-2 rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.10] transition-colors"
                          title="Tips"
                        >
                          <Lightbulb className="w-4 h-4 text-amber-400" />
                        </button>
                      </div>

                      {/* Best award highlight */}
                      {bestAward && (
                        <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                          <div className="text-[10px] text-emerald-400/80 mb-1">
                            💡 Best transfer value
                          </div>
                          <div className="text-xs text-white/80">
                            Transfer to <span className="font-medium text-white">{bestAward.program}</span> for{' '}
                            <span className="text-emerald-400">{(bestAward.impliedCpp || 0).toFixed(1)}¢/pt</span>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* STEP: SEARCHING */}
                  {flowStep === 'searching' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      {/* R8: Collapsed search instructions — expanded on tap */}
                      <div className="p-3 rounded-lg bg-[#4a90d9]/10 border border-[#4a90d9]/20">
                        <p className="text-xs text-white/70">
                          <strong className="text-white">PointsYeah opened in a new tab.</strong>
                        </p>
                        <ExpandableInfo
                          summary="What to look for"
                          detail={<>Look for award options showing Capital One as a transfer source.<br />• Miles required (e.g., &quot;42,900 pts&quot;)<br />• Taxes/fees (e.g., &quot;+ $258 tax&quot;)</>}
                          className="mt-1.5"
                        />
                      </div>

                      <GlassButton
                        variant="primary"
                        className="w-full"
                        onClick={() => setFlowStep('input')}
                      >
                        <Calculator className="w-3.5 h-3.5 mr-1.5" />
                        I Found an Award Option
                      </GlassButton>

                      <div className="flex gap-2">
                        <button
                          onClick={handleSearchClick}
                          className="flex-1 py-2 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/60 hover:bg-white/[0.08] transition-colors"
                        >
                          <RefreshCw className="w-3 h-3 inline mr-1.5" />
                          Open Again
                        </button>
                        <button
                          onClick={resetFlow}
                          className="flex-1 py-2 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/60 hover:bg-white/[0.08] transition-colors"
                        >
                          No Good Awards
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP: INPUT */}
                  {flowStep === 'input' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                        Enter Award Details
                      </div>

                      {/* Program selection with alliance badges */}
                      <div>
                        <div className="text-[11px] text-white/60 mb-2">Transfer Program</div>
                        <div className="flex flex-wrap gap-1.5">
                          {CAPITAL_ONE_PARTNERS.map((p) => (
                            <button
                              key={p.code}
                              onClick={() => setSelectedProgram(p.name)}
                              className={cn(
                                'px-2 py-1.5 rounded-lg text-[10px] transition-colors border flex items-center gap-1.5',
                                selectedProgram === p.name
                                  ? 'bg-[#2d4a63]/20 border-[#2d4a63]/30 text-white'
                                  : 'bg-white/[0.04] border-white/[0.08] text-white/60 hover:bg-white/[0.08]'
                              )}
                            >
                              <span>{p.name}</span>
                              <AllianceBadge alliance={p.alliance} size="sm" />
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Show alliance translation preview when program is selected */}
                      {selectedProgram && (() => {
                        const partner = CAPITAL_ONE_PARTNERS.find(p => p.name === selectedProgram);
                        return partner ? (
                          <AllianceTranslationCard partner={partner} />
                        ) : null;
                      })()}

                      {/* Miles input */}
                      <div>
                        <div className="text-[11px] text-white/60 mb-1.5">Miles Required</div>
                        <input
                          type="text"
                          value={milesInput}
                          onChange={(e) => setMilesInput(e.target.value)}
                          placeholder="e.g., 42,900"
                          className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.10] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
                        />
                        <div className="text-[10px] text-white/40 mt-1">
                          The points/miles shown on PointsYeah
                        </div>
                      </div>

                      {/* Taxes input */}
                      <div>
                        <div className="text-[11px] text-white/60 mb-1.5">Taxes & Fees (USD)</div>
                        <input
                          type="text"
                          value={taxesInput}
                          onChange={(e) => setTaxesInput(e.target.value)}
                          placeholder="e.g., 258"
                          className="w-full px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.10] text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
                        />
                        <div className="text-[10px] text-white/40 mt-1">
                          Cash amount (e.g., "+ $258.40 tax")
                        </div>
                      </div>

                      {/* Error */}
                      {inputError && (
                        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                          {inputError}
                        </div>
                      )}

                      {/* Actions */}
                      <GlassButton
                        variant="primary"
                        className="w-full"
                        onClick={handleCalculate}
                        disabled={!selectedProgram || !milesInput}
                      >
                        <Calculator className="w-3.5 h-3.5 mr-1.5" />
                        Compare Options
                      </GlassButton>

                      <button
                        onClick={() => setFlowStep('searching')}
                        className="w-full py-2 rounded-lg text-xs text-white/50 hover:text-white/70 transition-colors"
                      >
                        <ArrowLeft className="w-3 h-3 inline mr-1" />
                        Back
                      </button>
                    </motion.div>
                  )}

                  {/* STEP: RESULT */}
                  {flowStep === 'result' && comparisonResult && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      {/* Winner banner */}
                      <div className={cn(
                        'p-3 rounded-lg text-center',
                        comparisonResult.winner === 'award'
                          ? 'bg-emerald-500/15 border border-emerald-500/25'
                          : 'bg-white/[0.06] border border-white/[0.10]'
                      )}>
                        <Trophy className={cn(
                          'w-6 h-6 mx-auto mb-2',
                          comparisonResult.winner === 'award'
                            ? 'text-emerald-400'
                            : 'text-white/60'
                        )} />
                        <div className="text-sm font-semibold text-white">
                          {comparisonResult.winnerLabel} Wins!
                        </div>
                        {comparisonResult.savings > 0 && (
                          <div className="text-xs text-white/60 mt-1">
                            Saves ~${comparisonResult.savings} in net value
                          </div>
                        )}
                      </div>

                      {/* Comparison grid */}
                      <div className="grid grid-cols-3 gap-2">
                        {/* Portal */}
                        <div className={cn(
                          'p-2 rounded-lg text-center',
                          comparisonResult.winner === 'portal'
                            ? 'bg-emerald-500/10 border border-emerald-500/20'
                            : 'bg-white/[0.04] border border-white/[0.06]'
                        )}>
                          <div className="text-[10px] text-white/50 mb-1">Portal</div>
                          <div className="text-sm font-semibold text-white">
                            ${comparisonResult.portalCost}
                          </div>
                          <div className="text-[10px] text-white/40">out of pocket</div>
                        </div>

                        {/* Direct */}
                        <div className={cn(
                          'p-2 rounded-lg text-center',
                          comparisonResult.winner === 'direct'
                            ? 'bg-emerald-500/10 border border-emerald-500/20'
                            : 'bg-white/[0.04] border border-white/[0.06]'
                        )}>
                          <div className="text-[10px] text-white/50 mb-1">Direct</div>
                          <div className="text-sm font-semibold text-white">
                            ${comparisonResult.directCost}
                          </div>
                          <div className="text-[10px] text-white/40">out of pocket</div>
                        </div>

                        {/* Award */}
                        <div className={cn(
                          'p-2 rounded-lg text-center',
                          comparisonResult.winner === 'award'
                            ? 'bg-emerald-500/10 border border-emerald-500/20'
                            : 'bg-white/[0.04] border border-white/[0.06]'
                        )}>
                          <div className="text-[10px] text-white/50 mb-1">Award</div>
                          <div className="text-sm font-semibold text-white">
                            ${comparisonResult.awardCost}
                          </div>
                          <div className="text-[10px] text-white/40">+ miles</div>
                        </div>
                      </div>

                      {/* CPP badge - using research thresholds */}
                      <div className="text-center">
                        <CpmValueBadge cpm={comparisonResult.awardCpp} />
                      </div>
                      
                      {/* Warning for below-threshold awards */}
                      {/* R8: Shortened warning — full explanation on tap */}
                      {comparisonResult.awardCpp < CPM_THRESHOLDS.FLOOR && (
                        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                          <div className="text-xs text-red-400 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Below Travel Eraser baseline ({CPM_THRESHOLDS.FLOOR}¢/mi)</span>
                          </div>
                          <ExpandableInfo
                            summary="Why this matters"
                            detail={`At ${comparisonResult.awardCpp.toFixed(1)}¢/mile, this award is below the Travel Eraser baseline (${CPM_THRESHOLDS.FLOOR}¢/mile). You're better off paying cash and erasing later to get 1¢/mile guaranteed.`}
                            className="ml-5 mt-1"
                          />
                        </div>
                      )}

                      {/* Explanation */}
                      <div className="p-2 rounded-lg bg-white/[0.03]">
                        {comparisonResult.explanation.map((line, i) => (
                          <div key={i} className="text-xs text-white/70 leading-relaxed">
                            {line}
                          </div>
                        ))}
                      </div>

                      {/* Alliance Translation Card - when award wins */}
                      {comparisonResult.winner === 'award' && selectedProgram && (() => {
                        const partner = CAPITAL_ONE_PARTNERS.find(p => p.name === selectedProgram);
                        return partner ? (
                          <AllianceTranslationCard partner={partner} />
                        ) : null;
                      })()}

                      {/* Tie-breaker guidance when award wins */}
                      {comparisonResult.winner === 'award' && <TieBreakerGuidance />}

                      {/* R8: Transfer instructions collapsed behind tap-to-expand */}
                      {comparisonResult.winner === 'award' && (
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <ExpandableInfo
                            summary="📋 Next Steps"
                            detail={<>1. Transfer miles to {selectedProgram}<br />2. Verify availability on their site<br />3. Book through the airline<br /><span className="text-amber-400/70">⚠️ Transfers take up to 48 hours</span></>}
                            variant="amber"
                          />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setFlowStep('input')}
                          className="flex-1 py-2 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/60 hover:bg-white/[0.08] transition-colors"
                        >
                          Try Different Award
                        </button>
                        <button
                          onClick={resetFlow}
                          className="flex-1 py-2 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/60 hover:bg-white/[0.08] transition-colors"
                        >
                          Done
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Tips Modal */}
      <AnimatePresence>
        {showTips && (
          <TipsModal
            isOpen={showTips}
            onClose={() => setShowTips(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default TransferPartnersCard;
