'use client';

import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { useRef, ReactNode } from 'react';

interface BlurInTextProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  once?: boolean;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  /** When true, blur/opacity are driven 1:1 by scroll position instead of time-based animation */
  scrollSync?: boolean;
  /** Max blur amount in px (default: 12). Applies to both modes. */
  blurAmount?: number;
}

/**
 * Scroll-synced variant: blur and opacity are tied 1:1 to the user's scroll position.
 * Uses framer-motion's useScroll + useTransform for GPU-accelerated, rAF-driven updates.
 *
 * Progress 0 → element top enters viewport bottom
 * Progress 1 → element top reaches 40% from viewport top
 *
 * Scrolling back up reverses the effect automatically.
 */
function ScrollBlurIn({
  children,
  className,
  direction,
  blurAmount,
}: {
  children: ReactNode;
  className: string;
  direction: 'up' | 'down' | 'left' | 'right' | 'none';
  blurAmount: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    // "start end"  → element's top edge meets viewport bottom (progress=0)
    // "start 0.4"  → element's top edge is at 40% from viewport top (progress=1)
    offset: ['start end', 'start 0.4'],
  });

  // Map scroll progress to visual properties
  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const blur = useTransform(scrollYProgress, [0, 1], [blurAmount, 0]);
  const filter = useTransform(blur, (v: number) => `blur(${v}px)`);

  // Direction offsets — all hooks called unconditionally to satisfy Rules of Hooks
  const yAmount = direction === 'up' ? 30 : direction === 'down' ? -30 : 0;
  const xAmount = direction === 'left' ? 30 : direction === 'right' ? -30 : 0;
  const y = useTransform(scrollYProgress, [0, 1], [yAmount, 0]);
  const x = useTransform(scrollYProgress, [0, 1], [xAmount, 0]);

  return (
    <motion.div
      ref={ref}
      style={{
        opacity,
        filter,
        y,
        x,
        willChange: 'filter, opacity, transform',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Original time-based blur-in (plays on intersection).
 * Extracted to its own component to keep hooks unconditional in each branch.
 */
function TimeBasedBlurIn({
  children,
  className,
  delay,
  duration,
  once,
  direction,
}: {
  children: ReactNode;
  className: string;
  delay: number;
  duration: number;
  once: boolean;
  direction: 'up' | 'down' | 'left' | 'right' | 'none';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: '-50px' });

  const directionOffset = {
    up: { y: 30 },
    down: { y: -30 },
    left: { x: 30 },
    right: { x: -30 },
    none: {},
  };

  return (
    <motion.div
      ref={ref}
      initial={{
        opacity: 0,
        filter: 'blur(12px)',
        ...directionOffset[direction],
      }}
      animate={
        isInView
          ? {
              opacity: 1,
              filter: 'blur(0px)',
              x: 0,
              y: 0,
            }
          : {
              opacity: 0,
              filter: 'blur(12px)',
              ...directionOffset[direction],
            }
      }
      transition={{
        duration,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * BlurInText — Animate children with a blur-in + fade-in effect.
 *
 * Supports two modes:
 * - **Time-based** (default): Plays animation on intersection using framer-motion's useInView.
 * - **Scroll-synced** (`scrollSync={true}`): Blur/opacity are driven 1:1 by scroll position.
 *   Text progressively un-blurs as user scrolls, and re-blurs when scrolling back up.
 */
export function BlurInText({
  children,
  className = '',
  delay = 0,
  duration = 0.8,
  once = true,
  direction = 'up',
  scrollSync = false,
  blurAmount = 12,
}: BlurInTextProps) {
  if (scrollSync) {
    return (
      <ScrollBlurIn
        className={className}
        direction={direction}
        blurAmount={blurAmount}
      >
        {children}
      </ScrollBlurIn>
    );
  }

  return (
    <TimeBasedBlurIn
      className={className}
      delay={delay}
      duration={duration}
      once={once}
      direction={direction}
    >
      {children}
    </TimeBasedBlurIn>
  );
}

// Variant for individual characters/words with staggered blur-in
interface BlurInWordsProps {
  text: string;
  className?: string;
  wordClassName?: string;
  delay?: number;
  staggerDelay?: number;
  duration?: number;
  once?: boolean;
}

export function BlurInWords({
  text,
  className = '',
  wordClassName = '',
  delay = 0,
  staggerDelay = 0.05,
  duration = 0.5,
  once = true,
}: BlurInWordsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: '-50px' });
  const words = text.split(' ');

  return (
    <div ref={ref} className={`inline-flex flex-wrap ${className}`}>
      {words.map((word, index) => (
        <motion.span
          key={index}
          initial={{
            opacity: 0,
            filter: 'blur(10px)',
            y: 20,
          }}
          animate={
            isInView
              ? {
                  opacity: 1,
                  filter: 'blur(0px)',
                  y: 0,
                }
              : {
                  opacity: 0,
                  filter: 'blur(10px)',
                  y: 20,
                }
          }
          transition={{
            duration,
            delay: delay + index * staggerDelay,
            ease: [0.22, 1, 0.36, 1],
          }}
          className={`mr-[0.25em] ${wordClassName}`}
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
}

// Variant for character-by-character blur-in
interface BlurInCharsProps {
  text: string;
  className?: string;
  charClassName?: string;
  delay?: number;
  staggerDelay?: number;
  duration?: number;
  once?: boolean;
}

export function BlurInChars({
  text,
  className = '',
  charClassName = '',
  delay = 0,
  staggerDelay = 0.02,
  duration = 0.4,
  once = true,
}: BlurInCharsProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: '-50px' });

  return (
    <div ref={ref} className={`inline-block ${className}`}>
      {text.split('').map((char, index) => (
        <motion.span
          key={index}
          initial={{
            opacity: 0,
            filter: 'blur(8px)',
            y: 10,
          }}
          animate={
            isInView
              ? {
                  opacity: 1,
                  filter: 'blur(0px)',
                  y: 0,
                }
              : {
                  opacity: 0,
                  filter: 'blur(8px)',
                  y: 10,
                }
          }
          transition={{
            duration,
            delay: delay + index * staggerDelay,
            ease: [0.22, 1, 0.36, 1],
          }}
          className={`inline-block ${charClassName}`}
          style={{ whiteSpace: char === ' ' ? 'pre' : 'normal' }}
        >
          {char}
        </motion.span>
      ))}
    </div>
  );
}

export default BlurInText;
