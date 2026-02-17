'use client';

import { motion } from 'framer-motion';
import {
  ArrowLeftRight,
  Sparkles,
  Plane,
  CreditCard,
  Trophy,
  Calculator,
} from 'lucide-react';
import PremiumCard from '@/components/PremiumCard';
import { BlurInText } from './BlurInText';

/* ─── Feature data ─── */
const features = [
  {
    title: 'Portal vs Direct Price Compare',
    description:
      'Instantly compares Capital One portal prices against airline direct booking to find the best deal.',
    icon: ArrowLeftRight,
    meta: 'Core',
    tags: ['Compare', 'Savings'],
    featured: true,
  },
  {
    title: 'AI Travel Expert',
    description:
      'Chat with an AI that knows every Venture X benefit, transfer partner, and redemption strategy.',
    icon: Sparkles,
    meta: 'AI-Powered',
    tags: ['Chat', 'Strategy'],
    featured: true,
  },
  {
    title: '17+ Transfer Partners',
    description:
      'Real-time transfer rates and sweet spot analysis across all Capital One airline partners.',
    icon: Plane,
    meta: 'Live Rates',
    tags: ['Partners', 'Transfers'],
    featured: false,
  },
  {
    title: 'Travel Credit Coverage',
    description:
      'Track and maximize your $300 travel credit with automatic purchase detection.',
    icon: CreditCard,
    meta: '$300/yr',
    tags: ['Credits', 'Tracking'],
    featured: false,
  },
  {
    title: 'Smart Booking Verdicts',
    description:
      'Get instant pay-with-points or pay-cash recommendations based on real-time valuations.',
    icon: Trophy,
    meta: 'Verdicts',
    tags: ['Points', 'Value'],
    featured: false,
  },
  {
    title: 'Redemption Calculator',
    description:
      'Calculate exact cents-per-point value for any booking across all redemption methods.',
    icon: Calculator,
    meta: 'Calculator',
    tags: ['CPP', 'Math'],
    featured: false,
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 md:py-32 relative">
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
            Features
          </motion.span>
          <BlurInText scrollSync className="mb-4">
            <h2 className="text-3xl md:text-5xl font-bold tracking-wide">
              Everything you need to{' '}
              <span className="gradient-text">maximize value</span>
            </h2>
          </BlurInText>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/60 max-w-2xl mx-auto text-lg leading-relaxed"
          >
            Powerful tools designed specifically for Venture X cardholders to get
            the most out of every booking.
          </motion.p>
        </div>

        {/* ── Features grid — 3-col with Magic UI spotlight cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {features.map((feature, index) => (
            <PremiumCard
              key={feature.title}
              className="p-5"
              delay={index * 0.1}
              spotlight
              gradientSize={feature.featured ? 250 : 200}
            >
              <div className="relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  {/* Icon in subtle gold bg */}
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center bg-amber-500/15"
                  >
                    <feature.icon className="w-4 h-4 text-amber-400" />
                  </motion.div>
                  {/* Status/meta badge */}
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/[0.08] text-white/50 hover:bg-amber-500/10 hover:text-amber-400/80 transition-colors duration-200">
                    {feature.meta}
                  </span>
                </div>

                <h3 className="text-[15px] font-medium text-white tracking-tight group-hover:text-amber-50 transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-sm text-white/60 mt-1.5 leading-relaxed">
                  {feature.description}
                </p>

                {/* Tags row */}
                <div className="flex items-center gap-1.5 mt-4">
                  {feature.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.06] text-white/50 hover:bg-white/[0.10] hover:text-white/70 transition-colors duration-200 cursor-default"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Explore arrow hint */}
                <span className="absolute bottom-4 right-5 text-xs text-amber-500/0 group-hover:text-amber-500/60 transition-all duration-300 translate-x-0 group-hover:translate-x-1">→</span>
              </div>
            </PremiumCard>
          ))}
        </div>
      </div>
    </section>
  );
}
