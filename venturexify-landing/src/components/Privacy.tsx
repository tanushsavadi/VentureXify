'use client';

import { motion } from 'framer-motion';
import { Shield, Eye, Code, Users, Check, Lock, Database } from 'lucide-react';
import GlassCard from './GlassCard';
import { BlurInText } from './BlurInText';

const privacyFeatures = [
  { icon: Eye, text: 'No tracking or ads', description: 'We never sell your data or track browsing' },
  { icon: Database, text: 'Chrome storage only', description: 'Preferences & history stay on your device' },
  { icon: Lock, text: 'No bank login required', description: 'Works without your Capital One credentials' },
  { icon: Code, text: 'Open source', description: 'Fully transparent codebase on GitHub' },
];

export default function Privacy() {
  return (
    <section id="privacy" className="py-24 md:py-32 pb-8 md:pb-12 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-emerald-400 text-sm font-medium tracking-wider uppercase mb-4 block">
              Privacy First
            </span>
            <BlurInText scrollSync className="mb-6">
              <h2 className="text-3xl md:text-5xl font-bold">
                Your data stays{' '}
                <span className="gradient-text-emerald">yours</span>
              </h2>
            </BlurInText>
            <p className="text-white/60 text-lg mb-8">
              Your preferences, history, and perks tracking are stored locally in Chrome.
              AI features use secure Edge Functions — your browsing activity is never logged.
            </p>

            {/* Privacy features list */}
            <div className="space-y-4">
              {privacyFeatures.map((feature, index) => (
                <motion.div
                  key={feature.text}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                  className="flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-medium">{feature.text}</p>
                    <p className="text-white/40 text-sm">{feature.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right card - Security status */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <GlassCard className="p-8" glow="emerald">
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: false }}
                  transition={{ type: 'spring', delay: 0.4 }}
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center mx-auto mb-4"
                >
                  <Shield className="w-10 h-10 text-black" />
                </motion.div>
                <h3 className="text-xl font-semibold mb-2">Security Status</h3>
                <p className="text-emerald-400 font-medium">Fully Protected</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-emerald-400 mb-1">0</div>
                  <div className="text-white/60 text-sm">Ads or Tracking</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-emerald-400 mb-1">6</div>
                  <div className="text-white/60 text-sm">Minimal Permissions</div>
                </div>
              </div>

              {/* Trust badges */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="flex items-center justify-center gap-2 text-white/40 text-sm">
                  <Code className="w-4 h-4" />
                  <span>Open source on GitHub</span>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
