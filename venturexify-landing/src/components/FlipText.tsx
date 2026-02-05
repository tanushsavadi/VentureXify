'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface FlipTextProps {
  text: string;
  className?: string;
  duration?: number;
  direction?: 'up' | 'down';
}

/**
 * FlipText - A departure board style flip animation for text changes
 * Creates a 3D flip effect when text value changes, like an airport/train departure board
 */
export function FlipText({
  text,
  className = '',
  duration = 0.5,
  direction = 'down',
}: FlipTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isFlipping, setIsFlipping] = useState(false);
  
  useEffect(() => {
    if (text !== displayText) {
      setIsFlipping(true);
      // Small delay before changing text for smoother effect
      const timer = setTimeout(() => {
        setDisplayText(text);
        setIsFlipping(false);
      }, duration * 500); // Half the duration
      
      return () => clearTimeout(timer);
    }
  }, [text, displayText, duration]);

  const rotateDirection = direction === 'down' ? -90 : 90;
  const exitRotation = direction === 'down' ? 90 : -90;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ perspective: '400px' }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={displayText}
          initial={{ 
            rotateX: rotateDirection, 
            opacity: 0,
            y: direction === 'down' ? -8 : 8,
          }}
          animate={{ 
            rotateX: 0, 
            opacity: 1,
            y: 0,
          }}
          exit={{ 
            rotateX: exitRotation, 
            opacity: 0,
            y: direction === 'down' ? 8 : -8,
          }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
            mass: 0.8,
          }}
          style={{
            transformOrigin: direction === 'down' ? 'top center' : 'bottom center',
            transformStyle: 'preserve-3d',
            backfaceVisibility: 'hidden',
          }}
          className="whitespace-nowrap"
        >
          {displayText}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * FlipTextCharacter - Individual character flip for staggered effect
 * Creates a more complex departure board effect with individual characters flipping
 */
interface FlipTextCharactersProps {
  text: string;
  className?: string;
  charClassName?: string;
  staggerDelay?: number;
  duration?: number;
}

export function FlipTextCharacters({
  text,
  className = '',
  charClassName = '',
  staggerDelay = 0.03,
  duration = 0.4,
}: FlipTextCharactersProps) {
  const [displayChars, setDisplayChars] = useState(text.split(''));
  const [targetText, setTargetText] = useState(text);

  useEffect(() => {
    if (text !== targetText) {
      setTargetText(text);
      
      // Animate each character with stagger
      const newChars = text.split('');
      const maxLength = Math.max(displayChars.length, newChars.length);
      
      for (let i = 0; i < maxLength; i++) {
        setTimeout(() => {
          setDisplayChars(prev => {
            const updated = [...prev];
            if (i < newChars.length) {
              updated[i] = newChars[i];
            }
            // Trim array if new text is shorter
            if (newChars.length < updated.length && i === maxLength - 1) {
              return updated.slice(0, newChars.length);
            }
            return updated;
          });
        }, i * staggerDelay * 1000);
      }
    }
  }, [text, targetText, displayChars.length, staggerDelay]);

  return (
    <div className={`flex ${className}`} style={{ perspective: '400px' }}>
      {displayChars.map((char, index) => (
        <AnimatePresence mode="wait" key={`${index}-container`}>
          <motion.span
            key={`${index}-${char}`}
            initial={{ rotateX: -90, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            exit={{ rotateX: 90, opacity: 0 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 30,
              duration,
            }}
            style={{
              transformOrigin: 'top center',
              transformStyle: 'preserve-3d',
              backfaceVisibility: 'hidden',
              display: 'inline-block',
            }}
            className={charClassName}
          >
            {char === ' ' ? '\u00A0' : char}
          </motion.span>
        </AnimatePresence>
      ))}
    </div>
  );
}

export default FlipText;
