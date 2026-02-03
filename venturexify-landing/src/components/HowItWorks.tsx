'use client';

import { motion } from 'framer-motion';
import { Download, Globe, Zap } from 'lucide-react';
import GlassCard from './GlassCard';

const steps = [
  {
    number: '01',
    icon: Download,
    title: 'Install Extension',
    description: 'Add VentureXify to Chrome in one click. No account required to start.',
    color: 'from-amber-400 to-orange-500',
  },
  {
    number: '02',
    icon: Globe,
    title: 'Browse Travel Sites',
    description: 'Shop normally on your favorite travel sites. We work in the background.',
    color: 'from-violet-400 to-purple-500',
  },
  {
    number: '03',
    icon: Zap,
    title: 'Get Recommendations',
    description: 'See instant value calculations and smart booking recommendations.',
    color: 'from-emerald-400 to-green-500',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 md:py-32 relative">
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
            How it Works
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Simple as <span className="gradient-text">1, 2, 3</span>
          </h2>
          <p className="text-white/60 max-w-2xl mx-auto text-lg">
            Get started in under a minute. No complex setup or learning curve.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connection line */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500/20 via-violet-500/20 to-emerald-500/20 -translate-y-1/2" />

          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
            >
              <GlassCard className="p-8 text-center relative" hover>
                {/* Step number */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full bg-gradient-to-r ${step.color} text-black`}>
                    {step.number}
                  </span>
                </div>

                {/* Icon */}
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 10 }}
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto mb-6`}
                >
                  <step.icon className="w-8 h-8 text-black" />
                </motion.div>

                {/* Content */}
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  {step.description}
                </p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
