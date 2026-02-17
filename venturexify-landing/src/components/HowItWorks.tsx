'use client';

import { motion } from 'framer-motion';
import { Download, Search, Brain, Sparkles } from 'lucide-react';
import PremiumCard from '@/components/PremiumCard';
import { BlurInText } from './BlurInText';

/* ─── Step data ─── */
const steps = [
  {
    icon: Download,
    title: 'Install & Set Your Prefs',
    description:
      "Add to Chrome, set your miles valuation (default 1.7¢/mile), and whether you care about status earning. That's it.",
  },
  {
    icon: Search,
    title: 'Browse Google Flights, Hotels, etc.',
    description:
      'VentureXify auto-detects prices on supported sites including Google Flights, Delta, United, Marriott, Hilton, and more.',
  },
  {
    icon: Brain,
    title: 'Open Side Panel',
    description:
      'Click the extension to see Portal vs Direct comparison, transfer partner suggestions, and AI explanations in the side panel.',
  },
  {
    icon: Sparkles,
    title: 'Ask the AI Anything',
    description:
      'Not sure? Ask questions like "Should I transfer to Turkish?" or "How does double-dip eraser work?" - get instant answers.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── Section header ── */}
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-amber-400 text-sm font-medium tracking-wider uppercase mb-4 block"
          >
            How it Works
          </motion.span>
          <BlurInText scrollSync className="mb-4">
            <h2 className="text-3xl md:text-5xl font-bold tracking-wide">
              Simple as <span className="gradient-text">1, 2, 3</span>
            </h2>
          </BlurInText>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/60 max-w-2xl mx-auto text-lg leading-relaxed"
          >
            Get started in under a minute. No complex setup or learning curve.
          </motion.p>
        </div>

        {/* ── Steps grid with Magic UI spotlight cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* ── Connection line (lg only) — gold gradient ── */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 -translate-y-1/2 z-0 pointer-events-none">
            <div className="h-px w-full bg-gradient-to-r from-amber-500/0 via-amber-500/25 to-amber-500/0" />
          </div>

          {/* ── Step cards ── */}
          {steps.map((step, index) => (
            <PremiumCard
              key={index}
              className="p-5 pt-8 relative h-full"
              hover
              spotlight
              delay={index * 0.15}
            >
              {/* ── Step badge ── */}
              <motion.div
                className="absolute -top-3 left-5 z-20"
                initial={{ scale: 0.8, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: index * 0.15 + 0.2 }}
              >
                <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-black ring-1 ring-amber-500/20 shadow-sm">
                  0{index + 1}
                </span>
              </motion.div>

              {/* ── Icon ── */}
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 15,
                }}
                className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center"
              >
                <step.icon className="w-5 h-5 text-amber-400" />
              </motion.div>

              {/* ── Title ── */}
              <h3 className="text-[15px] font-medium text-white mt-4 tracking-tight">
                {step.title}
              </h3>

              {/* ── Description ── */}
              <p className="text-sm text-white/60 mt-1.5 leading-relaxed">
                {step.description}
              </p>
            </PremiumCard>
          ))}
        </div>
      </div>
    </section>
  );
}
