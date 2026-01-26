/**
 * FX Rate Display Component
 * 
 * UX FIX P0-3: Shows explicit FX rate with source, timestamp, and sensitivity
 * Addresses the trust issue where currency conversion is opaque
 * 
 * Trust principles:
 * - Never show "unknown" - always provide actionable info
 * - Show the source (API or fallback) and freshness
 * - For close comparisons, show sensitivity analysis
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  getExchangeRateStatus,
  refreshExchangeRates,
  isPeggedCurrency,
  convertToUSD,
  type FxRateStatus,
} from '../../../lib/currencyConverter';

interface FxRateDisplayProps {
  /** Original currency code (e.g., "AED", "EUR") */
  fromCurrency: string;
  /** Original amount in foreign currency */
  originalAmount: number;
  /** Converted amount in USD */
  convertedAmountUSD: number;
  /** Show sensitivity analysis (for close comparisons) */
  showSensitivity?: boolean;
  /** Price difference threshold for sensitivity warning */
  priceDifferenceUSD?: number;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * FxRateDisplay - Shows FX conversion with full transparency
 * 
 * Example display:
 * ┌─────────────────────────────────────────────┐
 * │ Currency: AED → USD                         │
 * │ Rate: 1 USD = 3.6725 AED                    │
 * │ Source: Pegged rate / Updated 5 min ago    │
 * │ [ ⟳ Refresh ]                               │
 * │                                             │
 * │ ⚠️ Note: Your bank may charge 1-3% FX fee   │
 * │    on direct bookings in AED               │
 * │                                             │
 * │ Sensitivity: If rate moves ±2%:             │
 * │   Direct price range: $1,009 - $1,049       │
 * └─────────────────────────────────────────────┘
 */
