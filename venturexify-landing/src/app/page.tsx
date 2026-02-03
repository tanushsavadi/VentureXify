'use client';

import { Suspense, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Star, ChevronDown, ArrowRight, MessageSquare } from 'lucide-react';
import Image from 'next/image';
import Navigation from '@/components/Navigation';
import Features from '@/components/Features';
import HowItWorks from '@/components/HowItWorks';
import Privacy from '@/components/Privacy';
import Footer from '@/components/Footer';
import GlassCard from '@/components/GlassCard';
import WaitlistForm, { InlineWaitlistForm } from '@/components/WaitlistForm';
import { getWaitlistCount } from '@/lib/supabase';

// Floating Credit Card Component with real Venture X card image
function FloatingCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotateY: -15 }}
      animate={{
        opacity: 1,
        y: [0, -10, 0],
        rotateY: [-5, 5, -5]
      }}
      transition={{
        opacity: { duration: 0.8 },
        y: { duration: 4, repeat: Infinity, ease: "easeInOut" },
        rotateY: { duration: 6, repeat: Infinity, ease: "easeInOut" }
      }}
      className="relative w-[340px] h-[215px] perspective-1000"
      style={{ transformStyle: 'preserve-3d' }}
    >
      {/* Card shadow */}
      <div className="absolute inset-0 rounded-2xl bg-blue-900/40 blur-2xl transform translate-y-4 scale-95" />
      
      {/* Real Venture X Card Image */}
      <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl">
        <Image
          src="/venture-x-card.png"
          alt="Capital One Venture X Card"
          fill
          className="object-cover"
          priority
        />
        
        {/* Card shine effect overlay */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
        />
      </div>
    </motion.div>
  );
}

// Stats section data
const stats = [
  { value: '2.4¢', label: 'Avg Value/Mile', suffix: '' },
  { value: '15+', label: 'Transfer Partners', suffix: '' },
  { value: '500+', label: 'Beta Signups', suffix: '' },
];

export default function Home() {
  const [waitlistCount, setWaitlistCount] = useState(500);

  useEffect(() => {
    getWaitlistCount().then(setWaitlistCount);
  }, []);

  return (
    <main className="min-h-screen bg-background overflow-x-hidden">
      <Navigation />

      {/* Hero Section */}
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

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
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

              {/* Floating Card - Mobile only, positioned between text and form */}
              <div className="flex justify-center lg:hidden mb-8">
                <FloatingCard />
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

            {/* Right content - Preview cards with floating card */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="hidden lg:flex flex-col items-center gap-6 relative z-10"
            >
              {/* Floating Credit Card */}
              <div className="mb-4">
                <FloatingCard />
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
                <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">
                  {stat.value}{stat.suffix}
                </div>
                <div className="text-white/60">{stat.label}</div>
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

      {/* Final CTA Section */}
      <section className="py-24 md:py-32 relative">
        <div className="absolute inset-0 bg-gradient-radial from-amber-500/10 via-transparent to-transparent opacity-50" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-5xl font-bold mb-6">
              Ready to maximize your{' '}
              <span className="gradient-text">Venture X</span>?
            </h2>
            <p className="text-white/60 text-lg mb-10">
              Join {waitlistCount}+ Venture X cardholders already on the waitlist.
            </p>
            <WaitlistForm showExtendedForm className="max-w-xl mx-auto" />
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </main>
  );
}
