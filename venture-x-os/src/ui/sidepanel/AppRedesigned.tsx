// ============================================
// VENTUREXIFY - REDESIGNED UI v4.0
// Home-first design with Chat + Compare tabs
// Intuitive, non-overwhelming user experience
// Now with STAYS (Hotels) support!
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  RefreshCw,
  Check,
  Plane,
  CreditCard,
  Calendar,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ExternalLink,
  Info,
  MessageCircle,
  Building2,
  Hotel,
  MapPin,
  Users,
  Coffee,
  Shield,
  HelpCircle,
} from 'lucide-react';

// Import glass components
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  GlassInput,
  GlassDivider,
  AuroraBackground,
  AskAboutVerdictModule,
  BookingSuccessState,
  type VerdictContext,
} from '../components/glass';
import { FxRateDisplay, FxIndicator } from '../components/glass/FxRateDisplay';
import { GlassProgressRail } from '../components/glass/SegmentedControl';
import { ProgressiveVerdictCard, type VerdictDataProgressive } from '../components/glass/ProgressiveVerdictCard';
import { cn } from '../../lib/utils';

// Import new redesigned components
import {
  ContextStatusChip,
  PasteDetailsModal,
  DEFAULT_STARTER_PROMPTS,
  type BookingContextStatus,
  type StarterPrompt,
  type ManualBookingDetails,
} from '../components/home';

// Import compare components
import { ManualDirectPriceEntry } from '../components/compare';
import { BottomNav, type TabId } from '../components/navigation';

// Import onboarding and settings
import { OnboardingFlow } from '../onboarding/OnboardingFlow';
import { SmartSettings } from '../components/SmartSettings';
import {
  needsOnboarding,
  getUserPrefs,
  type UserPrefs,
} from '../../storage/userPrefs';

// Import core functionality
import {
  sendChatMessage as sendChatViaSupabase,
  searchKnowledge,
  buildRAGContext,
  type SearchResult,
  type ChatContext,
} from '../../knowledge/vectorStore/supabase';
import { isSupabaseConfigured } from '../../config/supabase';
import { simpleCompare } from '../../engine';
import { calculateDoubleDipRecommendation, type DoubleDipRecommendation } from '../../engine/transferPartners';

// ============================================
// TYPES
// ============================================

type FlowStep = 1 | 2 | 3;
type DetectedSite = 'capital-one-portal' | 'capital-one-stays' | 'capital-one-unsupported' | 'google-flights' | 'google-hotels' | 'other' | 'unknown';
type BookingType = 'flight' | 'stay';
type UITabMode = 'cheapest' | 'max_value' | 'easiest';

// Citation source type
interface CitationSource {
  title: string;
  url: string;
  source: string;
  author?: string;
  relevanceScore: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isContextPrompt?: boolean;
  citations?: CitationSource[];
}

interface FlightLeg {
  airlines?: string[];
  departureTime?: string;
  arrivalTime?: string;
  duration?: string;
  stops?: number;
  stopAirports?: string[];
}

interface PortalCapture {
  price: number;
  priceUSD: number;
  currency: string;
  origin?: string;
  destination?: string;
  departDate?: string;
  returnDate?: string;
  cabin?: string;
  outbound?: FlightLeg;
  returnFlight?: FlightLeg;
  airline?: string;
  stops?: number;
}

interface DirectCapture {
  price: number;
  priceUSD: number;
  currency: string;
  siteName: string;
  // Seller info from Google Flights booking page
  sellerType?: 'airline' | 'ota' | 'metasearch' | 'unknown';
  sellerName?: string;
  bookingOptions?: Array<{
    provider: string;
    providerType: 'airline' | 'ota' | 'metasearch' | 'unknown';
    price: number;
    currency: string;
    isLowest: boolean;
  }>;
  lowestPriceProvider?: string;
}

// Stay-specific capture interfaces
interface StayCapture {
  price: number;                        // Raw price in original currency
  priceUSD: number;                     // Price in USD (PRE-credit, the true portal price)
  currency: string;
  propertyName?: string;
  location?: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  guests?: number;
  rooms?: number;
  roomType?: string;
  refundable?: boolean;
  mealPlan?: string;
  milesEquivalent?: number;
  taxesFees?: number;
  perNight?: number;
  stayType?: 'hotel' | 'vacation_rental';
  starRating?: number;                  // Hotel star rating (1-5)
  // Credit tracking - to avoid double-applying
  portalCreditApplied?: number;         // Amount of credit already applied by portal
  creditAlreadyApplied?: boolean;       // TRUE if portal already deducted credit from price
  amountDueAfterCredit?: number;        // Final amount user pays (after credit)
  // Pay at property - additional service fees due at check-in
  payAtProperty?: number;               // Additional service fee due at check-in (resort fee, etc.)
  payAtPropertyLabel?: string;          // Label for the fee
  totalAllIn?: number;                  // Total all-in cost (priceUSD + payAtProperty)
}

interface DirectStayCapture {
  price: number;
  priceUSD: number;
  currency: string;
  siteName: string;
  provider?: string;
  taxesFees?: number;
  perNight?: number;
  confidence?: 'high' | 'medium' | 'low';
}

// ============================================
// CURRENCY CONVERSION
// ============================================

const EXCHANGE_RATES_TO_USD: Record<string, number> = {
  USD: 1.0, AED: 0.2723, SAR: 0.2667, QAR: 0.2747,
  EUR: 1.08, GBP: 1.27, CAD: 0.74, AUD: 0.65, INR: 0.012, JPY: 0.0067,
};

function convertToUSD(amount: number, currency: string): number {
  return amount * (EXCHANGE_RATES_TO_USD[currency.toUpperCase()] || 1.0);
}

// Format cabin class name in title case (e.g., "economy" → "Economy")
function formatCabinClass(cabin?: string): string {
  if (!cabin) return 'Economy';
  return cabin.charAt(0).toUpperCase() + cabin.slice(1).toLowerCase();
}

// Format date consistently with year (e.g., "May 12, 2025")
function formatDateWithYear(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch { return dateStr; }
}

// Format date range (e.g., "May 12–20, 2025")
function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate) return '';
  try {
    const start = new Date(startDate);
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const startDay = start.getDate();
    const startYear = start.getFullYear();
    
    if (!endDate) {
      return `${startMonth} ${startDay}, ${startYear}`;
    }
    
    const end = new Date(endDate);
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    const endDay = end.getDate();
    const endYear = end.getFullYear();
    
    // Same month and year: "May 12–20, 2025"
    if (startMonth === endMonth && startYear === endYear) {
      return `${startMonth} ${startDay}–${endDay}, ${startYear}`;
    }
    // Same year, different months: "May 12 – Jun 5, 2025"
    if (startYear === endYear) {
      return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${startYear}`;
    }
    // Different years: "Dec 28, 2025 – Jan 3, 2026"
    return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${endYear}`;
  } catch { return startDate; }
}

// Format duration consistently (e.g., "4 hr 30 min" instead of "4h 30m")
function formatDuration(duration?: string): string {
  if (!duration) return '';
  // Convert various formats to consistent "X hr Y min" format
  return duration
    .replace(/(\d+)h\s*/gi, '$1 hr ')
    .replace(/(\d+)m(?:in)?\s*/gi, '$1 min')
    .replace(/\s+/g, ' ')
    .trim();
}

// Format time consistently (e.g., "10:15 AM" with space before AM/PM)
function formatTimeConsistent(time?: string): string {
  if (!time) return '--:--';
  // Match time patterns and standardize
  const match = time.match(/(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)?/i);
  if (!match) return time;
  
  let hour = parseInt(match[1], 10);
  const min = match[2];
  let ampm = match[3]?.toUpperCase() || '';
  
  // If no AM/PM provided, determine from hour
  if (!ampm) {
    ampm = hour >= 12 ? 'PM' : 'AM';
  }
  
  // Convert to 12-hour format if needed
  if (hour === 0) {
    hour = 12;
    ampm = 'AM';
  } else if (hour > 12) {
    hour = hour - 12;
  } else if (hour === 12 && !match[3]) {
    ampm = 'PM';
  }
  
  return `${hour}:${min} ${ampm}`;
}

// ============================================
// ANIMATED LOGO (Compact)
// ============================================

