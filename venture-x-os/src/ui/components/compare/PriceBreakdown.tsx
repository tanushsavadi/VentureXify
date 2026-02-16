/**
 * Price Breakdown Component
 * 
 * A reusable, premium price breakdown table with right-aligned numbers.
 * Used for both flight and stay comparisons to show detailed pricing.
 * 
 * Features:
 * - Right-aligned numeric values
 * - Consistent typography hierarchy
 * - Support for ranges, highlights, and totals
 * - Animated number transitions
 * - Collapsible sections
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../lib/utils';
import { ChevronDown, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

// ============================================
// TYPES
// ============================================

export interface PriceLineItem {
  label: string;
  value: number | string;
  valueRange?: { min: number; max: number };
  currency?: string;
  highlight?: 'success' | 'warning' | 'info' | 'muted';
  isSubtotal?: boolean;
  isTotal?: boolean;
  prefix?: string;
  suffix?: string;
  tooltip?: string;
  indent?: boolean;
}

export interface PriceBreakdownSection {
  title: string;
  icon?: React.ReactNode;
  items: PriceLineItem[];
  defaultExpanded?: boolean;
  badge?: {
    label: string;
    variant: 'success' | 'warning' | 'info' | 'neutral';
  };
}

interface PriceBreakdownProps {
  sections: PriceBreakdownSection[];
  showTotals?: boolean;
  portalTotal?: number;
  directTotal?: number;
  winner?: 'portal' | 'direct' | 'tie';
  currency?: string;
  className?: string;
}

// ============================================
// HELPERS
// ============================================

const formatCurrency = (value: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatRange = (min: number, max: number, currency: string = 'USD'): string => {
  if (min === max) return formatCurrency(min, currency);
  return `${formatCurrency(min, currency)}–${formatCurrency(max, currency)}`;
};

// ============================================
// ANIMATED NUMBER COMPONENT
// ============================================

const AnimatedValue: React.FC<{
  value: number | string;
  valueRange?: { min: number; max: number };
  prefix?: string;
  suffix?: string;
  currency?: string;
  className?: string;
}> = ({ value, valueRange, prefix = '', suffix = '', currency, className }) => {
  let displayValue: string;
  
  if (valueRange) {
    displayValue = formatRange(valueRange.min, valueRange.max, currency);
  } else if (typeof value === 'number') {
    displayValue = currency ? formatCurrency(value, currency) : value.toLocaleString();
  } else {
    displayValue = value;
  }
  
  return (
    <motion.span
      key={displayValue}
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={className}
    >
      {prefix}{displayValue}{suffix}
    </motion.span>
  );
};

// ============================================
// TOOLTIP COMPONENT
// ============================================

const Tooltip: React.FC<{
  content: string;
  children: React.ReactNode;
}> = ({ content, children }) => {
  const [show, setShow] = React.useState(false);
  
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-black/95 border border-white/20 text-[10px] text-white/80 whitespace-nowrap z-50 shadow-xl"
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black/95" />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
};

// ============================================
// LINE ITEM COMPONENT
// ============================================

const LineItem: React.FC<{
  item: PriceLineItem;
  currency?: string;
}> = ({ item, currency = 'USD' }) => {
  const highlightColors = {
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    info: 'text-[#7eb8e0]',
    muted: 'text-white/40',
  };
  
  const valueColor = item.highlight
    ? highlightColors[item.highlight]
    : item.isTotal
    ? 'text-white'
    : 'text-white/90';
  
  const labelColor = item.isTotal
    ? 'text-white font-semibold'
    : item.isSubtotal
    ? 'text-white/70 font-medium'
    : 'text-white/50';
  
  return (
    <div
      className={cn(
        'flex items-center justify-between py-1.5',
        item.isTotal && 'pt-2 mt-1 border-t border-white/[0.08]',
        item.indent && 'pl-4'
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn('text-xs', labelColor)}>
          {item.label}
        </span>
        {item.tooltip && (
          <Tooltip content={item.tooltip}>
            <Info className="w-3 h-3 text-white/30 cursor-help" />
          </Tooltip>
        )}
      </div>
      <span
        className={cn(
          'text-right font-mono',
          item.isTotal ? 'text-base font-bold' : 'text-sm font-semibold',
          valueColor
        )}
      >
        <AnimatedValue
          value={item.value}
          valueRange={item.valueRange}
          prefix={item.prefix}
          suffix={item.suffix}
          currency={item.currency || currency}
        />
      </span>
    </div>
  );
};

// ============================================
// SECTION COMPONENT
// ============================================

const Section: React.FC<{
  section: PriceBreakdownSection;
  currency?: string;
}> = ({ section, currency }) => {
  const [expanded, setExpanded] = React.useState(section.defaultExpanded ?? true);
  
  const badgeColors = {
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    info: 'bg-[#4a90d9]/15 text-[#7eb8e0] border-[#4a90d9]/20',
    neutral: 'bg-white/[0.05] text-white/60 border-white/[0.08]',
  };
  
  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
      {/* Section header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center justify-between gap-2 px-4 py-3',
          'bg-white/[0.02] hover:bg-white/[0.04] transition-colors'
        )}
      >
        <div className="flex items-center gap-2">
          {section.icon && (
            <span className="text-[#5b9bd5]">{section.icon}</span>
          )}
          <span className="text-xs font-semibold text-white/90 uppercase tracking-wider">
            {section.title}
          </span>
          {section.badge && (
            <span className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-medium border',
              badgeColors[section.badge.variant]
            )}>
              {section.badge.label}
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          <ChevronDown className="w-4 h-4 text-white/40" />
        </motion.div>
      </button>
      
      {/* Section content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="px-4 pb-3 pt-1 border-t border-white/[0.04]">
              {section.items.map((item, i) => (
                <LineItem key={i} item={item} currency={currency} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// COMPARISON SUMMARY COMPONENT
// ============================================

const ComparisonSummary: React.FC<{
  portalTotal: number;
  directTotal: number;
  winner: 'portal' | 'direct' | 'tie';
  currency?: string;
}> = ({ portalTotal, directTotal, winner, currency = 'USD' }) => {
  const diff = Math.abs(portalTotal - directTotal);
  const portalWins = winner === 'portal';
  
  return (
    <div className={cn(
      'p-4 rounded-xl border',
      portalWins
        ? 'bg-[#4a90d9]/10 border-[#4a90d9]/20'
        : 'bg-emerald-500/10 border-emerald-500/20'
    )}>
      {/* Winner badge */}
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className={cn(
          'w-4 h-4',
          portalWins ? 'text-[#5b9bd5]' : 'text-emerald-400'
        )} />
        <span className={cn(
          'text-xs font-semibold uppercase tracking-wider',
          portalWins ? 'text-[#5b9bd5]' : 'text-emerald-400'
        )}>
          {winner === 'tie' ? 'Similar Cost' : `${portalWins ? 'Portal' : 'Direct'} Wins`}
        </span>
      </div>
      
      {/* Comparison grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className={cn(
          'p-3 rounded-lg',
          portalWins ? 'bg-[#4a90d9]/10' : 'bg-white/[0.03]'
        )}>
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Portal</div>
          <div className={cn(
            'text-lg font-bold',
            portalWins ? 'text-[#7eb8e0]' : 'text-white/80'
          )}>
            {formatCurrency(portalTotal, currency)}
          </div>
        </div>
        
        <div className={cn(
          'p-3 rounded-lg',
          !portalWins ? 'bg-emerald-500/10' : 'bg-white/[0.03]'
        )}>
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Direct</div>
          <div className={cn(
            'text-lg font-bold',
            !portalWins ? 'text-emerald-300' : 'text-white/80'
          )}>
            {formatCurrency(directTotal, currency)}
          </div>
        </div>
      </div>
      
      {/* Savings callout */}
      {diff > 0 && winner !== 'tie' && (
        <div className={cn(
          'mt-3 pt-3 border-t text-center',
          portalWins ? 'border-[#4a90d9]/20' : 'border-emerald-500/20'
        )}>
          <span className={cn(
            'text-sm font-semibold',
            portalWins ? 'text-[#7eb8e0]' : 'text-emerald-300'
          )}>
            Save {formatCurrency(diff, currency)}
          </span>
          <span className="text-xs text-white/50 ml-1">
            with {portalWins ? 'Portal' : 'Direct'}
          </span>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const PriceBreakdown: React.FC<PriceBreakdownProps> = ({
  sections,
  showTotals = false,
  portalTotal,
  directTotal,
  winner,
  currency = 'USD',
  className,
}) => {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Sections */}
      {sections.map((section, i) => (
        <Section key={i} section={section} currency={currency} />
      ))}
      
      {/* Summary comparison */}
      {showTotals && portalTotal !== undefined && directTotal !== undefined && winner && (
        <ComparisonSummary
          portalTotal={portalTotal}
          directTotal={directTotal}
          winner={winner}
          currency={currency}
        />
      )}
    </div>
  );
};

