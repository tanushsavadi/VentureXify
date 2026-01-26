// ============================================
// MANUAL DIRECT PRICE ENTRY FOR STAYS
// User-friendly input when auto-capture isn't reliable
// Now with first-class currency handling!
// ============================================

import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { GlassCard, GlassButton, GlassBadge, GlassInput } from '../glass';
import { cn } from '../../../lib/utils';
import {
  detectCurrency,
  parsePriceAmount,
  convertToUSD,
  getExchangeRateStatus,
  refreshExchangeRates,
  getCurrentRates,
  formatPrice,
  isPeggedCurrency,
  getRateSourceForCurrency,
  type FxRateStatus,
} from '../../../lib/currencyConverter';

// ============================================
// TYPES
// ============================================

interface ManualDirectPriceEntryProps {
  portalPrice: number;
  portalCurrency?: string;
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
  onPriceSubmit: (price: number, provider?: string, notes?: string, metadata?: PriceMetadata) => void;
  className?: string;
}

/** Seller type classification - critical for trust */
export type SellerType = 'hotel_direct' | 'ota' | 'metasearch' | 'unknown';

/** Metadata for defensibility/transparency */
export interface PriceMetadata {
  originalAmount: number;
  originalCurrency: string;
  convertedAmountUSD: number;
  fxRate: number;
  fxBuffer: number;
  fxSource: 'api' | 'fallback' | 'none';
  fxSourceName: string; // NEW: Specific source name (e.g., "exchangerate.host")
  fxTimestamp: number | null;
  fxCacheAge: string; // NEW: Human-readable cache age
  sellerType: SellerType;
  sellerName: string | null;
}

/** Close-call threshold for price comparison */
const CLOSE_CALL_THRESHOLD_PERCENT = 2; // Within 2%
const CLOSE_CALL_THRESHOLD_ABS = 25; // Or within $25

// ============================================
// POPULAR HOTEL BOOKING SITES WITH SELLER TYPE
// ============================================

interface BookingSiteInfo {
  name: string;
  icon: string;
  sellerType: SellerType;
  description: string;
}

const HOTEL_BOOKING_SITES: BookingSiteInfo[] = [
  { name: 'Hotels.com', icon: '🏨', sellerType: 'ota', description: 'Online Travel Agency' },
  { name: 'Booking.com', icon: '📘', sellerType: 'ota', description: 'Online Travel Agency' },
  { name: 'Expedia', icon: '✈️', sellerType: 'ota', description: 'Online Travel Agency' },
  { name: 'Agoda', icon: '🌐', sellerType: 'ota', description: 'Online Travel Agency' },
  { name: 'Trip.com', icon: '🌍', sellerType: 'ota', description: 'Online Travel Agency' },
  { name: 'Priceline', icon: '💰', sellerType: 'ota', description: 'Online Travel Agency' },
  { name: 'Hotel Direct Site', icon: '🏢', sellerType: 'hotel_direct', description: 'Hotel\'s own website' },
  { name: 'Other', icon: '📋', sellerType: 'unknown', description: 'Unknown seller type' },
];

// Get seller type from provider name
const getSellerTypeFromProvider = (providerName: string | null): { sellerType: SellerType; label: string } => {
  if (!providerName) return { sellerType: 'unknown', label: 'Unknown' };
  
  const site = HOTEL_BOOKING_SITES.find(s => s.name === providerName);
  if (site) {
    return {
      sellerType: site.sellerType,
      label: site.sellerType === 'hotel_direct' ? 'Hotel Direct'
           : site.sellerType === 'ota' ? 'OTA'
           : site.sellerType === 'metasearch' ? 'Metasearch'
           : 'Unknown'
    };
  }
  
  // Fallback detection by name patterns
  const lowerName = providerName.toLowerCase();
  if (lowerName.includes('direct') || lowerName.includes('hotel') || lowerName.includes('resort')) {
    return { sellerType: 'hotel_direct', label: 'Hotel Direct' };
  }
  if (['booking', 'expedia', 'hotels.com', 'agoda', 'trip.com', 'priceline', 'orbitz', 'travelocity'].some(ota => lowerName.includes(ota))) {
    return { sellerType: 'ota', label: 'OTA' };
  }
  if (['google', 'trivago', 'kayak', 'tripadvisor'].some(meta => lowerName.includes(meta))) {
    return { sellerType: 'metasearch', label: 'Metasearch' };
  }
  
  return { sellerType: 'unknown', label: 'Unknown' };
};

