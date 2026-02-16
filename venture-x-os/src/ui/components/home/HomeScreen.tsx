/**
 * HomeScreen Component
 * 
 * Zero-context home state with two equal entry points:
 * 1) Ask VentureXify (Chat) - Primary CTA
 * 2) Compare this booking - Secondary CTA (context-aware)
 * 
 * Features:
 * - Starter prompts for quick Q&A
 * - Context status chip showing booking detection state
 * - Clean, intuitive design
 */

import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, GitCompare, Sparkles, ExternalLink, Globe, Building2, Plane } from 'lucide-react';
import { GlassCard, GlassButton, GlassBadge } from '../glass';
import { cn } from '../../../lib/utils';

// ============================================
// BOOKING TYPE
// ============================================

export type BookingDetectionType = 'flight' | 'stay' | 'rental' | 'unknown';

// ============================================
// TYPES
// ============================================

export type BookingContextStatus =
  | { type: 'none' }
  | { type: 'detected'; site: string; bookingType?: BookingDetectionType }
  | { type: 'captured'; route: string; site: string; bookingType?: BookingDetectionType };

export interface StarterPrompt {
  id: string;
  text: string;
  icon?: string;
}

export interface HomeScreenProps {
  contextStatus: BookingContextStatus;
  onAskChat: () => void;
  onCompareBooking: () => void;
  onStarterPromptClick: (prompt: StarterPrompt) => void;
  onOpenSupportedSites?: () => void;
}

// ============================================
// DEFAULT STARTER PROMPTS
// ============================================

export const DEFAULT_STARTER_PROMPTS: StarterPrompt[] = [
  {
    id: 'eraser',
    text: 'How does Travel Eraser work?',
    icon: '🧽',
  },
  {
    id: 'portal-vs-direct',
    text: 'Is it better to book in the portal or direct?',
    icon: '🤔',
  },
  {
    id: 'travel-definition',
    text: "What counts as 'travel' for Capital One?",
    icon: '✈️',
  },
  {
    id: 'transfer-partners',
    text: 'How do transfer partners compare to Eraser?',
    icon: '🔄',
  },
  {
    id: 'credit-use',
    text: 'When should I use my $300 credit?',
    icon: '💳',
  },
  {
    id: 'miles-value',
    text: 'What are my Capital One miles worth?',
    icon: '💰',
  },
];

// ============================================
// SUPPORTED SITES LIST
// ============================================

const SUPPORTED_SITES = [
  { name: 'Capital One Travel', icon: '🏦', status: 'active', types: ['flights', 'stays'] },
  { name: 'Google Flights', icon: '✈️', status: 'active', types: ['flights'] },
  { name: 'Google Hotels', icon: '🏨', status: 'active', types: ['stays'] },
  { name: 'Airline Websites', icon: '🌐', status: 'partial', types: ['flights'] },
];

// ============================================
// STAYS-SPECIFIC STARTER PROMPTS
// ============================================

export const STAYS_STARTER_PROMPTS: StarterPrompt[] = [
  {
    id: 'hotel-portal',
    text: 'Should I book this hotel via portal or direct?',
    icon: '🏨',
  },
  {
    id: 'hotel-loyalty',
    text: 'Do I lose hotel points if I book through the portal?',
    icon: '⭐',
  },
  {
    id: 'hotel-status',
    text: 'Does portal booking count for hotel elite status?',
    icon: '👑',
  },
  {
    id: 'vacation-rental',
    text: "What's the difference between hotels and vacation rentals?",
    icon: '🏡',
  },
];

// ============================================
// CONTEXT STATUS CHIP COMPONENT
// ============================================

