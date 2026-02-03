'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Star, ChevronDown, ArrowRight, MessageSquare, Rocket, Users, Shield, Zap } from 'lucide-react';
import Navigation from '@/components/Navigation';
import Features from '@/components/Features';
import HowItWorks from '@/components/HowItWorks';
import Privacy from '@/components/Privacy';
import Footer from '@/components/Footer';
import GlassCard from '@/components/GlassCard';
import { InlineWaitlistForm } from '@/components/WaitlistForm';
import { TiltCard } from '@/components/TiltCard';
import { ParticleTextDots } from '@/components/ParticleTextDots';
import { StarfieldBackground } from '@/components/StarfieldBackground';
import { getWaitlistCount } from '@/lib/supabase';

// Stats section data - accurate to actual product
const stats = [
  { value: '17', label: 'Transfer Partners', suffix: '+', sublabel: '1:1 airlines' },
  { value: '8', label: 'Supported Sites', suffix: '+', sublabel: 'Google Flights, hotels' },
  { value: '90', label: 'Day Eraser Window', suffix: '', sublabel: 'tracked automatically' },
];

// Sections to track for URL hash updates
const TRACKED_SECTIONS = ['features', 'how-it-works', 'privacy', 'cta'];

export default function Home() {
  const [waitlistCount, setWaitlistCount] = useState(500);

  useEffect(() => {
    getWaitlistCount().then(setWaitlistCount);
  }, []);

  // Scroll spy - update URL hash as sections come into view
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    
    TRACKED_SECTIONS.forEach((sectionId) => {
      const element = document.getElementById(sectionId);
      if (!element) return;
      
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
              // Update URL without triggering scroll
              window.history.replaceState(null, '', `#${sectionId}`);
            }
          });
        },
        { threshold: 0.3, rootMargin: '-20% 0px -20% 0px' }
      );
      
      observer.observe(element);
      observers.push(observer);
    });

    // Clear hash when at top of page
    const handleScroll = () => {
      if (window.scrollY < 200) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      observers.forEach((observer) => observer.disconnect());
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <>
      {/* Starfield Background - fixed behind all content */}
      <StarfieldBackground
        count={300}
        speed={0.3}
        starColor="#f5f5f5"
        twinkle={true}
        className="!bg-transparent"
      />
      
      <main className="relative min-h-screen overflow-x-hidden z-10">
        <Navigation />

      {/* Main Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-radial from-amber-500/10 via-transparent to-transparent opacity-50" />
        
        {/* Floating particles background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-amber-400/30"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -30, 0],
                opacity: [0.2, 0.6, 0.2],
              }}
              transition={{
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-20"
            >
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-400 font-medium">Beta Access Opening Soon</span>
              </motion.div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                Maximize your{' '}
                <span className="gradient-text">Venture X</span>{' '}
                rewards
              </h1>

              {/* Subheadline */}
              <p className="text-lg sm:text-xl text-white/60 mb-8 max-w-lg">
                The AI-powered Chrome extension that helps Capital One Venture X cardholders 
                make smarter decisions on every booking.
              </p>

              {/* 3D Tilt Card - Mobile only */}
              <div className="flex justify-center lg:hidden mb-8" style={{ perspective: '1000px' }}>
                <TiltCard 
                  imageSrc="/venture-x-card.png"
                  imageAlt="Capital One Venture X Card"
                />
              </div>

              {/* Email form */}
              <div id="waitlist" className="mb-8">
                <InlineWaitlistForm />
              </div>

              {/* Social proof */}
              <div className="flex flex-wrap items-center gap-6">
                {/* Avatar stack */}
                <div className="flex items-center">
                  <div className="flex -space-x-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-background flex items-center justify-center text-xs font-bold text-black"
                      >
                        {String.fromCharCode(64 + i)}
                      </div>
                    ))}
                  </div>
                  <span className="ml-3 text-sm text-white/60">
                    <span className="text-white font-medium">{waitlistCount}+</span> joined
                  </span>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="ml-2 text-sm text-white/60">from r/VentureX</span>
                </div>
              </div>
            </motion.div>

            {/* Right content - 3D Card with Preview cards */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:flex flex-col items-center gap-6 relative z-10"
              style={{ perspective: '1000px' }}
            >
              {/* 3D Tilt Card */}
              <div className="mb-4">
                <TiltCard 
                  imageSrc="/venture-x-card.png"
                  imageAlt="Capital One Venture X Card"
                />
              </div>

              {/* Preview Cards - stacked below the credit card */}
              <div className="grid grid-cols-1 gap-4 w-full max-w-md">
                {/* Portal vs Direct card */}
                <GlassCard className="p-5" glow="amber">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-amber-400 font-medium flex items-center gap-2">
                      <ArrowRight className="w-4 h-4" />
                      Use Portal
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400">
                      Recommended
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-white/50 text-xs mb-1">Portal</div>
                      <div className="font-semibold text-sm">42,800 mi</div>
                    </div>
                    <div>
                      <div className="text-white/50 text-xs mb-1">Direct</div>
                      <div className="font-semibold text-sm">$428</div>
                    </div>
                    <div>
                      <div className="text-white/50 text-xs mb-1">Value</div>
                      <div className="font-semibold text-sm text-emerald-400">2.1¢/mi</div>
                    </div>
                  </div>
                </GlassCard>

                {/* AI Chat card */}
                <GlassCard className="p-5" glow="violet">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
                      <MessageSquare className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-sm font-medium">Ask Anything</span>
                  </div>
                  <div className="bg-violet-500/10 rounded-lg p-3 border border-violet-500/20">
                    <p className="text-xs">
                      For Tokyo, your best options are <span className="text-violet-400">ANA (1:1)</span> at 
                      ~55K miles RT or <span className="text-violet-400">Virgin Atlantic</span> for partner awards...
                    </p>
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex flex-col items-center text-white/40"
          >
            <span className="text-xs mb-2">Scroll to explore</span>
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="py-16 md:py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="text-center"
              >
                <div className="text-4xl md:text-5xl font-bold gradient-text mb-1">
                  {stat.value}{stat.suffix}
                </div>
                <div className="text-white/80 font-medium">{stat.label}</div>
                {'sublabel' in stat && stat.sublabel && (
                  <div className="text-white/40 text-sm mt-1">{stat.sublabel}</div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <Features />

      {/* How It Works Section */}
      <HowItWorks />

      {/* Privacy Section */}
      <Privacy />

      {/* Premium Final CTA Section - seamless like hero */}
      <InteractiveCTASection waitlistCount={waitlistCount} />

        {/* Footer */}
        <Footer />
      </main>
    </>
  );
}

// Premium Email Form Component
function PremiumEmailForm() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Dynamic import to avoid importing at component level
      const { joinWaitlist } = await import('@/lib/supabase');
      const result = await joinWaitlist({ email, referral_source: 'cta_section' });
      
      if (result.success) {
        setIsSuccess(true);
      } else {
        setError(result.error || 'Something went wrong');
      }
    } catch {
      setError('Failed to join waitlist. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-6"
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <motion.svg
            className="w-8 h-8 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5 }}
          >
            <motion.path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </motion.svg>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">You&apos;re on the list!</h3>
        <p className="text-white/50">We&apos;ll notify you when beta access is ready.</p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      {/* Glow effect */}
      <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-amber-500/30 to-orange-500/30 blur opacity-50" />
      
      <div className="relative flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email"
          className="flex-1 px-5 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 focus:bg-white/10 transition-all"
          required
        />
        <motion.button
          type="submit"
          disabled={isSubmitting}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold hover:from-amber-400 hover:to-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[160px]"
        >
          {isSubmitting ? (
            <motion.div
              className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          ) : (
            <>
              <span>Get Early Access</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </motion.button>
      </div>
      
      {/* Error message */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-400 text-sm mt-3 text-center"
        >
          {error}
        </motion.p>
      )}
    </form>
  );
}

// Interactive CTA Section with mouse tracking for ParticleTextDots
function InteractiveCTASection({ waitlistCount }: { waitlistCount: number }) {
  const [mousePos, setMousePos] = useState<{ x: number; y: number; active: boolean } | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    setMousePos({
      x: e.clientX,
      y: e.clientY,
      active: true,
    });
  };

  const handleMouseLeave = () => {
    setMousePos(null);
  };

  // Memoize floating particles to prevent re-render jumps
  const floatingParticles = useMemo(() =>
    [...Array(15)].map((_, i) => ({
      left: Math.random() * 100,
      top: Math.random() * 100,
      duration: 3 + Math.random() * 2,
      delay: Math.random() * 2,
    })), []);

  return (
    <section
      id="cta"
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="pt-16 md:pt-20 pb-32 md:pb-40 relative"
    >

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          {/* Top badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-8"
            initial={{ scale: 0.9, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Rocket className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-400 font-medium">Launching Soon</span>
          </motion.div>

          {/* Headline */}
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Ready to{' '}
            <span className="gradient-text">maximize</span>
            {' '}your
            <br />
            <span className="gradient-text">Venture X</span>?
          </h2>

          {/* Subtitle */}
          <p className="text-white/60 text-lg md:text-xl mb-10 max-w-2xl mx-auto">
            Be among the first to experience the smarter way to use your points.
            Early access members get exclusive features.
          </p>

          {/* Email form */}
          <div className="max-w-lg mx-auto mb-10">
            <PremiumEmailForm />
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-6 md:gap-10 text-sm text-white/50">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400/60" />
              <span>{waitlistCount}+ on waitlist</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400/60" />
              <span>100% Privacy First</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-400/60" />
              <span>AI-Powered</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
