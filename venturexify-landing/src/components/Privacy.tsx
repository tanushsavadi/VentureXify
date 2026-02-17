'use client';

import { motion } from 'framer-motion';
import { Shield, Eye, Code, Lock, Check, Database } from 'lucide-react';
import PremiumCard from './PremiumCard';
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
            <span className="text-amber-400 text-sm font-medium tracking-wider uppercase mb-4 block">
              Privacy First
            </span>
            <BlurInText scrollSync className="mb-6">
              <h2 className="text-3xl md:text-5xl font-bold">
                Your data stays{' '}
                <span className="gradient-text">yours</span>
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
                  whileHover={{ x: 2 }}
                  className="flex items-center gap-4 cursor-default rounded-lg px-2 py-1 -mx-2 hover:bg-white/[0.02] transition-colors duration-200"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-medium">{feature.text}</p>
                    <p className="text-white/50 text-sm">{feature.description}</p>
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
            <PremiumCard className="p-8">
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: false }}
                  transition={{ type: 'spring', delay: 0.4 }}
                  className="w-20 h-20 mx-auto mb-4"
                >
                  <motion.div
                    animate={{ scale: [1, 1.03, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                      <Shield className="w-10 h-10 text-black" />
                    </div>
                  </motion.div>
                </motion.div>
                <h3 className="text-xl font-semibold mb-2">Security Status</h3>
                <p className="text-amber-400 font-medium">Fully Protected</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/[0.04] rounded-lg p-3 text-center hover:bg-white/[0.06] transition-colors duration-200">
                  <div className="text-3xl font-bold text-amber-400 mb-1">0</div>
                  <div className="text-white/50 text-sm">Ads or Tracking</div>
                </div>
                <div className="bg-white/[0.04] rounded-lg p-3 text-center hover:bg-white/[0.06] transition-colors duration-200">
                  <div className="text-3xl font-bold text-amber-400 mb-1">6</div>
                  <div className="text-white/50 text-sm">Minimal Permissions</div>
                </div>
              </div>

              {/* Trust badges */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
                  <Code className="w-4 h-4" />
                  <span>Open source on GitHub</span>
                </div>
              </div>
            </PremiumCard>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
