'use client';

import { motion } from 'framer-motion';
import {
  ArrowLeftRight,
  Sparkles,
  Plane,
  CreditCard,
  Shield,
  Gift,
} from 'lucide-react';
import GlassCard from './GlassCard';
import { StaggerContainer, StaggerItem } from './AnimatedSection';

const features = [
  {
    icon: ArrowLeftRight,
    title: 'Portal vs Direct',
    description: 'Instant comparison showing whether to book through Capital One Travel or directly with the provider.',
    color: 'amber',
    gradient: 'from-amber-400 to-orange-500',
  },
  {
    icon: Sparkles,
    title: 'AI-Powered Insights',
    description: 'Ask anything about your Venture X benefits. Get instant, accurate answers powered by AI.',
    color: 'violet',
    gradient: 'from-violet-400 to-purple-500',
  },
  {
    icon: Plane,
    title: 'Transfer Partners',
    description: 'Find optimal transfer opportunities across 15+ airline and hotel partners.',
    color: 'amber',
    gradient: 'from-amber-400 to-orange-500',
  },
  {
    icon: CreditCard,
    title: 'Travel Eraser',
    description: 'Smart tracking of eligible purchases. Know exactly when to use your points.',
    color: 'violet',
    gradient: 'from-violet-400 to-purple-500',
  },
  {
    icon: Shield,
    title: 'Price Protection',
    description: 'Real-time monitoring for price drops on your booked travel.',
    color: 'emerald',
    gradient: 'from-emerald-400 to-green-500',
  },
  {
    icon: Gift,
    title: 'Perks Tracker',
    description: 'Never miss your $300 travel credit, lounge visits, or other benefits.',
    color: 'amber',
    gradient: 'from-amber-400 to-orange-500',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 md:py-32 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-amber-400 text-sm font-medium tracking-wider uppercase mb-4 block">
            Features
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Everything you need to{' '}
            <span className="gradient-text">maximize value</span>
          </h2>
          <p className="text-white/60 max-w-2xl mx-auto text-lg">
            Powerful tools designed specifically for Venture X cardholders to get the most out of every booking.
          </p>
        </motion.div>

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
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4`}
                  >
                    <feature.icon className="w-6 h-6 text-black" />
                  </motion.div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed flex-grow">
                    {feature.description}
                  </p>

                  {/* Hover indicator */}
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: '2rem' }}
                    viewport={{ once: true }}
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
