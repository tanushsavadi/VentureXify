/**
 * BottomNav Component - Premium Frosted Glass Design v4
 *
 * Larger, more readable navigation bar with full-width glassmorphism.
 * Clean, minimal, Apple-inspired aesthetic with transparent frosted glass.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitCompare, MessageCircle, ClipboardPaste, MoreHorizontal } from 'lucide-react';
import { cn } from '../../../lib/utils';

// ============================================
// TYPES
// ============================================

export type TabId = 'compare' | 'chat';

export interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hasBookingContext?: boolean;
  /** Show badge on Chat tab when verdict is available and user hasn't asked a question */
  showChatBadge?: boolean;
  onPasteDetails?: () => void;
  onSettings?: () => void;
  showPasteButton?: boolean;
}

// ============================================
// COMPONENT
// ============================================

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  hasBookingContext = false,
  showChatBadge = false,
  onPasteDetails,
  onSettings,
  showPasteButton = true,
}) => {
  const tabs = [
    {
      id: 'compare' as TabId,
      icon: GitCompare,
      label: 'Compare',
      highlight: hasBookingContext,
      badgeColor: 'emerald', // green dot for booking context
    },
    {
      id: 'chat' as TabId,
      icon: MessageCircle,
      label: 'Chat',
      highlight: showChatBadge,
      badgeColor: 'indigo', // indigo dot for chat availability
    },
  ];

  return (
    <div
      className={cn(
        // Use absolute positioning relative to container, not fixed to viewport
        'absolute bottom-0 left-0 right-0 z-50',
        // Fully transparent wrapper - no background at all
        'pointer-events-none',
        // Floating padding - more space from bottom for true floating effect
        'px-4 pb-4 pt-2'
      )}
    >
      {/* Centered Nav Pill - premium glassmorphism floating pill */}
      <div className="flex justify-center items-center pointer-events-auto">
        <div
          className={cn(
            'relative flex items-center gap-2',
            'h-[56px] px-3',
            'rounded-full',
            // Darker frosted glass: subtle gradient + strong blur
            'bg-gradient-to-b from-white/[0.06] to-white/[0.02]',
            'backdrop-blur-2xl backdrop-saturate-150',
            // Subtle glass border
            'border border-white/[0.08]',
            // Multi-layer shadow for depth
            'shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]'
          )}
        >
          {/* Very subtle shine overlay */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/[0.03] via-transparent to-transparent pointer-events-none" />
          
          {/* Tabs */}
          <nav className="relative flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    'relative flex items-center gap-2',
                    'h-[42px] rounded-full',
                    // Proportional padding
                    isActive ? 'px-4' : 'px-3',
                    'transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50'
                  )}
                  whileTap={{ scale: 0.96 }}
                  transition={{ duration: 0.1 }}
                  aria-label={tab.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {/* Active Background Pill - Subtle, darker */}
                  {isActive && (
                    <motion.div
                      layoutId="navActivePill"
                      className={cn(
                        'absolute inset-0 rounded-full',
                        // Subtle frosted active pill
                        'bg-gradient-to-b from-white/[0.10] to-white/[0.04]',
                        'backdrop-blur-lg',
                        'border border-white/[0.08]',
                        'shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      )}
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 28
                      }}
                    />
                  )}

                  {/* Icon */}
                  <div className="relative z-10 flex items-center">
                    <Icon
                      className={cn(
                        'w-5 h-5 transition-colors duration-150',
                        isActive
                          ? 'text-white'
                          : 'text-white/50'
                      )}
                      strokeWidth={isActive ? 2.25 : 1.75}
                    />
                    
                    {/* Context Indicator Dot / Badge */}
                    <AnimatePresence>
                      {tab.highlight && !isActive && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                          className={cn(
                            'absolute -top-1.5 -right-1.5',
                            'w-2.5 h-2.5 rounded-full',
                            tab.badgeColor === 'indigo'
                              ? 'bg-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.8)]'
                              : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]'
                          )}
                        />
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Label - Only show for active tab */}
                  <AnimatePresence mode="wait">
                    {isActive && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className={cn(
                          'relative z-10 text-sm font-semibold text-white',
                          'overflow-hidden whitespace-nowrap'
                        )}
                      >
                        {tab.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </nav>

          {/* Thin Divider */}
          <div className="w-px h-7 bg-white/[0.12]" />

          {/* Utility Buttons */}
          <div className="relative flex items-center gap-0.5">
            {/* Paste Details Button */}
            {showPasteButton && onPasteDetails && (
              <motion.button
                onClick={onPasteDetails}
                className={cn(
                  'flex items-center justify-center',
                  'w-10 h-10 rounded-full',
                  'text-white/45',
                  'hover:text-white/70',
                  'hover:bg-white/[0.10]',
                  'active:bg-white/[0.15]',
                  'transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50'
                )}
                whileTap={{ scale: 0.92 }}
                title="Paste booking details"
                aria-label="Paste booking details"
              >
                <ClipboardPaste className="w-5 h-5" strokeWidth={1.75} />
              </motion.button>
            )}
            
            {/* More Button (Settings) */}
            {onSettings && (
              <motion.button
                onClick={onSettings}
                className={cn(
                  'flex items-center justify-center',
                  'w-10 h-10 rounded-full',
                  'text-white/45',
                  'hover:text-white/70',
                  'hover:bg-white/[0.10]',
                  'active:bg-white/[0.15]',
                  'transition-all duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50'
                )}
                whileTap={{ scale: 0.92 }}
                title="More options"
                aria-label="More options"
              >
                <MoreHorizontal className="w-5 h-5" strokeWidth={1.75} />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BottomNav;