// ============================================
// PRESET BUILDERS FOR COMMON CASES
// ============================================

/**
 * Build price breakdown sections for a stay comparison
 */
export function buildStayPriceBreakdownSections(
  portalDetails: {
    price: number;
    creditApplied: number;
    outOfPocket: number;
    taxesFees?: number;
    milesEarned: number;
    earnRate: number;
  },
  directDetails: {
    price: number;
    outOfPocket: number;
    taxesFees?: number;
    milesEarned: number;
  },
  currency: string = 'USD'
): PriceBreakdownSection[] {
  return [
    {
      title: 'Portal (Capital One)',
      badge: { label: `${portalDetails.earnRate}x`, variant: 'info' },
      defaultExpanded: true,
      items: [
        { label: 'Listed price', value: portalDetails.price, currency },
        ...(portalDetails.taxesFees ? [{
          label: 'Taxes & fees',
          value: portalDetails.taxesFees,
          currency,
          indent: true,
        } as PriceLineItem] : []),
        ...(portalDetails.creditApplied > 0 ? [{
          label: 'Travel credit',
          value: -portalDetails.creditApplied,
          currency,
          highlight: 'success' as const,
          prefix: '-',
        } as PriceLineItem] : []),
        {
          label: 'Out of pocket',
          value: portalDetails.outOfPocket,
          currency,
          isSubtotal: true,
        },
        {
          label: 'Miles earned',
          value: `+${portalDetails.milesEarned.toLocaleString()}`,
          highlight: 'info',
          suffix: ' mi',
        },
      ],
    },
    {
      title: 'Direct',
      badge: { label: '2x', variant: 'neutral' },
      defaultExpanded: true,
      items: [
        { label: 'Listed price', value: directDetails.price, currency },
        ...(directDetails.taxesFees ? [{
          label: 'Taxes & fees',
          value: directDetails.taxesFees,
          currency,
          indent: true,
        } as PriceLineItem] : []),
        {
          label: 'Out of pocket',
          value: directDetails.outOfPocket,
          currency,
          isSubtotal: true,
        },
        {
          label: 'Miles earned',
          value: `+${directDetails.milesEarned.toLocaleString()}`,
          highlight: 'info',
          suffix: ' mi',
        },
      ],
    },
  ];
}

export default PriceBreakdown;
