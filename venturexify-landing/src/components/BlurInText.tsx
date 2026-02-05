'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, ReactNode } from 'react';

interface BlurInTextProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  once?: boolean;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
}

export function BlurInText({
  children,
  className = '',
  delay = 0,
  duration = 0.8,
  once = true,
  direction = 'up',
}: BlurInTextProps) {
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