// ============================================
// COMMON CURRENCIES (ordered by likely usage)
// ============================================

const COMMON_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
];

// FX Buffer options
const FX_BUFFER_OPTIONS = [
  { value: 0, label: 'No buffer (0%)' },
  { value: 1, label: '1% buffer' },
  { value: 2, label: '2% buffer' },
  { value: 3, label: '3% buffer' },
];

// ============================================
// COMPONENT
// ============================================

export const ManualDirectPriceEntry: React.FC<ManualDirectPriceEntryProps> = ({
  portalPrice,
  portalCurrency = 'USD',
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
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);
  const [fxBuffer, setFxBuffer] = useState(0); // 0-3%
  const [showFxSettings, setShowFxSettings] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingFx, setIsRefreshingFx] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const currencyDropdownRef = useRef<HTMLDivElement>(null);

  // Get FX status
  const fxStatus = useMemo(() => getExchangeRateStatus(), [isRefreshingFx]);

  // Parse price from input - now currency-aware
  const parsedAmount = useMemo(() => {
    return parsePriceAmount(priceInput);
  }, [priceInput]);

  // Auto-detect currency from input
  useEffect(() => {
    if (priceInput.length > 2) {
      const detected = detectCurrency(priceInput);
      if (detected !== 'USD' && detected !== selectedCurrency) {
        setSelectedCurrency(detected);
      }
    }
  }, [priceInput]);

  // Calculate converted price with buffer
  const conversionResult = useMemo(() => {
    if (parsedAmount <= 0) return null;
    
    const rates = getCurrentRates();
    const rate = rates[selectedCurrency] || 1;
    const baseUSD = convertToUSD(parsedAmount, selectedCurrency);
    // Apply buffer (adds to direct price, making it more expensive - conservative estimate)
    const withBuffer = baseUSD * (1 + fxBuffer / 100);
    
    return {
      originalAmount: parsedAmount,
      originalCurrency: selectedCurrency,
      convertedAmountUSD: withBuffer,
      fxRate: rate,
      fxBuffer,
      needsConversion: selectedCurrency !== 'USD',
    };
  }, [parsedAmount, selectedCurrency, fxBuffer]);

  // Price comparison (use converted USD) with close-call detection
  const priceUSD = conversionResult?.convertedAmountUSD || 0;
  const priceDiff = priceUSD > 0 ? priceUSD - portalPrice : 0;
  const priceDiffPercent = portalPrice > 0 ? (Math.abs(priceDiff) / portalPrice) * 100 : 0;
  const isDirectCheaper = priceDiff < 0;
  const isSignificantDiff = Math.abs(priceDiff) > 10;
  
  // Close-call detection: within 2% or $25 (whichever is smaller)
  // This prevents overly confident verdicts on near-ties
  const isCloseCall = Math.abs(priceDiff) <= CLOSE_CALL_THRESHOLD_ABS ||
                      priceDiffPercent <= CLOSE_CALL_THRESHOLD_PERCENT;
  
  // Generate price comparison label with context
  const getPriceComparisonLabel = () => {
    if (priceUSD <= 0) return '';
    
    if (isCloseCall) {
      // Close call - be explicit about uncertainty
      return `≈ Portal (±$${CLOSE_CALL_THRESHOLD_ABS} / ${CLOSE_CALL_THRESHOLD_PERCENT}%)`;
    }
    
    if (isDirectCheaper) {
      return `$${Math.abs(priceDiff).toFixed(2)} cheaper`;
    }
    
    if (isSignificantDiff) {
      return `$${priceDiff.toFixed(2)} more`;
    }
    
    return 'Similar price';
  };

  // Auto-focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Close currency dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (currencyDropdownRef.current && !currencyDropdownRef.current.contains(e.target as Node)) {
        setShowCurrencyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRefreshFx = async () => {
    setIsRefreshingFx(true);
    await refreshExchangeRates();
    setIsRefreshingFx(false);
  };

  const handleSubmit = () => {
    if (priceUSD <= 0) return;
    
    setIsSubmitting(true);
    
    // Get seller type from selected provider
    const { sellerType } = getSellerTypeFromProvider(selectedProvider);
    
    // Build metadata for transparency/defensibility
    const metadata: PriceMetadata = {
      originalAmount: conversionResult?.originalAmount || priceUSD,
      originalCurrency: selectedCurrency,
      convertedAmountUSD: priceUSD,
      fxRate: conversionResult?.fxRate || 1,
      fxBuffer,
      fxSource: fxStatus.source,
      fxSourceName: fxStatus.sourceName, // NEW: Include specific source name
      fxTimestamp: fxStatus.lastUpdated,
      fxCacheAge: fxStatus.cacheAgeFormatted, // NEW: Human-readable cache age
      sellerType,
      sellerName: selectedProvider,
    };
    
    // Small delay for animation
    setTimeout(() => {
      onPriceSubmit(priceUSD, selectedProvider || undefined, undefined, metadata);
      setIsSubmitting(false);
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && priceUSD > 0) {
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

  // Format FX timestamp
  const formatFxTime = (ts: number | null) => {
    if (!ts) return 'unknown';
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    return `${hours}h ago`;
  };

  // Get currency info
  const getCurrencyInfo = (code: string) => {
    return COMMON_CURRENCIES.find(c => c.code === code) || { code, name: code, symbol: code };
  };

  const selectedCurrencyInfo = getCurrencyInfo(selectedCurrency);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/10 border border-blue-500/20 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">Enter Checkout Total</h3>
          <p className="text-xs text-white/50">Include currency if different from USD</p>
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
                <li>Enter that price below <strong className="text-white/80">with currency</strong> (e.g., AED 2,226)</li>
              </ol>
              
              {/* Warning about room matching + currency */}
              <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span className="text-[10px] text-amber-200/80">
                    Match room type, dates, guests, and note the <strong>checkout currency</strong> — some sites display prices differently than they charge.
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
            <div className="text-lg font-bold text-white">${portalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-[10px] text-white/40">total ({portalCurrency})</div>
          </div>
        </div>
      </div>

      {/* Price Input with Currency */}
      <div className="space-y-3">
        <div className="flex gap-2">
          {/* Currency Selector */}
          <div className="relative" ref={currencyDropdownRef}>
            <button
              onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
              className={cn(
                'h-full px-3 py-4 rounded-xl text-sm font-medium',
                'bg-white/[0.06] border-2 border-white/[0.12]',
                'hover:bg-white/[0.08] transition-all',
                'flex items-center gap-1',
                showCurrencyDropdown && 'border-white/20'
              )}
            >
              <span className="text-white">{selectedCurrencyInfo.code}</span>
              <ChevronDown className={cn(
                'w-4 h-4 text-white/40 transition-transform',
                showCurrencyDropdown && 'rotate-180'
              )} />
            </button>
            
            {/* Currency Dropdown */}
            <AnimatePresence>
              {showCurrencyDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="absolute top-full left-0 mt-1 w-56 max-h-64 overflow-y-auto z-50 rounded-xl bg-gray-900/95 border border-white/10 shadow-xl"
                >
                  {COMMON_CURRENCIES.map((currency) => (
                    <button
                      key={currency.code}
                      onClick={() => {
                        setSelectedCurrency(currency.code);
                        setShowCurrencyDropdown(false);
                      }}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm flex items-center justify-between',
                        'hover:bg-white/[0.08] transition-colors',
                        selectedCurrency === currency.code && 'bg-blue-500/20'
                      )}
                    >
                      <span className="text-white/80">{currency.code}</span>
                      <span className="text-white/40 text-xs">{currency.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Price Input */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`e.g., ${selectedCurrency === 'USD' ? '606.11' : selectedCurrency === 'AED' ? '2,226' : '1,234.56'}`}
              className={cn(
                'w-full px-4 py-4 rounded-xl text-xl font-semibold text-white',
                'bg-white/[0.06] border-2 placeholder:text-white/30',
                'focus:outline-none transition-all',
                parsedAmount > 0
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-white/[0.12] focus:border-white/20'
              )}
            />
            
            {/* Live comparison preview with close-call detection */}
            {priceUSD > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                <div className={cn(
                  'px-2 py-1 rounded-lg text-xs font-medium',
                  isCloseCall
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'  // Close call - amber/caution
                    : isDirectCheaper
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : isSignificantDiff
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-white/10 text-white/60'
                )}>
                  {getPriceComparisonLabel()}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Conversion Info (show when currency isn't USD) */}
        {conversionResult?.needsConversion && parsedAmount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-blue-300/80">
                <strong>{selectedCurrency} {parsedAmount.toLocaleString()}</strong> → <strong>${priceUSD.toFixed(2)} USD</strong>
              </span>
              <button
                onClick={() => setShowFxSettings(!showFxSettings)}
                className="text-[10px] text-blue-400/60 hover:text-blue-400 flex items-center gap-1"
              >
                FX Settings
                <ChevronDown className={cn('w-3 h-3', showFxSettings && 'rotate-180')} />
              </button>
            </div>
            {/* FX Rate Source & Timestamp - Trust-building display */}
            <div className="text-[10px] text-blue-300/50 flex items-center gap-1.5 flex-wrap">
              <span>
                Rate: 1 {selectedCurrency} = ${conversionResult.fxRate.toFixed(4)} USD
                {fxBuffer > 0 && ` (+${fxBuffer}% buffer)`}
              </span>
              <span className="text-blue-300/30">·</span>
              {/* Show pegged indicator for pegged currencies */}
              {isPeggedCurrency(selectedCurrency) ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400/80 text-[9px]">
                  🔒 Pegged rate (official)
                </span>
              ) : (
                <span className={cn(
                  'inline-flex items-center gap-1',
                  fxStatus.isStale ? 'text-amber-400/70' : 'text-blue-300/60'
                )}>
                  {fxStatus.source === 'api' ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      {fxStatus.sourceName}
                    </>
                  ) : fxStatus.source === 'fallback' ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                      Built-in rate
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                      No rate data
                    </>
                  )}
                  <span className="text-white/30">·</span>
                  <span>{fxStatus.cacheAgeFormatted}</span>
                </span>
              )}
              {/* Stale warning */}
              {fxStatus.isStale && !isPeggedCurrency(selectedCurrency) && (
                <span className="text-amber-400/70 text-[9px]">(stale – tap refresh)</span>
              )}
            </div>

            {/* FX Settings Panel */}
            <AnimatePresence>
              {showFxSettings && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 pt-2 border-t border-blue-500/20"
                >
                  {/* Source details */}
                  <div className="mb-3 p-2 rounded bg-white/[0.03] border border-white/[0.05]">
                    <div className="text-[10px] text-white/60 mb-1 font-medium">Rate Source Details</div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[9px]">
                      <div className="text-white/40">Source:</div>
                      <div className="text-white/70">{fxStatus.sourceName}</div>
                      <div className="text-white/40">Updated:</div>
                      <div className="text-white/70">
                        {fxStatus.lastUpdated
                          ? new Date(fxStatus.lastUpdated).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZoneName: 'short'
                            })
                          : 'Unknown'
                        }
                      </div>
                      <div className="text-white/40">Cache age:</div>
                      <div className={cn(
                        'font-medium',
                        fxStatus.isStale ? 'text-amber-400' : 'text-white/70'
                      )}>
                        {fxStatus.cacheAgeFormatted}
                        {fxStatus.isStale && ' ⚠️'}
                      </div>
                      {isPeggedCurrency(selectedCurrency) && (
                        <>
                          <div className="text-white/40">Type:</div>
                          <div className="text-emerald-400/80">🔒 USD-pegged currency</div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-white/50">FX buffer (accounts for bank spread)</span>
                    <button
                      onClick={handleRefreshFx}
                      disabled={isRefreshingFx || isPeggedCurrency(selectedCurrency)}
                      className={cn(
                        "text-[10px] flex items-center gap-1 transition-colors",
                        isPeggedCurrency(selectedCurrency)
                          ? "text-white/30 cursor-not-allowed"
                          : "text-blue-400/60 hover:text-blue-400"
                      )}
                      title={isPeggedCurrency(selectedCurrency) ? "Pegged currencies use fixed official rates" : "Refresh live rates"}
                    >
                      <RefreshCw className={cn('w-3 h-3', isRefreshingFx && 'animate-spin')} />
                      {isPeggedCurrency(selectedCurrency) ? 'Fixed rate' : 'Refresh rate'}
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    {FX_BUFFER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setFxBuffer(opt.value)}
                        className={cn(
                          'px-2 py-1 rounded text-[10px] transition-all border',
                          fxBuffer === opt.value
                            ? 'bg-blue-500/30 border-blue-500/50 text-white'
                            : 'bg-white/[0.03] border-white/[0.08] text-white/50 hover:bg-white/[0.06]'
                        )}
                      >
                        {opt.value}%
                      </button>
                    ))}
                  </div>
                  {fxBuffer > 0 && (
                    <div className="text-[9px] text-white/40 mt-1.5">
                      Est. range: ${(priceUSD / (1 + fxBuffer/100)).toFixed(2)}–${priceUSD.toFixed(2)} (depending on actual FX)
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Provider Selection (Optional) - Now with Seller Type Classification */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] text-white/40">Where did you find this price? (optional)</div>
            {/* Show seller type badge when provider selected */}
            {selectedProvider && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  'px-2 py-0.5 rounded text-[9px] font-medium',
                  getSellerTypeFromProvider(selectedProvider).sellerType === 'hotel_direct'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : getSellerTypeFromProvider(selectedProvider).sellerType === 'ota'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                )}
              >
                Seller type: {getSellerTypeFromProvider(selectedProvider).label}
              </motion.div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {HOTEL_BOOKING_SITES.map(({ name, icon, sellerType, description }) => (
              <button
                key={name}
                onClick={() => setSelectedProvider(selectedProvider === name ? null : name)}
                title={description}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-[11px] transition-all border relative',
                  selectedProvider === name
                    ? sellerType === 'hotel_direct'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-white'
                      : sellerType === 'ota'
                        ? 'bg-blue-500/20 border-blue-500/40 text-white'
                        : 'bg-amber-500/20 border-amber-500/40 text-white'
                    : 'bg-white/[0.03] border-white/[0.08] text-white/60 hover:bg-white/[0.06]'
                )}
              >
                <span className="mr-1">{icon}</span>
                {name}
              </button>
            ))}
          </div>
          {/* Seller type legend */}
          <div className="mt-2 flex items-center gap-3 text-[9px] text-white/40">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500/50"></span>
              Hotel Direct
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500/50"></span>
              OTA
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500/50"></span>
              Unknown
            </span>
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
            * Click through to see actual checkout total with taxes & currency
          </div>
        </div>
      )}

      {/* Submit Button */}
      <GlassButton
        variant="primary"
        className="w-full"
        onClick={handleSubmit}
        disabled={priceUSD <= 0 || isSubmitting}
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
            {conversionResult?.needsConversion && priceUSD > 0 && (
              <span className="text-xs opacity-70 ml-1">(${priceUSD.toFixed(0)} USD)</span>
            )}
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