export const FxRateDisplay: React.FC<FxRateDisplayProps> = ({
  fromCurrency,
  originalAmount,
  convertedAmountUSD,
  showSensitivity = false,
  priceDifferenceUSD,
  compact = false,
  className,
}) => {
  const [fxStatus, setFxStatus] = useState<FxRateStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  // Skip display if already in USD
  if (fromCurrency.toUpperCase() === 'USD') {
    return null;
  }
  
  // Calculate the effective exchange rate from the conversion
  const effectiveRate = originalAmount > 0 ? originalAmount / convertedAmountUSD : 0;
  const inverseRate = effectiveRate > 0 ? 1 / effectiveRate : 0;
  
  // Check if this is a pegged currency (more stable rate)
  const isPegged = isPeggedCurrency(fromCurrency);
  
  // Load FX status on mount
  useEffect(() => {
    const status = getExchangeRateStatus();
    setFxStatus(status);
  }, [convertedAmountUSD]);
  
  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshExchangeRates();
      const newStatus = getExchangeRateStatus();
      setFxStatus(newStatus);
      // Recalculate the converted amount would require re-running the parent's conversion
      // For now, just update the status display
    } catch (e) {
      console.error('[FxRateDisplay] Refresh failed:', e);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Calculate sensitivity range (±2%)
  const sensitivityPercent = 2;
  const lowRate = effectiveRate * (1 - sensitivityPercent / 100);
  const highRate = effectiveRate * (1 + sensitivityPercent / 100);
  const lowUSD = Math.round(originalAmount / highRate); // Higher rate = lower USD
  const highUSD = Math.round(originalAmount / lowRate); // Lower rate = higher USD
  
  // Determine if sensitivity matters (when price difference is small)
  const sensitivityMatters = showSensitivity && 
    priceDifferenceUSD !== undefined && 
    Math.abs(priceDifferenceUSD) < (highUSD - lowUSD);
  
  // Compact display for inline use
  if (compact) {
    return (
      <div className={cn(
        'inline-flex items-center gap-1.5 text-[10px] text-white/40',
        className
      )}>
        <Info className="w-2.5 h-2.5" />
        <span>
          {fromCurrency} {originalAmount.toLocaleString()} = ${convertedAmountUSD.toLocaleString()} USD
        </span>
        <span className="text-white/25">
          @ {effectiveRate.toFixed(4)}
        </span>
        {isPegged && (
          <span className="text-emerald-400/60 text-[9px]">(pegged)</span>
        )}
      </div>
    );
  }
  
  return (
    <div className={cn(
      'p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]',
      className
    )}>
      {/* Header with currency pair */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white/70">
            {fromCurrency} → USD
          </span>
          {isPegged && (
            <span className="px-1.5 py-0.5 text-[9px] font-medium bg-emerald-500/15 text-emerald-400 rounded">
              PEGGED
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-1 rounded hover:bg-white/[0.05] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn(
            'w-3.5 h-3.5 text-white/40',
            isRefreshing && 'animate-spin'
          )} />
        </button>
      </div>
      
      {/* Rate display */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-sm font-semibold text-white">
          1 USD = {effectiveRate.toFixed(4)} {fromCurrency}
        </span>
        <span className="text-[10px] text-white/30">
          (1 {fromCurrency} = ${inverseRate.toFixed(4)} USD)
        </span>
      </div>
      
      {/* Conversion result */}
      <div className="p-2 rounded-lg bg-white/[0.03] text-xs mb-2">
        <div className="flex justify-between items-center">
          <span className="text-white/50">
            {fromCurrency} {originalAmount.toLocaleString()}
          </span>
          <span className="text-white font-medium">
            = ${convertedAmountUSD.toLocaleString()} USD
          </span>
        </div>
      </div>
      
      {/* Source and freshness */}
      {fxStatus && (
        <div className="flex items-center gap-2 text-[10px] text-white/40 mb-2">
          <span>
            {isPegged 
              ? `Pegged rate (official)`
              : `Source: ${fxStatus.sourceName}`
            }
          </span>
          <span className="text-white/20">•</span>
          <span>{fxStatus.cacheAgeFormatted}</span>
          {fxStatus.isStale && (
            <>
              <span className="text-white/20">•</span>
              <span className="text-amber-400">stale</span>
            </>
          )}
        </div>
      )}
      
      {/* FX fee warning for non-pegged currencies */}
      {!isPegged && (
        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300/80 mb-2">
          <div className="flex items-start gap-1.5">
            <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>
              Your bank may charge 1-3% FX fee on direct bookings in {fromCurrency}. 
              Capital One has no FX fee on portal bookings.
            </span>
          </div>
        </div>
      )}
      
      {/* Sensitivity analysis */}
      {sensitivityMatters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px]"
        >
          <div className="text-indigo-300 font-medium mb-1">
            ⚠️ Rate sensitivity (±{sensitivityPercent}%)
          </div>
          <div className="text-white/60">
            If rate moves, this price could be ${lowUSD.toLocaleString()} – ${highUSD.toLocaleString()} USD
          </div>
          <div className="text-white/40 mt-1">
            Price difference (${priceDifferenceUSD?.toLocaleString()}) is within sensitivity range — 
            consider this a close call.
          </div>
        </motion.div>
      )}
      
      {/* Expandable details */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full text-[10px] text-white/30 hover:text-white/50 transition-colors mt-2"
      >
        {showDetails ? '▲ Hide details' : '▼ Show calculation details'}
      </button>
      
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 pt-2 border-t border-white/[0.06] text-[10px] text-white/40 space-y-1"
          >
            <div className="flex justify-between">
              <span>Original amount:</span>
              <span className="text-white/60">{fromCurrency} {originalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Exchange rate:</span>
              <span className="text-white/60">1 USD = {effectiveRate.toFixed(6)} {fromCurrency}</span>
            </div>
            <div className="flex justify-between">
              <span>Converted amount:</span>
              <span className="text-white/60">${convertedAmountUSD.toLocaleString()}</span>
            </div>
            {isPegged && (
              <div className="text-emerald-400/60 mt-1">
                ✓ {fromCurrency} is a USD-pegged currency — rate is officially fixed and very stable.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Compact FX indicator for use in capture cards
 */
export const FxIndicator: React.FC<{
  fromCurrency: string;
  originalAmount: number;
  convertedAmountUSD: number;
}> = ({ fromCurrency, originalAmount, convertedAmountUSD }) => {
  if (fromCurrency.toUpperCase() === 'USD') return null;
  
  const effectiveRate = originalAmount > 0 ? (originalAmount / convertedAmountUSD).toFixed(4) : '0';
  const isPegged = isPeggedCurrency(fromCurrency);
  
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-white/30">
      <Info className="w-2.5 h-2.5" />
      <span>Rate: 1 USD = {effectiveRate} {fromCurrency}</span>
      {isPegged && (
        <span className="text-emerald-400/50">(pegged)</span>
      )}
    </div>
  );
};

export default FxRateDisplay;
