/**
 * Stay Details Card Component
 * 
 * Displays captured stay/hotel booking details from Capital One Travel portal.
 * Shows property info, room details, dates, and pricing in a premium card format.
 * 
 * Features:
 * - Property name and star rating
 * - Check-in/out dates with night count
 * - Room type and amenities
 * - Cancellation policy
 * - Price breakdown with taxes/fees
 * - Miles equivalent if shown
 */

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/utils';
import {
  Building2,
  Calendar,
  Users,
  Bed,
  Coffee,
  Shield,
  Star,
  MapPin,
  CreditCard,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import {
  StayPortalCapture,
  formatStayPrice,
  formatDateRange,
} from '../../../lib/staysTypes';

// ============================================
// TYPES
// ============================================

interface StayDetailsCardProps {
  capture: StayPortalCapture;
  onCompareClick?: () => void;
  compact?: boolean;
  className?: string;
}

// ============================================
// DETAIL ROW COMPONENT
// ============================================

const DetailRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
  highlight?: boolean;
  className?: string;
}> = ({ icon, label, value, highlight, className }) => (
  <div className={cn('flex items-center gap-3', className)}>
    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-[10px] text-white/40 uppercase tracking-wider">{label}</div>
      <div className={cn(
        'text-sm font-medium truncate',
        highlight ? 'text-emerald-400' : 'text-white/90'
      )}>
        {value}
      </div>
    </div>
  </div>
);

// ============================================
// STAR RATING COMPONENT
// ============================================

const StarRating: React.FC<{ rating: number; max?: number }> = ({ rating, max = 5 }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: max }).map((_, i) => (
      <Star
        key={i}
        className={cn(
          'w-3 h-3',
          i < rating ? 'fill-amber-400 text-amber-400' : 'text-white/20'
        )}
      />
    ))}
  </div>
);

// ============================================
// PRICE BADGE COMPONENT
// ============================================

const PriceBadge: React.FC<{
  amount: number;
  label: string;
  currency?: string;
  subtext?: string;
}> = ({ amount, label, currency = 'USD', subtext }) => (
  <div className="text-right">
    <div className="text-[10px] text-white/40 uppercase tracking-wider">{label}</div>
    <div className="text-lg font-bold text-white">
      {formatStayPrice(amount, currency)}
    </div>
    {subtext && (
      <div className="text-[11px] text-white/50">{subtext}</div>
    )}
  </div>
);

// ============================================
// AMENITY BADGE COMPONENT
// ============================================