const AnimatedLogo: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  return (
    <motion.div
      className={cn(
        sizeClasses,
        'rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-white/10 flex items-center justify-center overflow-hidden'
      )}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <span className="text-white font-bold text-sm relative z-10">VX</span>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20"
        animate={{ x: ['0%', '100%', '0%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />
    </motion.div>
  );
};

// ============================================
// CITATION BADGE - Inline citation marker
// ============================================

const CitationBadge: React.FC<{ number: number; onClick?: () => void }> = ({ number, onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-semibold bg-indigo-500/30 text-indigo-300 rounded-full hover:bg-indigo-500/40 transition-colors ml-0.5 align-super"
  >
    {number}
  </button>
);

// ============================================
// CITATIONS DROPDOWN
// ============================================

const CitationsDropdown: React.FC<{ citations: CitationSource[] }> = ({ citations }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!citations || citations.length === 0) return null;
  
  return (
    <div className="mt-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/60 transition-colors"
      >
        <span>📚</span>
        <span>Show {citations.length} source{citations.length > 1 ? 's' : ''}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          ▼
        </motion.span>
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1.5">
              {citations.map((citation, i) => (
                <div
                  key={i}
                  className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[10px]"
                >
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center bg-indigo-500/20 text-indigo-300 rounded-full text-[8px] font-semibold">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-white/70 font-medium truncate">{citation.title}</div>
                      <div className="text-white/40 truncate">{citation.source}</div>
                      {citation.url && (
                        <a
                          href={citation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 truncate block mt-0.5"
                        >
                          View source →
                        </a>
                      )}
                    </div>
                    <div className="text-white/30">
                      {Math.round(citation.relevanceScore * 100)}% match
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// FORMAT MESSAGE WITH INLINE CITATIONS
// ============================================

const formatMessageWithCitations = (content: string): React.ReactNode => {
  // Match [1], [2], etc. citation markers in text
  const citationRegex = /\[(\d+)\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  
  while ((match = citationRegex.exec(content)) !== null) {
    // Add text before citation
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    // Add citation badge
    parts.push(
      <CitationBadge key={match.index} number={parseInt(match[1], 10)} />
    );
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : content;
};

// ============================================
// MESSAGE BUBBLE (Enhanced for Chat with Citations)
// ============================================

const MessageBubble: React.FC<{
  message: ChatMessage;
  onContextAction?: () => void;
}> = ({ message, onContextAction }) => {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className={cn('mb-3 flex', isUser ? 'justify-end' : 'justify-start')}
    >
      <div className="max-w-[85%]">
        <div
          className={cn(
            'px-4 py-3 rounded-2xl text-sm leading-relaxed',
            'backdrop-blur-md',
            isUser
              ? 'bg-indigo-500/20 border border-indigo-500/30 text-white rounded-br-md'
              : 'bg-white/[0.06] border border-white/[0.10] text-white/90 rounded-bl-md'
          )}
        >
          {isUser ? message.content : formatMessageWithCitations(message.content)}
        </div>
        
        {/* Citations dropdown for assistant messages */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <CitationsDropdown citations={message.citations} />
        )}
        
        {/* Context action prompt */}
        {message.isContextPrompt && onContextAction && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            onClick={onContextAction}
            className="mt-2 px-3 py-1.5 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition-colors"
          >
            📊 Open a booking page to compare prices
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

// ============================================
// CHAT COMPOSER (Enhanced)
// ============================================

const ChatComposer: React.FC<{
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  suggestions?: string[];
}> = ({ value, onChange, onSend, placeholder, suggestions }) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-stretch">
        <div className="flex-1 min-w-0">
          <GlassInput
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Ask about portal, miles, eraser...'}
            className="w-full h-full"
          />
        </div>
        <GlassButton
          variant="primary"
          onClick={onSend}
          disabled={!value.trim()}
          className="px-4 flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </GlassButton>
      </div>
      
      {/* Suggestion chips */}
      {suggestions && suggestions.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {suggestions.map((q) => (
            <button
              key={q}
              onClick={() => onChange(q)}
              className="px-3 py-1.5 text-xs text-white/50 bg-white/[0.04] border border-white/[0.08] rounded-full hover:bg-white/[0.08] hover:text-white/70 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// FLIGHT LEG DISPLAY (from AppPremium.tsx)
// ============================================

const FlightLegDisplay: React.FC<{ leg: FlightLeg; label: string; date?: string }> = ({ leg, label, date }) => {
  return (
    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</span>
        {date && <span className="text-[10px] text-white/30">{date}</span>}
      </div>
      {leg.airlines && leg.airlines.length > 0 && (
        <div className="text-sm font-semibold text-white mb-2">
          {leg.airlines.join(' + ')}
        </div>
      )}
      <div className="flex items-center gap-3">
        <span className="text-base font-bold text-white">{formatTimeConsistent(leg.departureTime)}</span>
        <div className="flex-1 relative h-[2px] bg-white/[0.10] rounded-full">
          {leg.duration && (
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-white/40">
              {formatDuration(leg.duration)}
            </span>
          )}
        </div>
        <span className="text-base font-bold text-white">{formatTimeConsistent(leg.arrivalTime)}</span>
      </div>
      <div className="flex gap-2 mt-2">
        {typeof leg.stops === 'number' && (
          <GlassBadge variant={leg.stops === 0 ? 'success' : 'default'} size="sm">
            {leg.stops === 0 ? 'Nonstop' : `${leg.stops} stop${leg.stops > 1 ? 's' : ''}`}
          </GlassBadge>
        )}
        {leg.stopAirports && leg.stopAirports.length > 0 && (
          <GlassBadge variant="muted" size="sm">
            via {leg.stopAirports.join(', ')}
          </GlassBadge>
        )}
      </div>
    </div>
  );
};

// ============================================
// PORTAL CAPTURE CARD (Full Details - from AppPremium.tsx)
// ============================================

const PortalCaptureCard: React.FC<{
  capture: PortalCapture;
  onConfirm: () => void;
  onRecapture: () => void;
}> = ({ capture, onConfirm, onRecapture }) => {

  // Check if we have detailed flight info
  const hasDetailedInfo = capture.outbound?.airlines && capture.outbound.airlines.length > 0;

  return (
    <GlassCard variant="elevated" className="mb-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
          <Plane className="w-4 h-4 text-indigo-300" />
        </div>
        <span className="font-semibold text-white">Portal Itinerary Captured</span>
      </div>

      {/* Route Header - Only show if we have valid airport codes */}
      {capture.origin && capture.destination ? (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-white">{capture.origin}</span>
            <div className="w-8 h-[2px] bg-white/20 rounded-full relative">
              <Plane className="w-3 h-3 text-white/40 absolute -top-1 left-1/2 -translate-x-1/2" />
            </div>
            <span className="text-2xl font-bold text-white">{capture.destination}</span>
          </div>
          {capture.cabin && (
            <GlassBadge variant="accent" size="md">
              {formatCabinClass(capture.cabin)}
            </GlassBadge>
          )}
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
          <div className="flex items-center gap-2 text-sm text-amber-300">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>Navigate to the review/checkout page to capture flight details</span>
          </div>
        </div>
      )}

      {/* Detailed Flight Info OR Basic Badges */}
      {hasDetailedInfo ? (
        <div className="space-y-2 mb-4">
          {/* Outbound Flight */}
          {capture.outbound && (
            <FlightLegDisplay
              leg={capture.outbound}
              label="Outbound"
              date={formatDateWithYear(capture.departDate)}
            />
          )}
          {/* Return Flight */}
          {capture.returnFlight && capture.returnFlight.airlines && (
            <FlightLegDisplay
              leg={capture.returnFlight}
              label="Return"
              date={formatDateWithYear(capture.returnDate)}
            />
          )}
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap mb-4">
          {capture.departDate && (
            <GlassBadge variant="default" size="md">
              <Calendar className="w-3 h-3" />
              {formatDateRange(capture.departDate, capture.returnDate)}
            </GlassBadge>
          )}
          {capture.airline && (
            <GlassBadge variant="default" size="md">{capture.airline}</GlassBadge>
          )}
          {typeof capture.stops === 'number' && (
            <GlassBadge variant={capture.stops === 0 ? 'success' : 'default'} size="sm">
              {capture.stops === 0 ? 'Nonstop' : `${capture.stops} stop${capture.stops > 1 ? 's' : ''}`}
            </GlassBadge>
          )}
        </div>
      )}

      {/* Divider */}
      <GlassDivider className="my-4" />

      {/* Price */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-white/50 text-sm">Portal Price</span>
        <div className="text-right">
          <span className="text-2xl font-bold text-white">${capture.priceUSD.toLocaleString()}</span>
          {capture.currency !== 'USD' && (
            <div className="text-xs text-white/40">
              ({capture.currency} {capture.price.toLocaleString()})
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <GlassButton variant="primary" className="flex-1" onClick={onConfirm}>
          <Check className="w-4 h-4" />
          Confirm & Compare
        </GlassButton>
        <GlassButton variant="ghost" onClick={onRecapture}>
          <RefreshCw className="w-4 h-4" />
        </GlassButton>
      </div>
    </GlassCard>
  );
};

// ============================================
// STAY PORTAL CAPTURE CARD (NEW - for Hotels)
// ============================================

const StayPortalCaptureCard: React.FC<{
  capture: StayCapture;
  onConfirm: () => void;
  onRecapture: () => void;
}> = ({ capture, onConfirm, onRecapture }) => {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  };

  return (
    <GlassCard variant="elevated" className="mb-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
          <Building2 className="w-4 h-4 text-violet-300" />
        </div>
        <span className="font-semibold text-white">Stay Captured</span>
        <GlassBadge variant="accent" size="sm" className="ml-auto">
          {capture.stayType === 'vacation_rental' ? '🏠 Rental' : '🏨 Hotel'}
        </GlassBadge>
      </div>

      {/* Property Name */}
      <div className="mb-3">
        <h3 className="text-xl font-bold text-white leading-tight">
          {capture.propertyName || 'Hotel'}
        </h3>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {/* Star Rating */}
          {capture.starRating && (
            <div className="flex items-center gap-1 text-amber-400">
              <span className="text-sm">★</span>
              <span className="text-sm font-medium">{capture.starRating} stars</span>
            </div>
          )}
          {/* Location */}
          {capture.location && (
            <div className="flex items-center gap-1 text-sm text-white/60">
              {capture.starRating && <span className="text-white/30">•</span>}
              <MapPin className="w-3.5 h-3.5" />
              <span>{capture.location}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stay Details */}
      <div className="flex flex-wrap gap-2 mb-4">
        {capture.checkIn && capture.checkOut && (
          <GlassBadge variant="default" size="md">
            <Calendar className="w-3 h-3" />
            {formatDate(capture.checkIn)} - {formatDate(capture.checkOut)}
          </GlassBadge>
        )}
        {capture.nights && (
          <GlassBadge variant="default" size="md">
            {capture.nights} night{capture.nights > 1 ? 's' : ''}
          </GlassBadge>
        )}
        {capture.guests && (
          <GlassBadge variant="default" size="md">
            <Users className="w-3 h-3" />
            {capture.guests} guest{capture.guests > 1 ? 's' : ''}
          </GlassBadge>
        )}
        {capture.rooms && capture.rooms > 1 && (
          <GlassBadge variant="default" size="md">
            {capture.rooms} room{capture.rooms > 1 ? 's' : ''}
          </GlassBadge>
        )}
      </div>

      {/* Room Type & Amenities */}
      {(capture.roomType || capture.mealPlan || capture.refundable !== undefined) && (
        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] mb-4 space-y-2">
          {capture.roomType && (
            <div className="text-sm text-white/80">{capture.roomType}</div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {capture.mealPlan && (
              <GlassBadge variant="success" size="sm">
                <Coffee className="w-3 h-3" />
                {capture.mealPlan}
              </GlassBadge>
            )}
            {capture.refundable !== undefined && (
              <GlassBadge variant={capture.refundable ? 'success' : 'muted'} size="sm">
                <Shield className="w-3 h-3" />
                {capture.refundable ? 'Refundable' : 'Non-refundable'}
              </GlassBadge>
            )}
          </div>
        </div>
      )}

      <GlassDivider className="my-4" />

      {/* Pricing - Full Breakdown */}
      <div className="space-y-2 mb-4">
        {/* P1 FIX: Standardized price precision - no decimals for cleaner display */}
        {/* Portal Price (sticker price / subtotal before credit) */}
        <div className="flex justify-between items-center">
          <span className="text-white/50 text-sm">Portal Price</span>
          <div className="text-right">
            <span className="text-2xl font-bold text-white">${capture.priceUSD.toLocaleString()}</span>
            {capture.currency !== 'USD' && (
              <div className="text-xs text-white/40">
                ({capture.currency} {capture.price.toLocaleString()})
              </div>
            )}
          </div>
        </div>
        
        {capture.perNight && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-white/40">Per night</span>
            <span className="text-white/60">${capture.perNight.toLocaleString()}</span>
          </div>
        )}
        
        {capture.taxesFees && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-white/40">Taxes & fees (included)</span>
            <span className="text-white/60">${capture.taxesFees.toLocaleString()}</span>
          </div>
        )}
        
        {/* Credit Applied (if any) */}
        {capture.portalCreditApplied && capture.portalCreditApplied > 0 && (
          <div className="flex justify-between items-center text-sm text-emerald-400">
            <span>Travel credit applied</span>
            <span>-${capture.portalCreditApplied.toLocaleString()}</span>
          </div>
        )}
        
        {/* Pay Today (after credit) - THE KEY NUMBER */}
        {capture.creditAlreadyApplied && capture.amountDueAfterCredit && (
          <div className="flex justify-between items-center pt-2 border-t border-white/[0.06]">
            <span className="text-white/80 text-sm font-medium">Pay today</span>
            <span className="text-lg font-bold text-white">${capture.amountDueAfterCredit.toLocaleString()}</span>
          </div>
        )}
        
        {/* Pay at Property (additional service fee) */}
        {capture.payAtProperty && capture.payAtProperty > 0 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-amber-400/80">
              {capture.payAtPropertyLabel || 'Due at property'}
            </span>
            <span className="text-amber-400 font-medium">+${capture.payAtProperty.toLocaleString()}</span>
          </div>
        )}
        
        {/* All-In Total (if pay at property exists) */}
        {capture.totalAllIn && capture.payAtProperty && capture.payAtProperty > 0 && (
          <div className="flex justify-between items-center text-sm pt-1">
            <span className="text-white/40">All-in total</span>
            <span className="text-white/60">${capture.totalAllIn.toLocaleString()}</span>
          </div>
        )}
        
        {/* Miles Equivalent */}
        {capture.milesEquivalent && (
          <div className="flex justify-between items-center text-sm pt-2 border-t border-white/[0.06]">
            <span className="text-indigo-300/80">Or pay with miles</span>
            <span className="text-indigo-300 font-medium">
              {capture.milesEquivalent.toLocaleString()} miles
            </span>
          </div>
        )}
      </div>

      {/* Earn rate info */}
      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-4">
        <div className="flex items-center gap-2 text-xs text-emerald-300">
          <span>🎯</span>
          <span>
            Earn <strong>{capture.stayType === 'vacation_rental' ? '5x' : '10x'}</strong> miles on this booking
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <GlassButton variant="primary" className="flex-1" onClick={onConfirm}>
          <Check className="w-4 h-4" />
          Compare Direct
        </GlassButton>
        <GlassButton variant="ghost" onClick={onRecapture}>
          <RefreshCw className="w-4 h-4" />
        </GlassButton>
      </div>
    </GlassCard>
  );
};

// ============================================
// STAY DIRECT CAPTURE CARD (NEW - for Google Hotels)
// ============================================

const StayDirectCaptureCard: React.FC<{
  capture: DirectStayCapture;
  portalPriceUSD: number;
  onConfirm: () => void;
  onRecapture: () => void;
}> = ({ capture, portalPriceUSD, onConfirm, onRecapture }) => {
  const savings = portalPriceUSD - capture.priceUSD;
  const isDirectCheaper = savings > 0;

  return (
    <GlassCard variant="elevated" className="mb-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
          <Hotel className="w-4 h-4 text-emerald-300" />
        </div>
        <span className="font-semibold text-white">Direct Price Found</span>
        <GlassBadge variant="muted" size="sm" className="ml-auto">{capture.siteName}</GlassBadge>
      </div>

      {/* Provider info */}
      {capture.provider && (
        <div className="text-sm text-white/60 mb-3">via {capture.provider}</div>
      )}

      <div className="text-center mb-4">
        <span className="text-3xl font-bold text-white">${capture.priceUSD.toLocaleString()}</span>
        {capture.currency !== 'USD' && (
          <div className="text-xs text-white/40">
            ({capture.currency} {capture.price.toLocaleString()})
          </div>
        )}
      </div>

      {/* Price breakdown */}
      {(capture.perNight || capture.taxesFees) && (
        <div className="p-2 rounded-lg bg-white/[0.03] text-xs text-white/50 mb-3 space-y-1">
          {capture.perNight && (
            <div className="flex justify-between">
              <span>Per night</span>
              <span>${capture.perNight.toLocaleString()}</span>
            </div>
          )}
          {capture.taxesFees && (
            <div className="flex justify-between">
              <span>Taxes & fees</span>
              <span>${capture.taxesFees.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Confidence indicator */}
      {capture.confidence && capture.confidence !== 'high' && (
        <div className={cn(
          'p-2 rounded-lg text-xs mb-3',
          capture.confidence === 'low'
            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
            : 'bg-white/[0.04] text-white/50'
        )}>
          <div className="flex items-center gap-1.5">
            <Info className="w-3 h-3" />
            <span>
              {capture.confidence === 'low'
                ? 'Low match confidence - verify this is the same hotel'
                : 'Medium confidence match'}
            </span>
          </div>
        </div>
      )}

      <div className="p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] mb-4">
        <div className="flex justify-between items-center">
          <span className="text-white/50 text-sm">vs Portal Price</span>
          <span className={cn('text-base font-semibold', isDirectCheaper ? 'text-emerald-400' : 'text-red-400')}>
            {isDirectCheaper ? (
              <>
                <TrendingDown className="w-4 h-4 inline mr-1" />
                Save ${savings.toLocaleString()}
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4 inline mr-1" />
                ${Math.abs(savings).toLocaleString()} more
              </>
            )}
          </span>
        </div>
      </div>

      {/* Earn rate comparison */}
      <div className="p-2 rounded-lg bg-white/[0.03] text-[10px] text-white/40 mb-4">
        Portal: 10x miles • Direct: 2x miles
      </div>

      <div className="flex gap-2">
        <GlassButton variant="primary" className="flex-1" onClick={onConfirm}>
          <Check className="w-4 h-4" />
          See Verdict
        </GlassButton>
        <GlassButton variant="ghost" onClick={onRecapture}>
          <RefreshCw className="w-4 h-4" />
        </GlassButton>
      </div>
    </GlassCard>
  );
};

// ============================================
// DIRECT CAPTURE CARD (with FX rate display - from AppPremium.tsx)
// ============================================

const DirectCaptureCard: React.FC<{
  capture: DirectCapture;
  portalPriceUSD: number;
  portalCapture?: PortalCapture;  // For flight mismatch detection
  onConfirm: () => void;
  onRecapture: () => void;
  onFindCorrectFlight?: () => void;  // Callback when user wants to find a different flight
}> = ({ capture, portalPriceUSD, portalCapture, onConfirm, onRecapture, onFindCorrectFlight }) => {
  const savings = portalPriceUSD - capture.priceUSD;
  const isDirectCheaper = savings > 0;
  
  // Calculate exchange rate for display
  const exchangeRate = capture.currency !== 'USD' && capture.price > 0
    ? (capture.price / capture.priceUSD).toFixed(4)
    : null;
  
  // Detect flight mismatch if we're on Google Flights
  const [flightMismatches, setFlightMismatches] = React.useState<Array<{
    type: string;
    message: string;
    portalValue: string;
    googleValue: string;
  }> | null>(null);
  
  React.useEffect(() => {
    const checkFlightMatch = async () => {
      // Check if we're on Google Flights - siteName might be "Google Flights", "www.google.com", etc.
      const isOnGoogleFlights = capture.siteName &&
        (capture.siteName.toLowerCase().includes('google') ||
         capture.siteName.toLowerCase().includes('flight'));
      
      console.log('[DirectCaptureCard] 🔍 Checking flight match...', {
        siteName: capture.siteName,
        isOnGoogleFlights,
        hasPortalCapture: !!portalCapture,
      });
      
      if (!portalCapture || !isOnGoogleFlights) {
        console.log('[DirectCaptureCard] ❌ Skipping mismatch check - missing portalCapture or not on Google Flights');
        setFlightMismatches(null);
        return;
      }
      
      try {
        // Get current tab URL
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url || !tab?.id) {
          console.log('[DirectCaptureCard] ❌ No tab URL or ID found');
          return;
        }
        
        console.log('[DirectCaptureCard] 📍 Tab URL:', tab.url.substring(0, 100));
        
        // Import the parser dynamically
        const { detectFlightMismatch } = await import('../../lib/googleFlightsParser');
        
        // Build a complete portal flight object including all airlines from both legs
        const portalFlightForComparison = {
          origin: portalCapture.origin,
          destination: portalCapture.destination,
          departDate: portalCapture.departDate,
          returnDate: portalCapture.returnDate,
          airline: portalCapture.airline,
          // Include ALL airlines from both outbound and return legs
          airlines: [
            ...(portalCapture.outbound?.airlines || []),
            ...(portalCapture.returnFlight?.airlines || []),
            ...(portalCapture.airline ? [portalCapture.airline] : []),
          ].filter((a, i, arr) => arr.indexOf(a) === i), // Remove duplicates
          stops: portalCapture.stops,
          outbound: portalCapture.outbound,
          returnFlight: portalCapture.returnFlight,
        };
        
        console.log('[DirectCaptureCard] 📋 Portal flight for comparison:', {
          origin: portalFlightForComparison.origin,
          destination: portalFlightForComparison.destination,
          airlines: portalFlightForComparison.airlines,
          outboundAirlines: portalCapture.outbound?.airlines,
          returnAirlines: portalCapture.returnFlight?.airlines,
          singleAirline: portalCapture.airline,
          outboundDepartureTime: portalCapture.outbound?.departureTime,
          outboundArrivalTime: portalCapture.outbound?.arrivalTime,
          returnDepartureTime: portalCapture.returnFlight?.departureTime,
          returnArrivalTime: portalCapture.returnFlight?.arrivalTime,
        });
        
        // Request flight times from the Google Flights DOM via content script
        let googleDOMTimes: {
          outbound?: { departureTime?: string; arrivalTime?: string; duration?: string; stops?: number };
          returnFlight?: { departureTime?: string; arrivalTime?: string; duration?: string; stops?: number };
        } | undefined;
        
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_GOOGLE_FLIGHT_TIMES' });
          if (response?.success && response?.times) {
            googleDOMTimes = response.times;
            console.log('[DirectCaptureCard] 📋 Google DOM times received:', googleDOMTimes);
          }
        } catch (timeErr) {
          console.log('[DirectCaptureCard] ⚠️ Could not get DOM times (content script may not be loaded):', timeErr);
        }
        
        const mismatches = detectFlightMismatch(portalFlightForComparison, tab.url, googleDOMTimes);
        setFlightMismatches(mismatches);
        
        if (mismatches && mismatches.length > 0) {
          console.log('[DirectCaptureCard] ⚠️ Flight mismatch detected:', mismatches);
        } else {
          console.log('[DirectCaptureCard] ✅ No mismatches found (or parsing failed)');
        }
      } catch (e) {
        console.error('[DirectCaptureCard] Error checking flight match:', e);
      }
    };
    
    checkFlightMatch();
    // IMPORTANT: Include capture.priceUSD in dependencies so mismatch detection
    // re-runs when user navigates back and selects a different flight
    // (the price changes but siteName stays the same)
  }, [portalCapture, capture.siteName, capture.priceUSD]);

  return (
    <GlassCard variant="elevated" className="mb-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
          <CreditCard className="w-4 h-4 text-emerald-300" />
        </div>
        <span className="font-semibold text-white">Direct Price Captured</span>
        <GlassBadge variant="muted" size="sm" className="ml-auto">{capture.siteName}</GlassBadge>
      </div>

      <div className="text-center mb-4">
        <span className="text-3xl font-bold text-white">${capture.priceUSD.toLocaleString()}</span>
        {capture.currency !== 'USD' && (
          <div className="space-y-1.5">
            <div className="text-xs text-white/40">
              ({capture.currency} {capture.price.toLocaleString()})
            </div>
            {/* UX FIX P0-3: Enhanced FX rate display with source and sensitivity */}
            <div className="flex justify-center">
              <FxIndicator
                fromCurrency={capture.currency}
                originalAmount={capture.price}
                convertedAmountUSD={capture.priceUSD}
              />
            </div>
          </div>
        )}
      </div>

      {/* Flight Mismatch Warning */}
      {flightMismatches && flightMismatches.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30"
        >
          <div className="flex items-start gap-2 mb-2">
            <span className="text-lg flex-shrink-0">⚠️</span>
            <div>
              <div className="text-sm font-semibold text-amber-300 mb-1">
                Different Flight Detected
              </div>
              <div className="text-xs text-amber-200/80 mb-2">
                This flight doesn't match the one you selected on Capital One Travel:
              </div>
              <div className="space-y-1.5">
                {flightMismatches.map((mismatch, i) => (
                  <div key={i} className="text-xs text-white/70 bg-white/[0.04] p-2 rounded">
                    <div className="font-medium text-amber-200 mb-0.5">{mismatch.message}</div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className="text-white/50">Portal:</span>
                      <span className="text-white/80">{mismatch.portalValue}</span>
                      <span className="text-white/30">→</span>
                      <span className="text-white/50">Google:</span>
                      <span className="text-white/80">{mismatch.googleValue}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t border-amber-500/20">
                <div className="text-xs text-amber-200/80 mb-2">
                  💡 Make sure you're comparing the exact same flight to get an accurate comparison.
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      // Go back to Google Flights search with proper route/dates
                      // The booking page tfs parameter has flight-specific data that won't work for search
                      // So we build a fresh search URL from the portal capture data
                      if (typeof chrome !== 'undefined' && chrome.tabs && portalCapture) {
                        const origin = portalCapture.origin || '';
                        const dest = portalCapture.destination || '';
                        const departDate = portalCapture.departDate || '';
                        const returnDate = portalCapture.returnDate || '';
                        
                        // Build a search query similar to handleConfirmPortal
                        let searchQuery = `flights from ${origin} to ${dest}`;
                        if (departDate) searchQuery += ` on ${departDate}`;
                        if (returnDate) searchQuery += ` returning ${returnDate}`;
                        
                        const searchUrl = `https://www.google.com/travel/flights?q=${encodeURIComponent(searchQuery)}`;
                        console.log('[DirectCaptureCard] Navigating back to search:', searchUrl);
                        chrome.tabs.update({ url: searchUrl });
                        
                        // Go back to step 1 to show the captured portal booking info
                        if (onFindCorrectFlight) {
                          onFindCorrectFlight();
                        }
                      }
                    }}
                    className="px-3 py-1.5 text-xs bg-white/[0.08] hover:bg-white/[0.12] border border-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
                  >
                    ← Find the correct flight
                  </button>
                  <span className="text-[10px] text-amber-200/50 self-center">or</span>
                  <span className="text-[10px] text-white/50 self-center">proceed with "See Verdict" anyway</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="p-3 rounded-lg bg-white/[0.04] border border-white/[0.08] mb-4">
        <div className="flex justify-between items-center">
          <span className="text-white/50 text-sm">vs Portal Price</span>
          <span className={cn('text-base font-semibold', isDirectCheaper ? 'text-emerald-400' : 'text-red-400')}>
            {isDirectCheaper ? (
              <>
                <TrendingDown className="w-4 h-4 inline mr-1" />
                Save ${savings.toLocaleString()}
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4 inline mr-1" />
                ${Math.abs(savings).toLocaleString()} more
              </>
            )}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <GlassButton variant="primary" className="flex-1" onClick={onConfirm}>
          <Check className="w-4 h-4" />
          See Verdict
        </GlassButton>
        <GlassButton variant="ghost" onClick={onRecapture}>
          <RefreshCw className="w-4 h-4" />
        </GlassButton>
      </div>
    </GlassCard>
  );
};

// ============================================
// Award data from transfer partner search
// ============================================
interface AwardData {
  program: string;
  miles: number;
  taxes: number;
  taxesEstimated?: boolean;
  cpp: number;
}

type MaxValuePhase = 'ask' | 'searching' | 'input' | 'verdict';

// Capital One transfer partners
const TRANSFER_PARTNERS = [
  { code: 'TK', name: 'Turkish Miles&Smiles' },
  { code: 'EY', name: 'Etihad Guest' },
  { code: 'EK', name: 'Emirates Skywards' },
  { code: 'AV', name: 'Avianca LifeMiles' },
  { code: 'AF', name: 'Air France/KLM' },
  { code: 'BA', name: 'British Airways' },
  { code: 'SQ', name: 'Singapore KrisFlyer' },
  { code: 'QF', name: 'Qantas' },
];

// ============================================
// VERDICT SECTION (Full Featured with PointsYeah - from AppPremium.tsx)
// Now includes Portal + Eraser double-dip strategy display
// ============================================

const VerdictSection: React.FC<{
  portalPriceUSD: number;
  directPriceUSD: number;
  creditRemaining?: number;
  milesBalance?: number; // User's current miles balance for double-dip calculation
  mileValueCpp?: number; // User's mile valuation in cpp (e.g., 0.018 = 1.8¢)
  itinerary?: {
    origin?: string;
    destination?: string;
    departDate?: string;
    returnDate?: string;
    cabin?: string;
  };
  tabMode?: UITabMode;
  onTabModeChange?: (mode: UITabMode) => void;
  bookingType?: 'flight' | 'hotel' | 'vacation_rental';
  // Additional props for enhanced UX per critique
  // NEW-8: Added 'airline' for flight bookings on Google Flights
  sellerType?: 'airline' | 'hotel_direct' | 'ota' | 'metasearch' | 'unknown';
  sellerName?: string;
  hasFxConversion?: boolean;
  fxCurrency?: string;
  // Callback to open settings (for "Tap to change" on assumptions)
  onOpenSettings?: () => void;
  // P2-21: Callback when user clicks "Continue to Portal/Direct" - triggers success celebration
  onVerdictContinue?: (recommendation: 'portal' | 'direct', savings?: number) => void;
}> = ({ portalPriceUSD, directPriceUSD, creditRemaining: initialCreditRemaining = 300, milesBalance = 0, mileValueCpp: userMileValueCpp = 0.015, itinerary, tabMode: controlledTabMode, onTabModeChange, bookingType = 'flight', sellerType = 'unknown', sellerName, hasFxConversion = false, fxCurrency, onOpenSettings, onVerdictContinue }) => {
  // Use controlled mode if provided, otherwise local state
  const [localTabMode, setLocalTabMode] = useState<UITabMode>('cheapest');
  const tabMode = controlledTabMode ?? localTabMode;
  const setTabMode = onTabModeChange ?? setLocalTabMode;
  const [applyTravelCredit, setApplyTravelCredit] = useState(true);
  const [showDoubleDipStrategy, setShowDoubleDipStrategy] = useState(true);
  
  // Mile value sensitivity control - initialize from user preference prop (default 1.5¢ conservative)
  const [mileValueCpp, setMileValueCpp] = useState(userMileValueCpp);
  const MILE_VALUE_PRESETS = [
    { value: 0.010, label: '1.0¢' },
    { value: 0.015, label: '1.5¢' },
    { value: 0.018, label: '1.8¢' },
    { value: 0.020, label: '2.0¢' },
  ];
  
  // Max Value flow state
  const [maxValuePhase, setMaxValuePhase] = useState<MaxValuePhase>('ask');
  const [awardData, setAwardData] = useState<AwardData | null>(null);
  const [selectedProgram, setSelectedProgram] = useState('');
  const [milesInput, setMilesInput] = useState('');
  const [taxesInput, setTaxesInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [awardBaseline, setAwardBaseline] = useState<'portal_with_credit' | 'portal_no_credit' | 'direct'>('portal_with_credit');
  
  // Credit toggle - determines effective credit
  const creditRemaining = applyTravelCredit ? initialCreditRemaining : 0;
  
  // Reset max value phase when switching tabs
  useEffect(() => {
    if (tabMode !== 'max_value') {
      setMaxValuePhase('ask');
      setAwardData(null);
    }
  }, [tabMode]);
  
  // Map UI tab mode to engine objective
  const engineObjective = tabMode === 'cheapest' ? 'cheapest_cash'
    : tabMode === 'easiest' ? 'easiest'
    : 'max_value';
  
  // Calculate the double-dip recommendation (Portal + Eraser strategy)
  const doubleDipRec = calculateDoubleDipRecommendation(
    portalPriceUSD,
    directPriceUSD,
    creditRemaining,
    milesBalance,
    mileValueCpp
  );
  
  const comparison = simpleCompare({
    portalPriceUSD,
    directPriceUSD,
    creditRemaining,
    mileValuationCpp: mileValueCpp, // Use dynamic user preference (default 1.5¢/mi conservative)
    objective: engineObjective,
    // CRITICAL: Pass booking type for correct earn rate (10x hotels, 5x flights/rentals)
    bookingType: bookingType === 'vacation_rental' ? 'vacation_rental'
               : bookingType === 'hotel' ? 'hotel'
               : 'flight',
  });

  const portalOOP = comparison.portalDetails.outOfPocket;
  const directOOP = comparison.directDetails.outOfPocket;
  const milesDiff = comparison.portalDetails.milesEarned - comparison.directDetails.milesEarned;
  
  // ============================================
  // CLOSE-CALL DETECTION
  // Per UX critique: When prices are within a small band,
  // users expect "basically the same" — not a hard "WINNER"
  // ============================================
  const CLOSE_CALL_THRESHOLD_ABS = 25; // $25
  const CLOSE_CALL_THRESHOLD_PERCENT = 2; // 2%
  
  const outOfPocketDiffAbs = Math.abs(portalOOP - directOOP);
  const outOfPocketDiffPercent = Math.min(portalOOP, directOOP) > 0
    ? (outOfPocketDiffAbs / Math.min(portalOOP, directOOP)) * 100
    : 0;
  
  const isCloseCall = outOfPocketDiffAbs <= CLOSE_CALL_THRESHOLD_ABS ||
                      outOfPocketDiffPercent <= CLOSE_CALL_THRESHOLD_PERCENT;
  
  // If FX is involved, widen the threshold (more uncertainty)
  const isCloseCallWithFx = hasFxConversion
    ? (outOfPocketDiffAbs <= CLOSE_CALL_THRESHOLD_ABS * 1.5 || outOfPocketDiffPercent <= CLOSE_CALL_THRESHOLD_PERCENT * 1.5)
    : isCloseCall;
  
  const closeCallReason = isCloseCallWithFx
    ? hasFxConversion
      ? `Within $${CLOSE_CALL_THRESHOLD_ABS} or ${CLOSE_CALL_THRESHOLD_PERCENT}% (adjusted for FX uncertainty). Choose based on cancellation policy or support quality.`
      : `Within $${CLOSE_CALL_THRESHOLD_ABS} or ${CLOSE_CALL_THRESHOLD_PERCENT}%. Choose based on cancellation policy, support quality, or personal preference.`
    : undefined;

  // Tab definitions with descriptions and detailed tooltips - NOW CONTEXT-AWARE
  const tabDefs = [
    {
      mode: 'cheapest' as UITabMode,
      label: 'Cheapest',
      emoji: '💵',
      description: 'Lowest out-of-pocket today (after credits)',
      tooltip: 'Minimizes cash you pay today. Good when you want the lowest immediate cost, regardless of miles earned.',
    },
    {
      mode: 'max_value' as UITabMode,
      label: 'Max Value',
      emoji: '📈',
      description: 'Lowest effective cost after valuing points earned/spent',
      tooltip: 'Best value after subtracting the estimated worth of miles you\'ll earn (at your mile valuation, default 1.5¢). Higher upfront cost can be worth it if you\'ll earn significantly more miles. Adjust mile value in Settings.',
    },
    {
      mode: 'easiest' as UITabMode,
      label: 'Easiest',
      emoji: '✨',
      description: 'Lowest friction (even if it costs a bit more)',
      // Context-aware tooltip based on booking type (hotels vs flights)
      tooltip: bookingType === 'hotel' || bookingType === 'vacation_rental'
        ? 'Prioritizes convenience: easier changes/cancellations, direct hotel support, keeping hotel loyalty status & elite nights. Direct booking usually wins unless portal is significantly cheaper.'
        : 'Prioritizes convenience: easier changes/cancellations, direct airline support for delays & cancellations, keeping loyalty status. Direct booking usually wins unless portal is significantly cheaper.',
    },
  ];

  // Calculate effective costs for Max Value mode - use user's preference or 1.5¢ default
  const MILES_VALUE_CPP = mileValueCpp || 0.015; // Use user preference or 1.5¢/mi conservative default
  const portalEffectiveCost = (portalPriceUSD - creditRemaining) - (comparison.portalDetails.milesEarned * MILES_VALUE_CPP);
  const directEffectiveCost = directPriceUSD - (comparison.directDetails.milesEarned * MILES_VALUE_CPP);

  // Build PointsYeah URL
  const buildPointsYeahUrl = () => {
    if (!itinerary?.origin || !itinerary?.destination || !itinerary?.departDate) return '';
    const tripType = itinerary.returnDate ? '2' : '1';
    const capitalOnePartners = 'AR,AC,AV,EK,EY,AY,B6,QF,SQ,TK,VS,VA';
    
    const params = new URLSearchParams({
      cabins: '',
      banks: 'Capital One',
      airlineProgram: capitalOnePartners,
      tripType,
      adults: '1',
      children: '0',
      departure: itinerary.origin,
      arrival: itinerary.destination,
      departDate: itinerary.departDate,
      departDateSec: itinerary.departDate,
      multiday: 'false',
    });
    
    if (itinerary.returnDate) {
      params.set('returnDate', itinerary.returnDate);
      params.set('returnDateSec', itinerary.returnDate);
    }
    
    return `https://www.pointsyeah.com/search?${params.toString()}`;
  };

  const handleSearchPointsYeah = () => {
    const url = buildPointsYeahUrl();
    if (url) {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({ url });
      } else {
        window.open(url, '_blank');
      }
    }
    setMaxValuePhase('searching');
  };

  const handleCalculateAward = () => {
    const miles = parseInt(milesInput.replace(/,/g, ''), 10);
    const taxesRaw = taxesInput.replace(/[^0-9.]/g, '').trim();
    
    // Smart default for taxes
    const estimatedTaxes = Math.min(150, Math.max(75, portalPriceUSD * 0.10));
    const parsedTaxes = parseFloat(taxesRaw);
    const hasValidTaxInput = taxesRaw.length > 0 && !isNaN(parsedTaxes) && parsedTaxes >= 0;
    const taxes = hasValidTaxInput ? parsedTaxes : estimatedTaxes;
    const taxesWereEstimated = !hasValidTaxInput;
    
    if (!selectedProgram) {
      setInputError('Please select a program');
      return;
    }
    if (isNaN(miles) || miles < 1000) {
      setInputError('Please enter valid miles (at least 1,000)');
      return;
    }
    
    setInputError(null);
    
    // Calculate CPP based on selected baseline
    let cashAvoided: number;
    switch (awardBaseline) {
      case 'portal_with_credit':
        cashAvoided = Math.max(0, portalPriceUSD - creditRemaining);
        break;
      case 'portal_no_credit':
        cashAvoided = portalPriceUSD;
        break;
      case 'direct':
        cashAvoided = directPriceUSD;
        break;
    }
    
    const cpp = cashAvoided > 0 && miles > 0
      ? ((cashAvoided - taxes) / miles) * 100
      : 0;
    
    setAwardData({
      program: selectedProgram,
      miles,
      taxes: Math.round(taxes),
      taxesEstimated: taxesWereEstimated,
      cpp: Math.max(0, cpp),
    });
    setMaxValuePhase('verdict');
  };

  // 3-way comparison if award data exists
  let finalWinner: 'portal' | 'direct' | 'award' = comparison.recommendation as 'portal' | 'direct';
  let awardOOP = 0;
  
  if (awardData && tabMode === 'max_value') {
    awardOOP = awardData.taxes;
    const MILES_VALUE = 0.015;
    const portalNetCost = portalOOP - (comparison.portalDetails.milesEarned * MILES_VALUE);
    const directNetCost = directOOP - (comparison.directDetails.milesEarned * MILES_VALUE);
    const awardNetCost = awardData.taxes + (awardData.miles * MILES_VALUE);
    
    if (awardNetCost < portalNetCost && awardNetCost < directNetCost) {
      finalWinner = 'award';
    } else if (portalNetCost < directNetCost) {
      finalWinner = 'portal';
    } else {
      finalWinner = 'direct';
    }
  }
  
  const isPortal = finalWinner === 'portal';
  const isAward = finalWinner === 'award';
  const outOfPocketDiff = Math.abs(portalOOP - directOOP);

  // ============================================
  // Build comprehensive why bullets (max 3)
  // ============================================
  const whyBullets: VerdictDataProgressive['whyBullets'] = [];
  
  if (isAward && awardData) {
    // Award-specific bullets
    const taxLabel = awardData.taxesEstimated
      ? `~$${awardData.taxes} est. taxes`
      : `$${awardData.taxes} in taxes`;
    whyBullets.push({
      icon: '💰',
      text: `Pay only ${taxLabel} + ${awardData.miles.toLocaleString()} miles`,
    });
    if (awardData.cpp >= 1.5) {
      whyBullets.push({
        icon: '✈️',
        text: `${awardData.cpp >= 2.0 ? 'Excellent' : 'Good'} redemption at ${awardData.cpp.toFixed(2)}¢/mile`,
      });
    } else if (awardData.cpp >= 1.0) {
      whyBullets.push({
        icon: '📊',
        text: `Decent value at ${awardData.cpp.toFixed(2)}¢/mi (≥1¢ Travel Eraser baseline)`,
      });
    } else {
      whyBullets.push({
        icon: '⚠️',
        text: `Low value: ${awardData.cpp.toFixed(2)}¢/mi (below 1¢ Travel Eraser baseline)`,
      });
    }
    whyBullets.push({
      icon: '💡',
      text: `Transfer to ${awardData.program} (allow up to 48hrs)`,
    });
  } else if (awardData && !isAward) {
    if (awardData.cpp < 1.0) {
      whyBullets.push({
        icon: '⚠️',
        text: `Award skipped: ${awardData.cpp.toFixed(2)}¢/mi is below Travel Eraser (1¢/mi)`,
      });
    }
  }
  
  if (!isAward) {
    // For "easiest" tab: Focus on friction/convenience, NOT price
    // Showing "Portal is cheaper" when recommending Direct is contradictory
    if (tabMode === 'easiest') {
      // Context-aware messaging for hotels vs flights
      const isStayBooking = bookingType === 'hotel' || bookingType === 'vacation_rental';
      
      // Primary bullet: Why the winner is easiest
      whyBullets.push({
        icon: '💡',
        text: isPortal
          ? isStayBooking
            ? 'Portal manages the booking end-to-end, but may not earn hotel loyalty'
            : 'Portal manages the booking end-to-end, single point of contact'
          : isStayBooking
            ? 'Direct: easier modifications, special requests, hotel loyalty/elite nights'
            : 'Direct: changes handled by airline, easier during delays & cancellations',
      });
      
      // Secondary bullet: Acknowledge price difference if significant (but frame it correctly)
      if (outOfPocketDiff > 20) {
        const portalCheaper = portalOOP < directOOP;
        if ((isPortal && portalCheaper) || (!isPortal && !portalCheaper)) {
          // Winner is also cheaper - great!
          whyBullets.push({
            icon: '💰',
            text: `Also saves $${outOfPocketDiff.toFixed(2)} vs the alternative`,
          });
        } else {
          // Winner costs more - acknowledge the tradeoff
          whyBullets.push({
            icon: '💡',
            text: isPortal
              ? `Costs $${outOfPocketDiff.toFixed(2)} more, but easier booking experience`
              : `Costs $${outOfPocketDiff.toFixed(2)} more, but better flexibility for changes`,
          });
        }
      }
    } else {
      // For "cheapest" and "max_value" tabs: Price is the focus
      if (comparison.portalDetails.creditApplied > 0 && isPortal) {
        whyBullets.push({
          icon: '💰',
          text: `Pay today: $${portalOOP.toFixed(2)} (after $${comparison.portalDetails.creditApplied.toFixed(2)} credit) vs $${directOOP.toFixed(2)} direct`,
        });
      } else if (outOfPocketDiff > 5) {
        const cheaper = portalOOP < directOOP ? 'Portal' : 'Direct';
        whyBullets.push({
          icon: '💰',
          text: `${cheaper} is $${outOfPocketDiff.toFixed(2)} cheaper out of pocket`,
        });
      }
      
      if (Math.abs(milesDiff) > 100) {
        const milesWinner = milesDiff > 0 ? 'Portal' : 'Direct';
        whyBullets.push({
          icon: '✈️',
          text: `${milesWinner} earns ${Math.abs(milesDiff).toLocaleString()} more miles`,
        });
      }
      
      if (comparison.confidence !== 'high' && comparison.confidenceReasons?.length) {
        whyBullets.push({
          icon: '⚠️',
          text: comparison.confidenceReasons[0],
        });
      }
    }
  }
  
  // Ensure at least one bullet
  if (whyBullets.length === 0) {
    const isStayBooking = bookingType === 'hotel' || bookingType === 'vacation_rental';
    whyBullets.push({
      icon: '💡',
      text: isPortal
        ? `Portal gives ${isStayBooking ? (bookingType === 'hotel' ? '10x' : '5x') : '5x'} miles on $${portalPriceUSD.toFixed(2)} purchase`
        : isStayBooking
          ? 'Direct offers better flexibility for modifications'
          : 'Direct may offer better flexibility with airline',
    });
  }

  // ============================================
  // Build friction level
  // ============================================
  const getFrictionLevel = (): { level: 'low' | 'medium' | 'high'; tooltip: string } => {
    const isStayBooking = bookingType === 'hotel' || bookingType === 'vacation_rental';
    if (isAward) {
      return {
        level: 'high',
        tooltip: 'Transfer is usually irreversible + availability can change. Allow up to 48hrs for transfer.',
      };
    }
    if (isPortal) {
      return {
        level: 'medium',
        tooltip: isStayBooking
          ? 'Portal booking + credit. Changes/cancellations may need to go through the portal. May not earn hotel loyalty points.'
          : 'Portal booking + credit. Easy, but changes/support can be slower than booking direct.',
      };
    }
    return {
      level: 'low',
      tooltip: isStayBooking
        ? 'Direct hotel booking. Easier modifications, special requests, upgrades. Earn hotel loyalty/elite nights.'
        : 'Direct booking. Changes handled by airline, easiest during delays & cancellations.',
    };
  };

  // ============================================
  // Build secondary perk
  // ============================================
  const getSecondaryPerk = (): VerdictDataProgressive['secondaryPerk'] => {
    const isStayBooking = bookingType === 'hotel' || bookingType === 'vacation_rental';
    if (isAward && awardData) {
      return {
        icon: 'miles',
        label: `${awardData.cpp.toFixed(1)}¢/mile value`,
      };
    }
    if (tabMode === 'easiest') {
      return {
        icon: 'flexibility',
        label: isPortal
          ? isStayBooking
            ? 'Portal change policies apply'
            : 'Portal change policies apply'
          : isStayBooking
            ? 'Direct: easier for modifications, special requests'
            : 'Direct: easier for changes during delays & cancellations',
      };
    }
    if (Math.abs(milesDiff) > 100) {
      return {
        icon: 'miles',
        label: milesDiff > 0
          ? `+${milesDiff.toLocaleString()} more miles via portal`
          : `+${Math.abs(milesDiff).toLocaleString()} more miles via direct`,
      };
    }
    return undefined;
  };

  // ============================================
  // Build full progressive verdict
  // ENHANCED: Add close-call state for better trust
  // ============================================
  const winnerLabel = isAward ? 'Award Booking' : isPortal ? 'Portal Booking' : 'Other Site Booking';
  const winnerPayToday = isAward ? awardOOP : isPortal ? portalOOP : directOOP;
  
  // Calculate effective cost range for Max Value mode when miles range exists
  const portalMilesRange = comparison.portalDetails.milesEarnedRange;
  const portalEffectiveCostRange = portalMilesRange ? {
    min: (portalPriceUSD - creditRemaining) - (portalMilesRange.max * mileValueCpp),
    max: (portalPriceUSD - creditRemaining) - (portalMilesRange.min * mileValueCpp),
  } : undefined;
  
  // Build itinerary summary string for display (e.g., "DXB → LAX • May 12–20")
  const buildItinerarySummary = (): string | undefined => {
    if (!itinerary?.origin || !itinerary?.destination) return undefined;
    
    const route = `${itinerary.origin} → ${itinerary.destination}`;
    
    const formatDate = (dateStr?: string): string | undefined => {
      if (!dateStr) return undefined;
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch {
        return dateStr;
      }
    };
    
    const departFormatted = formatDate(itinerary.departDate);
    const returnFormatted = formatDate(itinerary.returnDate);
    
    if (departFormatted && returnFormatted) {
      // Round trip: "May 12–20"
      return `${route} • ${departFormatted}–${returnFormatted}`;
    } else if (departFormatted) {
      // One way: "May 12"
      return `${route} • ${departFormatted}`;
    }
    
    return route;
  };

  // Build double-dip strategy info for portal recommendations on flights
  const doubleDipStrategyForVerdict = bookingType === 'flight' && comparison.recommendation === 'portal' ? {
    payToday: doubleDipRec.breakdown.payToday,
    milesEarned: doubleDipRec.breakdown.milesEarned,
    milesValue: doubleDipRec.breakdown.milesValue,
    eraseLater: doubleDipRec.breakdown.eraseLater,
    savingsVsDirect: Math.max(0, directPriceUSD - doubleDipRec.breakdown.payToday),
    mileValueCpp: mileValueCpp,
  } : undefined;

  const progressiveVerdict: VerdictDataProgressive = {
    // Override recommendation to 'tie' if it's a close call
    recommendation: isCloseCallWithFx ? 'tie' : (isAward ? 'portal' : comparison.recommendation as 'portal' | 'direct' | 'tie'),
    // Itinerary summary for display (e.g., "DXB → LAX • May 12–20")
    itinerarySummary: buildItinerarySummary(),
    // Double-dip strategy for portal flight bookings (consolidated into verdict card)
    doubleDipStrategy: tabMode !== 'easiest' ? doubleDipStrategyForVerdict : undefined,
    winner: {
      label: isCloseCallWithFx ? 'Essentially a Tie' : winnerLabel,
      payToday: winnerPayToday,
      payTodayLabel: isCloseCallWithFx
        ? `Both options within $${Math.round(outOfPocketDiffAbs)} — choose based on flexibility`
        : isAward
          ? `Pay $${awardOOP} + ${awardData?.miles.toLocaleString()} miles`
          : `Pay $${winnerPayToday.toLocaleString()} today`,
    },
    primaryDelta: isAward && awardData ? {
      type: 'savings',
      amount: Math.min(portalOOP, directOOP) - awardOOP,
      label: `Save $${(Math.min(portalOOP, directOOP) - awardOOP).toLocaleString()} in cash`,
    } : {
      type: outOfPocketDiff > 5 && ((isPortal && portalOOP < directOOP) || (!isPortal && directOOP < portalOOP)) ? 'savings' : 'cost',
      amount: outOfPocketDiff,
      label: outOfPocketDiff > 5
        ? (isPortal && portalOOP < directOOP
            ? `Save $${outOfPocketDiff.toLocaleString()} vs direct`
            : !isPortal && directOOP < portalOOP
              ? `Save $${outOfPocketDiff.toLocaleString()} vs portal`
              : `$${outOfPocketDiff.toLocaleString()} more but better value`)
        : 'Similar out-of-pocket',
    },
    secondaryPerk: getSecondaryPerk(),
    whyBullets,
    auditTrail: {
      assumptions: [
        { label: 'Mile value', value: `${(mileValueCpp * 100).toFixed(1)}¢/mi`, editable: true },
        {
          label: 'Portal multiplier',
          value: bookingType === 'hotel' ? '10x' : bookingType === 'vacation_rental' ? '5x' : '5x',
          editable: false
        },
        { label: 'Direct multiplier', value: '2x', editable: false },
        { label: 'Travel credit', value: `$${comparison.portalDetails.creditApplied}`, editable: true },
      ],
      couldFlipIf: awardData ? [] : (comparison.couldFlipIf || []),
      fullBreakdown: {
        portalSticker: portalPriceUSD,
        portalOutOfPocket: portalOOP,
        // FIX: Only show range format if min !== max (prevents "6,330–6,330" strikethrough bug)
        portalMilesEarned: comparison.portalDetails.milesEarnedRange &&
          comparison.portalDetails.milesEarnedRange.min !== comparison.portalDetails.milesEarnedRange.max
          ? `${comparison.portalDetails.milesEarnedRange.min.toLocaleString()}–${comparison.portalDetails.milesEarnedRange.max.toLocaleString()}`
          : `+${comparison.portalDetails.milesEarned.toLocaleString()}`,
        directSticker: directPriceUSD,
        directOutOfPocket: directOOP,
        directMilesEarned: comparison.directDetails.milesEarned,
        creditApplied: comparison.portalDetails.creditApplied,
        portalPremiumPercent: directPriceUSD > 0
          ? ((portalPriceUSD - directPriceUSD) / directPriceUSD) * 100
          : undefined,
        awardProgram: awardData?.program,
        awardMiles: awardData?.miles,
        awardTaxes: awardData?.taxes,
        awardTaxesEstimated: awardData?.taxesEstimated,
        awardCpp: awardData?.cpp,
      },
      notes: awardData ? [
        `Transfer ${awardData.miles.toLocaleString()} Capital One miles to ${awardData.program}.`,
        `Award taxes: $${awardData.taxes}${awardData.taxesEstimated ? ' (estimated)' : ''}.`,
        'Transfers typically take up to 48 hours.',
      ] : [
        comparison.portalDetails.creditApplied > 0
          ? `$${comparison.portalDetails.creditApplied} travel credit applies only to portal bookings.`
          : 'No travel credit applied.',
        bookingType === 'flight'
          ? 'Portal earns 5x miles on flights. Direct earns 2x.'
          : bookingType === 'hotel'
            ? 'Portal earns 10x miles on hotels. Direct earns 2x.'
            : 'Portal earns 5x miles on vacation rentals. Direct earns 2x.',
        // Add hotel disclaimer for stays
        ...(bookingType === 'hotel' || bookingType === 'vacation_rental'
          ? ['⚠️ May exclude resort/incidental fees due at property.']
          : []),
      ],
    },
    confidence: comparison.confidence,
    friction: getFrictionLevel(),
    tabMode,
  };

  // Check if we should show the Max Value pre-verdict flow
  const showMaxValueFlow = tabMode === 'max_value' &&
    itinerary?.origin && itinerary?.destination && itinerary?.departDate &&
    maxValuePhase !== 'verdict';

  return (
    <div className="space-y-4">
      {/* Status */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
      >
        <Check className="w-4 h-4 text-emerald-400" />
        <span className="text-sm text-emerald-300 font-medium">Prices captured</span>
        <span className="text-xs text-white/40">Portal + Direct</span>
      </motion.div>

      {/* Tab Selector with descriptions and tooltips */}
      <div className="space-y-3">
        <div className="flex gap-2">
          {tabDefs.map(({ mode, label, emoji }) => (
            <GlassButton
              key={mode}
              variant={tabMode === mode ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setTabMode(mode)}
            >
              {emoji} {label}
            </GlassButton>
          ))}
        </div>
        {/* Active tab description + tooltip */}
        <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <div className="text-xs text-white/80 font-medium mb-1">
                {tabDefs.find(t => t.mode === tabMode)?.description}
              </div>
              <div className="text-[10px] text-white/50 leading-relaxed">
                {tabDefs.find(t => t.mode === tabMode)?.tooltip}
              </div>
            </div>
            <Info className="w-3.5 h-3.5 text-white/30 flex-shrink-0 mt-0.5" />
          </div>
        </div>
      </div>

      {/* Credit Toggle - Enhanced with verification messaging per UX critique P1-4 */}
      <div className="p-3 rounded-lg bg-white/[0.04] border border-white/[0.08]">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5 flex-1">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-indigo-400" />
              <span className="text-sm text-white/80">Include ${initialCreditRemaining} credit in comparison</span>
            </div>
            <span className="text-[10px] text-white/40 ml-6">
              {applyTravelCredit ? 'Portal price will reflect credit applied' : 'Comparing sticker prices only'}
            </span>
          </div>
          <button
            onClick={() => setApplyTravelCredit(!applyTravelCredit)}
            className={cn(
              'relative w-12 h-6 rounded-full transition-colors flex-shrink-0',
              applyTravelCredit ? 'bg-indigo-500' : 'bg-white/20'
            )}
          >
            <motion.div
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
              animate={{ left: applyTravelCredit ? 'calc(100% - 20px)' : '4px' }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
        {/* P1-4: Credit verification messaging */}
        {/* P0 #7 FIX: Changed amber/orange (error-like) to informational blue/gray styling */}
        {applyTravelCredit && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 pt-2 border-t border-white/[0.06]"
          >
            <div className="flex items-start gap-2 text-[10px]">
              <Info className="w-3 h-3 text-blue-400/70 flex-shrink-0 mt-0.5" />
              <div className="text-white/50">
                <span className="text-blue-300/80">Assumes you have ${initialCreditRemaining} credit available and unused.</span>
                {' '}The credit applies only to Capital One Travel portal bookings.
                Toggle off to compare prices without credit.
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ============================================
          DOUBLE-DIP STRATEGY CARD
          Shows the optimal "Portal + Travel Eraser" approach
          Now ALWAYS shows for flights (educational), even if user can't execute yet
          ============================================ */}
      {/* P1 FIX: Hide double-dip strategy on "Easiest" tab - it's not simple/easy */}
      {/* P1 FIX: Hide standalone double-dip card when verdict is showing (it's now integrated into verdict card accordion) */}
      {/* Only show during max_value pre-verdict flow (ask/searching/input phases) */}
      {showDoubleDipStrategy && bookingType === 'flight' && tabMode !== 'easiest' && showMaxValueFlow && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden"
        >
          <div className="relative bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-cyan-500/10 backdrop-blur-xl rounded-2xl border border-emerald-500/30 p-4">
            {/* Close button */}
            <button
              onClick={() => setShowDoubleDipStrategy(false)}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:bg-white/20 hover:text-white/80 transition-colors"
            >
              ✕
            </button>
            
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                <span className="text-lg">🎯</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Maximum Value Strategy</h3>
                <p className="text-[10px] text-emerald-300/80">Portal + Travel Eraser "Double-Dip"</p>
              </div>
            </div>
            
            {/* Strategy Steps */}
            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[10px] text-emerald-300 font-bold flex-shrink-0 mt-0.5">1</div>
                <div className="text-xs text-white/80">
                  <strong className="text-white">Book via Capital One Travel Portal</strong>
                  <div className="text-white/50 mt-0.5">Pay ${doubleDipRec.breakdown.payToday.toLocaleString(undefined, { maximumFractionDigits: 0 })} today → Earn <span className="text-emerald-300 font-semibold">{doubleDipRec.breakdown.milesEarned.toLocaleString()}</span> miles at 5x rate</div>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-[10px] text-emerald-300 font-bold flex-shrink-0 mt-0.5">2</div>
                <div className="text-xs text-white/80">
                  <strong className="text-white">Use Travel Eraser within 90 days</strong>
                  <div className="text-white/50 mt-0.5">Redeem miles at 1¢/mile — <span className="text-cyan-300 font-medium">no minimum, partial OK!</span></div>
                  <div className="text-white/40 mt-0.5 text-[10px]">Cover any amount: $1 to ${doubleDipRec.breakdown.eraseLater.toLocaleString(undefined, { maximumFractionDigits: 0 })} — you choose</div>
                </div>
              </div>
            </div>
            
            {/* Cost Breakdown - FIXED: Show Miles Value vs Travel Eraser as ALTERNATIVE options, not additive */}
            <div className="p-3 rounded-xl bg-black/20 border border-white/10 mb-3">
              <div className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Cost Breakdown</div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/60">Pay today (portal)</span>
                  <span className="text-white/90">${doubleDipRec.breakdown.payToday.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/60">Miles earned (5x × ${doubleDipRec.breakdown.payToday.toFixed(0)})</span>
                  <span className="text-emerald-300">+{doubleDipRec.breakdown.milesEarned.toLocaleString()} mi</span>
                </div>
                
                {/* FIXED: Show alternatives clearly - user can EITHER keep miles OR use Travel Eraser */}
                <div className="mt-3 pt-2 border-t border-white/10">
                  <div className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Then Choose One:</div>
                  
                  {/* Option A: Keep miles for transfer partners */}
                  {/* P0 FIX: Only show concrete dollar value if user actually found an award via PointsYeah */}
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px]">🅰️</span>
                      <span className="text-xs text-emerald-300 font-medium">Keep Miles for Transfers</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-white/50">Earned miles</span>
                      <span className="text-emerald-300 font-medium">+{doubleDipRec.breakdown.milesEarned.toLocaleString()} mi</span>
                    </div>
                    <div className="text-[9px] text-white/40 mt-1">Check PointsYeah to find actual award value for your route</div>
                  </div>
                  
                  {/* Option B: Use Travel Eraser */}
                  {doubleDipRec.breakdown.eraseLater > 0 && (
                    <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px]">🅱️</span>
                        <span className="text-xs text-cyan-300 font-medium">Use Travel Eraser</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-white/50">Erase up to (@1¢/mi)</span>
                        <span className="text-cyan-300 font-medium">−${doubleDipRec.breakdown.eraseLater.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="text-[9px] text-white/40 mt-1">Apply within 90 days to reduce out-of-pocket</div>
                    </div>
                  )}
                </div>
                
                {/* Actual cash savings vs direct - this is the REAL comparison */}
                <div className="flex justify-between items-center text-sm pt-3 border-t border-white/10 mt-3">
                  <span className="text-white font-semibold">Cash Savings vs Direct</span>
                  <span className="text-xl font-bold text-emerald-400">
                    ${Math.max(0, directPriceUSD - doubleDipRec.breakdown.payToday).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                
                {/* Effective Total Cost - factoring in all miles */}
                {milesBalance > 0 && (() => {
                  const totalMiles = milesBalance + doubleDipRec.breakdown.milesEarned;
                  const eraseValue = totalMiles / 100;
                  const effectiveCost = Math.max(0, doubleDipRec.breakdown.payToday - eraseValue);
                  return (
                    <div className="flex justify-between items-center text-sm pt-2 mt-2 border-t border-white/5 group relative">
                      <div className="flex items-center gap-1">
                        <div className="flex flex-col">
                          <span className="text-white/60 text-xs">Effective Total Cost</span>
                          <span className="text-[10px] text-white/40">After using all {totalMiles.toLocaleString()} miles</span>
                        </div>
                        <div className="relative">
                          <HelpCircle className="w-3 h-3 text-white/30 hover:text-white/50 cursor-help peer" />
                          <div className="absolute left-0 top-full mt-1 z-50 w-52 p-2 rounded-lg bg-black/95 border border-white/20 text-[10px] text-white/80 shadow-xl opacity-0 peer-hover:opacity-100 transition-opacity pointer-events-none">
                            ${doubleDipRec.breakdown.payToday.toLocaleString(undefined, { maximumFractionDigits: 0 })} pay today − ${eraseValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} erased ({totalMiles.toLocaleString()} miles @ 1¢/mi) = ${effectiveCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </div>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-cyan-400">
                        ${effectiveCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>
            
            {/* P0 #2 FIX: Removed misleading "Save $877" highlight that used effectiveCost.
                The correct "Cash Savings vs Direct: $312" is already shown above. */}
            
            {/* Fine print */}
            <div className="mt-3 text-[9px] text-white/40 leading-relaxed space-y-1.5">
              <div>
                💡 <strong className="text-white/50">Why this works:</strong> You earn miles on the cash purchase AND get to redeem them. Travel Eraser applies to any travel purchase made in the last 90 days.
              </div>
              <div className="flex items-start gap-1.5 p-1.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                <span className="text-[10px]">✨</span>
                <span className="text-cyan-300/80">
                  <strong>No minimum!</strong> Cover $0.78 or $780 — Capital One lets you choose exactly how much to erase. Partial redemptions OK.
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Pay Today display for Max Value mode - UX FIX NEW-7 */}
      {tabMode === 'max_value' && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-2"
        >
          <div className={cn(
            'p-3 rounded-lg border text-center',
            portalOOP < directOOP
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-white/[0.04] border-white/[0.08]'
          )}>
            <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Portal</div>
            <div className={cn(
              'text-lg font-bold',
              portalOOP < directOOP ? 'text-emerald-400' : 'text-white/80'
            )}>
              ${Math.round(portalOOP).toLocaleString()}
            </div>
            <div className="text-[9px] text-white/60 font-medium mb-0.5">Pay Today</div>
            <div className="text-[9px] text-white/40">
              Effective: ${Math.round(portalEffectiveCost).toLocaleString()}
            </div>
          </div>
          <div className={cn(
            'p-3 rounded-lg border text-center',
            directOOP < portalOOP
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-white/[0.04] border-white/[0.08]'
          )}>
            <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Direct</div>
            <div className={cn(
              'text-lg font-bold',
              directOOP < portalOOP ? 'text-emerald-400' : 'text-white/80'
            )}>
              ${Math.round(directOOP).toLocaleString()}
            </div>
            <div className="text-[9px] text-white/60 font-medium mb-0.5">Pay Today</div>
            <div className="text-[9px] text-white/40">
              Effective: ${Math.round(directEffectiveCost).toLocaleString()}
            </div>
          </div>
        </motion.div>
      )}

      {/* Max Value: Pre-verdict flow with PointsYeah */}
      {showMaxValueFlow && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden"
        >
          <div className="relative bg-gradient-to-br from-violet-500/10 via-indigo-500/10 to-purple-500/10 backdrop-blur-xl rounded-2xl border border-white/[0.10] p-5">
            
            {/* Phase: ASK */}
            {maxValuePhase === 'ask' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Want to explore other options?</h3>
                    <p className="text-sm text-white/60">Transfer partner awards might beat both prices</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                  <p className="text-xs text-white/60 leading-relaxed">
                    Transfer partners can sometimes beat both portal and direct prices.
                    Takes ~2 min to check PointsYeah.
                  </p>
                </div>

                {/* P1 FIX: "Show verdict" is the primary action (why user is here),
                    "Check awards" is secondary (exploratory, leaves the app) */}
                <div className="flex gap-2">
                  <GlassButton
                    variant="primary"
                    className="flex-1"
                    onClick={() => setMaxValuePhase('verdict')}
                  >
                    Show Verdict
                  </GlassButton>
                  <GlassButton
                    variant="secondary"
                    className="flex-1"
                    onClick={handleSearchPointsYeah}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Check Awards
                  </GlassButton>
                </div>
              </div>
            )}

            {/* Phase: SEARCHING */}
            {maxValuePhase === 'searching' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">PointsYeah opened</h3>
                    <p className="text-sm text-white/60">Find an award option to compare</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <p className="text-xs text-white/70 leading-relaxed">
                    <strong className="text-white">Look for:</strong><br />
                    • Miles required (e.g., "42,900 pts")<br />
                    • Taxes/fees (e.g., "+ $258")
                  </p>
                </div>

                <div className="p-2 rounded-lg bg-white/[0.03] text-[11px] text-white/50">
                  {itinerary?.origin} → {itinerary?.destination} • {itinerary?.departDate}
                  {itinerary?.returnDate && ' (roundtrip)'}
                </div>

                <div className="flex gap-2">
                  <GlassButton
                    variant="primary"
                    className="flex-1"
                    onClick={() => setMaxValuePhase('input')}
                  >
                    I found an award
                  </GlassButton>
                  <GlassButton
                    variant="ghost"
                    onClick={handleSearchPointsYeah}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </GlassButton>
                </div>

                <button
                  onClick={() => setMaxValuePhase('verdict')}
                  className="w-full py-2 text-xs text-white/50 hover:text-white/70 transition-colors"
                >
                  No good awards → Show verdict
                </button>
              </div>
            )}

            {/* Phase: INPUT */}
            {maxValuePhase === 'input' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">Confirm award numbers</h3>
                    <p className="text-sm text-white/60">Just 2 fields from PointsYeah</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] space-y-4">
                  {/* Miles required */}
                  <div>
                    <label className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white font-medium">Miles required</span>
                      <span className="text-[10px] text-white/40">from Capital One row</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={milesInput}
                        onChange={(e) => setMilesInput(e.target.value)}
                        placeholder="37,000"
                        className="w-full px-4 py-3 rounded-lg bg-white/[0.06] border border-white/[0.12] text-white text-lg font-semibold placeholder:text-white/30 focus:outline-none focus:border-violet-500/40"
                        autoFocus
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/40">pts</span>
                    </div>
                  </div>

                  {/* Taxes & fees */}
                  <div>
                    <label className="flex items-center justify-between mb-2">
                      <span className="text-sm text-white/70">Taxes & fees</span>
                      <span className="text-[10px] text-white/40 bg-white/[0.06] px-2 py-0.5 rounded">optional</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base text-white/40">$</span>
                      <input
                        type="text"
                        value={taxesInput}
                        onChange={(e) => setTaxesInput(e.target.value)}
                        placeholder="e.g., 85.80"
                        className="w-full pl-8 pr-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white text-base placeholder:text-white/25 focus:outline-none focus:border-white/15"
                      />
                    </div>
                    <p className="text-[10px] text-white/40 mt-1.5">
                      💡 Leave blank to estimate (~10% of cash price)
                    </p>
                  </div>
                </div>
                
                {/* Award baseline selector */}
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-[10px] text-white/50 uppercase tracking-wider mb-2">
                    Compare award against:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'portal_with_credit', label: 'Portal (with credit)', value: Math.max(0, portalPriceUSD - initialCreditRemaining) },
                      { key: 'portal_no_credit', label: 'Portal (no credit)', value: portalPriceUSD },
                      { key: 'direct', label: 'Direct', value: directPriceUSD },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setAwardBaseline(opt.key as typeof awardBaseline)}
                        className={cn(
                          'px-2 py-1.5 rounded text-[10px] transition-colors border',
                          awardBaseline === opt.key
                            ? 'bg-indigo-500/20 border-indigo-500/30 text-white'
                            : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.06]'
                        )}
                      >
                        {opt.label}: ${opt.value}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Program selection */}
                <div>
                  <div className="text-xs text-white/50 mb-2">Transfer program:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {TRANSFER_PARTNERS.map((p) => (
                      <button
                        key={p.code}
                        onClick={() => setSelectedProgram(p.name)}
                        className={cn(
                          'px-2 py-1 rounded text-[10px] transition-colors border',
                          selectedProgram === p.name
                            ? 'bg-violet-500/20 border-violet-500/30 text-white'
                            : 'bg-white/[0.03] border-white/[0.06] text-white/50 hover:bg-white/[0.06]'
                        )}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>

                {inputError && (
                  <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                    {inputError}
                  </div>
                )}

                <GlassButton
                  variant="primary"
                  className="w-full"
                  onClick={handleCalculateAward}
                  disabled={!selectedProgram || !milesInput}
                >
                  <Sparkles className="w-4 h-4" />
                  Compare All 3 Options
                </GlassButton>

                <button
                  onClick={() => setMaxValuePhase('searching')}
                  className="w-full py-2 text-xs text-white/40 hover:text-white/60 transition-colors"
                >
                  ← Back to search
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Main Verdict Card (show when not in Max Value pre-flow) */}
      {(!showMaxValueFlow || tabMode !== 'max_value') && (
        <>
          {/* 3-way comparison header if award data exists */}
          {awardData && tabMode === 'max_value' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 mb-2"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs text-violet-300 font-medium">
                  3-Way Comparison: Portal vs Direct vs Award
                </div>
                <button
                  onClick={() => {
                    setAwardData(null);
                    setMaxValuePhase('ask');
                  }}
                  className="text-[10px] text-white/40 hover:text-white/60"
                >
                  Clear award
                </button>
              </div>
              
              {/* Mini comparison grid */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className={cn(
                  'p-2 rounded-lg text-center transition-all',
                  finalWinner === 'portal'
                    ? 'bg-emerald-500/15 border-2 border-emerald-500/40'
                    : 'bg-white/[0.03] border border-white/[0.06] opacity-70'
                )}>
                  <div className="flex items-center justify-center gap-1">
                    {finalWinner === 'portal' && <span className="text-[9px]">👑</span>}
                    <span className={cn(
                      "text-[10px]",
                      finalWinner === 'portal' ? "text-emerald-300 font-medium" : "text-white/50"
                    )}>Portal</span>
                  </div>
                  <div className={cn(
                    "text-sm font-semibold",
                    finalWinner === 'portal' ? "text-white" : "text-white/70"
                  )}>${portalOOP}</div>
                </div>

                <div className={cn(
                  'p-2 rounded-lg text-center transition-all',
                  finalWinner === 'direct'
                    ? 'bg-emerald-500/15 border-2 border-emerald-500/40'
                    : 'bg-white/[0.03] border border-white/[0.06] opacity-70'
                )}>
                  <div className="flex items-center justify-center gap-1">
                    {finalWinner === 'direct' && <span className="text-[9px]">👑</span>}
                    <span className={cn(
                      "text-[10px]",
                      finalWinner === 'direct' ? "text-emerald-300 font-medium" : "text-white/50"
                    )}>Direct</span>
                  </div>
                  <div className={cn(
                    "text-sm font-semibold",
                    finalWinner === 'direct' ? "text-white" : "text-white/70"
                  )}>${directOOP}</div>
                </div>

                <div className={cn(
                  'p-2 rounded-lg text-center transition-all',
                  finalWinner === 'award'
                    ? 'bg-emerald-500/15 border-2 border-emerald-500/40'
                    : awardData && awardData.cpp < 1.0
                      ? 'bg-amber-500/10 border border-amber-500/20 opacity-80'
                      : 'bg-white/[0.03] border border-white/[0.06] opacity-70'
                )}>
                  <div className="flex items-center justify-center gap-1">
                    {finalWinner === 'award' && <span className="text-[9px]">👑</span>}
                    <span className={cn(
                      "text-[10px]",
                      finalWinner === 'award' ? "text-emerald-300 font-medium" : "text-white/50"
                    )}>Award</span>
                  </div>
                  <div className={cn(
                    "text-sm font-semibold",
                    finalWinner === 'award' ? "text-white" : "text-white/70"
                  )}>
                    ${awardOOP} + {awardData ? (awardData.miles / 1000).toFixed(1) : 0}k mi
                  </div>
                  {awardData && (
                    <div className={cn(
                      "text-[9px]",
                      awardData.cpp < 1.0 ? "text-amber-400" : finalWinner === 'award' ? "text-emerald-300" : "text-white/50"
                    )}>
                      {awardData.cpp.toFixed(2)}¢/mi
                    </div>
                  )}
                </div>
              </div>

              {/* Low value warning */}
              {awardData && awardData.cpp < 1.0 && (
                <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="text-[10px] text-amber-300 font-medium flex items-start gap-1.5">
                    <span>⚠️</span>
                    <span>Award value ({awardData.cpp.toFixed(2)}¢/mi) is below Travel Eraser baseline (1¢/mi)</span>
                  </div>
                  <div className="text-[9px] text-amber-200/70 mt-1.5">
                    Good award redemptions are typically &gt;1.3–1.5¢/mi. Consider portal or direct instead.
                  </div>
                </div>
              )}
            </motion.div>
          )}

          <ProgressiveVerdictCard
            verdict={progressiveVerdict}
            tabMode={tabMode}
            onContinue={() => {
              // P2-21: Trigger success celebration instead of just logging
              const rec = progressiveVerdict.recommendation === 'tie'
                ? (portalOOP <= directOOP ? 'portal' : 'direct')
                : (progressiveVerdict.recommendation as 'portal' | 'direct');
              const savings = outOfPocketDiff > 5 ? outOfPocketDiff : undefined;
              onVerdictContinue?.(rec, savings);
            }}
            onAssumptionEdit={(label) => {
              // Open settings when user taps "Tap to change" on Mile value or Travel credit
              onOpenSettings?.();
            }}
          />
        </>
      )}

      {/* Post-verdict: Option to search PointsYeah */}
      {tabMode === 'max_value' && !showMaxValueFlow && !awardData && itinerary?.origin && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-xs text-white/60">Want to check transfer partner awards?</span>
            </div>
            <button
              onClick={() => setMaxValuePhase('ask')}
              className="px-3 py-1.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-xs text-teal-300 hover:bg-teal-500/20 transition-colors"
            >
              Check Awards
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// ============================================
// CHAT TAB CONTENT
// ============================================

const ChatTabContent: React.FC<{
  messages: ChatMessage[];
  inputValue: string;
  setInputValue: (v: string) => void;
  onSend: () => void;
  onStarterPrompt: (prompt: StarterPrompt) => void;
  contextStatus: BookingContextStatus;
  onSwitchToCompare: () => void;
  // P0 #4 FIX: Add props for showing booking CTA when verdict is available
  hasVerdict?: boolean;
  verdictWinner?: 'portal' | 'direct';
  onBookNow?: () => void;
}> = ({
  messages,
  inputValue,
  setInputValue,
  onSend,
  onStarterPrompt,
  contextStatus,
  onSwitchToCompare,
  hasVerdict = false,
  verdictWinner,
  onBookNow,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const suggestions = ['Portal vs direct?', 'Travel Eraser?', 'Transfer partners?'];
  const showStarterPrompts = messages.length <= 1;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Chat Messages - Scrollable with auto-hide scrollbar */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 scrollbar-auto-hide">
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <MessageBubble 
              key={msg.id} 
              message={msg}
              onContextAction={contextStatus.type !== 'none' ? onSwitchToCompare : undefined}
            />
          ))}
        </AnimatePresence>
        
        {/* Starter Prompts */}
        {showStarterPrompts && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-3 mt-4"
          >
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
                Quick Questions
              </span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {DEFAULT_STARTER_PROMPTS.slice(0, 4).map((prompt, index) => (
                <motion.button
                  key={prompt.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                  onClick={() => onStarterPrompt(prompt)}
                  className={cn(
                    'w-full p-3 rounded-xl text-left',
                    'bg-white/[0.04] border border-white/[0.08]',
                    'hover:bg-white/[0.08] hover:border-white/[0.12]',
                    'transition-all duration-200'
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-base flex-shrink-0">{prompt.icon}</span>
                    <span className="text-sm text-white/80">{prompt.text}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* P0 #4 FIX: Booking CTA Banner - Show when verdict is available */}
      {hasVerdict && onBookNow && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-3 border-t border-[rgba(255,255,255,0.06)] bg-gradient-to-r from-emerald-500/10 to-indigo-500/10"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  Verdict: Book {verdictWinner === 'portal' ? 'Portal' : 'Direct'}
                </div>
                <div className="text-[10px] text-white/50">
                  Tap to complete your booking
                </div>
              </div>
            </div>
            <GlassButton
              variant="primary"
              size="sm"
              onClick={onBookNow}
              className="flex-shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Book Now
            </GlassButton>
          </div>
        </motion.div>
      )}

      {/* Composer - Minimal border */}
      <div className="p-4 border-t border-[rgba(255,255,255,0.04)] bg-black/95 backdrop-blur-lg">
        <ChatComposer
          value={inputValue}
          onChange={setInputValue}
          onSend={onSend}
          suggestions={suggestions}
        />
      </div>
    </div>
  );
};

// ============================================
// COMPARE TAB CONTENT
// ============================================

const CompareTabContent: React.FC<{
  currentStep: FlowStep;
  portalCapture: PortalCapture | null;
  directCapture: DirectCapture | null;
  stayCapture: StayCapture | null;
  directStayCapture: DirectStayCapture | null;
  bookingType: BookingType;
  detectedSite: DetectedSite;  // P1 FIX: Added for dynamic site detection in progress rail
  contextStatus: BookingContextStatus;
  creditRemaining: number;
  onConfirmPortal: () => void;
  onRecapturePortal: () => void;
  onConfirmDirect: () => void;
  onRecaptureDirect: () => void;
  onFindCorrectFlight?: () => void;  // When user wants to go back to find a different flight
  onConfirmStayPortal: () => void;
  onConfirmStayDirect: () => void;
  onManualDirectPriceSubmit?: (price: number, provider?: string) => void;
  onReset: () => void;
  onSwitchToChat: () => void;
  onStepChange?: (step: FlowStep) => void;
  onAskQuestion?: (question: string, context: VerdictContext) => void;
  tabMode?: UITabMode;
  onTabModeChange?: (mode: UITabMode) => void;
  onOpenSettings?: () => void;
  mileValuationCpp?: number;  // User's mile valuation preference (default 0.015 = 1.5¢)
  milesBalance?: number;  // User's current miles balance for Travel Eraser calculation
  // P2-21: Callback when user clicks "Continue to Portal/Direct" - triggers success celebration
  onVerdictContinue?: (recommendation: 'portal' | 'direct', savings?: number) => void;
}> = ({
  currentStep,
  portalCapture,
  directCapture,
  stayCapture,
  directStayCapture,
  bookingType,
  detectedSite,  // P1 FIX: Destructure detectedSite for dynamic progress rail labels
  contextStatus,
  creditRemaining,
  onConfirmPortal,
  onRecapturePortal,
  onConfirmDirect,
  onRecaptureDirect,
  onFindCorrectFlight,
  onConfirmStayPortal,
  onConfirmStayDirect,
  onManualDirectPriceSubmit,
  onReset,
  onSwitchToChat,
  onStepChange,
  onAskQuestion,
  tabMode,
  onTabModeChange,
  onOpenSettings,
  mileValuationCpp,
  milesBalance,
  onVerdictContinue,
}) => {
  // Determine what state we're in for better UX - now booking-type aware
  const isStay = bookingType === 'stay';
  const isUnsupportedPage = detectedSite === 'capital-one-unsupported';
  
  // For stays
  const showWaitingForStayCapture = isStay && !stayCapture && (contextStatus.type === 'detected');
  const showStayPortalCapture = isStay && stayCapture && currentStep === 1;
  const showStayDirectCapture = isStay && directStayCapture && stayCapture && currentStep === 2;
  const showWaitingForStayDirect = isStay && stayCapture && !directStayCapture && currentStep === 2;
  const showStayVerdict = isStay && stayCapture && directStayCapture && currentStep === 3;
  
  // For flights
  const showWaitingForCapture = !isStay && !portalCapture && (contextStatus.type === 'detected');
  const showNoBooking = (!isStay ? !portalCapture : !stayCapture) && contextStatus.type === 'none' && !isUnsupportedPage;
  const showPortalCapture = !isStay && portalCapture && currentStep === 1;
  const showDirectCapture = !isStay && directCapture && portalCapture && currentStep === 2;
  const showWaitingForDirect = !isStay && portalCapture && !directCapture && currentStep === 2;
  const showVerdict = !isStay && portalCapture && directCapture && currentStep === 3;

  // Determine which steps can be navigated to - booking-type aware
  const getEnabledSteps = (): number[] => {
    const enabled: number[] = [1]; // Step 1 always enabled
    if (isStay) {
      if (stayCapture) {
        enabled.push(2); // Can go to Direct if portal captured
      }
      if (stayCapture && directStayCapture) {
        enabled.push(3); // Can go to Verdict if both captured
      }
    } else {
      if (portalCapture) {
        enabled.push(2); // Can go to Direct if portal captured
      }
      if (portalCapture && directCapture) {
        enabled.push(3); // Can go to Verdict if both captured
      }
    }
    return enabled;
  };

  // Handle step click navigation - with confirmation when navigating back
  const [showNavConfirm, setShowNavConfirm] = useState<{ targetStep: FlowStep; isReset: boolean } | null>(null);
  
  const handleStepClick = (step: number) => {
    const enabledSteps = getEnabledSteps();
    if (!enabledSteps.includes(step) || !onStepChange) return;
    
    // If navigating backwards (to an earlier step) and we have captured data, show confirmation
    const hasData = isStay ? !!stayCapture : !!portalCapture;
    const isGoingBack = step < currentStep;
    
    if (isGoingBack && hasData) {
      // Step 1 = Start new booking (reset)
      // Step 2 = Just review current portal capture
      setShowNavConfirm({
        targetStep: step as FlowStep,
        isReset: step === 1,
      });
    } else {
      // Going forward or no data - just navigate
      onStepChange(step as FlowStep);
    }
  };
  
  const handleNavConfirm = (action: 'view' | 'new') => {
    if (!showNavConfirm || !onStepChange) return;
    
    if (action === 'new') {
      // User wants to start a new comparison - reset everything
      onReset();
    } else {
      // User wants to view current booking at that step
      onStepChange(showNavConfirm.targetStep);
    }
    setShowNavConfirm(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-24 scrollbar-auto-hide">
      {/* Step Navigation Confirmation Popup */}
      <AnimatePresence>
        {showNavConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowNavConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xs bg-[#1a1a2e] rounded-2xl border border-white/10 p-5 shadow-2xl"
            >
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3">
                  <Info className="w-6 h-6 text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {showNavConfirm.isReset ? 'Start New Comparison?' : 'View Current Booking'}
                </h3>
                <p className="text-sm text-white/60">
                  {showNavConfirm.isReset
                    ? 'You have a booking in progress. Would you like to view it or start fresh?'
                    : 'Navigate back to view your captured booking details?'}
                </p>
              </div>
              
              <div className="space-y-2">
                <GlassButton
                  variant="primary"
                  className="w-full"
                  onClick={() => handleNavConfirm('view')}
                >
                  👁️ View Current Booking
                </GlassButton>
                <GlassButton
                  variant="secondary"
                  className="w-full"
                  onClick={() => handleNavConfirm('new')}
                >
                  🔄 Start New Comparison
                </GlassButton>
                <button
                  onClick={() => setShowNavConfirm(null)}
                  className="w-full py-2 text-xs text-white/40 hover:text-white/60 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Progress Rail - Clickable - P1 FIX: Dynamic site detection instead of hardcoded "Other Site" */}
      <div className="mb-6">
        <GlassProgressRail
          currentStep={currentStep}
          steps={[
            { label: 'Portal' },
            { label: (() => {
              // Dynamic label based on detected site
              if (bookingType === 'stay') {
                return detectedSite === 'google-hotels' ? 'Google Hotels' : 'Direct Site';
              }
              return detectedSite === 'google-flights' ? 'Google Flights' : 'Direct Site';
            })() },
            { label: 'Verdict' },
          ]}
          onStepClick={handleStepClick}
          enabledSteps={getEnabledSteps()}
        />
      </div>

      {/* No booking state */}
      {showNoBooking && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-8"
        >
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/[0.08] flex items-center justify-center">
            <Plane className="w-10 h-10 text-white/25" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No Booking Detected</h3>
          <p className="text-sm text-white/50 mb-6 max-w-[280px] mx-auto leading-relaxed">
            Compare prices on flights, hotels, and vacation rentals to see if you should book via the Capital One Travel portal or directly. Start on the portal to capture your booking.
          </p>
          <div className="flex flex-col gap-3 max-w-[260px] mx-auto">
            <GlassButton
              variant="primary"
              className="w-full gap-2"
              onClick={() => {
                if (typeof chrome !== 'undefined' && chrome.tabs) {
                  chrome.tabs.create({ url: 'https://travel.capitalone.com' });
                }
              }}
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open Portal</span>
            </GlassButton>
            <GlassButton variant="ghost" className="w-full gap-2" onClick={onSwitchToChat}>
              <MessageCircle className="w-4 h-4" />
              <span>Ask a Question</span>
            </GlassButton>
          </div>
          
          {/* Force capture option for users already on checkout */}
          <div className="mt-6 pt-4 border-t border-white/[0.04]">
            <p className="text-[10px] text-white/30 mb-2">Already on a checkout page?</p>
            <GlassButton variant="ghost" size="sm" className="gap-2" onClick={onRecapturePortal}>
              <RefreshCw className="w-3 h-3" />
              <span>Force Capture</span>
            </GlassButton>
          </div>
          
          {/* Supported booking types */}
          <div className="mt-6 pt-6 border-t border-white/[0.06]">
            <p className="text-xs text-white/30 mb-3">What you can compare</p>
            <div className="flex justify-center gap-3 flex-wrap">
              <span className="text-xs text-white/50">✈️ Flights</span>
              <span className="text-white/20">•</span>
              <span className="text-xs text-white/50">🏨 Hotels</span>
              <span className="text-white/20">•</span>
              <span className="text-xs text-white/50">🏠 Vacation Rentals</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Unsupported Capital One Travel page (cars, packages, activities, premium-stays) */}
      {isUnsupportedPage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-8"
        >
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 flex items-center justify-center">
            <span className="text-4xl">👀</span>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Coming Soon!</h3>
          <p className="text-sm text-white/50 mb-6 max-w-[280px] mx-auto leading-relaxed">
            Cars, Packages, Activities, and Premium Stays aren't supported yet — but we're working on it!
          </p>
          
          <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] mx-4 mb-6">
            <p className="text-xs text-white/60 mb-3">Currently supported:</p>
            <div className="flex justify-center gap-3 flex-wrap">
              <span className="text-xs text-emerald-400 font-medium">✈️ Flights</span>
              <span className="text-white/20">•</span>
              <span className="text-xs text-emerald-400 font-medium">🏨 Hotels & Stays</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-3 max-w-[260px] mx-auto">
            <GlassButton
              variant="primary"
              className="w-full gap-2"
              onClick={() => {
                if (typeof chrome !== 'undefined' && chrome.tabs) {
                  chrome.tabs.create({ url: 'https://travel.capitalone.com/flights' });
                }
              }}
            >
              <Plane className="w-4 h-4" />
              <span>Search Flights</span>
            </GlassButton>
            <GlassButton
              variant="secondary"
              className="w-full gap-2"
              onClick={() => {
                if (typeof chrome !== 'undefined' && chrome.tabs) {
                  chrome.tabs.create({ url: 'https://travel.capitalone.com/stays' });
                }
              }}
            >
              <Building2 className="w-4 h-4" />
              <span>Search Hotels</span>
            </GlassButton>
          </div>
        </motion.div>
      )}

      {/* Waiting for portal capture - handles BOTH flights and stays */}
      {/* IMPORTANT: Don't show this when on unsupported page (Coming Soon takes precedence) */}
      {(showWaitingForCapture || showWaitingForStayCapture) && !isUnsupportedPage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-8"
        >
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-indigo-500/10 border border-emerald-500/20 flex items-center justify-center relative">
            {/* Show different icon based on detected site */}
            {contextStatus.site?.includes('Stays') || contextStatus.site?.includes('Hotels') ? (
              <Building2 className="w-10 h-10 text-emerald-400/70" />
            ) : (
              <Plane className="w-10 h-10 text-emerald-400/70" />
            )}
            {/* Pulsing ring */}
            <motion.div
              className="absolute inset-0 rounded-2xl border-2 border-emerald-400/30"
              animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Booking Page Detected!</h3>
          <p className="text-sm text-emerald-400/80 mb-1">{contextStatus.site}</p>
          <p className="text-sm text-white/50 mb-6 max-w-[280px] mx-auto leading-relaxed">
            {contextStatus.site?.includes('Stays') || contextStatus.site?.includes('Hotels')
              ? 'Select a hotel or room to capture the portal price.'
              : 'Select a flight on the page to capture the portal price.'}
          </p>
          
          {/* Loading spinner */}
          <div className="flex items-center justify-center gap-2 text-white/40">
            <motion.div
              className="w-4 h-4 border-2 border-white/20 border-t-indigo-400 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <span className="text-xs">
              {contextStatus.site?.includes('Stays') || contextStatus.site?.includes('Hotels')
                ? 'Waiting for hotel selection...'
                : 'Waiting for flight selection...'}
            </span>
          </div>
          
          {/* Manual capture button */}
          <div className="mt-6">
            <GlassButton variant="ghost" size="sm" onClick={onRecapturePortal}>
              <RefreshCw className="w-3 h-3" />
              Force Capture
            </GlassButton>
          </div>
        </motion.div>
      )}

      {/* Portal Capture (Flights) */}
      {showPortalCapture && portalCapture && (
        <PortalCaptureCard
          capture={portalCapture}
          onConfirm={onConfirmPortal}
          onRecapture={onRecapturePortal}
        />
      )}

      {/* Stay Portal Capture (Hotels) */}
      {showStayPortalCapture && stayCapture && (
        <StayPortalCaptureCard
          capture={stayCapture}
          onConfirm={onConfirmStayPortal}
          onRecapture={onRecapturePortal}
        />
      )}
      
      {/* Manual Direct Price Entry for Stays */}
      {showWaitingForStayDirect && stayCapture && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ManualDirectPriceEntry
            portalPrice={stayCapture.priceUSD}
            portalPropertyName={stayCapture.propertyName}
            portalCheckIn={stayCapture.checkIn}
            portalCheckOut={stayCapture.checkOut}
            portalNights={stayCapture.nights}
            portalRoomType={stayCapture.roomType}
            onPriceSubmit={(price, provider) => {
              if (price === 0) {
                // Skip direct comparison - show verdict with portal-only
                // For now, create a placeholder direct capture
                if (onManualDirectPriceSubmit) {
                  onManualDirectPriceSubmit(stayCapture.priceUSD * 1.1, 'Skipped'); // ~10% more than portal as placeholder
                }
              } else if (onManualDirectPriceSubmit) {
                onManualDirectPriceSubmit(price, provider);
              }
            }}
          />
        </motion.div>
      )}

      {/* Stay Direct Capture (Google Hotels) */}
      {showStayDirectCapture && directStayCapture && stayCapture && (
        <StayDirectCaptureCard
          capture={directStayCapture}
          portalPriceUSD={stayCapture.priceUSD}
          onConfirm={onConfirmStayDirect}
          onRecapture={onRecapturePortal}
        />
      )}

      {/* Waiting for direct capture - ENHANCED with full flight details */}
      {/* P0 #5 FIX: Context-aware instructions - detect if already on Google Flights */}
      {showWaitingForDirect && portalCapture && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="py-4"
        >
          {/* P0 #5 FIX: Detect if user is already on Google Flights */}
          {(() => {
            // Type-safe access: only check site if contextStatus has it (type !== 'none')
            // Note: when detectedSite === 'google-flights' in parent, contextStatus.site will be 'Google Flights'
            const siteLabel = contextStatus.type !== 'none' ? contextStatus.site : '';
            const isOnGoogleFlights = siteLabel?.toLowerCase().includes('google flights') ||
                                       siteLabel?.toLowerCase().includes('google') && siteLabel?.toLowerCase().includes('flight');
            return (
              <>
                <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 flex items-center justify-center relative">
                  <CreditCard className="w-10 h-10 text-blue-400/70" />
                  <motion.div
                    className="absolute inset-0 rounded-2xl border-2 border-blue-400/30"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 text-center">
                  {isOnGoogleFlights ? 'Select the Same Flight' : 'Find the Direct Price'}
                </h3>
                <p className="text-sm text-white/50 mb-6 max-w-[280px] mx-auto leading-relaxed text-center">
                  {isOnGoogleFlights
                    ? 'Select the matching flight on this page to capture the direct price:'
                    : 'Open Google Flights or the airline website to find the direct booking price for this flight:'}
                </p>
              </>
            );
          })()}
          
          {/* Portal Flight Details Card - FULL INFO */}
          <GlassCard variant="elevated" className="mb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <Plane className="w-4 h-4 text-indigo-300" />
              </div>
              <span className="font-semibold text-white">Portal Flight Details</span>
            </div>

            {/* Route Header - Only show if we have valid airport codes */}
            {portalCapture.origin && portalCapture.destination ? (
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-white">{portalCapture.origin}</span>
                  <div className="w-8 h-[2px] bg-white/20 rounded-full relative">
                    <Plane className="w-3 h-3 text-white/40 absolute -top-1 left-1/2 -translate-x-1/2" />
                  </div>
                  <span className="text-2xl font-bold text-white">{portalCapture.destination}</span>
                </div>
                {portalCapture.cabin && (
                  <GlassBadge variant="accent" size="md">
                    {formatCabinClass(portalCapture.cabin)}
                  </GlassBadge>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
                <div className="flex items-center gap-2 text-sm text-amber-300">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>Flight route not captured — select a flight on the portal to capture details</span>
                </div>
              </div>
            )}

            {/* Detailed Flight Info */}
            {portalCapture.outbound?.airlines && portalCapture.outbound.airlines.length > 0 && (
              <div className="space-y-2 mb-4">
                {/* Outbound Flight */}
                <FlightLegDisplay
                  leg={portalCapture.outbound}
                  label="Outbound"
                  date={portalCapture.departDate ? new Date(portalCapture.departDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined}
                />
                {/* Return Flight */}
                {portalCapture.returnFlight && portalCapture.returnFlight.airlines && (
                  <FlightLegDisplay
                    leg={portalCapture.returnFlight}
                    label="Return"
                    date={portalCapture.returnDate ? new Date(portalCapture.returnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined}
                  />
                )}
              </div>
            )}
            
            {/* If no detailed info, show basic badges */}
            {(!portalCapture.outbound?.airlines || portalCapture.outbound.airlines.length === 0) && (
              <div className="flex gap-2 flex-wrap mb-4">
                {portalCapture.departDate && (
                  <GlassBadge variant="default" size="md">
                    <Calendar className="w-3 h-3" />
                    {new Date(portalCapture.departDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {portalCapture.returnDate && ` - ${new Date(portalCapture.returnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </GlassBadge>
                )}
                {portalCapture.airline && (
                  <GlassBadge variant="default" size="md">{portalCapture.airline}</GlassBadge>
                )}
                {typeof portalCapture.stops === 'number' && (
                  <GlassBadge variant={portalCapture.stops === 0 ? 'success' : 'default'} size="sm">
                    {portalCapture.stops === 0 ? 'Nonstop' : `${portalCapture.stops} stop${portalCapture.stops > 1 ? 's' : ''}`}
                  </GlassBadge>
                )}
              </div>
            )}

            <GlassDivider className="my-4" />

            {/* Price */}
            <div className="flex justify-between items-center">
              <span className="text-white/50 text-sm">Portal Price</span>
              <span className="text-2xl font-bold text-white">${portalCapture.priceUSD.toLocaleString()}</span>
            </div>
          </GlassCard>
          
          {/* Instruction */}
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 mb-4">
            <div className="text-xs text-blue-300 font-medium mb-1">📍 Match this exact flight:</div>
            <div className="text-xs text-white/60 leading-relaxed">
              • Same airline{portalCapture.outbound?.airlines && portalCapture.outbound.airlines.length > 1 && 's'}: {portalCapture.outbound?.airlines?.join(' + ') || portalCapture.airline || 'Check airline'}
              <br />• Same dates: {portalCapture.departDate ? new Date(portalCapture.departDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Check dates'}
              {portalCapture.returnDate && ` - ${new Date(portalCapture.returnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
              <br />• Same cabin: {formatCabinClass(portalCapture.cabin)}
            </div>
            {/* IMPORTANT: Same times - highlighted to draw attention */}
            {(portalCapture.outbound?.departureTime || portalCapture.outbound?.arrivalTime) && (
              <div className="mt-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                <div className="text-xs text-amber-300 font-medium flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>Same times:</span>
                </div>
                <div className="text-xs text-amber-200/80 mt-1">
                  {portalCapture.outbound?.departureTime && (
                    <span>Departs {portalCapture.outbound.departureTime}</span>
                  )}
                  {portalCapture.outbound?.arrivalTime && (
                    <span> → Arrives {portalCapture.outbound.arrivalTime}</span>
                  )}
                  {portalCapture.returnFlight?.departureTime && (
                    <span className="block mt-0.5">
                      Return: {portalCapture.returnFlight.departureTime}
                      {portalCapture.returnFlight?.arrivalTime && ` → ${portalCapture.returnFlight.arrivalTime}`}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Loading spinner */}
          <div className="flex items-center justify-center gap-2 text-white/40">
            <motion.div
              className="w-4 h-4 border-2 border-white/20 border-t-blue-400 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <span className="text-xs">Waiting for direct price...</span>
          </div>
        </motion.div>
      )}

      {/* Direct Capture (Flights) */}
      {showDirectCapture && directCapture && portalCapture && (
        <DirectCaptureCard
          capture={directCapture}
          portalPriceUSD={portalCapture.priceUSD}
          portalCapture={portalCapture}
          onConfirm={onConfirmDirect}
          onRecapture={onRecaptureDirect}
          onFindCorrectFlight={onFindCorrectFlight}
        />
      )}

      {/* Verdict (Flights) */}
      {showVerdict && portalCapture && directCapture && (
        <>
          <VerdictSection
            portalPriceUSD={portalCapture.priceUSD}
            directPriceUSD={directCapture.priceUSD}
            creditRemaining={creditRemaining}
            milesBalance={milesBalance}  // Pass user's miles balance for Travel Eraser
            mileValueCpp={mileValuationCpp}  // Pass user's mile valuation preference
            itinerary={{
              origin: portalCapture.origin,
              destination: portalCapture.destination,
              departDate: portalCapture.departDate,
              returnDate: portalCapture.returnDate,
              cabin: portalCapture.cabin,
            }}
            tabMode={tabMode}
            onTabModeChange={onTabModeChange}
            bookingType="flight"
            // NEW-8: Pass seller info from Google Flights booking page
            sellerType={directCapture.sellerType}
            sellerName={directCapture.sellerName}
            // FX conversion detection
            hasFxConversion={directCapture.currency !== 'USD'}
            fxCurrency={directCapture.currency !== 'USD' ? directCapture.currency : undefined}
            // Allow "Tap to change" on assumptions to open Settings
            onOpenSettings={onOpenSettings}
            // P2-21: Wire up success celebration callback
            onVerdictContinue={onVerdictContinue}
          />
          
          {/* Ask About This Verdict Module - with spacing from verdict card */}
          {onAskQuestion && (
            <div className="mt-5">
              <AskAboutVerdictModule
                context={{
                  route: portalCapture.origin && portalCapture.destination
                    ? `${portalCapture.origin} → ${portalCapture.destination}`
                    : 'Your Flight',
                  portalPrice: portalCapture.priceUSD,
                  directPrice: directCapture.priceUSD,
                  winner: (portalCapture.priceUSD - creditRemaining) <= directCapture.priceUSD ? 'portal' : 'direct',
                  winnerLabel: (portalCapture.priceUSD - creditRemaining) <= directCapture.priceUSD ? 'Portal Booking' : 'Direct Booking',
                  effectiveCost: Math.min(
                    portalCapture.priceUSD - creditRemaining,
                    directCapture.priceUSD
                  ),
                  portalMilesEarned: Math.round(portalCapture.priceUSD * 5),
                  directMilesEarned: Math.round(directCapture.priceUSD * 2),
                  creditApplied: creditRemaining,
                }}
                onAskQuestion={onAskQuestion}
              />
            </div>
          )}
          
          {/* Compare Another Flight - Made more prominent per UX review */}
          <div className="mt-8 pt-6 border-t border-white/[0.08]">
            <GlassButton variant="secondary" className="w-full py-3" onClick={onReset}>
              <RefreshCw className="w-4 h-4" />
              Compare Another Flight
            </GlassButton>
            <p className="text-[10px] text-white/40 text-center mt-2">
              Start a new comparison
            </p>
          </div>
        </>
      )}

      {/* Verdict (Stays) */}
      {showStayVerdict && stayCapture && directStayCapture && (
        <>
          {/* Credit already applied notice */}
          {stayCapture.creditAlreadyApplied && stayCapture.portalCreditApplied && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
            >
              <div className="flex items-center gap-2 text-sm text-emerald-300">
                <span>✅</span>
                <span>
                  <strong>${stayCapture.portalCreditApplied} travel credit</strong> already applied by portal
                </span>
              </div>
              <div className="text-xs text-white/50 mt-1">
                Portal price shown is <strong>pre-credit</strong>. You'll pay ${stayCapture.amountDueAfterCredit} today.
              </div>
            </motion.div>
          )}
          
          <VerdictSection
            portalPriceUSD={stayCapture.priceUSD}
            directPriceUSD={directStayCapture.priceUSD}
            // CRITICAL: If credit was already applied by portal, pass 0 to avoid double-dipping!
            // The portal price already reflects what user will pay after credit.
            creditRemaining={stayCapture.creditAlreadyApplied ? 0 : creditRemaining}
            milesBalance={milesBalance}  // Pass user's miles balance for Travel Eraser
            mileValueCpp={mileValuationCpp}  // Pass user's mile valuation preference
            itinerary={undefined} // No flight itinerary for stays
            tabMode={tabMode}
            onTabModeChange={onTabModeChange}
            bookingType={stayCapture.stayType === 'vacation_rental' ? 'vacation_rental' : 'hotel'}
            // Allow "Tap to change" on assumptions to open Settings
            onOpenSettings={onOpenSettings}
            // P2-21: Wire up success celebration callback
            onVerdictContinue={onVerdictContinue}
          />
          
          {/* Ask About This Verdict Module for stays */}
          {onAskQuestion && (
            <div className="mt-5">
              <AskAboutVerdictModule
                context={{
                  route: `${stayCapture.propertyName || 'Hotel'} • ${stayCapture.location || ''}`,
                  portalPrice: stayCapture.priceUSD,
                  directPrice: directStayCapture.priceUSD,
                  // If credit already applied, use amountDueAfterCredit for portal comparison
                  winner: (stayCapture.creditAlreadyApplied && stayCapture.amountDueAfterCredit
                    ? stayCapture.amountDueAfterCredit
                    : stayCapture.priceUSD - creditRemaining) <= directStayCapture.priceUSD ? 'portal' : 'direct',
                  winnerLabel: (stayCapture.creditAlreadyApplied && stayCapture.amountDueAfterCredit
                    ? stayCapture.amountDueAfterCredit
                    : stayCapture.priceUSD - creditRemaining) <= directStayCapture.priceUSD ? 'Portal Booking' : 'Direct Booking',
                  effectiveCost: Math.min(
                    stayCapture.creditAlreadyApplied && stayCapture.amountDueAfterCredit
                      ? stayCapture.amountDueAfterCredit
                      : stayCapture.priceUSD - creditRemaining,
                    directStayCapture.priceUSD
                  ),
                  // Hotels earn 10x on portal, 2x direct
                  portalMilesEarned: Math.round(stayCapture.priceUSD * (stayCapture.stayType === 'vacation_rental' ? 5 : 10)),
                  directMilesEarned: Math.round(directStayCapture.priceUSD * 2),
                  creditApplied: stayCapture.creditAlreadyApplied ? (stayCapture.portalCreditApplied || 0) : creditRemaining,
                }}
                onAskQuestion={onAskQuestion}
              />
            </div>
          )}
          
          {/* Compare Another Stay - Made more prominent per UX review */}
          <div className="mt-8 pt-6 border-t border-white/[0.08]">
            <GlassButton variant="secondary" className="w-full py-3" onClick={onReset}>
              <RefreshCw className="w-4 h-4" />
              Compare Another Stay
            </GlassButton>
            <p className="text-[10px] text-white/40 text-center mt-2">
              Start a new comparison
            </p>
          </div>
        </>
      )}
    </div>
  );
};

// ============================================
// MAIN APP COMPONENT
// ============================================

export function SidePanelApp() {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [_prefillQuestion, setPrefillQuestion] = useState<string | null>(null);
  const [showChatBadge, setShowChatBadge] = useState(false);
  const [hasAskedAboutVerdict, setHasAskedAboutVerdict] = useState(false);
  
  // Tab mode state (persisted across tab switches)
  const [verdictTabMode, setVerdictTabMode] = useState<UITabMode>('cheapest');
  
  // Compare state
  const [currentStep, setCurrentStep] = useState<FlowStep>(1);
  const [detectedSite, setDetectedSite] = useState<DetectedSite>('unknown');
  const [bookingType, setBookingType] = useState<BookingType>('flight');
  const [portalCapture, setPortalCapture] = useState<PortalCapture | null>(null);
  const [directCapture, setDirectCapture] = useState<DirectCapture | null>(null);
  
  // Stays-specific state
  const [stayCapture, setStayCapture] = useState<StayCapture | null>(null);
  const [directStayCapture, setDirectStayCapture] = useState<DirectStayCapture | null>(null);
  
  // Step navigation confirmation popup state
  const [showStepNavConfirm, setShowStepNavConfirm] = useState<{
    targetStep: FlowStep;
    message: string;
  } | null>(null);
  
  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [showPasteDetails, setShowPasteDetails] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [userPrefs, setUserPrefs] = useState<UserPrefs | null>(null);
  
  // P2-21: Success state celebration after user confirms verdict
  const [showBookingSuccess, setShowBookingSuccess] = useState(false);
  const [successRecommendation, setSuccessRecommendation] = useState<'portal' | 'direct'>('portal');
  const [successSavings, setSuccessSavings] = useState<number | undefined>(undefined);

  // New search detection prompt - shown when user returns to portal search page with existing captured data
  const [showNewSearchPrompt, setShowNewSearchPrompt] = useState<{
    type: 'flight' | 'stay';
    summary: string;
  } | null>(null);

  // Derive context status - now supports both flights and stays
  // IMPORTANT: Don't show "???" in badges - show helpful status instead
  const contextStatus: BookingContextStatus = (() => {
    // Stays context
    if (stayCapture) {
      // Only show as captured if we have meaningful data
      const hasValidData = stayCapture.propertyName || stayCapture.location;
      if (hasValidData) {
        return {
          type: 'captured' as const,
          route: `${stayCapture.propertyName || 'Hotel'} • ${stayCapture.location || ''}`,
          site: 'Capital One Travel (Stays)',
        };
      } else {
        return {
          type: 'detected' as const,
          site: 'Capital One Travel (Stays)',
        };
      }
    }
    // Flights context
    if (portalCapture) {
      // Only show route if we have BOTH origin AND destination (not "???")
      const hasValidRoute = portalCapture.origin && portalCapture.destination;
      if (hasValidRoute) {
        return {
          type: 'captured' as const,
          route: `${portalCapture.origin} → ${portalCapture.destination}`,
          site: detectedSite === 'capital-one-portal' ? 'Capital One Travel' : 'Google Flights',
        };
      } else {
        return {
          type: 'detected' as const,
          site: detectedSite === 'capital-one-portal' ? 'Capital One Travel' : 'Google Flights',
        };
      }
    }
    // Detected but not captured
    if (detectedSite !== 'unknown') {
      const siteLabels: Record<DetectedSite, string> = {
        'capital-one-portal': 'Capital One Travel (Flights)',
        'capital-one-stays': 'Capital One Travel (Stays)',
        'capital-one-unsupported': 'Capital One Travel',
        'google-flights': 'Google Flights',
        'google-hotels': 'Google Hotels',
        'other': 'Travel Site',
        'unknown': '',
      };
      return { type: 'detected' as const, site: siteLabels[detectedSite] };
    }
    return { type: 'none' as const };
  })();

  // Check onboarding on mount
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const needs = await needsOnboarding();
        setShowOnboarding(needs);
        
        if (!needs) {
          const prefs = await getUserPrefs();
          setUserPrefs(prefs);
          
          // Set initial tab based on preferences and context
          if (prefs.defaultOpenTab === 'chat') {
            setActiveTab('chat');
          } else if (prefs.defaultOpenTab === 'compare') {
            setActiveTab('compare');
          }
          // 'auto' is handled below after page detection
        }
      } catch (e) {
        console.error('[SidePanelApp] Onboarding check error:', e);
      } finally {
        setCheckingOnboarding(false);
      }
    };
    
    checkOnboardingStatus();
  }, []);

  // Initialize and set up message listeners
  useEffect(() => {
    if (!checkingOnboarding && !showOnboarding) {
      console.log('[SidePanelApp] Initializing v4.0 Redesigned...');
      
      setMessages([{
        id: '1',
        role: 'assistant',
        content: "👋 Hi! I'm VentureXify, your Capital One Venture X assistant. Ask me anything about portal bookings, miles, Travel Eraser, or transfer partners.",
        timestamp: Date.now(),
      }]);
      
      detectCurrentPage();
      loadCapturedData();
      
      // ============================================
      // TAB CHANGE LISTENER
      // When user navigates or switches tabs, detect new page
      // and clear stale captures from different booking type
      // ============================================
      const handleTabActivated = (_activeInfo: chrome.tabs.TabActiveInfo) => {
        console.log('[SidePanelApp] 🔄 Tab activated - re-detecting page');
        detectCurrentPage();
      };
      
      const handleTabUpdated = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
        // Only re-detect on URL changes for active tab
        if (changeInfo.url && tab.active) {
          console.log('[SidePanelApp] 🔄 URL changed - re-detecting page:', changeInfo.url.substring(0, 60));
          detectCurrentPage();
        }
        // Also re-detect when page finishes loading (for SPA navigations)
        if (changeInfo.status === 'complete' && tab.active) {
          console.log('[SidePanelApp] 🔄 Page load complete - re-detecting');
          detectCurrentPage();
        }
      };
      
      // Listen for tab activation and URL changes
      chrome.tabs.onActivated.addListener(handleTabActivated);
      chrome.tabs.onUpdated.addListener(handleTabUpdated);
      
      // Set up message listener for price captures from content scripts
      const handleMessage = (message: { type: string; payload?: unknown }) => {
        console.log('[SidePanelApp] 📩 Message received:', message.type, 'has payload:', !!message.payload);
        
        // DEBUG: Log ALL stay-related messages
        if (message.type.includes('STAY') || message.type.includes('stay')) {
          console.log('[SidePanelApp] 🏨 STAY MESSAGE:', message.type, JSON.stringify(message.payload, null, 2));
        }
        
        // Flight portal capture
        if (message.type === 'PORTAL_CAPTURE' || message.type === 'FLOW_STATE_UPDATE') {
          const payload = message.payload as { snapshot?: unknown; portalSnapshot?: unknown };
          const snapshot = payload?.snapshot || payload?.portalSnapshot;
          if (snapshot) {
            console.log('[SidePanelApp] Processing portal snapshot:', snapshot);
            processPortalSnapshot(snapshot);
            setBookingType('flight');
            // IMPORTANT: When receiving a new portal capture, reset to step 1
            // This ensures we don't show step 2 from stale direct captures
            setCurrentStep(1);
            // Clear any stale direct capture that might be from a different flight
            setDirectCapture(null);
            console.log('[SidePanelApp] ✈️ New portal capture - reset to step 1');
          }
        }
        
        // Flight direct capture
        if (message.type === 'DIRECT_CAPTURE' || message.type === 'VX_COMPARE_DIRECT_CAPTURED') {
          const payload = message.payload as { snapshot?: unknown; directSnapshot?: unknown };
          const snapshot = payload?.snapshot || payload?.directSnapshot;
          if (snapshot) {
            console.log('[SidePanelApp] Processing direct snapshot:', snapshot);
            processDirectSnapshot(snapshot);
          }
        }
        
        // ============================================
        // STAYS MESSAGE HANDLERS (NEW)
        // Handle both VX_ prefixed (from content script) and non-prefixed (from router broadcast)
        // ============================================
        
        // Stay portal capture from Capital One Travel
        // Router broadcasts STAY_PORTAL_CAPTURED, content script sends VX_STAY_PORTAL_CAPTURED
        if (message.type === 'STAY_PORTAL_CAPTURED' || message.type === 'VX_STAY_PORTAL_CAPTURED') {
          const payload = message.payload as { stayCapture?: unknown };
          if (payload?.stayCapture) {
            console.log('[SidePanelApp] Processing stay portal capture:', payload.stayCapture);
            processStayPortalSnapshot(payload.stayCapture);
            setBookingType('stay');
            setDetectedSite('capital-one-stays');
            // IMPORTANT: When receiving a new stay portal capture, reset to step 1
            // This ensures we don't show step 2 from stale direct captures
            setCurrentStep(1);
            // Clear any stale direct stay capture that might be from a different property
            setDirectStayCapture(null);
            console.log('[SidePanelApp] 🏨 New stay portal capture - reset to step 1');
            // Auto-switch to compare tab when capture received
            if (userPrefs?.defaultOpenTab === 'auto' || !userPrefs) {
              setActiveTab('compare');
            }
          }
        }
        
        // Stay direct capture from Google Hotels
        // Router broadcasts STAY_DIRECT_CAPTURED, content script sends VX_STAY_DIRECT_CAPTURED
        if (message.type === 'STAY_DIRECT_CAPTURED' || message.type === 'VX_STAY_DIRECT_CAPTURED') {
          const payload = message.payload as { directCapture?: unknown };
          if (payload?.directCapture) {
            console.log('[SidePanelApp] Processing stay direct capture:', payload.directCapture);
            processStayDirectSnapshot(payload.directCapture);
          }
        }
        
        // Portal updated (manual price entry)
        if (message.type === 'STAY_PORTAL_UPDATED') {
          const payload = message.payload as { portalCapture?: unknown };
          if (payload?.portalCapture) {
            console.log('[SidePanelApp] Stay portal updated:', payload.portalCapture);
            processStayPortalSnapshot(payload.portalCapture);
          }
        }
        
        // Stay verdict computed
        if (message.type === 'STAY_VERDICT_COMPUTED') {
          const payload = message.payload as { verdict?: unknown };
          if (payload?.verdict) {
            console.log('[SidePanelApp] Stay verdict received:', payload.verdict);
            // Could store verdict state here if needed
          }
        }
        
        // Stay flow reset
        if (message.type === 'STAY_FLOW_RESET') {
          console.log('[SidePanelApp] Stay flow reset');
          setStayCapture(null);
          setDirectStayCapture(null);
          setCurrentStep(1);
        }
        
        // Context update - re-detect page
        if (message.type === 'VX_CONTEXT_UPDATE') {
          detectCurrentPage();
        }
      };
      
      chrome.runtime.onMessage.addListener(handleMessage);
      
      // IMPORTANT: Also watch chrome.storage for changes
      // This is MORE RELIABLE than message passing for side panels
      const handleStorageChange = (
        changes: { [key: string]: chrome.storage.StorageChange }
      ) => {
        console.log('[SidePanelApp] 💾 Storage changed:', Object.keys(changes));
        
        // Watch for stay portal capture changes
        if (changes.vx_stay_portal_snapshot?.newValue) {
          console.log('[SidePanelApp] 🏨 Stay portal snapshot changed in storage!');
          processStayPortalSnapshot(changes.vx_stay_portal_snapshot.newValue);
          setBookingType('stay');
          setDetectedSite('capital-one-stays');
          // IMPORTANT: Reset to step 1 and clear stale direct capture
          setCurrentStep(1);
          setDirectStayCapture(null);
          console.log('[SidePanelApp] 🏨 New stay portal snapshot - reset to step 1');
          setActiveTab('compare');
        }
        
        // Watch for stay direct capture changes
        if (changes.vx_stay_direct_snapshot?.newValue) {
          console.log('[SidePanelApp] 🏨 Stay direct snapshot changed in storage!');
          processStayDirectSnapshot(changes.vx_stay_direct_snapshot.newValue);
          setCurrentStep(2);
        }
        
        // Watch for flight portal capture changes
        if (changes.vx_portal_snapshot?.newValue && !changes.vx_stay_portal_snapshot?.newValue) {
          console.log('[SidePanelApp] ✈️ Flight portal snapshot changed in storage!');
          processPortalSnapshot(changes.vx_portal_snapshot.newValue);
          setBookingType('flight');
          // IMPORTANT: Reset to step 1 and clear stale direct capture
          setCurrentStep(1);
          setDirectCapture(null);
          console.log('[SidePanelApp] ✈️ New flight portal snapshot - reset to step 1');
        }
        
        // Watch for flight direct capture changes
        if (changes.vx_direct_snapshot?.newValue && !changes.vx_stay_direct_snapshot?.newValue) {
          console.log('[SidePanelApp] ✈️ Flight direct snapshot changed in storage!');
          processDirectSnapshot(changes.vx_direct_snapshot.newValue);
        }
      };
      
      chrome.storage.local.onChanged.addListener(handleStorageChange);
      
      return () => {
        console.log('[SidePanelApp] Cleaning up listeners');
        chrome.runtime.onMessage.removeListener(handleMessage);
        chrome.storage.local.onChanged.removeListener(handleStorageChange);
        chrome.tabs.onActivated.removeListener(handleTabActivated);
        chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      };
    }
  }, [checkingOnboarding, showOnboarding]);

  // Auto-select tab based on context (for 'auto' mode)
  // Only switch to Compare when there's actually captured data, not just detected site
  useEffect(() => {
    if (userPrefs?.defaultOpenTab === 'auto' || !userPrefs) {
      // Only auto-switch to compare if we have actual captured data
      if (contextStatus.type === 'captured') {
        setActiveTab('compare');
      }
      // Otherwise stay on chat (or wherever user navigated)
    }
  }, [contextStatus.type, userPrefs?.defaultOpenTab]);

  // Show chat badge when verdict is available and user hasn't asked about it
  useEffect(() => {
    const hasVerdict = portalCapture && directCapture && currentStep === 3;
    if (hasVerdict && !hasAskedAboutVerdict) {
      setShowChatBadge(true);
    }
  }, [portalCapture, directCapture, currentStep, hasAskedAboutVerdict]);

  // Reset the hasAskedAboutVerdict flag when comparing a new flight
  useEffect(() => {
    if (currentStep === 1) {
      setHasAskedAboutVerdict(false);
      setShowChatBadge(false);
    }
  }, [currentStep]);

  // Load any previously captured data from storage
  // SMART LOADING: Only load captures relevant to the CURRENT PAGE
  // ALSO: Force re-capture on portal pages to get fresh data
  const loadCapturedData = async () => {
    try {
      console.log('[SidePanelApp] 📦 Loading captured data from storage...');
      
      // First, detect what type of page we're currently on
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentUrl = (tab?.url || '').toLowerCase();
      
      // ============================================
      // FORCE RE-CAPTURE ON PORTAL PAGES
      // When the side panel opens on a portal page, force a fresh capture
      // to ensure we have the latest price (not stale cached data)
      // ============================================
      // IMPORTANT: Only force capture on REVIEW/BOOK pages, NOT on search/selection pages!
      // URL patterns:
      // - flightShopProgress=1 = Departure selection (SEARCH - skip)
      // - flightShopProgress=2 = Return selection (SEARCH - skip)
      // - flightShopProgress=3 = Review itinerary (CAPTURE ✓)
      // - /flights/book = Book page (CAPTURE ✓)
      const flightProgressMatch = currentUrl.match(/flightshopprogress=(\d+)/i);
      const flightProgress = flightProgressMatch ? parseInt(flightProgressMatch[1], 10) : 0;
      const isOnReviewOrBookPage = (flightProgress === 3) || currentUrl.includes('/flights/book');
      
      const isOnCapitalOnePortalFlights = currentUrl.includes('capitalone.com') &&
                                           currentUrl.includes('flights') &&
                                           !currentUrl.includes('/stays/') &&
                                           !currentUrl.includes('/hotels/');
      const isOnCapitalOneStays = currentUrl.includes('capitalone.com') &&
                                   (currentUrl.includes('/stays/') || currentUrl.includes('/hotels/') || currentUrl.includes('lodgings'));
      
      // Only force capture on REVIEW/BOOK pages, NOT while user is browsing flights
      if (isOnCapitalOnePortalFlights && isOnReviewOrBookPage && tab?.id) {
        console.log('[SidePanelApp] ✈️ On Capital One portal REVIEW/BOOK page - forcing fresh capture...');
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'FORCE_CAPTURE_PORTAL' });
          // Give the content script a moment to capture and send the message
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
          console.log('[SidePanelApp] Force capture failed (content script may not be ready):', e);
        }
      } else if (isOnCapitalOnePortalFlights && !isOnReviewOrBookPage) {
        console.log('[SidePanelApp] ✈️ On Capital One portal SEARCH page (progress=' + flightProgress + ') - NOT capturing, user is browsing');
      }
      
      if (isOnCapitalOneStays && tab?.id) {
        console.log('[SidePanelApp] 🏨 On Capital One stays - forcing fresh capture...');
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'FORCE_CAPTURE_STAY' });
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
          console.log('[SidePanelApp] Force stay capture failed:', e);
        }
      }
      
      // Determine current page type from URL
      const isOnStaysPage = (currentUrl.includes('capitalone.com') &&
                            (currentUrl.includes('/stays/') || currentUrl.includes('/hotels/') || currentUrl.includes('lodgings'))) ||
                           (currentUrl.includes('google.com/travel') && currentUrl.includes('hotel'));
      const isOnFlightsPage = (currentUrl.includes('capitalone.com') &&
                              (currentUrl.includes('/flights') || currentUrl.includes('flights/shop'))) ||
                             (currentUrl.includes('google.com') && (currentUrl.includes('/flights') || currentUrl.includes('/travel/flights')));
      
      console.log('[SidePanelApp] 📦 Current page analysis:', {
        url: currentUrl.substring(0, 80),
        isOnStaysPage,
        isOnFlightsPage
      });
      
      const data = await chrome.storage.local.get([
        'vx_portal_snapshot',
        'vx_direct_snapshot',
        'vx_flow_state',
        'vx_stay_portal_snapshot',
        'vx_stay_direct_snapshot'
      ]);
      
      console.log('[SidePanelApp] 📦 Storage keys found:', Object.keys(data).filter(k => data[k]));
      
      // ============================================
      // SMART LOADING LOGIC:
      // Only load captures that match the CURRENT page type
      // This prevents stale hotel data from showing on flight pages
      // ============================================
      
      // If we're on a FLIGHTS page, clear stale stay data and load flights
      if (isOnFlightsPage) {
        console.log('[SidePanelApp] ✈️ On flights page - clearing any stale stay data');
        setStayCapture(null);
        setDirectStayCapture(null);
        
        // Clear stale stay snapshots from storage
        if (data.vx_stay_portal_snapshot || data.vx_stay_direct_snapshot) {
          await chrome.storage.local.remove(['vx_stay_portal_snapshot', 'vx_stay_direct_snapshot']);
          console.log('[SidePanelApp] 🗑️ Cleared stale stay snapshots from storage');
        }
        
        // Determine if we're specifically on Capital One portal vs Google Flights
        // This is important for setting the correct step
        const isOnCapitalOnePortal = currentUrl.includes('capitalone.com');
        const isOnGoogleFlights = currentUrl.includes('google.com') &&
                                   (currentUrl.includes('/flights') || currentUrl.includes('/travel/flights'));
        
        // Load flight data if available
        if (data.vx_portal_snapshot) {
          console.log('[SidePanelApp] ✈️ Loading portal snapshot from storage');
          processPortalSnapshot(data.vx_portal_snapshot);
        }
        
        // Only load direct snapshot if we're NOT on the portal page
        // When on portal, any existing direct capture is likely from a different flight
        // and loading it would incorrectly set step to 2
        if (data.vx_direct_snapshot) {
          if (!isOnCapitalOnePortal) {
            console.log('[SidePanelApp] ✈️ Loading direct snapshot from storage');
            processDirectSnapshot(data.vx_direct_snapshot);
          } else {
            console.log('[SidePanelApp] ✈️ On portal page - NOT loading direct snapshot (stale from different flight)');
            // Clear the direct capture state to ensure step 1 is shown
            setDirectCapture(null);
            // Clear stale direct snapshot from storage
            await chrome.storage.local.remove(['vx_direct_snapshot']);
            console.log('[SidePanelApp] 🗑️ Cleared stale direct snapshot from storage');
          }
        }
        
        // Explicitly set the correct step based on current page context
        // This prevents showing step 2 when user is on the portal page
        if (isOnCapitalOnePortal) {
          console.log('[SidePanelApp] ✈️ On portal - setting step to 1');
          setCurrentStep(1);
        } else if (isOnGoogleFlights && data.vx_portal_snapshot) {
          console.log('[SidePanelApp] ✈️ On Google Flights with portal data - setting step to 2');
          setCurrentStep(2);
        }
        
        setBookingType('flight');
        return;
      }
      
      // If we're on a STAYS page, clear stale flight data and load stays
      if (isOnStaysPage) {
        console.log('[SidePanelApp] 🏨 On stays page - clearing any stale flight data');
        setPortalCapture(null);
        setDirectCapture(null);
        
        // Clear stale flight snapshots from storage
        if (data.vx_portal_snapshot || data.vx_direct_snapshot) {
          await chrome.storage.local.remove(['vx_portal_snapshot', 'vx_direct_snapshot']);
          console.log('[SidePanelApp] 🗑️ Cleared stale flight snapshots from storage');
        }
        
        // Determine if we're specifically on Capital One stays portal vs Google Hotels
        // This is important for setting the correct step
        const isOnCapitalOneStays = currentUrl.includes('capitalone.com') &&
                                     (currentUrl.includes('/stays/') || currentUrl.includes('/hotels/') || currentUrl.includes('lodgings'));
        const isOnGoogleHotels = currentUrl.includes('google.com/travel') && currentUrl.includes('hotel');
        
        // Load stay data if available
        if (data.vx_stay_portal_snapshot) {
          console.log('[SidePanelApp] 🏨 Loading stay portal snapshot from storage');
          processStayPortalSnapshot(data.vx_stay_portal_snapshot);
          setBookingType('stay');
          setDetectedSite('capital-one-stays');
        }
        
        // Only load direct stay snapshot if we're NOT on the portal page
        // When on portal, any existing direct capture is likely from a different property
        // and loading it would incorrectly set step to 2
        if (data.vx_stay_direct_snapshot) {
          if (!isOnCapitalOneStays) {
            console.log('[SidePanelApp] 🏨 Loading stay direct snapshot from storage');
            processStayDirectSnapshot(data.vx_stay_direct_snapshot);
          } else {
            console.log('[SidePanelApp] 🏨 On portal stays page - NOT loading direct snapshot (stale from different property)');
            // Clear the direct stay capture state to ensure step 1 is shown
            setDirectStayCapture(null);
            // Clear stale direct snapshot from storage
            await chrome.storage.local.remove(['vx_stay_direct_snapshot']);
            console.log('[SidePanelApp] 🗑️ Cleared stale stay direct snapshot from storage');
          }
        }
        
        // Explicitly set the correct step based on current page context
        // This prevents showing step 2 when user is on the portal stays page
        if (isOnCapitalOneStays) {
          console.log('[SidePanelApp] 🏨 On portal stays - setting step to 1');
          setCurrentStep(1);
        } else if (isOnGoogleHotels && data.vx_stay_portal_snapshot) {
          console.log('[SidePanelApp] 🏨 On Google Hotels with portal data - setting step to 2');
          setCurrentStep(2);
        }
        
        return;
      }
      
      // If we're on an UNKNOWN page (neither flights nor stays),
      // load the most recent data (stay data takes precedence for backwards compat)
      console.log('[SidePanelApp] ❓ On unknown page - loading most recent captures');
      
      let hasStayData = false;
      
      if (data.vx_stay_portal_snapshot) {
        console.log('[SidePanelApp] 🏨 Found stay portal snapshot in storage');
        processStayPortalSnapshot(data.vx_stay_portal_snapshot);
        hasStayData = true;
        setBookingType('stay');
        setDetectedSite('capital-one-stays');
      }
      if (data.vx_stay_direct_snapshot) {
        console.log('[SidePanelApp] 🏨 Found stay direct snapshot in storage');
        processStayDirectSnapshot(data.vx_stay_direct_snapshot);
        hasStayData = true;
      }
      
      // Only load flight captures if we DON'T have stay data
      if (!hasStayData) {
        if (data.vx_portal_snapshot) {
          console.log('[SidePanelApp] ✈️ Found portal snapshot in storage');
          processPortalSnapshot(data.vx_portal_snapshot);
        }
        if (data.vx_direct_snapshot) {
          console.log('[SidePanelApp] ✈️ Found direct snapshot in storage');
          processDirectSnapshot(data.vx_direct_snapshot);
        }
      }
      
      // Also check flow state which might have the data
      if (data.vx_flow_state) {
        const flowState = data.vx_flow_state as { portalSnapshot?: unknown; directSnapshot?: unknown; stayPortalSnapshot?: unknown; stayDirectSnapshot?: unknown };
        
        // Stay data takes precedence (only if on stays page or no page detected)
        if (!isOnFlightsPage && flowState.stayPortalSnapshot) {
          console.log('[SidePanelApp] 🏨 Found stay portal snapshot in flow state');
          processStayPortalSnapshot(flowState.stayPortalSnapshot);
          hasStayData = true;
          setBookingType('stay');
        }
        if (!isOnFlightsPage && flowState.stayDirectSnapshot) {
          console.log('[SidePanelApp] 🏨 Found stay direct snapshot in flow state');
          processStayDirectSnapshot(flowState.stayDirectSnapshot);
          hasStayData = true;
        }
        
        // Flight data only if no stay data
        if (!hasStayData && !isOnStaysPage) {
          if (flowState.portalSnapshot) {
            console.log('[SidePanelApp] ✈️ Found portal snapshot in flow state');
            processPortalSnapshot(flowState.portalSnapshot);
          }
          if (flowState.directSnapshot) {
            console.log('[SidePanelApp] ✈️ Found direct snapshot in flow state');
            processDirectSnapshot(flowState.directSnapshot);
          }
        }
      }
    } catch (e) {
      console.error('[SidePanelApp] ❌ Error loading captured data:', e);
    }
  };

  const processPortalSnapshot = (snapshot: unknown) => {
    const s = snapshot as {
      totalPrice?: { amount?: number; currency?: string };
      itinerary?: {
        origin?: string; destination?: string; departDate?: string; returnDate?: string;
        cabin?: string; departureTime?: string; arrivalTime?: string; duration?: string;
        stops?: number; stopAirports?: string[]; airlines?: string[];
        // Return flight data (from original AppPremium.tsx)
        returnDepartureTime?: string; returnArrivalTime?: string; returnDuration?: string;
        returnStops?: number; returnStopAirports?: string[]; returnAirlines?: string[];
      };
      providerName?: string;
    };
    
    if (s?.totalPrice?.amount) {
      const itinerary = s.itinerary;
      const rawPrice = s.totalPrice.amount;
      const currency = s.totalPrice.currency || 'USD';
      const priceUSD = currency === 'USD' ? rawPrice : convertToUSD(rawPrice, currency);
      
      const capture: PortalCapture = {
        price: rawPrice,
        priceUSD: Math.round(priceUSD),
        currency,
        origin: itinerary?.origin,
        destination: itinerary?.destination,
        departDate: itinerary?.departDate,
        returnDate: itinerary?.returnDate,
        cabin: itinerary?.cabin,
        outbound: {
          airlines: itinerary?.airlines || (s.providerName ? [s.providerName] : undefined),
          departureTime: itinerary?.departureTime,
          arrivalTime: itinerary?.arrivalTime,
          duration: itinerary?.duration,
          stops: itinerary?.stops,
          stopAirports: itinerary?.stopAirports,
        },
        // Include return flight data (from original AppPremium.tsx)
        returnFlight: itinerary?.returnDepartureTime ? {
          airlines: itinerary?.returnAirlines || itinerary?.airlines,
          departureTime: itinerary?.returnDepartureTime,
          arrivalTime: itinerary?.returnArrivalTime,
          duration: itinerary?.returnDuration,
          stops: itinerary?.returnStops,
          stopAirports: itinerary?.returnStopAirports,
        } : undefined,
        airline: s.providerName || itinerary?.airlines?.[0],
        stops: itinerary?.stops,
      };
      
      setPortalCapture(capture);
      setDetectedSite('capital-one-portal');
    }
  };

  const processDirectSnapshot = (snapshot: unknown) => {
    const s = snapshot as {
      totalPrice?: { amount?: number; currency?: string };
      siteName?: string;
      // Seller info from Google Flights booking page (NEW-8 fix)
      sellerType?: 'airline' | 'ota' | 'metasearch' | 'unknown';
      sellerName?: string;
      bookingOptions?: Array<{
        provider: string;
        providerType: 'airline' | 'ota' | 'metasearch' | 'unknown';
        price: number;
        currency: string;
        isLowest: boolean;
      }>;
      lowestPriceProvider?: string;
    };
    
    if (s?.totalPrice?.amount) {
      const rawPrice = s.totalPrice.amount;
      const currency = s.totalPrice.currency || 'USD';
      const priceUSD = currency === 'USD' ? rawPrice : convertToUSD(rawPrice, currency);
      
      // Log seller info for debugging (NEW-8)
      if (s.sellerType || s.sellerName || s.bookingOptions) {
        console.log('[SidePanelApp] ✈️ Direct capture with seller info:', {
          sellerType: s.sellerType,
          sellerName: s.sellerName,
          bookingOptionsCount: s.bookingOptions?.length,
          lowestPriceProvider: s.lowestPriceProvider,
        });
      }
      
      setDirectCapture({
        price: rawPrice,
        priceUSD: Math.round(priceUSD),
        currency,
        siteName: s.siteName || 'Google Flights',
        // Pass seller info from Google Flights booking page (NEW-8 fix)
        sellerType: s.sellerType,
        sellerName: s.sellerName,
        bookingOptions: s.bookingOptions,
        lowestPriceProvider: s.lowestPriceProvider,
      });
      setDetectedSite('google-flights');
      setCurrentStep(2);
    }
  };

  // Process stay portal snapshot from Capital One Travel
  // NOTE: This handles both the StayPortalCapture format from staysCapture.ts
  // AND any legacy/alternative flat structures
  const processStayPortalSnapshot = (snapshot: unknown) => {
    try {
      console.log('[SidePanelApp] 🏨🏨🏨 processStayPortalSnapshot CALLED');
      console.log('[SidePanelApp] 🏨 Raw snapshot:', JSON.stringify(snapshot, null, 2));
      
      if (!snapshot || typeof snapshot !== 'object') {
        console.error('[SidePanelApp] ❌ Invalid snapshot - not an object');
        return;
      }
      
      // Cast to any first to handle flexible field access, then narrow
      const raw = snapshot as Record<string, unknown>;
      
      // Log all available keys for debugging
      console.log('[SidePanelApp] 🏨 Snapshot keys:', Object.keys(raw));
      console.log('[SidePanelApp] 🏨 checkoutBreakdown:', JSON.stringify(raw.checkoutBreakdown));
      console.log('[SidePanelApp] 🏨 property:', JSON.stringify(raw.property));
      console.log('[SidePanelApp] 🏨 totalPrice:', JSON.stringify(raw.totalPrice));
      
      const s = {
        // Support StayPortalCapture.property (which has 'city' not 'location')
        property: raw.property as { propertyName?: string; city?: string; location?: string; starRating?: number } | undefined,
        // Support StayPortalCapture.searchContext (which has 'place')
        searchContext: raw.searchContext as { checkIn?: string; checkOut?: string; adults?: number; rooms?: number; place?: string; nights?: number } | undefined,
        // Support StayPortalCapture.selectedRoom
        selectedRoom: raw.selectedRoom as { roomName?: string; refundable?: boolean; isRefundable?: boolean; mealPlan?: string; perNight?: number } | undefined,
        // Support pricing
        pricing: raw.pricing as { totalCash?: number; taxesFees?: number; perNight?: number; milesEquivalent?: number; currency?: string } | undefined,
        // Support StayPortalCapture fields - NOTE: checkoutBreakdown contains credit info!
        checkoutBreakdown: raw.checkoutBreakdown as {
          roomSubtotal?: number;
          taxesFees?: number;
          dueTodayCash?: number;          // PRE-credit price
          dueTodayMiles?: number;
          creditApplied?: number;          // Amount of credit portal applied
          creditAlreadyApplied?: boolean;  // Whether credit was applied
          amountDueAfterCredit?: number;   // POST-credit price (what user actually pays)
          payAtProperty?: number;          // Additional service fee due at check-in
          payAtPropertyLabel?: string;     // Label for the fee (e.g., "Additional Service Fee")
          totalAllIn?: number;             // Total all-in cost (dueTodayCash + payAtProperty)
        } | undefined,
        totalPrice: raw.totalPrice as { amount?: number; currency?: string } | undefined,
        accommodationType: raw.accommodationType as string | undefined,
        portalMilesEquivalent: raw.portalMilesEquivalent as number | undefined,
        // Alternative flat structure fields
        stayType: raw.stayType as 'hotel' | 'vacation_rental' | undefined,
        propertyName: raw.propertyName as string | undefined,
        location: raw.location as string | undefined,
        checkIn: raw.checkIn as string | undefined,
        checkOut: raw.checkOut as string | undefined,
        nights: raw.nights as number | undefined,
        taxesFees: raw.taxesFees as number | undefined,
        milesEquivalent: raw.milesEquivalent as number | undefined,
      };
    
    // Extract price (support both nested and flat structures)
    // IMPORTANT: checkoutBreakdown.dueTodayCash is the PRE-credit "Due Today" value!
    // This is the TRUE portal price before any credit deduction.
    // If not available, fall back to roomSubtotal + taxesFees, totalPrice, or pricing.totalCash
    const rawPrice = s.checkoutBreakdown?.dueTodayCash ||
                     (s.checkoutBreakdown?.roomSubtotal && s.checkoutBreakdown?.taxesFees
                       ? s.checkoutBreakdown.roomSubtotal + s.checkoutBreakdown.taxesFees
                       : 0) ||
                     s.totalPrice?.amount ||
                     s.pricing?.totalCash ||
                     0;
    const currency = s.pricing?.currency || s.totalPrice?.currency || 'USD';
    const priceUSD = currency === 'USD' ? rawPrice : convertToUSD(rawPrice, currency);
    
    // Extract credit info from checkout breakdown
    const portalCreditApplied = s.checkoutBreakdown?.creditApplied || 0;
    const creditAlreadyApplied = s.checkoutBreakdown?.creditAlreadyApplied || (portalCreditApplied > 0);
    const amountDueAfterCredit = s.checkoutBreakdown?.amountDueAfterCredit ||
                                  (creditAlreadyApplied ? rawPrice - portalCreditApplied : rawPrice);
    
    console.log('[SidePanelApp] 🏨 Price extraction:', {
      dueTodayCash: s.checkoutBreakdown?.dueTodayCash,
      roomSubtotal: s.checkoutBreakdown?.roomSubtotal,
      totalPriceAmount: s.totalPrice?.amount,
      rawPrice,
      portalCreditApplied,
      creditAlreadyApplied,
      amountDueAfterCredit,
    });
    
    // IMPORTANT: Clear flight data when processing stay data to avoid UI confusion
    if (rawPrice > 0) {
      // Clear any existing flight captures since we're now in stay mode
      setPortalCapture(null);
      setDirectCapture(null);
      // Calculate nights from dates if not provided
      let nights = s.nights;
      if (!nights && s.searchContext?.checkIn && s.searchContext?.checkOut) {
        const checkInDate = new Date(s.searchContext.checkIn);
        const checkOutDate = new Date(s.searchContext.checkOut);
        nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      } else if (!nights && s.checkIn && s.checkOut) {
        const checkInDate = new Date(s.checkIn);
        const checkOutDate = new Date(s.checkOut);
        nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      }
      
      const capture: StayCapture = {
        price: rawPrice,
        priceUSD: Math.round(priceUSD),  // This is PRE-credit price
        currency,
        propertyName: s.property?.propertyName || s.propertyName,
        // Support both 'location' and 'city' field names (StayPropertyDetails uses 'city')
        location: s.property?.location || (s.property as any)?.city || s.location || s.searchContext?.place,
        checkIn: s.searchContext?.checkIn || s.checkIn,
        checkOut: s.searchContext?.checkOut || s.checkOut,
        nights: nights || 1,
        guests: s.searchContext?.adults,
        rooms: s.searchContext?.rooms,
        roomType: s.selectedRoom?.roomName,
        refundable: s.selectedRoom?.refundable || s.selectedRoom?.isRefundable,
        mealPlan: s.selectedRoom?.mealPlan,
        milesEquivalent: s.pricing?.milesEquivalent || s.milesEquivalent || s.portalMilesEquivalent,
        taxesFees: s.pricing?.taxesFees || s.taxesFees || s.checkoutBreakdown?.taxesFees,
        perNight: s.pricing?.perNight || s.selectedRoom?.perNight,
        stayType: (s.stayType || s.accommodationType) === 'vacation_rental' ? 'vacation_rental' : 'hotel',
        starRating: s.property?.starRating || (raw.starRating as number | undefined),  // Hotel star rating
        // Credit tracking - critical for correct verdict calculation!
        portalCreditApplied: portalCreditApplied > 0 ? portalCreditApplied : undefined,
        creditAlreadyApplied: creditAlreadyApplied,
        amountDueAfterCredit: creditAlreadyApplied ? Math.round(amountDueAfterCredit) : undefined,
        // Pay at property - additional service fees due at check-in (resort fee, etc.)
        payAtProperty: s.checkoutBreakdown?.payAtProperty,
        payAtPropertyLabel: s.checkoutBreakdown?.payAtPropertyLabel || 'Additional Service Fee',
        totalAllIn: s.checkoutBreakdown?.totalAllIn ||
                    (s.checkoutBreakdown?.payAtProperty
                      ? rawPrice + s.checkoutBreakdown.payAtProperty
                      : undefined),
      };
      
      setStayCapture(capture);
      setDetectedSite('capital-one-stays');
      setBookingType('stay');
      console.log('[SidePanelApp] Stay capture set:', capture);
    }
  } catch (e) {
    console.error('[SidePanelApp] ❌ Error processing stay snapshot:', e);
  }
};

  // Process direct stay snapshot from Google Hotels
  const processStayDirectSnapshot = (snapshot: unknown) => {
    const s = snapshot as {
      totalPrice?: { amount?: number; currency?: string };
      provider?: string;
      taxesFees?: number;
      perNight?: number;
      confidence?: 'high' | 'medium' | 'low';
      siteName?: string;
    };
    
    if (s?.totalPrice?.amount) {
      const rawPrice = s.totalPrice.amount;
      const currency = s.totalPrice.currency || 'USD';
      const priceUSD = currency === 'USD' ? rawPrice : convertToUSD(rawPrice, currency);
      
      setDirectStayCapture({
        price: rawPrice,
        priceUSD: Math.round(priceUSD),
        currency,
        siteName: s.siteName || 'Google Hotels',
        provider: s.provider,
        taxesFees: s.taxesFees,
        perNight: s.perNight,
        confidence: s.confidence || 'medium',
      });
      setDetectedSite('google-hotels');
      setCurrentStep(2);
    }
  };

  const detectCurrentPage = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('[SidePanelApp] Detecting page, URL:', tab?.url);
      if (tab?.url) {
        const url = tab.url.toLowerCase();
        
        // Determine what type of page this is
        let newDetectedSite: DetectedSite = 'unknown';
        let newBookingType: BookingType = 'flight';
        let newStep: FlowStep = 1;
        
        // Capital One Travel - UNSUPPORTED pages (cars, packages, activities, premium-stays)
        // Check these FIRST before other Capital One detection
        if ((url.includes('capitalone.com') || url.includes('travel.capitalone.com')) &&
            (url.includes('/cars') || url.includes('/packages') || url.includes('/activities') || url.includes('/premium-stays'))) {
          console.log('[SidePanelApp] Detected Capital One Travel (UNSUPPORTED - cars/packages/activities/premium-stays)');
          newDetectedSite = 'capital-one-unsupported';
          newBookingType = 'flight'; // Default, doesn't matter for unsupported
        }
        // Capital One Travel - Stays detection (check first, more specific)
        else if ((url.includes('capitalone.com') || url.includes('travel.capitalone.com')) &&
            (url.includes('/stays/') || url.includes('/hotels/') || url.includes('lodgings'))) {
          console.log('[SidePanelApp] Detected Capital One Travel (Stays)');
          newDetectedSite = 'capital-one-stays';
          newBookingType = 'stay';
        }
        // Capital One Travel - Flights
        else if ((url.includes('capitalone.com/travel') || url.includes('travel.capitalone.com') || url.includes('capitalone.com/flights')) &&
                 !url.includes('/cars') && !url.includes('/packages') && !url.includes('/activities') && !url.includes('/premium-stays')) {
          console.log('[SidePanelApp] Detected Capital One portal (Flights)');
          newDetectedSite = 'capital-one-portal';
          newBookingType = 'flight';
        }
        // Google Hotels
        else if (url.includes('google.com/travel/hotels') || (url.includes('google.com/travel') && url.includes('hotel'))) {
          console.log('[SidePanelApp] Detected Google Hotels');
          newDetectedSite = 'google-hotels';
          newBookingType = 'stay';
          newStep = 2;
        }
        // Google Flights
        else if (url.includes('google.com/travel/flights') || url.includes('google.com/flights')) {
          console.log('[SidePanelApp] Detected Google Flights');
          newDetectedSite = 'google-flights';
          newBookingType = 'flight';
          newStep = 2;
        } else {
          console.log('[SidePanelApp] No matching site detected');
        }
        
        // ============================================
        // SMART INVALIDATION: Clear stale captures when
        // user navigates to a DIFFERENT booking type
        // ============================================
        const previousBookingType = bookingType;
        
        // If we're moving from stays → flights, clear stay captures
        if (previousBookingType === 'stay' && newBookingType === 'flight') {
          console.log('[SidePanelApp] 🔄 Booking type changed: stay → flight. Clearing stale stay captures.');
          setStayCapture(null);
          setDirectStayCapture(null);
          // Also clear from storage to prevent reload issues
          chrome.storage.local.remove(['vx_stay_portal_snapshot', 'vx_stay_direct_snapshot']).catch(console.error);
        }
        
        // If we're moving from flights → stays, clear flight captures
        if (previousBookingType === 'flight' && newBookingType === 'stay') {
          console.log('[SidePanelApp] 🔄 Booking type changed: flight → stay. Clearing stale flight captures.');
          setPortalCapture(null);
          setDirectCapture(null);
          // Also clear from storage to prevent reload issues
          chrome.storage.local.remove(['vx_portal_snapshot', 'vx_direct_snapshot']).catch(console.error);
        }
        
        // Now update state
        setDetectedSite(newDetectedSite);
        setBookingType(newBookingType);
        if (newStep !== 1) {
          setCurrentStep(newStep);
        }
      }
    } catch (e) {
      console.log('[SidePanelApp] Tab detection error:', e);
    }
  };

  // Use a counter to ensure unique message IDs (prevents collision when calls are < 1ms apart)
  const messageIdCounter = useRef(0);
  const generateMessageId = () => {
    messageIdCounter.current += 1;
    return `msg-${Date.now()}-${messageIdCounter.current}`;
  };

  const addMessage = (role: 'user' | 'assistant', content: string, isContextPrompt?: boolean, citations?: CitationSource[]) => {
    setMessages((prev) => [...prev, {
      id: generateMessageId(),
      role,
      content,
      timestamp: Date.now(),
      isContextPrompt,
      citations,
    }]);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    const userInput = inputValue;
    addMessage('user', userInput);
    setInputValue('');
    
    try {
      if (isSupabaseConfigured()) {
        const thinkingId = generateMessageId();
        setMessages(prev => [...prev, {
          id: thinkingId,
          role: 'assistant',
          content: '💭 Searching knowledge base...',
          timestamp: Date.now(),
        }]);
        
        // Step 1: Search knowledge base for relevant info (RAG)
        let ragContext: string | undefined;
        let citations: CitationSource[] = [];
        
        try {
          const searchResponse = await searchKnowledge(userInput, 3, 0.4);
          if (searchResponse.success && searchResponse.results && searchResponse.results.length > 0) {
            const ragResult = buildRAGContext(searchResponse.results);
            ragContext = ragResult.context;
            citations = ragResult.sources;
            console.log('[Chat] RAG search found', citations.length, 'sources');
          }
        } catch (searchErr) {
          console.warn('[Chat] RAG search failed:', searchErr);
        }
        
        // Update thinking message to show progress
        setMessages(prev => prev.map(m =>
          m.id === thinkingId
            ? { ...m, content: '💭 Generating response...' }
            : m
        ));
        
        // Step 2: Send to LLM with RAG context
        const result = await sendChatViaSupabase(userInput, {
          portalPrice: portalCapture?.priceUSD,
          directPrice: directCapture?.priceUSD,
        }, ragContext);
        
        // Check if response needs context
        const needsContext = userInput.toLowerCase().includes('compare') ||
                           userInput.toLowerCase().includes('price') ||
                           userInput.toLowerCase().includes('this flight');
        
        // Step 3: Attach citations to the response
        setMessages(prev => prev.map(m =>
          m.id === thinkingId
            ? {
                ...m,
                content: result.response || 'I can help you with Capital One Venture X questions!',
                isContextPrompt: needsContext && contextStatus.type === 'none',
                citations: citations.length > 0 ? citations : undefined,
              }
            : m
        ));
      } else {
        // Fallback response
        setTimeout(() => {
          const needsContext = userInput.toLowerCase().includes('compare') ||
                             userInput.toLowerCase().includes('price');
          addMessage(
            'assistant',
            getSimpleResponse(userInput),
            needsContext && contextStatus.type === 'none'
          );
        }, 150);
      }
    } catch (e) {
      addMessage('assistant', 'I can help you compare portal vs direct prices!');
    }
  };

  const getSimpleResponse = (question: string): string => {
    const q = question.toLowerCase();
    if (q.includes('eraser')) {
      return 'Travel Eraser lets you redeem Capital One miles at 1¢ each for travel purchases made in the last 90 days. It\'s convenient but often provides less value than transfer partners.';
    }
    if (q.includes('transfer') || q.includes('partner')) {
      return 'Capital One miles transfer 1:1 to partners like Turkish Miles&Smiles, Emirates Skywards, and Avianca LifeMiles. For premium cabins, you can often get 1.5-3¢+ per mile.';
    }
    if (q.includes('portal') && q.includes('direct')) {
      return 'Portal gives 5x miles but may have different change/cancel policies. Direct gives 2x miles but more flexibility with the airline. The best choice depends on price and your flexibility needs.';
    }
    if (q.includes('credit') || q.includes('$300')) {
      return 'The $300 travel credit resets each cardmember year. It applies automatically to Capital One Travel portal purchases. Using it for flights is a great way to maximize value!';
    }
    return 'I can help with Capital One Venture X questions! Ask about portal vs direct bookings, Travel Eraser, transfer partners, or your travel credit.';
  };

  const handleStarterPrompt = (prompt: StarterPrompt) => {
    setInputValue(prompt.text);
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

  // Handle ask question from Verdict screen - switches to Chat tab with prefilled question
  const handleAskAboutVerdict = (question: string, context: VerdictContext) => {
    // Switch to chat tab
    setActiveTab('chat');
    setShowChatBadge(false);
    setHasAskedAboutVerdict(true);
    setInputValue('');
    
    // Send the message after a short delay to allow tab switch animation
    setTimeout(() => {
      // Add user message AND thinking message in a single state update to prevent race conditions
      const userMsgId = generateMessageId();
      const thinkingMsgId = generateMessageId();
      
      setMessages(prev => [
        ...prev,
        {
          id: userMsgId,
          role: 'user' as const,
          content: question,
          timestamp: Date.now(),
        },
        {
          id: thinkingMsgId,
          role: 'assistant' as const,
          content: '💭 Searching knowledge base...',
          timestamp: Date.now() + 1,
        },
      ]);
      
      // Get AI response with the thinking message ID
      handleSendMessageWithContext(question, context, thinkingMsgId);
    }, 250);
  };

  // Send message with verdict context for better AI response
  const handleSendMessageWithContext = async (question: string, context: VerdictContext, existingThinkingId?: string) => {
    try {
      if (isSupabaseConfigured()) {
        // Use existing thinking ID or create new one
        const thinkingId = existingThinkingId || generateMessageId();
        
        // Only add thinking message if we don't have one already
        if (!existingThinkingId) {
          setMessages(prev => [...prev, {
            id: thinkingId,
            role: 'assistant',
            content: '💭 Searching knowledge base...',
            timestamp: Date.now(),
          }]);
        }
        
        // Step 1: Search knowledge base for relevant info
        let ragContext: string | undefined;
        let citations: CitationSource[] = [];
        
        try {
          const searchResponse = await searchKnowledge(question, 3, 0.4);
          if (searchResponse.success && searchResponse.results && searchResponse.results.length > 0) {
            const ragResult = buildRAGContext(searchResponse.results);
            ragContext = ragResult.context;
            citations = ragResult.sources;
          }
        } catch (searchErr) {
          console.warn('[Chat] RAG search failed:', searchErr);
        }
        
        // Update thinking message to show progress
        setMessages(prev => prev.map(m =>
          m.id === thinkingId
            ? { ...m, content: '💭 Analyzing your booking...' }
            : m
        ));
        
        // Step 2: Build full context from VerdictContext
        const fullContext: ChatContext = {
          portalPrice: context.portalPrice,
          directPrice: context.directPrice,
          route: context.route,
          portalMiles: context.portalMilesEarned,
          directMiles: context.directMilesEarned,
          winner: context.winner,
          savings: context.portalPrice && context.directPrice
            ? Math.abs(context.portalPrice - context.directPrice)
            : undefined,
          creditRemaining: context.creditApplied,
          portalNetCost: context.effectiveCost,
          directNetCost: context.directPrice,
        };
        
        // Step 3: Send to LLM with full context and RAG
        const result = await sendChatViaSupabase(question, fullContext, ragContext);
        
        // Update with response and citations
        setMessages(prev => prev.map(m =>
          m.id === thinkingId
            ? {
                ...m,
                content: result.response || 'I can help you with your booking decision!',
                citations: citations.length > 0 ? citations : undefined,
              }
            : m
        ));
      } else {
        // Fallback response
        setTimeout(() => {
          addMessage('assistant', getSimpleResponse(question));
        }, 150);
      }
    } catch (e) {
      console.error('[Chat] Error with context:', e);
      addMessage('assistant', 'I can help you compare portal vs direct prices!');
    }
  };

  const handleConfirmPortal = () => {
    if (portalCapture) {
      setCurrentStep(2);
      
      const origin = portalCapture.origin || '';
      const dest = portalCapture.destination || '';
      const departDate = portalCapture.departDate || '';
      const returnDate = portalCapture.returnDate || '';
      
      // Build Google Flights search query with dates (matching original AppPremium.tsx)
      let searchQuery = `flights from ${origin} to ${dest}`;
      if (departDate) searchQuery += ` on ${departDate}`;
      if (returnDate) searchQuery += ` returning ${returnDate}`;
      
      chrome.tabs.create({ url: `https://www.google.com/travel/flights?q=${encodeURIComponent(searchQuery)}` });
    }
  };

  const handleRecapturePortal = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'FORCE_CAPTURE_PORTAL' });
      }
    } catch (e) {
      console.log('[SidePanelApp] Recapture error:', e);
    }
  };

  const handleConfirmDirect = () => {
    if (directCapture && portalCapture) {
      setCurrentStep(3);
    }
  };

  const handleRecaptureDirect = () => {
    setDirectCapture(null);
  };

  // Handler for when user wants to find a different flight (from flight mismatch warning)
  // Goes back to step 1 to show captured portal booking info while browser navigates to search
  const handleFindCorrectFlight = () => {
    setDirectCapture(null);
    setCurrentStep(1);
    console.log('[SidePanelApp] 🔄 User clicked "Find correct flight" - returning to step 1');
  };

  // Handler for confirming stay portal capture and opening Google Hotels
  const handleConfirmStayPortal = () => {
    if (stayCapture) {
      setCurrentStep(2);
      
      // Build Google Hotels search URL
      const propertyName = stayCapture.propertyName || '';
      const checkIn = stayCapture.checkIn || '';
      const checkOut = stayCapture.checkOut || '';
      const guests = stayCapture.guests || 2;
      const rooms = stayCapture.rooms || 1;
      
      // Use property name directly as the search query
      // Property names from portal usually include the city (e.g., "Bab Al Shams, Dubai")
      // Don't append location - it can cause Google to match wrong results
      const searchQuery = propertyName;
      
      // Build Google Travel search URL with proper format
      // Google Travel uses:
      // - Path: /travel/search (NOT /travel/hotels)
      // - dates param in format: YYYY-MM-DD_YYYY-MM-DD (combined with underscore)
      // - adults param (not guests)
      // - rooms param
      const params = new URLSearchParams();
      params.set('q', searchQuery);
      
      // Dates in combined format: dates=YYYY-MM-DD_YYYY-MM-DD
      if (checkIn && checkOut) {
        params.set('dates', `${checkIn}_${checkOut}`);
      } else if (checkIn) {
        // If only checkIn, estimate checkout based on nights or +1 day
        const nights = stayCapture.nights || 1;
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkInDate);
        checkOutDate.setDate(checkOutDate.getDate() + nights);
        const checkOutStr = checkOutDate.toISOString().split('T')[0];
        params.set('dates', `${checkIn}_${checkOutStr}`);
      }
      
      // Add occupancy params
      params.set('adults', String(guests));
      params.set('rooms', String(rooms));
      
      // Add language/region for consistency
      params.set('hl', 'en');
      params.set('gl', 'us');
      
      // Use /travel/search endpoint which properly handles hotel search with dates
      const googleHotelsUrl = `https://www.google.com/travel/search?${params.toString()}`;
      
      console.log('[SidePanelApp] Opening Google Hotels URL:', googleHotelsUrl);
      console.log('[SidePanelApp] Stay dates - checkIn:', checkIn, 'checkOut:', checkOut);
      
      chrome.tabs.create({ url: googleHotelsUrl });
    }
  };

  // Handler for confirming stay direct capture and showing verdict
  const handleConfirmStayDirect = () => {
    if (directStayCapture && stayCapture) {
      setCurrentStep(3);
    }
  };

  // Handler for manual direct price entry (stays)
  const handleManualDirectPriceSubmit = (price: number, provider?: string) => {
    if (stayCapture) {
      // Create a DirectStayCapture from manual input
      setDirectStayCapture({
        price: price,
        priceUSD: Math.round(price),
        currency: 'USD',
        siteName: provider || 'Manual Entry',
        provider: provider,
        confidence: 'high', // Manual entry is always high confidence
      });
      // Move to step 3 (verdict)
      setCurrentStep(3);
    }
  };

  const handleReset = () => {
    setPortalCapture(null);
    setDirectCapture(null);
    setStayCapture(null);
    setDirectStayCapture(null);
    setCurrentStep(1);
    setDetectedSite('unknown');
    setBookingType('flight');
    // Reset success state
    setShowBookingSuccess(false);
  };

  // Full reset including clearing persisted storage (used by "Start New Search" prompt)
  const handleStartNewSearch = async () => {
    console.log('[SidePanelApp] 🆕 Starting new search - clearing all captured data and storage');
    // Clear React state
    setPortalCapture(null);
    setDirectCapture(null);
    setStayCapture(null);
    setDirectStayCapture(null);
    setCurrentStep(1);
    setBookingType('flight');
    setShowBookingSuccess(false);
    setShowNewSearchPrompt(null);
    // Clear persisted storage so stale data doesn't reload
    try {
      await chrome.storage.local.remove([
        'vx_portal_snapshot',
        'vx_direct_snapshot',
        'vx_stay_portal_snapshot',
        'vx_stay_direct_snapshot',
        'vx_flow_state',
      ]);
      console.log('[SidePanelApp] 🗑️ Cleared all capture snapshots from storage');
    } catch (e) {
      console.error('[SidePanelApp] Error clearing storage:', e);
    }
    // Re-detect current page to set correct site/booking type
    detectCurrentPage();
  };

  // P2-21: Handle "Continue to Portal/Direct" from verdict card - show success celebration
  const handleVerdictContinue = (recommendation: 'portal' | 'direct', savings?: number) => {
    setSuccessRecommendation(recommendation);
    setSuccessSavings(savings);
    setShowBookingSuccess(true);
  };

  const handlePasteDetails = (details: ManualBookingDetails) => {
    setPortalCapture({
      price: details.portalPrice,
      priceUSD: details.portalPrice,
      currency: 'USD',
      origin: details.origin,
      destination: details.destination,
    });
    setDirectCapture({
      price: details.directPrice,
      priceUSD: details.directPrice,
      currency: 'USD',
      siteName: 'Manual Entry',
    });
    setCurrentStep(3);
    setActiveTab('compare');
  };

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    const prefs = await getUserPrefs();
    setUserPrefs(prefs);
  };

  // Handler for SmartSettings close - reload prefs in case they changed
  const handleSettingsClose = async () => {
    console.log('[SidePanelApp] Settings closed, reloading prefs...');
    const newPrefs = await getUserPrefs();
    setUserPrefs(newPrefs);
    setShowSettings(false);
  };

  // Loading state - minimal spinner
  if (checkingOnboarding) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <AuroraBackground />
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-6 h-6 border-2 border-[rgba(99,102,241,0.20)] border-t-[rgba(99,102,241,0.70)] rounded-full mx-auto mb-3"
          />
          <p className="text-[rgba(255,255,255,0.40)] text-xs">Loading...</p>
        </div>
      </div>
    );
  }

  // Onboarding
  if (showOnboarding) {
    return (
      <OnboardingFlow
        onComplete={handleOnboardingComplete}
        onOpenSettings={() => {
          setShowOnboarding(false);
          setShowSettings(true);
        }}
      />
    );
  }

  return (
    <div className="h-full min-h-screen w-full bg-black text-white flex flex-col relative overflow-hidden">
      {/* Subtle gradient background - minimal, not overwhelming */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/15 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-indigo-500/[0.03] blur-[100px] rounded-full pointer-events-none" />
      <AuroraBackground />

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <SmartSettings
            isOpen={showSettings}
            onClose={handleSettingsClose}
            onRerunOnboarding={() => {
              setShowSettings(false);
              setShowOnboarding(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Paste Details Modal */}
      <PasteDetailsModal
        isOpen={showPasteDetails}
        onClose={() => setShowPasteDetails(false)}
        onSubmit={handlePasteDetails}
        defaultCreditRemaining={userPrefs?.creditRemaining || 300}
      />

      {/* P2-21: Success State Celebration Modal */}
      <AnimatePresence>
        {showBookingSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl"
          >
            <BookingSuccessState
              recommendation={successRecommendation}
              savings={successSavings}
              onNewComparison={() => {
                setShowBookingSuccess(false);
                handleReset();
              }}
              onSwitchToChat={() => {
                setShowBookingSuccess(false);
                setActiveTab('chat');
              }}
              onDismiss={() => setShowBookingSuccess(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-40 px-4 py-3 border-b border-[rgba(255,255,255,0.04)] bg-black/95 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <AnimatedLogo size="sm" />
          <div className="flex-shrink-0">
            <h1 className="text-sm font-semibold text-[rgba(255,255,255,0.95)] tracking-tight whitespace-nowrap">VentureXify</h1>
          </div>
          <div className="flex-1 min-w-0 flex justify-end">
            <ContextStatusChip status={contextStatus} size="sm" />
          </div>
        </div>
      </header>

      {/* Main Content - with padding for fixed header only; floating nav overlays content */}
      <main className="flex-1 flex flex-col min-h-0 relative z-10 pt-14">
        <AnimatePresence mode="wait">
          {activeTab === 'chat' ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <ChatTabContent
                messages={messages}
                inputValue={inputValue}
                setInputValue={setInputValue}
                onSend={handleSendMessage}
                onStarterPrompt={handleStarterPrompt}
                contextStatus={contextStatus}
                onSwitchToCompare={() => setActiveTab('compare')}
                // P0 #4 FIX: Pass verdict info to show booking CTA
                hasVerdict={!!(portalCapture && directCapture && currentStep === 3) || !!(stayCapture && directStayCapture && currentStep === 3)}
                verdictWinner={
                  (portalCapture && directCapture)
                    ? ((portalCapture.priceUSD - (userPrefs?.creditRemaining || 300)) <= directCapture.priceUSD ? 'portal' : 'direct')
                    : (stayCapture && directStayCapture)
                      ? (stayCapture.priceUSD <= directStayCapture.priceUSD ? 'portal' : 'direct')
                      : undefined
                }
                onBookNow={() => {
                  // P0 #4 FIX: Open the winning booking site
                  const isPortalWinner = (portalCapture && directCapture)
                    ? ((portalCapture.priceUSD - (userPrefs?.creditRemaining || 300)) <= directCapture.priceUSD)
                    : (stayCapture && directStayCapture)
                      ? (stayCapture.priceUSD <= directStayCapture.priceUSD)
                      : true;
                  
                  if (isPortalWinner) {
                    // Open Capital One Travel portal
                    if (typeof chrome !== 'undefined' && chrome.tabs) {
                      chrome.tabs.create({ url: 'https://travel.capitalone.com' });
                    } else {
                      window.open('https://travel.capitalone.com', '_blank');
                    }
                  } else {
                    // Open Google Flights/Hotels for direct booking
                    const isStay = !!(stayCapture && directStayCapture);
                    if (isStay) {
                      if (typeof chrome !== 'undefined' && chrome.tabs) {
                        chrome.tabs.create({ url: 'https://www.google.com/travel/hotels' });
                      } else {
                        window.open('https://www.google.com/travel/hotels', '_blank');
                      }
                    } else {
                      if (typeof chrome !== 'undefined' && chrome.tabs) {
                        chrome.tabs.create({ url: 'https://www.google.com/travel/flights' });
                      } else {
                        window.open('https://www.google.com/travel/flights', '_blank');
                      }
                    }
                  }
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="compare"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <CompareTabContent
                currentStep={currentStep}
                portalCapture={portalCapture}
                directCapture={directCapture}
                stayCapture={stayCapture}
                directStayCapture={directStayCapture}
                bookingType={bookingType}
                detectedSite={detectedSite}  // P1 FIX: Pass detectedSite for dynamic progress rail labels
                contextStatus={contextStatus}
                creditRemaining={userPrefs?.creditRemaining || 300}
                onConfirmPortal={handleConfirmPortal}
                onRecapturePortal={handleRecapturePortal}
                onConfirmDirect={handleConfirmDirect}
                onRecaptureDirect={handleRecaptureDirect}
                onFindCorrectFlight={handleFindCorrectFlight}
                onConfirmStayPortal={handleConfirmStayPortal}
                onConfirmStayDirect={handleConfirmStayDirect}
                onManualDirectPriceSubmit={handleManualDirectPriceSubmit}
                onReset={handleReset}
                onSwitchToChat={() => setActiveTab('chat')}
                onStepChange={(step) => setCurrentStep(step)}
                onAskQuestion={handleAskAboutVerdict}
                tabMode={verdictTabMode}
                onTabModeChange={setVerdictTabMode}
                onOpenSettings={() => setShowSettings(true)}
                mileValuationCpp={userPrefs?.mileValuationCpp}  // Pass user's mile valuation preference
                milesBalance={userPrefs?.milesBalance}  // Pass user's miles balance for Travel Eraser
                // P2-21: Wire up success celebration callback
                onVerdictContinue={handleVerdictContinue}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasBookingContext={contextStatus.type !== 'none'}
        onPasteDetails={() => setShowPasteDetails(true)}
        onSettings={() => setShowSettings(true)}
        showChatBadge={showChatBadge}
      />
    </div>
  );
}

export default SidePanelApp;
