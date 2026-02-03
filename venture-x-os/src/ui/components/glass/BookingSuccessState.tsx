/**
 * BookingSuccessState.tsx
 * Premium celebration screen shown after user confirms their booking decision.
 * Features confetti animation, celebratory messaging, and clear navigation.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassButton, GlassCard } from './index';

interface BookingSuccessStateProps {
  /** The winning recommendation: 'portal' | 'direct' */
  recommendation: 'portal' | 'direct';
  /** Amount saved in dollars */
  savings?: number;
  /** Callback to start a new comparison */
  onNewComparison: () => void;
  /** Callback to switch to chat tab */
  onSwitchToChat: () => void;
  /** Optional callback to dismiss */
  onDismiss?: () => void;
}

// Confetti particle component
const ConfettiParticle: React.FC<{ delay: number; color: string }> = ({ delay, color }) => {
  const randomX = Math.random() * 100;
  const randomRotation = Math.random() * 720 - 360;
  const randomDuration = 2 + Math.random() * 2;
  
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-sm"
      style={{ 
        left: `${randomX}%`,
        backgroundColor: color,
        top: -10,
      }}
      initial={{ 
        y: -20, 
        opacity: 1,
        rotate: 0,
        scale: 1,
      }}
      animate={{ 
        y: 400,
        opacity: [1, 1, 0],
        rotate: randomRotation,
        scale: [1, 1, 0.5],
      }}
      transition={{
        duration: randomDuration,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    />
  );
};

// Confetti burst component
const ConfettiBurst: React.FC = () => {
  const colors = [
    '#10B981', // emerald
    '#8B5CF6', // violet
    '#3B82F6', // blue
    '#F59E0B', // amber
    '#EC4899', // pink
    '#14B8A6', // teal
  ];
  
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.5,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <ConfettiParticle key={p.id} delay={p.delay} color={p.color} />
      ))}
    </div>
  );
};

// Animated checkmark icon
const AnimatedCheckmark: React.FC = () => (
  <motion.div
    className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center"
    initial={{ scale: 0, rotate: -180 }}
    animate={{ scale: 1, rotate: 0 }}
    transition={{ 
      type: 'spring', 
      stiffness: 200, 
      damping: 15,
      delay: 0.2,
    }}
  >
    <motion.svg
      className="w-10 h-10 text-emerald-400"
      viewBox="0 0 24 24"
      fill="none"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.5 }}
    >
      <motion.path
        d="M5 12l5 5L20 7"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      />
    </motion.svg>
  </motion.div>
);

// Sparkle animation component
const Sparkle: React.FC<{ delay: number; x: number; y: number }> = ({ delay, x, y }) => (
  <motion.div
    className="absolute w-1 h-1 bg-white rounded-full"
    style={{ left: `${x}%`, top: `${y}%` }}
    initial={{ scale: 0, opacity: 0 }}
    animate={{ 
      scale: [0, 1.5, 0],
      opacity: [0, 1, 0],
    }}
    transition={{
      duration: 1.5,
      delay,
      repeat: Infinity,
      repeatDelay: 2,
    }}
  />
);

export const BookingSuccessState: React.FC<BookingSuccessStateProps> = ({
  recommendation,
  savings,
  onNewComparison,
  onSwitchToChat,
  onDismiss,
}) => {
  const [showConfetti, setShowConfetti] = useState(true);
  
  // Stop confetti after initial burst
  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);
  
  const isPortal = recommendation === 'portal';
  const savingsText = savings && savings > 0 
    ? `You're saving $${Math.round(savings)}` 
    : null;
  
  const sparkles = [
    { delay: 0, x: 15, y: 20 },
    { delay: 0.5, x: 85, y: 25 },
    { delay: 1, x: 25, y: 70 },
    { delay: 1.5, x: 75, y: 75 },
    { delay: 0.3, x: 50, y: 15 },
    { delay: 0.8, x: 10, y: 50 },
    { delay: 1.2, x: 90, y: 55 },
  ];

  return (
    <motion.div
      className="flex-1 flex flex-col items-center justify-center p-6 relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Confetti burst */}
      <AnimatePresence>
        {showConfetti && <ConfettiBurst />}
      </AnimatePresence>
      
      {/* Ambient sparkles */}
      {sparkles.map((s, i) => (
        <Sparkle key={i} delay={s.delay} x={s.x} y={s.y} />
      ))}
      
      {/* Gradient background glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 left-1/3 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl" />
      </motion.div>
      
      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
        {/* Animated checkmark */}
        <AnimatedCheckmark />
        
        {/* Celebration text */}
        <motion.h1
          className="mt-6 text-2xl font-bold bg-gradient-to-r from-white via-emerald-100 to-white bg-clip-text text-transparent"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          Great Choice! 🎉
        </motion.h1>
        
        <motion.p
          className="mt-3 text-white/60 text-sm leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          You've chosen to book through the{' '}
          <span className="text-white font-medium">
            {isPortal ? 'Capital One Portal' : 'airline directly'}
          </span>
          . Smart move!
        </motion.p>
        
        {/* Savings highlight */}
        {savingsText && (
          <motion.div
            className="mt-4"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, type: 'spring' }}
          >
            <GlassCard variant="elevated" className="px-4 py-2">
              <span className="text-emerald-400 font-semibold">{savingsText}</span>
              <span className="text-white/40 text-sm ml-1">vs. the alternative</span>
            </GlassCard>
          </motion.div>
        )}
        
        {/* Tip card */}
        <motion.div
          className="mt-6 w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <GlassCard variant="default" className="p-4 text-left">
            <div className="flex items-start gap-3">
              <span className="text-lg">💡</span>
              <div>
                <p className="text-white/80 text-sm font-medium">Pro Tip</p>
                <p className="text-white/50 text-xs mt-1">
                  {isPortal 
                    ? "Remember to book through the Capital One portal link to ensure you get the proper miles earning rate."
                    : "Book directly with the airline for the best fare class flexibility and elite status benefits."}
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
        
        {/* Navigation buttons */}
        <motion.div
          className="mt-8 w-full space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <GlassButton
            variant="primary"
            className="w-full py-3 gap-2"
            onClick={onNewComparison}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 4v16m8-8H4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Compare Another Booking
          </GlassButton>
          
          <GlassButton
            variant="secondary"
            className="w-full py-3 gap-2"
            onClick={onSwitchToChat}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Ask a Question
          </GlassButton>
          
          {onDismiss && (
            <button
              className="w-full py-2 text-white/40 text-sm hover:text-white/60 transition-colors"
              onClick={onDismiss}
            >
              Dismiss
            </button>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default BookingSuccessState;