const AmenityBadge: React.FC<{
  icon: React.ReactNode;
  label: string;
  variant?: 'default' | 'highlight';
}> = ({ icon, label, variant = 'default' }) => (
  <span className={cn(
    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
    variant === 'highlight'
      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
      : 'bg-white/[0.05] text-white/70 border border-white/[0.08]'
  )}>
    {icon}
    {label}
  </span>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const StayDetailsCard: React.FC<StayDetailsCardProps> = ({
  capture,
  onCompareClick,
  compact = false,
  className,
}) => {
  const { property, selectedRoom, searchContext, checkoutBreakdown, totalPrice } = capture;
  
  // Format dates
  const dateRange = searchContext?.checkIn && searchContext?.checkOut
    ? formatDateRange(searchContext.checkIn, searchContext.checkOut)
    : 'Dates not available';
  
  // Night count
  const nights = searchContext?.nights || 1;
  const nightsLabel = nights === 1 ? '1 night' : `${nights} nights`;
  
  // Occupancy - always show both guests and rooms for clarity
  const adults = searchContext?.adults || 2;
  const rooms = searchContext?.rooms || 1;
  const guestLabel = adults === 1 ? '1 guest' : `${adults} guests`;
  const roomLabel = rooms === 1 ? '1 room' : `${rooms} rooms`;
  const occupancyLabel = `${guestLabel} • ${roomLabel}`;
  
  // Price to show
  const displayPrice = checkoutBreakdown?.dueTodayCash ?? totalPrice?.amount ?? 0;
  const priceLabel = checkoutBreakdown ? 'Due Today' : totalPrice?.label === 'perNight' ? 'Per Night' : 'Total';
  
  // Per night calculation
  const perNight = selectedRoom?.perNight || (totalPrice?.amount && nights ? Math.round(totalPrice.amount / nights) : undefined);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'relative rounded-2xl overflow-hidden',
        className
      )}
    >
      {/* Gradient border effect */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          padding: '1px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.15), rgba(6, 182, 212, 0.2))',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />

      {/* Card content */}
      <div className="relative bg-[#0A0A0F]/95 backdrop-blur-xl rounded-2xl p-5">
        {/* Inner glow */}
        <div className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-br from-indigo-500/[0.03] via-transparent to-cyan-500/[0.03]" />

        <div className="relative z-10 space-y-5">
          {/* Header: Property info */}
          <div className="flex items-start gap-4">
            {/* Property icon/image placeholder */}
            <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-white/[0.08] flex items-center justify-center">
              <Building2 className="w-7 h-7 text-indigo-400" />
            </div>
            
            <div className="flex-1 min-w-0">
              {/* Property name */}
              <h3 className="text-base font-semibold text-white truncate">
                {property?.propertyName || 'Hotel'}
              </h3>
              
              {/* Star rating + location */}
              <div className="flex items-center gap-2 mt-1">
                {property?.starRating && (
                  <StarRating rating={property.starRating} />
                )}
                {property?.city && (
                  <span className="text-xs text-white/50 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {property.city}
                  </span>
                )}
              </div>
              
              {/* Accommodation type badge */}
              <div className="mt-2">
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider',
                  capture.accommodationType === 'hotel'
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                    : 'bg-violet-500/15 text-violet-300 border border-violet-500/20'
                )}>
                  {capture.accommodationType === 'vacation_rental' ? '5x Vacation Rental' : '10x Hotel'}
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

          {/* Stay details grid */}
          <div className="grid grid-cols-2 gap-4">
            <DetailRow
              icon={<Calendar className="w-4 h-4 text-indigo-400" />}
              label="Dates"
              value={dateRange}
            />
            <DetailRow
              icon={<Bed className="w-4 h-4 text-violet-400" />}
              label="Stay"
              value={nightsLabel}
            />
            <DetailRow
              icon={<Users className="w-4 h-4 text-cyan-400" />}
              label="Guests"
              value={occupancyLabel}
            />
            {perNight && (
              <DetailRow
                icon={<CreditCard className="w-4 h-4 text-emerald-400" />}
                label="Per Night"
                value={formatStayPrice(perNight)}
              />
            )}
          </div>

          {/* Room selection (if available) */}
          {selectedRoom && !compact && (
            <>
              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
              
              <div className="space-y-3">
                <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                  Selected Room
                </div>
                <div className="text-sm text-white/90 font-medium">
                  {selectedRoom.roomName}
                </div>
                
                {/* Amenities/features */}
                <div className="flex flex-wrap gap-2">
                  {selectedRoom.mealPlan && (
                    <AmenityBadge
                      icon={<Coffee className="w-3 h-3" />}
                      label={selectedRoom.mealPlan}
                      variant="highlight"
                    />
                  )}
                  {selectedRoom.isRefundable && (
                    <AmenityBadge
                      icon={<Shield className="w-3 h-3" />}
                      label="Refundable"
                      variant="highlight"
                    />
                  )}
                  {selectedRoom.refundableLabel && !selectedRoom.isRefundable && (
                    <AmenityBadge
                      icon={<Shield className="w-3 h-3" />}
                      label={selectedRoom.refundableLabel}
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Checkout breakdown (if available) */}
          {checkoutBreakdown && !compact && (
            <>
              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
              
              <div className="space-y-3">
                <div className="text-[10px] text-white/40 uppercase tracking-wider font-medium">
                  Checkout Breakdown
                </div>
                
                <div className="space-y-2 text-sm">
                  {/* Room subtotal */}
                  <div className="flex justify-between">
                    <span className="text-white/60">
                      Room {checkoutBreakdown.roomNights ? `(${checkoutBreakdown.roomNights})` : ''}
                    </span>
                    <span className="text-white/90 font-medium">
                      {formatStayPrice(checkoutBreakdown.roomSubtotal)}
                    </span>
                  </div>
                  
                  {/* Taxes & fees */}
                  <div className="flex justify-between">
                    <span className="text-white/60">
                      {checkoutBreakdown.taxesFeesLabel || 'Taxes & fees'}
                    </span>
                    <span className="text-white/90 font-medium">
                      {formatStayPrice(checkoutBreakdown.taxesFees)}
                    </span>
                  </div>
                  
                  {/* Discounts */}
                  {checkoutBreakdown.discounts?.map((discount, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-emerald-400/80">{discount.label}</span>
                      <span className="text-emerald-400 font-medium">
                        -{formatStayPrice(discount.amount)}
                      </span>
                    </div>
                  ))}
                  
                  {/* Credit applied */}
                  {checkoutBreakdown.creditApplied && checkoutBreakdown.creditApplied > 0 && (
                    <div className="flex justify-between">
                      <span className="text-emerald-400/80">Travel credit</span>
                      <span className="text-emerald-400 font-medium">
                        -{formatStayPrice(checkoutBreakdown.creditApplied)}
                      </span>
                    </div>
                  )}
                  
                  {/* Divider */}
                  <div className="h-px bg-white/[0.08] my-1" />
                  
                  {/* Due today */}
                  <div className="flex justify-between items-center">
                    <span className="text-white font-semibold">Due today</span>
                    <span className="text-lg font-bold text-white">
                      {formatStayPrice(checkoutBreakdown.dueTodayCash)}
                    </span>
                  </div>
                  
                  {/* Miles equivalent */}
                  {checkoutBreakdown.dueTodayMiles && (
                    <div className="flex justify-between text-xs">
                      <span className="text-indigo-400/80">or</span>
                      <span className="text-indigo-400 font-medium">
                        {checkoutBreakdown.dueTodayMiles.toLocaleString()} miles
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Summary price (when no breakdown) */}
          {!checkoutBreakdown && (
            <>
              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">
                    {priceLabel}
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {formatStayPrice(displayPrice)}
                  </div>
                  {capture.portalMilesEquivalent && (
                    <div className="text-xs text-indigo-400">
                      or {capture.portalMilesEquivalent.toLocaleString()} miles
                    </div>
                  )}
                </div>
                
                {/* Miles earned preview */}
                <div className="text-right">
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">
                    Miles Earned
                  </div>
                  <div className="flex items-center gap-1 text-indigo-300">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-lg font-bold">
                      {capture.milesEarned?.toLocaleString() || '—'}
                    </span>
                  </div>
                  <div className="text-[10px] text-white/40">
                    ({capture.portalEarnRate}x rate)
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Compare button */}
          {onCompareClick && (
            <>
              <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
              
              <button
                onClick={onCompareClick}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl',
                  'bg-gradient-to-r from-indigo-500/20 to-violet-500/20',
                  'border border-indigo-500/30 hover:border-indigo-500/50',
                  'text-sm font-medium text-white',
                  'transition-all duration-200 hover:scale-[1.02]',
                  'group'
                )}
              >
                <span>Compare on Google Hotels</span>
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default StayDetailsCard;
