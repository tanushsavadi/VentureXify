'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle } from 'lucide-react';
import { joinWaitlist, sendConfirmationEmail } from '@/lib/supabase';
import { useWaitlist } from '@/context/WaitlistContext';
import { HeroWaitlistSuccess, CTAWaitlistSuccess } from './WaitlistSuccess';

interface WaitlistFormProps {
  showExtendedForm?: boolean;
  className?: string;
}

export default function WaitlistForm({ showExtendedForm = false, className = '' }: WaitlistFormProps) {
  const { isSignedUp, setSignedUp, incrementWaitlistCount } = useWaitlist();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [redditUsername, setRedditUsername] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'already_registered'>('idle');
  const [position, setPosition] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const featureOptions = [
    { id: 'portal-direct', label: 'Portal vs Direct Comparison' },
    { id: 'ai-insights', label: 'AI-Powered Insights' },
    { id: 'transfer-partners', label: 'Transfer Partner Optimization' },
    { id: 'perks-tracker', label: 'Perks & Credits Tracker' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus('idle');

    try {
      const result = await joinWaitlist({
        email,
        first_name: firstName || undefined,
        reddit_username: redditUsername || undefined,
        referral_source: 'landing_page',
        feature_interests: selectedFeatures.length > 0 ? selectedFeatures : undefined,
      });

      if (result.success) {
        if (result.error === 'already_registered') {
          setStatus('already_registered');
          // Don't increment count for already registered
        } else {
          setStatus('success');
          // Increment count for new signups
          incrementWaitlistCount();
          // Send confirmation email for new signups only
          if (result.position) {
            sendConfirmationEmail({
              email,
              position: result.position,
              source: 'landing_page',
            }).catch(console.error); // Non-blocking
          }
        }
        setPosition(result.position || null);
        // Sync state globally
        setSignedUp(email, 'landing_page', result.position);
      } else {
        setStatus('error');
        setErrorMessage(result.error || 'Something went wrong');
      }
    } catch {
      setStatus('error');
      setErrorMessage('Failed to join waitlist. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFeature = (featureId: string) => {
    setSelectedFeatures(prev =>
      prev.includes(featureId)
        ? prev.filter(f => f !== featureId)
        : [...prev, featureId]
    );
  };

  // Show success state if already signed up (from any source)
  if (isSignedUp || status === 'success' || status === 'already_registered') {
    return (
      <div className={className}>
        <CTAWaitlistSuccess position={position || undefined} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="space-y-4">
        {/* Email input */}
        <div className="relative">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            className="w-full input-glass pr-32"
            disabled={isLoading}
          />
          <motion.button
            type="submit"
            disabled={isLoading || !email}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="absolute right-1 top-1 btn-primary px-4 py-2 text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group"
          >
            {/* Rotating border shimmer */}
            <span className="absolute inset-0 overflow-hidden rounded-lg">
              <span className="absolute inset-[-100%] animate-spin-around bg-[conic-gradient(from_90deg_at_50%_50%,transparent_0%,transparent_50%,rgba(255,255,255,0.25)_50%,transparent_100%)]" style={{ animationDuration: '3s' }} />
            </span>
            
            {/* Hover shine */}
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
            
            <span className="relative z-10">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Join Waitlist'
              )}
            </span>
          </motion.button>
        </div>

        {/* Extended form fields */}
        <AnimatePresence>
          {showExtendedForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name (optional)"
                  className="input-glass"
                  disabled={isLoading}
                />
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">u/</span>
                  <input
                    type="text"
                    value={redditUsername}
                    onChange={(e) => setRedditUsername(e.target.value)}
                    placeholder="Reddit username"
                    className="input-glass pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Feature interests */}
              <div>
                <p className="text-sm text-white/60 mb-3">Which features interest you most?</p>
                <div className="flex flex-wrap gap-2">
                  {featureOptions.map((feature) => (
                    <motion.button
                      key={feature.id}
                      type="button"
                      onClick={() => toggleFeature(feature.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                        selectedFeatures.includes(feature.id)
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                          : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                      }`}
                    >
                      {feature.label}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error message */}
        <AnimatePresence>
          {status === 'error' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 text-red-400 text-sm"
            >
              <AlertCircle className="w-4 h-4" />
              {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}

// Simple inline waitlist form for hero
export function InlineWaitlistForm() {
  const { isSignedUp, setSignedUp, incrementWaitlistCount } = useWaitlist();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await joinWaitlist({ email, referral_source: 'hero_section' });
      if (result.success) {
        // Only increment count for new signups (not duplicates)
        if (result.error !== 'already_registered') {
          incrementWaitlistCount();
          // Send confirmation email for new signups only
          if (result.position) {
            sendConfirmationEmail({
              email,
              position: result.position,
              source: 'hero_section',
            }).catch(console.error); // Non-blocking
          }
        }
        setSignedUp(email, 'hero_section', result.position);
      }
    } catch {
      // Handle error silently
    } finally {
      setIsLoading(false);
    }
  };

  if (isSignedUp) {
    return <HeroWaitlistSuccess />;
  }

  return (
    <form onSubmit={handleSubmit} className="relative z-50 flex gap-2 flex-col sm:flex-row w-full max-w-md" style={{ isolation: 'isolate' }}>
      {/* Input with glow effect on focus */}
      <div className="flex-1 relative group z-10">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          required
          className="w-full input-glass transition-all duration-300"
          disabled={isLoading}
          style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
        />
        {/* Subtle ambient glow when focused */}
        <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/0 via-amber-500/10 to-amber-500/0 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 -z-10 blur-md" />
      </div>
      
      {/* Flashy Shimmer Button with SOLID opaque background */}
      <motion.button
        type="submit"
        disabled={isLoading || !email}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        className="relative z-20 overflow-hidden px-6 py-3 rounded-xl text-black font-bold whitespace-nowrap transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-[0_4px_25px_rgba(251,191,36,0.5),0_0_50px_rgba(245,158,11,0.3)]"
        style={{
          background: 'linear-gradient(to right, #facc15, #f59e0b, #f97316)',
        }}
        animate={{
          boxShadow: [
            '0 4px 25px rgba(251, 191, 36, 0.5), 0 0 50px rgba(245, 158, 11, 0.3)',
            '0 4px 35px rgba(251, 191, 36, 0.7), 0 0 70px rgba(245, 158, 11, 0.5)',
            '0 4px 25px rgba(251, 191, 36, 0.5), 0 0 50px rgba(245, 158, 11, 0.3)',
          ],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* Solid opaque background layer - blocks starfield */}
        <span
          className="absolute inset-0 rounded-xl"
          style={{ background: 'linear-gradient(to right, #facc15, #f59e0b, #f97316)' }}
        />
        
        {/* Rotating light beam border */}
        <span className="absolute -inset-[2px] overflow-hidden rounded-xl pointer-events-none">
          <span
            className="absolute w-[200%] h-[200%] -top-1/2 -left-1/2"
            style={{
              background: 'conic-gradient(from 0deg, transparent 0deg, transparent 60deg, rgba(255,255,255,0.8) 90deg, #fff 120deg, transparent 150deg, transparent 360deg)',
              animation: 'spin-around 2s linear infinite',
            }}
          />
          <span
            className="absolute inset-[2px] rounded-xl"
            style={{ background: 'linear-gradient(to right, #facc15, #f59e0b, #f97316)' }}
          />
        </span>
        
        {/* Shine sweep */}
        <span className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
          <span
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            style={{
              animation: 'shimmer-slide 1.5s ease-in-out infinite',
            }}
          />
        </span>
        
        {/* Content */}
        <span className="relative z-10">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Join Waitlist'}
        </span>
      </motion.button>
    </form>
  );
}
