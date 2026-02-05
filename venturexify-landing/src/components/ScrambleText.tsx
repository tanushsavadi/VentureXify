'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';

interface ScrambleTextProps {
  text: string;
  isActive: boolean;
  className?: string;
  scrambleSpeed?: number;
  revealDelay?: number;
  characters?: string;
}

export function ScrambleText({
  text,
  isActive,
  className = '',
  scrambleSpeed = 50,
  revealDelay = 100,
  characters = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
}: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isRevealed, setIsRevealed] = useState(!isActive);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getRandomChar = useCallback(() => {
    return characters[Math.floor(Math.random() * characters.length)];
  }, [characters]);

  const scramble = useCallback(() => {
    setDisplayText(
      text
        .split('')
        .map((char) => (char === ' ' ? ' ' : getRandomChar()))
        .join('')
    );
  }, [text, getRandomChar]);

  const reveal = useCallback(() => {
    let revealedCount = 0;
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      revealedCount++;
      
      setDisplayText(
        text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (index < revealedCount) return char;
            return getRandomChar();
          })
          .join('')
      );

      if (revealedCount >= text.length) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        setIsRevealed(true);
      }
    }, revealDelay);
  }, [text, getRandomChar, revealDelay]);

  useEffect(() => {
    if (isActive && !isRevealed) {
      // Start scrambling
      const scrambleInterval = setInterval(scramble, scrambleSpeed);
      
      // After a delay, start revealing
      timeoutRef.current = setTimeout(() => {
        clearInterval(scrambleInterval);
        reveal();
      }, 500);

      return () => {
        clearInterval(scrambleInterval);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    } else if (!isActive) {
      // Reset when not active
      setIsRevealed(false);
      setDisplayText(text);
    }
  }, [isActive, isRevealed, scramble, reveal, scrambleSpeed, text]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <motion.span
      className={`font-mono ${className}`}
      animate={{
        opacity: isActive ? 1 : 0.8,
      }}
    >
      {displayText.split('').map((char, index) => (
        <span
          key={index}
          className={`inline-block transition-all duration-150 ${
            isActive && !isRevealed && char !== text[index]
              ? 'text-amber-400/80'
              : ''
          }`}
          style={{
            textShadow: isActive && !isRevealed && char !== text[index]
              ? '0 0 8px rgba(251, 191, 36, 0.8)'
              : 'none',
          }}
        >
          {char}
        </span>
      ))}
    </motion.span>
  );
}

export default ScrambleText;
