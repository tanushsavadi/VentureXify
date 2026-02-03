'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Check, AlertCircle, Sparkles } from 'lucide-react';
import { joinWaitlist } from '@/lib/supabase';

interface WaitlistFormProps {
  showExtendedForm?: boolean;
  className?: string;
}

export default function WaitlistForm({ showExtendedForm = false, className = '' }: WaitlistFormProps) {
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
        } else {
          setStatus('success');
        }
        setPosition(result.position || null);
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

  if (status === 'success' || status === 'already_registered') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`glass-card p-8 text-center ${className}`}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4"
        >
          <Check className="w-8 h-8 text-black" />
        </motion.div>
        <h3 className="text-2xl font-bold mb-2">
          {status === 'already_registered' ? 'Welcome Back!' : 'You\'re on the list!'}
        </h3>
        {position && (
          <p className="text-white/60 mb-4">
            Your position: <span className="text-amber-400 font-semibold">#{position}</span>
          </p>
        )}
        <p className="text-white/60">
          {status === 'already_registered'
            ? 'You\'re already registered. We\'ll notify you when beta access opens.'
            : 'We\'ll send you an email when beta access is ready. Stay tuned!'}
        </p>
      </motion.div>
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
            className="absolute right-1 top-1 btn-primary px-4 py-2 text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Join Waitlist'
            )}
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
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await joinWaitlist({ email });
      setSuccess(true);
    } catch {
      // Handle error silently
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2 text-amber-400"
      >
        <Sparkles className="w-5 h-5" />
        <span>You&apos;re on the list!</span>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 flex-col sm:flex-row w-full max-w-md">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
        className="flex-1 input-glass"
        disabled={isLoading}
      />
      <motion.button
        type="submit"
        disabled={isLoading || !email}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="btn-primary whitespace-nowrap disabled:opacity-50"
      >
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Join Waitlist'}
      </motion.button>
    </form>
  );
}
