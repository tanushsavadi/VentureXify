'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, Rocket, Share2, Copy, Mail, Zap, Crown } from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  TwitterShareButton,
  TwitterIcon,
  LinkedinShareButton,
  LinkedinIcon,
  FacebookShareButton,
  FacebookIcon,
  WhatsappShareButton,
  WhatsappIcon,
  RedditShareButton,
  RedditIcon,
} from 'next-share';

interface WaitlistSuccessProps {
  variant?: 'hero' | 'cta' | 'full';
  position?: number;
  email?: string;
}

const SHARE_URL = 'https://venturexify.vercel.app';
const SHARE_TITLE = 'Just joined the VentureXify waitlist! The AI-powered Chrome extension for Capital One Venture X cardholders 🚀';

// Confetti burst with brand colors
function fireConfetti() {
  const colors = ['#fbbf24', '#f59e0b', '#f97316', '#fb923c', '#fcd34d', '#ffffff'];
  
  // First burst - from center
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors,
    shapes: ['circle', 'square'],
    scalar: 1.2,
  });
  
  // Second burst - delayed, from sides
  setTimeout(() => {
    confetti({
      particleCount: 40,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors,
      scalar: 0.9,
    });
    confetti({
      particleCount: 40,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors,
      scalar: 0.9,
    });
  }, 250);
  
  // Third burst - star burst
  setTimeout(() => {
    confetti({
      particleCount: 30,
      spread: 180,
      origin: { y: 0.5 },
      colors,
      shapes: ['circle'],
      scalar: 0.8,
      startVelocity: 25,
    });
  }, 500);
}

// Animated checkmark SVG
function AnimatedCheckmark() {
  return (
    <motion.div
      className="relative w-20 h-20"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
    >
      {/* Outer glow ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 2] }}
        transition={{ duration: 1.5, delay: 0.3 }}
        style={{
          background: 'radial-gradient(circle, rgba(245,158,11,0.4) 0%, transparent 70%)',
        }}
      />
      
      {/* Circle background */}
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 15, stiffness: 300, delay: 0.1 }}
        style={{
          boxShadow: '0 0 30px rgba(245, 158, 11, 0.5), 0 0 60px rgba(245, 158, 11, 0.3)',
        }}
      />
      
      {/* Rotating shine ring */}
      <motion.div
        className="absolute -inset-1 rounded-full overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.div
          className="absolute w-full h-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          style={{
            background: 'conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(255,255,255,0.5) 330deg, transparent 360deg)',
          }}
        />
      </motion.div>
      
      {/* Checkmark */}
      <svg
        className="absolute inset-0 w-full h-full p-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.path
          d="M4 12l5 5L20 6"
          className="text-black"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.5, ease: [0.65, 0, 0.35, 1] }}
        />
      </svg>
    </motion.div>
  );
}

// Position badge component
function PositionBadge({ position }: { position: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.8, type: 'spring' }}
      className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 border border-amber-500/30 backdrop-blur-sm"
    >
      <Rocket className="w-4 h-4 text-amber-400" />
      <span className="text-sm text-white/70">Your position:</span>
      <motion.span
        className="text-lg font-bold text-amber-400"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1, type: 'spring', stiffness: 300 }}
      >
        #{position}
      </motion.span>
      <motion.div
        className="absolute -inset-px rounded-full"
        animate={{
          boxShadow: [
            '0 0 10px rgba(245, 158, 11, 0.2)',
            '0 0 20px rgba(245, 158, 11, 0.4)',
            '0 0 10px rgba(245, 158, 11, 0.2)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </motion.div>
  );
}

// Social share buttons component
function SocialShareButtons() {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(SHARE_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const buttonClass = "p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-center gap-2 flex-wrap"
    >
      {/* X (Twitter) */}
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
        <TwitterShareButton url={SHARE_URL} title={SHARE_TITLE} className={buttonClass}>
          <TwitterIcon size={36} round />
        </TwitterShareButton>
      </motion.div>

      {/* LinkedIn */}
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
        <LinkedinShareButton url={SHARE_URL} className={buttonClass}>
          <LinkedinIcon size={36} round />
        </LinkedinShareButton>
      </motion.div>

      {/* Facebook */}
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
        <FacebookShareButton url={SHARE_URL} quote={SHARE_TITLE} hashtag="#VentureX" className={buttonClass}>
          <FacebookIcon size={36} round />
        </FacebookShareButton>
      </motion.div>

      {/* WhatsApp */}
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
        <WhatsappShareButton url={SHARE_URL} title={SHARE_TITLE} separator=" - " className={buttonClass}>
          <WhatsappIcon size={36} round />
        </WhatsappShareButton>
      </motion.div>

      {/* Reddit */}
      <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
        <RedditShareButton url={SHARE_URL} title={SHARE_TITLE} className={buttonClass}>
          <RedditIcon size={36} round />
        </RedditShareButton>
      </motion.div>

      {/* Copy Link */}
      <motion.button
        onClick={handleCopy}
        className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors relative"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="Copy link"
      >
        {copied ? (
          <Check className="w-5 h-5 text-emerald-400" />
        ) : (
          <Copy className="w-5 h-5 text-white/70" />
        )}
      </motion.button>
    </motion.div>
  );
}

// Hero variant - compact inline success
export function HeroWaitlistSuccess({ isReturning = false }: { isReturning?: boolean }) {
  const hasAnimated = useRef(false);
  
  useEffect(() => {
    if (!hasAnimated.current && !isReturning) {
      fireConfetti();
      hasAnimated.current = true;
    }
  }, [isReturning]);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-3"
    >
      <motion.div
        className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.2 }}
        style={{
          boxShadow: '0 0 20px rgba(245, 158, 11, 0.5)',
        }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Check className="w-5 h-5 text-black" strokeWidth={3} />
        </motion.div>
      </motion.div>
      <div>
        <motion.p
          className="text-amber-400 font-semibold flex items-center gap-2"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Sparkles className="w-4 h-4" />
          {isReturning ? 'Welcome back!' : "You're on the list!"}
        </motion.p>
        <motion.p
          className="text-white/50 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {isReturning
            ? "You're already on the waitlist — we'll notify you at launch"
            : "We'll notify you when beta launches"}
        </motion.p>
      </div>
    </motion.div>
  );
}

