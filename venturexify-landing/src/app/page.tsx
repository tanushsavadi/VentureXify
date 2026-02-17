'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ChevronDown, ArrowRight, MessageSquare, Rocket, Users, Shield, Zap, Hotel, BarChart3, Bell } from 'lucide-react';
import Navigation from '@/components/Navigation';
import Features from '@/components/Features';
import HowItWorks from '@/components/HowItWorks';
import Privacy from '@/components/Privacy';
import Footer from '@/components/Footer';
import PremiumCard from '@/components/PremiumCard';
import { InlineWaitlistForm } from '@/components/WaitlistForm';
import { TiltCard } from '@/components/TiltCard';
import { ParticleTextDots } from '@/components/ParticleTextDots';
import { StarfieldBackground } from '@/components/StarfieldBackground';
import { getWaitlistCount } from '@/lib/supabase';
import { BlurInText, BlurInWords } from '@/components/BlurInText';
import { useWaitlist } from '@/context/WaitlistContext';
import { CTAWaitlistSuccess } from '@/components/WaitlistSuccess';

// Stats section data - accurate to actual product
const stats = [
  { value: '17+', label: 'Transfer Partners', suffix: '', sublabel: 'All Capital One partners supported' },
  { value: '10s', label: 'AI Analysis', suffix: '', sublabel: 'Groq-powered responses' },
  { value: '100%', label: 'Local Storage', suffix: '', sublabel: 'Your data stays private' },
];

// Sections to track for URL hash updates
const TRACKED_SECTIONS = ['features', 'how-it-works', 'privacy', 'why-i-built-this', 'cta', 'coming-soon'];

