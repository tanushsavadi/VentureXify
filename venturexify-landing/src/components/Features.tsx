'use client';

import { motion } from 'framer-motion';
import {
  ArrowLeftRight,
  Sparkles,
  Plane,
  CreditCard,
  Trophy,
  Gift,
  Calculator,
  Globe,
} from 'lucide-react';
import GlassCard from './GlassCard';
import { StaggerContainer, StaggerItem } from './AnimatedSection';
import { BlurInText } from './BlurInText';

const features = [
  {
    icon: ArrowLeftRight,
    title: 'Portal vs Direct',
    description: 'Intelligent comparison factoring in 5x portal earnings, travel credit, status earning, and break-even analysis. Know exactly which booking option saves you more.',
    color: 'amber',
    gradient: 'from-amber-400 to-orange-500',
    stats: 'Works on any travel site',
  },
  {
    icon: Sparkles,
    title: 'AI Expert Assistant',
    description: 'Ask anything about Venture X benefits, transfer strategies, or redemption math. Powered by RAG knowledge base with insights from Capital One guides, The Points Guy, NerdWallet, and more.',
    color: 'violet',
    gradient: 'from-violet-400 to-purple-500',
    stats: 'Llama + Qwen via Groq',
  },
  {
    icon: Plane,
    title: '17+ Transfer Partners',
    description: 'All 1:1 airline partners mapped: Turkish, Aeroplan, Emirates, Singapore, JetBlue, and more. See which partner gets you the best CPM for your route.',
    color: 'amber',
    gradient: 'from-amber-400 to-orange-500',
    stats: 'Powered by PointsYeah',
  },
  {
    icon: CreditCard,
    title: 'Cover Travel Purchases',
    description: 'Known on Reddit as "Travel Eraser"—officially "Cover travel purchases" on the portal. Get reimbursed for travel at 1¢/mile with the "double-dip" strategy: earn miles on cash, redeem later.',
    color: 'violet',
    gradient: 'from-violet-400 to-purple-500',
    stats: 'No minimum required',
  },
  {
    icon: Trophy,
    title: 'Smart Booking Verdicts',
    description: 'Get instant, personalized recommendations with savings calculations. See exactly how much you save with each booking method—portal, direct, or miles transfer.',
    color: 'emerald',
    gradient: 'from-emerald-400 to-green-500',
    stats: 'Real savings • Real data',
  },
  {
    icon: Calculator,
    title: 'Redemption Calculator',
    description: 'Compare Travel Eraser vs Transfer Partners vs Portal booking. Set your target CPM and get personalized recommendations based on your miles valuation.',
    color: 'amber',
    gradient: 'from-amber-400 to-orange-500',
    stats: 'Customize your valuation',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.5 }}
            className="text-amber-400 text-sm font-medium tracking-wider uppercase mb-4 block"
          >
            Features
          </motion.span>
          <BlurInText delay={0.1} duration={1.1} once={false} className="mb-4">
            <h2 className="text-3xl md:text-5xl font-bold">
              Everything you need to{' '}
              <span className="gradient-text">maximize value</span>
            </h2>
          </BlurInText>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-white/60 max-w-2xl mx-auto text-lg"
          >
            Powerful tools designed specifically for Venture X cardholders to get the most out of every booking.
          </motion.p>
        </div>

        {/* Features grid */}
        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <StaggerItem key={feature.title}>
              <GlassCard
                className="p-6 h-full"
                glow={feature.color as 'amber' | 'violet' | 'emerald'}
                delay={index * 0.1}
              >
                <div className="flex flex-col h-full">
                  {/* Icon */}
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4`}
                  >
                    <feature.icon className="w-6 h-6 text-black" />
                  </motion.div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed flex-grow mb-3">
                    {feature.description}
                  </p>

                  {/* Stats badge */}
                  {'stats' in feature && feature.stats && (
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r ${feature.gradient} w-fit`}>
                      <span className="text-xs font-semibold text-black">{feature.stats}</span>
                    </div>
                  )}

                  {/* Hover indicator */}
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: '3rem' }}
                    viewport={{ once: false }}
                    transition={{ delay: 0.5 + index * 0.1, duration: 0.4 }}
                    className={`h-0.5 bg-gradient-to-r ${feature.gradient} mt-4 rounded-full`}
                  />
                </div>
              </GlassCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