// Full CTA variant - impressive celebration
export function CTAWaitlistSuccess({ position, isReturning = false }: { position?: number; isReturning?: boolean }) {
  const hasAnimated = useRef(false);
  const [showShare, setShowShare] = useState(false);
  
  useEffect(() => {
    if (!hasAnimated.current && !isReturning) {
      fireConfetti();
      hasAnimated.current = true;
    }
  }, [isReturning]);
  
  const newSignupItems = [
    { icon: Mail, text: 'Confirmation email on the way', gradient: 'from-blue-400 to-cyan-400' },
    { icon: Zap, text: 'Early access at launch', gradient: 'from-amber-400 to-orange-400' },
    { icon: Crown, text: 'Exclusive beta features', gradient: 'from-violet-400 to-purple-400' },
  ];

  const returningItems = [
    { icon: Check, text: 'You\'re already on the waitlist', gradient: 'from-emerald-400 to-green-400' },
    { icon: Zap, text: 'Early access at launch', gradient: 'from-amber-400 to-orange-400' },
    { icon: Crown, text: 'Exclusive beta features', gradient: 'from-violet-400 to-purple-400' },
  ];

  const whatsNextItems = isReturning ? returningItems : newSignupItems;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-center py-4"
    >
      {/* Animated checkmark */}
      <div className="flex justify-center mb-6">
        <AnimatedCheckmark />
      </div>
      
      {/* Headline */}
      <motion.h3
        className="text-xl md:text-2xl font-semibold mb-2 text-white"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        {isReturning ? 'Welcome back! 👋' : "You're in 🎉"}
      </motion.h3>
      
      <motion.p
        className="text-white/50 mb-6 text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        {isReturning
          ? "You're already signed up — no need to register again"
          : "We'll ping you when early access opens"}
      </motion.p>
      
      {/* Position badge */}
      {position && (
        <div className="mb-6">
          <PositionBadge position={position} />
        </div>
      )}
      
      {/* What's next section - Glassmorphic premium card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="relative mb-6"
      >
        {/* Ambient glow */}
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-amber-500/10 via-transparent to-orange-500/10 blur-xl" />
        
        {/* Glass card */}
        <div className="relative bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]">
          {/* Gradient border glow effect */}
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div className="absolute inset-[-1px] rounded-2xl bg-gradient-to-b from-white/[0.08] via-transparent to-transparent" />
          </div>
          
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">
            {isReturning ? 'Your Status' : "What's Next"}
          </p>
          
          <div className="flex flex-col gap-3">
            {whatsNextItems.map((item, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-3 group"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 + i * 0.15 }}
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform`}>
                  <item.icon className="w-4 h-4 text-black" strokeWidth={2.5} />
                </div>
                <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">{item.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
      
      {/* Share section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
      >
        <button
          onClick={() => setShowShare(!showShare)}
          className="text-sm text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-2 mx-auto mb-4"
        >
          <Share2 className="w-4 h-4" />
          {showShare ? 'Hide share options' : 'Share with friends'}
        </button>
        
        <AnimatePresence>
          {showShare && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <SocialShareButtons />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default function WaitlistSuccess({ variant = 'full', position, email }: WaitlistSuccessProps) {
  if (variant === 'hero') {
    return <HeroWaitlistSuccess />;
  }
  
  return <CTAWaitlistSuccess position={position} />;
}
