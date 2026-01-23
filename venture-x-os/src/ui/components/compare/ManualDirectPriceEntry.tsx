// ============================================
// MANUAL DIRECT PRICE ENTRY FOR STAYS
// User-friendly input when auto-capture isn't reliable
// ============================================

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  Check,
  Info,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Building2,
  Globe,
  Calculator,
} from 'lucide-react';
import { GlassCard, GlassButton, GlassBadge, GlassInput } from '../glass';
import { cn } from '../../../lib/utils';

// ============================================
// TYPES
// ============================================

interface ManualDirectPriceEntryProps {
  portalPrice: number;
  portalPropertyName?: string;
  portalCheckIn?: string;
  portalCheckOut?: string;
  portalNights?: number;
  portalRoomType?: string;
  suggestedProviders?: {
    name: string;
    priceHint?: string;
    url?: string;
  }[];
  onPriceSubmit: (price: number, provider?: string, notes?: string) => void;
  className?: string;
}

// ============================================
// POPULAR HOTEL BOOKING SITES
// ============================================

const HOTEL_BOOKING_SITES = [
  { name: 'Hotels.com', icon: '🏨' },
  { name: 'Booking.com', icon: '📘' },
  { name: 'Expedia', icon: '✈️' },
  { name: 'Agoda', icon: '🌐' },
  { name: 'Hotel Direct Site', icon: '🏢' },
  { name: 'Other', icon: '📋' },
];

// ============================================
// COMPONENT
// ============================================

export const ManualDirectPriceEntry: React.FC<ManualDirectPriceEntryProps> = ({
  portalPrice,
  portalPropertyName,
  portalCheckIn,
  portalCheckOut,
  portalNights,
  portalRoomType,
  suggestedProviders,
  onPriceSubmit,
  className,
}) => {
  const [priceInput, setPriceInput] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Parse price from input
  const parsePrice = (input: string): number => {
    // Remove currency symbols and commas
    const cleaned = input.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const parsedPrice = parsePrice(priceInput);
  const priceDiff = parsedPrice > 0 ? parsedPrice - portalPrice : 0;
  const isDirectCheaper = priceDiff < 0;
  const isSignificantDiff = Math.abs(priceDiff) > 10;

  // Auto-focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = () => {
    if (parsedPrice <= 0) return;
    
    setIsSubmitting(true);
    
    // Small delay for animation
    setTimeout(() => {
      onPriceSubmit(parsedPrice, selectedProvider || undefined);
      setIsSubmitting(false);
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && parsedPrice > 0) {
      handleSubmit();
    }
  };

  // Format date for display
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">Enter Direct Price</h3>
          <p className="text-xs text-white/50">Find the checkout total on another site</p>
        </div>
      </div>

      {/* Instructions Card */}
      <AnimatePresence>
        {showTips && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <GlassCard variant="default" className="p-3">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-medium text-white/80">How to compare</span>
                </div>
                <button
                  onClick={() => setShowTips(false)}
                  className="text-[10px] text-white/40 hover:text-white/60"
                >
                  Hide
                </button>
              </div>
              <ol className="text-[11px] text-white/60 space-y-1.5 list-decimal list-inside">
                <li>Click a booking site on Google Hotels</li>
                <li>Select the <strong className="text-white/80">same room type</strong> & dates</li>
                <li>Go to checkout to see <strong className="text-white/80">total with taxes</strong></li>
                <li>Enter that price below</li>
              </ol>
              
              {/* Warning about room matching */}
              <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <span className="text-amber-400 text-xs">⚠️</span>
                  <span className="text-[10px] text-amber-200/80">
                    Make sure you're comparing the same room type, dates, and number of guests for an accurate comparison.
                  </span>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Portal Reference */}
      <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/50">Portal booking</span>
          <GlassBadge variant="accent" size="sm">Reference</GlassBadge>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            {portalPropertyName && (
              <div className="text-sm font-medium text-white truncate">{portalPropertyName}</div>
            )}
            <div className="flex items-center gap-2 text-[10px] text-white/40 mt-1">
              {portalCheckIn && portalCheckOut && (
                <span>{formatDate(portalCheckIn)} - {formatDate(portalCheckOut)}</span>
              )}
              {portalNights && (
                <span>• {portalNights} night{portalNights > 1 ? 's' : ''}</span>
              )}
            </div>
            {portalRoomType && (
              <div className="text-[10px] text-white/40 mt-1 truncate">{portalRoomType}</div>
            )}
          </div>
          <div className="text-right ml-4">
            <div className="text-lg font-bold text-white">${portalPrice.toLocaleString()}</div>
            <div className="text-[10px] text-white/40">total</div>
          </div>
        </div>
      </div>

      {/* Price Input */}
      <div className="space-y-3">
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <DollarSign className="w-5 h-5 text-white/40" />
          </div>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter checkout total (e.g., 9,752)"
            className={cn(
              'w-full pl-12 pr-4 py-4 rounded-xl text-xl font-semibold text-white',
              'bg-white/[0.06] border-2 placeholder:text-white/30',
              'focus:outline-none transition-all',
              parsedPrice > 0
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-white/[0.12] focus:border-white/20'
            )}
          />
          
          {/* Live comparison preview */}
          {parsedPrice > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              <div className={cn(
                'px-2 py-1 rounded-lg text-xs font-medium',
                isDirectCheaper
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : isSignificantDiff
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-white/10 text-white/60'
              )}>
                {isDirectCheaper
                  ? `$${Math.abs(priceDiff).toLocaleString()} cheaper`
                  : isSignificantDiff
                    ? `$${priceDiff.toLocaleString()} more`
                    : 'Similar price'}
              </div>
            </motion.div>
          )}
        </div>

        {/* Provider Selection (Optional) */}
        <div>
          <div className="text-[10px] text-white/40 mb-2">Where did you find this price? (optional)</div>
          <div className="flex flex-wrap gap-1.5">
            {HOTEL_BOOKING_SITES.map(({ name, icon }) => (
              <button
                key={name}
                onClick={() => setSelectedProvider(selectedProvider === name ? null : name)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-[11px] transition-all border',
                  selectedProvider === name
                    ? 'bg-blue-500/20 border-blue-500/40 text-white'
                    : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:bg-white/[0.06]'
                )}
              >
                <span className="mr-1">{icon}</span>
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Suggested providers from Google Hotels */}
      {suggestedProviders && suggestedProviders.length > 0 && (
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="text-[10px] text-white/40 mb-2 flex items-center gap-1">
            <Globe className="w-3 h-3" />
            Prices seen on Google Hotels (may vary)
          </div>
          <div className="space-y-1.5">
            {suggestedProviders.slice(0, 4).map((provider, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-white/70">{provider.name}</span>
                <span className="text-white/50">{provider.priceHint || '—'}</span>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-white/30 mt-2">
            * Click through to see actual checkout total with taxes
          </div>
        </div>
      )}

      {/* Submit Button */}
      <GlassButton
        variant="primary"
        className="w-full"
        onClick={handleSubmit}
        disabled={parsedPrice <= 0 || isSubmitting}
      >
        {isSubmitting ? (
          <motion.div
            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        ) : (
          <>
            <Check className="w-4 h-4" />
            Compare Prices
          </>
        )}
      </GlassButton>

      {/* Skip option */}
      <div className="text-center">
        <button
          onClick={() => onPriceSubmit(0)}
          className="text-[11px] text-white/40 hover:text-white/60 transition-colors"
        >
          Skip direct comparison →
        </button>
      </div>
    </div>
  );
};

export default ManualDirectPriceEntry;