export const ContextStatusChip: React.FC<{
  status: BookingContextStatus;
  size?: 'sm' | 'md';
  onClick?: () => void;
}> = ({ status, size = 'md', onClick }) => {
  const getConfig = () => {
    switch (status.type) {
      case 'none':
        return {
          variant: 'muted' as const,
          text: 'No booking detected',
          dot: false,
          pulse: false,
        };
      case 'detected':
        return {
          variant: 'success' as const,
          text: `Booking detected: ${status.site}`,
          dot: true,
          pulse: true,
        };
      case 'captured':
        return {
          variant: 'success' as const,
          text: `Booking captured: ${status.route}`,
          dot: true,
          pulse: false,
        };
    }
  };

  const config = getConfig();

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'inline-flex items-center max-w-full min-w-0',
        onClick && 'cursor-pointer hover:opacity-80'
      )}
      onClick={onClick}
    >
      <GlassBadge
        variant={config.variant}
        size={size}
        dot={config.dot}
        pulse={config.pulse}
        className="max-w-full overflow-hidden"
      >
        <span className="truncate">{config.text}</span>
      </GlassBadge>
    </motion.div>
  );
};

// ============================================
// STARTER PROMPT CARD
// ============================================

const StarterPromptCard: React.FC<{
  prompt: StarterPrompt;
  onClick: () => void;
  delay?: number;
}> = ({ prompt, onClick, delay = 0 }) => (
  <motion.button
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.2 }}
    onClick={onClick}
    className={cn(
      'w-full p-3 rounded-xl text-left',
      'bg-white/[0.04] border border-white/[0.08]',
      'hover:bg-white/[0.08] hover:border-white/[0.12]',
      'transition-all duration-200',
      'group'
    )}
  >
    <div className="flex items-start gap-2.5">
      <span className="text-base flex-shrink-0">{prompt.icon}</span>
      <span className="text-sm text-white/80 group-hover:text-white transition-colors">
        {prompt.text}
      </span>
    </div>
  </motion.button>
);

// ============================================
// HOME SCREEN COMPONENT
// ============================================