export default function Home() {
  const { waitlistCount, isSignedUp, justSignedUp } = useWaitlist();

  // Auto-scroll to Coming Soon section after fresh signup
  useEffect(() => {
    if (justSignedUp) {
      const timer = setTimeout(() => {
        document.getElementById('coming-soon')?.scrollIntoView({ behavior: 'smooth' });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [justSignedUp]);

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
              className="relative z-20 text-center lg:text-left"
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

              {/* Headline with blur-in animation */}
              <BlurInText delay={0.3} duration={1.2} className="mb-6">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                  Maximize your{' '}
                  <span className="gradient-text">Venture X</span>{' '}
                  rewards
                </h1>
              </BlurInText>

              {/* Subheadline */}
              <p className="text-lg sm:text-xl text-white/60 mb-8 max-w-lg mx-auto lg:mx-0">
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

              {/* Email form - elevated z-index to render above starfield */}
              <div id="waitlist" className="relative z-50 mb-8 flex flex-col items-center lg:items-start" style={{ isolation: 'isolate' }}>
                <InlineWaitlistForm />
              </div>

              {/* Social proof - only show when count > 0 */}
              {waitlistCount > 0 && (
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mt-2">
                  {/* Avatar stack */}
                  <div className="flex items-center">
                    <div className="flex -space-x-2">
                      {[...Array(Math.min(waitlistCount, 5))].map((_, i) => (
                        <div
                          key={i}
                          className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 border-2 border-background flex items-center justify-center"
                        >
                          <Users className="w-3.5 h-3.5 text-black" />
                        </div>
                      ))}
                    </div>
                    <span className="ml-3 text-sm text-white/60">
                      <span className="text-white font-medium">{waitlistCount}</span> on waitlist
                    </span>
                  </div>
                </div>
              )}
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
                <PremiumCard className="p-5">
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
                      <div className="font-semibold text-sm text-amber-400">2.1¢/mi</div>
                    </div>
                  </div>
                </PremiumCard>

                {/* AI Chat card */}
                <PremiumCard className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                    <span className="text-sm font-medium">Ask Anything</span>
                  </div>
                  <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                    <p className="text-xs">
                      For Tokyo, your best options are <span className="text-amber-400">ANA (1:1)</span> at
                      ~55K miles RT or <span className="text-amber-400">Virgin Atlantic</span> for partner awards...
                    </p>
                  </div>
                </PremiumCard>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator - hidden on mobile to avoid overlap */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="hidden md:block absolute bottom-4 left-1/2 -translate-x-1/2"
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
                viewport={{ once: false }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="text-center"
              >
                <div className="text-4xl md:text-5xl font-bold gradient-text mb-1">
                  {stat.value}{stat.suffix}
                </div>
                <div className="text-white/80 font-medium">{stat.label}</div>
                {'sublabel' in stat && stat.sublabel && (
                  <div className="text-white/50 text-sm mt-1">{stat.sublabel}</div>
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

      {/* Why I Built This Section */}
      <section id="why-i-built-this" className="py-24 md:py-32 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: false }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6"
            >
              <span className="text-sm text-amber-400 font-medium">From the Creator</span>
            </motion.div>
            
            <BlurInText scrollSync className="mb-6">
              <h2 className="text-3xl sm:text-4xl font-bold">
                Why I Built <span className="gradient-text">VentureXify</span>
              </h2>
            </BlurInText>
            
            <div className="text-lg text-white/60 space-y-4 text-left sm:text-center">
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                Hey! I&apos;m a college student who got obsessed with maximizing credit card rewards.
                After spending countless hours calculating portal vs direct bookings, researching transfer partners,
                and trying to squeeze every cent of value from my Venture X, I thought: <em className="text-white/80">&quot;Why isn&apos;t there a tool for this?&quot;</em>
              </motion.p>
              
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                So I built one. VentureXify is my passion project—made by a points nerd, for points nerds.
              </motion.p>
              
              <motion.p
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: false }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                For newcomers, the Venture X can feel overwhelming—there&apos;s so much this card can do. Instead of just
                giving you answers, this tool <span className="text-white/80">guides you through the decision-making process</span> so
                you understand <em>why</em> a booking strategy works. My goal is for you to feel confident making these calls yourself.
              </motion.p>
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <motion.div
                whileHover={{ scale: 1.05, y: -2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-amber-500/10 border border-amber-500/20"
              >
                <div className="text-amber-400 font-semibold text-lg">100% Free</div>
                <div className="text-white/50 text-sm">No catch. No premium tier (yet).</div>
              </motion.div>
              
              <motion.a
                href="https://github.com/VentureXify/VentureXify"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05, y: -2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-white/80" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                  <span className="text-white/80 font-medium group-hover:text-white">Star on GitHub</span>
                </div>
                <div className="text-white/50 text-sm">Open source & community-driven</div>
              </motion.a>
            </motion.div>
            
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: false }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="mt-6 text-sm text-white/50"
            >
              Future paid features will help fund server costs, but the core extension will always be free.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Premium Final CTA Section - seamless like hero */}
      <InteractiveCTASection waitlistCount={waitlistCount} />

      {/* Coming Soon Section — revealed after CTA */}
      <section id="coming-soon" className="relative py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-4 text-center">
          {/* Section label with blur-in entrance */}
          <motion.div
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: false }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-white text-sm font-medium tracking-widest uppercase">
              Coming Soon
            </span>
          </motion.div>

          {/* Heading with blur-in entrance */}
          <motion.div
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: false }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-4"
          >
            <h2 className="text-3xl md:text-5xl font-bold gradient-text">
              What&apos;s Next
            </h2>
          </motion.div>

          {/* Subtitle with blur-in entrance */}
          <motion.p
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: false }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/60 mt-4 max-w-2xl mx-auto"
          >
            We&apos;re constantly building new features to help you maximize your Venture X card.
            Here&apos;s what&apos;s on the roadmap.
          </motion.p>

          {/* Coming soon feature cards — staggered entrance with spotlight */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-12">
            {[
              {
                icon: Hotel,
                title: 'Hotel Price Compare',
                description: 'Compare hotel portal vs direct prices across Marriott, Hilton, Hyatt, and more.',
                status: 'In Development',
              },
              {
                icon: BarChart3,
                title: 'Points Dashboard',
                description: 'Track your points balance, redemption history, and savings over time.',
                status: 'Planned',
              },
              {
                icon: Bell,
                title: 'Price Drop Alerts',
                description: "Get notified when flight prices drop on routes you're watching.",
                status: 'Exploring',
              },
            ].map((feature, index) => (
              <PremiumCard
                key={feature.title}
                className="p-5 text-left"
                delay={index * 0.15}
                spotlight
              >
                {/* Icon with spring hover */}
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/15 mb-4"
                >
                  <feature.icon className="w-4 h-4 text-amber-400" />
                </motion.div>
                <h3 className="text-[15px] font-medium text-white tracking-tight">{feature.title}</h3>
                <p className="text-sm text-white/60 mt-1.5 leading-relaxed">
                  {feature.description}
                </p>
                {/* Status badge with subtle pulse on viewport entry */}
                <motion.span
                  initial={{ opacity: 0.7 }}
                  whileInView={{ opacity: [0.7, 1, 0.7] }}
                  viewport={{ once: false }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="inline-block mt-3 text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400/80 font-medium"
                >
                  {feature.status}
                </motion.span>
              </PremiumCard>
            ))}
          </div>

          {/* Feature Request Input */}
          <div className="mt-16 max-w-xl mx-auto">
            <h3 className="text-lg font-medium text-white mb-2">Want a feature?</h3>
            <p className="text-sm text-white/50 mb-6">
              Tell us what you&apos;d love to see in VentureXify. Your input shapes the roadmap.
            </p>

            {/* Feature request form */}
            <FeatureRequestForm />
          </div>
        </div>
      </section>

        {/* Footer */}
        <Footer />
      </main>
    </>
  );
}

// Premium Email Form Component
function PremiumEmailForm() {
  const { isSignedUp, setSignedUp, incrementWaitlistCount } = useWaitlist();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Dynamic import to avoid importing at component level
      const { joinWaitlist, sendConfirmationEmail } = await import('@/lib/supabase');
      const result = await joinWaitlist({ email, referral_source: 'cta_section' });
      
      if (result.success) {
        // Only increment for new signups (not duplicates)
        if (result.error !== 'already_registered') {
          incrementWaitlistCount();
          // Send confirmation email for new signups only
          if (result.position) {
            sendConfirmationEmail({
              email,
              position: result.position,
              source: 'cta_section',
            }).catch(console.error); // Non-blocking
          }
        }
        setSignedUp(email, 'cta_section', result.position);
      } else {
        setError(result.error || 'Something went wrong');
      }
    } catch {
      setError('Failed to join waitlist. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show success state if already signed up (from any source)
  if (isSignedUp) {
    return <CTAWaitlistSuccess />;
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      {/* Glow effect */}
      <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-amber-500/30 to-orange-500/30 blur opacity-50" />
      
      <div className="relative flex flex-col sm:flex-row gap-3">
        {/* Input with focus glow */}
        <div className="flex-1 relative group">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full px-5 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 focus:bg-white/10 transition-all"
            required
          />
          {/* Pulsing glow when focused */}
          <div className="absolute -inset-px bg-gradient-to-r from-amber-500/0 via-amber-500/20 to-amber-500/0 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 -z-10 blur-sm" />
        </div>
        
        {/* Flashy Shimmer Button */}
        <motion.button
          type="submit"
          disabled={isSubmitting}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          className="relative overflow-hidden px-8 py-4 rounded-xl bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 text-black font-bold hover:from-yellow-300 hover:via-amber-400 hover:to-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[180px] group shadow-[0_4px_25px_rgba(251,191,36,0.5),0_0_50px_rgba(245,158,11,0.3)]"
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
          {/* Rotating light beam border */}
          <span className="absolute -inset-[2px] overflow-hidden rounded-xl">
            <span
              className="absolute w-[200%] h-[200%] -top-1/2 -left-1/2"
              style={{
                background: 'conic-gradient(from 0deg, transparent 0deg, transparent 60deg, rgba(255,255,255,0.8) 90deg, #fff 120deg, transparent 150deg, transparent 360deg)',
                animation: 'spin-around 2s linear infinite',
              }}
            />
            <span className="absolute inset-[2px] rounded-xl bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500" />
          </span>
          
          {/* Multiple shine sweeps */}
          <span
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            style={{
              animation: 'shimmer-slide 1.5s ease-in-out infinite',
            }}
          />
          
          {/* Content */}
          <span className="relative z-10 flex items-center gap-2">
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
          </span>
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
          viewport={{ once: false }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          {/* Top badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-8"
            initial={{ scale: 0.9, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: false }}
            transition={{ delay: 0.2 }}
          >
            <Rocket className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-400 font-medium">Launching Soon</span>
          </motion.div>

          {/* Headline with blur-in animation */}
          <BlurInText scrollSync className="mb-6">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold">
              Ready to{' '}
              <span className="gradient-text">maximize</span>
              {' '}your
              <br />
              <span className="gradient-text">Venture X</span>?
            </h2>
          </BlurInText>

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
              <Shield className="w-4 h-4 text-amber-400/60" />
              <span>100% Privacy First</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400/60" />
              <span>AI-Powered</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// Inline Feature Request Form Component
function FeatureRequestForm() {
  const [suggestion, setSuggestion] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (submitted) {
      const timer = setTimeout(() => {
        setSubmitted(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [submitted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestion.trim()) return;

    setSubmitting(true);

    try {
      await fetch('/api/feature-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestion: suggestion.trim() }),
      });
    } catch {
      // Silently handle — we still show success
    }

    setSubmitted(true);
    setSuggestion('');
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-center py-6"
      >
        <p className="text-amber-400 font-medium text-lg">Thanks for your suggestion! 🎉</p>
        <p className="text-white/50 text-sm mt-1">We&apos;ll review it for the roadmap.</p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <textarea
        value={suggestion}
        onChange={(e) => setSuggestion(e.target.value)}
        placeholder="I'd love to see..."
        className="bg-white/[0.05] border border-white/[0.08] rounded-xl p-4 text-white placeholder:text-white/30 focus:border-amber-500/40 focus:outline-none focus:ring-1 focus:ring-amber-500/20 focus:shadow-[0_0_0_2px_rgba(245,158,11,0.15)] resize-none w-full h-24 text-sm transition-shadow duration-300"
      />
      <div className="flex justify-end">
        <motion.button
          type="submit"
          disabled={submitting || !suggestion.trim()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-r from-amber-500 to-amber-600 text-black font-medium text-sm px-6 py-2.5 rounded-lg hover:from-amber-400 hover:to-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Sending...' : 'Submit Suggestion'}
        </motion.button>
      </div>
    </form>
  );
}
