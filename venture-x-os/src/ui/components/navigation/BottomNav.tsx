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
        'fixed bottom-0 left-0 right-0 z-50',
        // Fully transparent wrapper - no background at all
        'pointer-events-none',
        // Padding for the nav content
        'px-4 pb-3 pt-2'
      )}
    >
      {/* Centered Nav Pill - true glassmorphism */}
      <div className="flex justify-center pointer-events-auto">
        <div
          className={cn(
            'flex items-center gap-2',
            'h-[56px] px-2',
            'rounded-2xl',
            // True frosted glass: very transparent background + strong blur
            'bg-white/[0.08]',
            'backdrop-blur-2xl backdrop-saturate-[1.8]',
            // Glass border effect
            'border border-white/[0.20]',
            // Soft shadow + inner highlight for glass depth
            'shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.15),inset_0_-1px_1px_rgba(0,0,0,0.1)]'
          )}
        >
          {/* Tabs */}
          <nav className="flex items-center gap-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    'relative flex items-center gap-2',
                    'h-10 rounded-xl',
                    // Active state gets more padding for pill effect
                    isActive ? 'px-4' : 'px-3',
                    'transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50'
                  )}
                  whileTap={{ scale: 0.96 }}
                  transition={{ duration: 0.1 }}
                  aria-label={tab.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {/* Active Background Pill - Frosted */}
                  {isActive && (
                    <motion.div
                      layoutId="navActivePill"
                      className={cn(
                        'absolute inset-0 rounded-xl',
                        // Frosted active pill
                        'bg-white/[0.18]',
                        'backdrop-blur-lg',
                        'border border-white/[0.14]',
                        'shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
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
                          : 'text-white/55'
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
                              ? 'bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.7)]'
                              : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]'
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
          <div className="flex items-center gap-0.5">
            {/* Paste Details Button */}
            {showPasteButton && onPasteDetails && (
              <motion.button
                onClick={onPasteDetails}
                className={cn(
                  'flex items-center justify-center',
                  'w-10 h-10 rounded-xl',
                  'text-white/50',
                  'hover:text-white/75',
                  'hover:bg-white/[0.12]',
                  'active:bg-white/[0.18]',
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
                  'w-10 h-10 rounded-xl',
                  'text-white/50',
                  'hover:text-white/75',
                  'hover:bg-white/[0.12]',
                  'active:bg-white/[0.18]',
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
