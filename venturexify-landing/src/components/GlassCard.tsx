'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: 'amber' | 'violet' | 'emerald' | 'none';
  delay?: number;
}

export default function GlassCard({
  children,
  className = '',
  hover = true,
  glow = 'none',
  delay = 0,
}: GlassCardProps) {
  const glowColors = {
    amber: 'hover:shadow-[0_20px_40px_-20px_rgba(245,158,11,0.3)]',
    violet: 'hover:shadow-[0_20px_40px_-20px_rgba(139,92,246,0.3)]',
    emerald: 'hover:shadow-[0_20px_40px_-20px_rgba(16,185,129,0.3)]',
    none: '',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={hover ? { y: -4, scale: 1.01 } : undefined}
      className={`
        bg-white/[0.03] backdrop-blur-xl rounded-2xl
        border border-white/[0.05] transition-all duration-300
        ${hover ? 'hover:border-white/[0.1]' : ''}
        ${glowColors[glow]}
        ${className}
      `}
    >
      {children}
    </motion.div>
  );
}
