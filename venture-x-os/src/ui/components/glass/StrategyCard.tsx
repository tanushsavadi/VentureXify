/**
 * Premium Strategy Card
 * Glass morphism with animated gradient borders for BEST card
 * Expandable details using collapsible accordion
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { GlassBadge } from './index';
import {
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Shield,
  CreditCard,
  Plane,
  Zap,
  Target,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface StrategyData {
  id: string;
  name: string;
  description: string;
  netCashCost: number;
  milesEarned: number;
  milesSpent: number;
  cppRealized: number;
  pros: string[];
  cons: string[];
  available: boolean;
  tags?: ('cheapest' | 'max-value' | 'easiest' | 'best')[];
}

interface GlassStrategyCardProps {
  strategy: StrategyData;
  isWinner?: boolean;
  index?: number;
  className?: string;
}

// ============================================
// ICON MAPPING
// ============================================

const getStrategyIcon = (id: string) => {
  const icons: Record<string, React.ReactNode> = {
    'PORTAL_PARITY': <CreditCard className="w-5 h-5" />,
    'PORTAL_PROTECTED': <Shield className="w-5 h-5" />,
    'DIRECT_CASH': <Plane className="w-5 h-5" />,
    'DIRECT_ERASER': <Zap className="w-5 h-5" />,
    'TRANSFER_AWARD': <Target className="w-5 h-5" />,
    'HYBRID_AWARD_ERASER': <Sparkles className="w-5 h-5" />,
  };
  return icons[id] || <CreditCard className="w-5 h-5" />;
};

const tagConfig = {
  'cheapest': { label: 'Cheapest', variant: 'success' as const, icon: TrendingDown },
  'max-value': { label: 'Max Value', variant: 'accent' as const, icon: TrendingUp },
  'easiest': { label: 'Easiest', variant: 'default' as const, icon: Zap },
  'best': { label: 'BEST', variant: 'accent' as const, icon: Sparkles },
};

// ============================================
// GLASS STRATEGY CARD
// ============================================

export const GlassStrategyCard: React.FC<GlassStrategyCardProps> = ({
  strategy,
  isWinner = false,
  index = 0,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!strategy.available) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{
        duration: 0.35,
        delay: index * 0.08,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={cn(
        'relative rounded-xl overflow-hidden',
        'transition-all duration-300',
        className
      )}
    >
      {/* Animated gradient border for winner */}
      {isWinner && (
        <div
          className="absolute inset-0 rounded-xl"
          style={{
            padding: '2px',
            background: 'conic-gradient(from 0deg, rgba(99, 102, 241, 0.6), rgba(139, 92, 246, 0.4), rgba(168, 85, 247, 0.3), rgba(139, 92, 246, 0.4), rgba(99, 102, 241, 0.6))',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            animation: 'rotate-gradient 4s linear infinite',
          }}
        />
      )}

      {/* Card content */}
      <div
        className={cn(
          'relative rounded-xl p-4',
          'backdrop-blur-lg',
          'transition-all duration-200',
          isWinner
            ? 'bg-white/[0.10] shadow-[0_0_30px_rgba(99,102,241,0.20)]'
            : 'bg-white/[0.05] border border-white/[0.10] hover:bg-white/[0.07] hover:border-white/[0.15]'
        )}
      >
        {/* Noise overlay */}
        <div
          className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-[0.015] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Inner highlight */}
        <div className="absolute inset-0 rounded-[inherit] pointer-events-none shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" />

        {/* Header - clickable to expand */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="relative z-10 w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 rounded-lg"
        >
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-xl',
                'transition-all duration-200',
                isWinner
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'bg-white/[0.06] text-white/60 border border-white/[0.10]'
              )}
            >
              {getStrategyIcon(strategy.id)}
            </div>

            {/* Title and description */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-white truncate">
                  {strategy.name}
                </h3>
                {/* Tags */}
                {strategy.tags?.map((tag) => {
                  const config = tagConfig[tag];
                  const IconComponent = config.icon;
                  return (
                    <GlassBadge
                      key={tag}
                      variant={config.variant}
                      size="sm"
                      className={cn(
                        isWinner && tag === 'best' && 'animate-pulse'
                      )}
                    >
                      <IconComponent className="w-3 h-3" />
                      {config.label}
                    </GlassBadge>
                  );
                })}
              </div>
              <p className="text-xs text-white/50 mt-0.5 line-clamp-1">
                {strategy.description}
              </p>
            </div>

            {/* Price and expand */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-lg font-bold text-white">
                  ${strategy.netCashCost.toLocaleString()}
                </div>
                <div className="text-[10px] text-white/40 uppercase tracking-wide">
                  Net Cost
                </div>
              </div>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-white/40"
              >
                <ChevronDown className="w-5 h-5" />
              </motion.div>
            </div>
          </div>
        </button>

        {/* Expandable details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="relative z-10 overflow-hidden"
            >
              <div className="pt-4 mt-4 border-t border-white/[0.08]">
                {/* Metrics row */}
                <div className="flex gap-4 mb-4">
                  {strategy.milesEarned > 0 && (
                    <div className="flex-1 p-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                      <div className="text-[10px] text-white/40 uppercase tracking-wide mb-1">
                        Miles Earned
                      </div>
                      <div className="text-sm font-semibold text-emerald-400 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        +{strategy.milesEarned.toLocaleString()}
                      </div>
                    </div>
                  )}
                  {strategy.milesSpent > 0 && (
                    <div className="flex-1 p-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                      <div className="text-[10px] text-white/40 uppercase tracking-wide mb-1">
                        Miles Spent
                      </div>
                      <div className="text-sm font-semibold text-red-400 flex items-center gap-1">
                        <TrendingDown className="w-3.5 h-3.5" />
                        -{strategy.milesSpent.toLocaleString()}
                      </div>
                    </div>
                  )}
                  {strategy.cppRealized > 0 && (
                    <div className="flex-1 p-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                      <div className="text-[10px] text-white/40 uppercase tracking-wide mb-1">
                        Value Realized
                      </div>
                      <div className="text-sm font-semibold text-indigo-300">
                        {strategy.cppRealized.toFixed(2)}¢/mi
                      </div>
                    </div>
                  )}
                </div>

                {/* Pros and Cons */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Pros */}
                  {strategy.pros.length > 0 && (
                    <div>
                      <div className="text-[10px] text-emerald-400/70 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-emerald-400" />
                        Pros
                      </div>
                      <ul className="space-y-1">
                        {strategy.pros.map((pro, i) => (
                          <motion.li
                            key={i}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="text-xs text-white/60 flex items-start gap-1.5"
                          >
                            <span className="text-emerald-400 mt-0.5">✓</span>
                            {pro}
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Cons */}
                  {strategy.cons.length > 0 && (
                    <div>
                      <div className="text-[10px] text-red-400/70 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-red-400" />
                        Cons
                      </div>
                      <ul className="space-y-1">
                        {strategy.cons.map((con, i) => (
                          <motion.li
                            key={i}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="text-xs text-white/50 flex items-start gap-1.5"
                          >
                            <span className="text-red-400/70 mt-0.5">✗</span>
                            {con}
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Winner glow pulse effect */}
        {isWinner && (
          <motion.div
            className="absolute inset-0 rounded-xl pointer-events-none"
            animate={{
              boxShadow: [
                '0 0 20px rgba(99, 102, 241, 0.1)',
                '0 0 35px rgba(99, 102, 241, 0.2)',
                '0 0 20px rgba(99, 102, 241, 0.1)',
              ],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </div>
    </motion.div>
  );
};

// ============================================
// VERDICT CARD (Winner announcement)
// Enhanced with decision-grade context
// ============================================

interface VerdictData {
  recommendation: 'portal' | 'direct' | 'eraser';
  topStrategy?: StrategyData;
  netSavings: number;
  portalDetails: {
    price: number;
    outOfPocket: number;
    creditApplied: number;
    milesEarned: number;
    netEffectiveCost: number;
    milesEarnedRange?: { min: number; max: number };
  };
  directDetails: {
    price: number;
    outOfPocket: number;
    milesEarned: number;
    netEffectiveCost: number;
    isOTA?: boolean | 'unknown';
    sellerType?: 'airline' | 'ota' | 'unknown';
  };
  explanation: string[];
  // New decision-grade fields
  whyThisWon?: {
    payToday: string;
    milesEarned: string;
    decisionTip: string;
  };
  assumptions?: {
    label: string;
    value: string;
    editable?: boolean;
  }[];
  couldFlipIf?: string[];
  confidence?: 'high' | 'medium' | 'low';
  confidenceReasons?: string[];
  deltas?: {
    stickerDiff: number;
    outOfPocketDiff: number;
    netEffectiveDiff: number;
    milesDiff: number;
  };
}

interface GlassVerdictCardProps {
  verdict: VerdictData;
  className?: string;
  onAssumptionEdit?: (label: string) => void;
}

export const GlassVerdictCard: React.FC<GlassVerdictCardProps> = ({
  verdict,
  className,
  onAssumptionEdit,
}) => {
  const [showFlipConditions, setShowFlipConditions] = useState(false);
  
  const getRecommendationEmoji = () => {
    switch (verdict.recommendation) {
      case 'portal': return '🏦';
      case 'eraser': return '💳';
      case 'direct': return '✈️';
      default: return '✨';
    }
  };
  
  const getConfidenceColor = () => {
    switch (verdict.confidence) {
      case 'high': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'medium': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'low': return 'text-red-400 bg-red-500/10 border-red-500/20';
      default: return 'text-white/50 bg-white/5 border-white/10';
    }
  };
  
  const formatMilesRange = (min: number, max: number) => {
    if (min === max) return `+${min.toLocaleString()}`;
    return `+${min.toLocaleString()}–${max.toLocaleString()}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'relative rounded-2xl overflow-hidden',
        className
      )}
    >
      {/* Animated gradient border */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          padding: '2px',
          background: 'conic-gradient(from 0deg, rgba(99, 102, 241, 0.6), rgba(139, 92, 246, 0.4), rgba(168, 85, 247, 0.3), rgba(139, 92, 246, 0.4), rgba(99, 102, 241, 0.6))',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          animation: 'rotate-gradient 4s linear infinite',
        }}
      />

      {/* Card content */}
      <div className="relative bg-white/[0.08] backdrop-blur-xl rounded-2xl p-6">
        {/* Noise overlay */}
        <div
          className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-[0.015] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Inner highlight */}
        <div className="absolute inset-0 rounded-[inherit] pointer-events-none shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]" />

        {/* Winner Banner + Confidence */}
        <div className="relative z-10 text-center mb-4">
          <div className="flex justify-center items-center gap-2 mb-2">
            <motion.div
              className="text-4xl"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              {getRecommendationEmoji()}
            </motion.div>
            {/* Confidence indicator */}
            {verdict.confidence && (
              <span className={cn(
                'px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-full border',
                getConfidenceColor()
              )}>
                {verdict.confidence} confidence
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-white mb-1">
            {verdict.topStrategy?.name || `Book ${verdict.recommendation === 'portal' ? 'Portal' : 'Direct'}`}
          </h2>
          <p className="text-sm text-white/60">
            ${verdict.topStrategy?.netCashCost.toLocaleString() || verdict.netSavings.toFixed(0)} out of pocket
          </p>
        </div>

        {/* WHY THIS WON - 3 bullet summary */}
        {verdict.whyThisWon && (
          <div className="relative z-10 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
            <div className="text-[10px] text-indigo-300 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              Why this wins
            </div>
            <div className="space-y-1.5">
              <div className="text-xs text-white/80 flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5">💰</span>
                <span>{verdict.whyThisWon.payToday}</span>
              </div>
              <div className="text-xs text-white/80 flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5">✈️</span>
                <span>{verdict.whyThisWon.milesEarned}</span>
              </div>
              <div className="text-xs text-white/60 flex items-start gap-2">
                <span className="text-indigo-400 mt-0.5">💡</span>
                <span>{verdict.whyThisWon.decisionTip}</span>
              </div>
            </div>
          </div>
        )}

        {/* Comparison Grid */}
        <div className="relative z-10 grid grid-cols-2 gap-3 mb-4">
          {/* Portal */}
          <div
            className={cn(
              'p-4 rounded-xl border transition-all duration-200',
              verdict.recommendation === 'portal'
                ? 'bg-white/[0.10] border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
                : 'bg-white/[0.04] border-white/[0.08]'
            )}
          >
            <div className="text-xs text-white/50 mb-2">Portal</div>
            <div className="text-xl font-bold text-white">
              ${verdict.portalDetails.outOfPocket.toLocaleString()}
            </div>
            <div className="text-[10px] text-white/40 mb-2">out of pocket</div>
            {verdict.portalDetails.creditApplied > 0 && (
              <div className="text-xs text-emerald-400">
                -${verdict.portalDetails.creditApplied} credit applied
              </div>
            )}
            {/* Miles earned - show range if available */}
            <div className="text-xs text-indigo-300 mt-1">
              {verdict.portalDetails.milesEarnedRange
                ? `${formatMilesRange(verdict.portalDetails.milesEarnedRange.min, verdict.portalDetails.milesEarnedRange.max)} mi (5x)`
                : `+${verdict.portalDetails.milesEarned.toLocaleString()} mi (5x)`
              }
            </div>
            {verdict.portalDetails.milesEarnedRange &&
             verdict.portalDetails.milesEarnedRange.min !== verdict.portalDetails.milesEarnedRange.max && (
              <div className="text-[9px] text-white/30 mt-0.5">
                range: credit may affect earn base
              </div>
            )}
          </div>

          {/* Direct */}
          <div
            className={cn(
              'p-4 rounded-xl border transition-all duration-200',
              verdict.recommendation === 'direct'
                ? 'bg-white/[0.10] border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
                : 'bg-white/[0.04] border-white/[0.08]'
            )}
          >
            <div className="text-xs text-white/50 mb-2 flex items-center gap-1">
              Direct
              {verdict.directDetails.sellerType === 'ota' && (
                <span className="text-amber-400 text-[9px]">(OTA)</span>
              )}
              {verdict.directDetails.sellerType === 'unknown' && (
                <span className="text-white/30 text-[9px]">(?)</span>
              )}
            </div>
            <div className="text-xl font-bold text-white">
              ${verdict.directDetails.outOfPocket.toLocaleString()}
            </div>
            <div className="text-[10px] text-white/40 mb-2">out of pocket</div>
            <div className="text-[10px] text-white/30">no credit - portal only</div>
            <div className="text-xs text-indigo-300 mt-1">
              +{verdict.directDetails.milesEarned.toLocaleString()} mi (2x)
            </div>
            {verdict.directDetails.isOTA === 'unknown' && (
              <div className="text-[9px] text-amber-400/70 mt-0.5">
                ⚠️ verify: airline or OTA?
              </div>
            )}
          </div>
        </div>

        {/* Assumptions (compact inline) */}
        {verdict.assumptions && verdict.assumptions.length > 0 && (
          <div className="relative z-10 mb-4">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
              Assumptions used
            </div>
            <div className="flex flex-wrap gap-2">
              {verdict.assumptions.map((assumption, i) => (
                <button
                  key={i}
                  onClick={() => assumption.editable && onAssumptionEdit?.(assumption.label)}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] border transition-all',
                    assumption.editable
                      ? 'bg-white/[0.06] border-white/[0.15] text-white/70 hover:bg-white/[0.10] hover:border-indigo-500/30 cursor-pointer'
                      : 'bg-white/[0.03] border-white/[0.08] text-white/50 cursor-default'
                  )}
                >
                  <span className="text-white/40">{assumption.label}:</span>
                  <span className={assumption.editable ? 'text-indigo-300' : 'text-white/50'}>
                    {assumption.value}
                  </span>
                  {assumption.editable && (
                    <span className="text-indigo-400 text-[8px]">✎</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Could Flip If - expandable */}
        {verdict.couldFlipIf && verdict.couldFlipIf.length > 0 && (
          <div className="relative z-10 mb-4">
            <button
              onClick={() => setShowFlipConditions(!showFlipConditions)}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.06] transition-all"
            >
              <span className="text-[10px] text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown className="w-3 h-3" />
                What could change the answer?
              </span>
              <motion.div
                animate={{ rotate: showFlipConditions ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-white/40"
              >
                <ChevronDown className="w-4 h-4" />
              </motion.div>
            </button>
            <AnimatePresence>
              {showFlipConditions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 space-y-2 mt-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    {verdict.couldFlipIf.map((condition, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="text-xs text-white/60 flex items-start gap-2"
                      >
                        <span className="text-amber-400 mt-0.5">→</span>
                        <span>{condition}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Confidence reasons (if not high) */}
        {verdict.confidence && verdict.confidence !== 'high' && verdict.confidenceReasons && (
          <div className="relative z-10 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] mb-4">
            <div className="text-[9px] text-white/40 mb-1">
              Why {verdict.confidence} confidence:
            </div>
            <div className="text-[10px] text-white/50">
              {verdict.confidenceReasons.join(' • ')}
            </div>
          </div>
        )}

        {/* Detailed Explanation */}
        <div className="relative z-10 p-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">
            Full breakdown
          </div>
          {verdict.explanation.map((line, i) => (
            <p key={i} className="text-xs text-white/60 mb-1 last:mb-0">
              {line}
            </p>
          ))}
        </div>

        {/* Glow pulse */}
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{
            boxShadow: [
              '0 0 30px rgba(99, 102, 241, 0.1)',
              '0 0 50px rgba(99, 102, 241, 0.2)',
              '0 0 30px rgba(99, 102, 241, 0.1)',
            ],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>
    </motion.div>
  );
};

// CSS for animated gradient - needs to be added to stylesheet
const styleSheet = `
@keyframes rotate-gradient {
  to {
    background: conic-gradient(from 360deg, rgba(99, 102, 241, 0.6), rgba(139, 92, 246, 0.4), rgba(168, 85, 247, 0.3), rgba(139, 92, 246, 0.4), rgba(99, 102, 241, 0.6));
  }
}
`;

export default GlassStrategyCard;