export const HomeScreen: React.FC<HomeScreenProps> = ({
  contextStatus,
  onAskChat,
  onCompareBooking,
  onStarterPromptClick,
  onOpenSupportedSites,
}) => {
  const hasBookingContext = contextStatus.type !== 'none';
  
  // Determine booking type for context-aware prompts
  const bookingType = contextStatus.type !== 'none' ? contextStatus.bookingType : undefined;
  const isStay = bookingType === 'stay';
  
  // Select prompts based on booking type
  const promptsToShow = isStay
    ? STAYS_STARTER_PROMPTS
    : DEFAULT_STARTER_PROMPTS.slice(0, 4);

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center pt-4 pb-2"
      >
        <motion.div
          className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#4a90d9]/30 to-[#1e3048]/20 border border-[#4a90d9]/30 flex items-center justify-center"
          whileHover={{ scale: 1.05 }}
          animate={{
            boxShadow: ['0 0 20px rgba(74,144,217,0.2)', '0 0 40px rgba(74,144,217,0.3)', '0 0 20px rgba(74,144,217,0.2)'],
          }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Sparkles className="w-8 h-8 text-[#7eb8e0]" />
        </motion.div>
        <h1 className="text-xl font-semibold text-white mb-2">
          VentureXify
        </h1>
        <p className="text-sm text-white/60 max-w-xs mx-auto">
          Your Capital One Venture X assistant. Ask questions or compare bookings.
        </p>
      </motion.div>

      {/* Context Status Chip */}
      <div className="flex justify-center">
        <ContextStatusChip 
          status={contextStatus} 
          onClick={hasBookingContext ? onCompareBooking : undefined}
        />
      </div>

      {/* Primary CTAs */}
      <div className="space-y-3">
        {/* Ask VentureXify (Chat) - Primary */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GlassCard 
            variant="interactive" 
            className="p-0 overflow-hidden"
            onClick={onAskChat}
          >
            <div className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#4a90d9]/20 border border-[#4a90d9]/30 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-6 h-6 text-[#7eb8e0]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-white">
                  Ask VentureXify
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  Get help with portal, miles, Eraser, and more
                </p>
              </div>
              <GlassBadge variant="accent" size="sm">Chat</GlassBadge>
            </div>
          </GlassCard>
        </motion.div>

        {/* Compare this booking - Secondary (context-aware) */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <GlassCard 
            variant={hasBookingContext ? 'winner' : 'default'}
            className={cn(
              'p-0 overflow-hidden',
              hasBookingContext && 'cursor-pointer'
            )}
            onClick={hasBookingContext ? onCompareBooking : undefined}
          >
            <div className="p-4 flex items-center gap-4">
              <div className={cn(
                'w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0',
                hasBookingContext 
                  ? 'bg-emerald-500/20 border-emerald-500/30'
                  : 'bg-white/[0.05] border-white/[0.10]'
              )}>
                <GitCompare className={cn(
                  'w-6 h-6',
                  hasBookingContext ? 'text-emerald-300' : 'text-white/40'
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={cn(
                  'text-base font-semibold',
                  hasBookingContext ? 'text-white' : 'text-white/60'
                )}>
                  {hasBookingContext ? 'Compare this booking' : 'Compare a booking'}
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  {hasBookingContext 
                    ? contextStatus.type === 'captured' 
                      ? `Ready: ${(contextStatus as { route: string }).route}`
                      : 'Booking detected — ready to compare'
                    : 'Open a flight or hotel page first'
                  }
                </p>
              </div>
              {hasBookingContext ? (
                <GlassBadge variant="success" size="sm" dot pulse>Ready</GlassBadge>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSupportedSites?.();
                  }}
                  className="text-xs text-white/40 hover:text-white/60 underline"
                >
                  Sites
                </button>
              )}
            </div>
          </GlassCard>
        </motion.div>
      </div>

      {/* Starter Prompts Section - Context-aware */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="space-y-3"
      >
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
            {isStay ? 'Hotel Questions' : 'Quick Questions'}
          </span>
          {isStay && (
            <Building2 className="w-3 h-3 text-white/30" />
          )}
          <div className="flex-1 h-px bg-white/[0.08]" />
        </div>
        
        <div className="grid grid-cols-1 gap-2">
          {promptsToShow.map((prompt, index) => (
            <StarterPromptCard
              key={prompt.id}
              prompt={prompt}
              onClick={() => onStarterPromptClick(prompt)}
              delay={0.35 + index * 0.05}
            />
          ))}
        </div>
      </motion.div>

      {/* Supported Sites (when no context) */}
      {!hasBookingContext && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider">
              Supported Sites
            </span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>
          
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_SITES.map((site) => (
              <div
                key={site.name}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg',
                  'bg-white/[0.04] border border-white/[0.08]',
                  'text-xs text-white/60'
                )}
              >
                <span>{site.icon}</span>
                <span>{site.name}</span>
                {site.status === 'partial' && (
                  <span className="text-[9px] text-amber-400/80">(partial)</span>
                )}
              </div>
            ))}
          </div>

          {/* Quick action to open portal and comparison sites */}
          <div className="flex flex-wrap gap-2 pt-2">
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => {
                if (typeof chrome !== 'undefined' && chrome.tabs) {
                  chrome.tabs.create({ url: 'https://travel.capitalone.com' });
                } else {
                  window.open('https://travel.capitalone.com', '_blank');
                }
              }}
            >
              <ExternalLink className="w-3 h-3" />
              Portal
            </GlassButton>
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => {
                if (typeof chrome !== 'undefined' && chrome.tabs) {
                  chrome.tabs.create({ url: 'https://www.google.com/travel/flights' });
                } else {
                  window.open('https://www.google.com/travel/flights', '_blank');
                }
              }}
            >
              <Plane className="w-3 h-3" />
              Flights
            </GlassButton>
            <GlassButton
              variant="secondary"
              size="sm"
              onClick={() => {
                if (typeof chrome !== 'undefined' && chrome.tabs) {
                  chrome.tabs.create({ url: 'https://www.google.com/travel/hotels' });
                } else {
                  window.open('https://www.google.com/travel/hotels', '_blank');
                }
              }}
            >
              <Building2 className="w-3 h-3" />
              Hotels
            </GlassButton>
          </div>
        </motion.div>
      )}

      {/* Context-aware tip */}
      {!hasBookingContext && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="p-3 rounded-xl bg-[#4a90d9]/[0.08] border border-[#4a90d9]/[0.15]"
        >
          <p className="text-xs text-[#a3c9e8]/80 text-center">
            💡 Open a flight or hotel page, and I can compare prices automatically
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default HomeScreen;
